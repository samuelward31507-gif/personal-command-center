import { neon } from "@neondatabase/serverless";
import { notesFor, phoneDigits, sourceFor, validateInbound } from "@/lib/inbound";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/inbound-lead — public intake for Cinder's lead form (/start).
 * Creates (or updates) a contact for the workspace owner in CINDER_OWNER_ID, marks a same-day follow-up and an
 * urgent "call them" task. Never sends a message or places a call.
 */
export async function POST(request: Request) {
  const owner = process.env.CINDER_OWNER_ID?.trim();
  if (!owner || !process.env.DATABASE_URL) {
    console.error("Inbound lead rejected: intake not configured", { hasOwner: !!owner, hasDb: !!process.env.DATABASE_URL });
    return reply({ error: "This form isn't accepting submissions right now. Please email us instead." }, 503);
  }
  const body = await request.json().catch(() => null);
  const lead = validateInbound(body);
  if (lead === "spam") return reply({ ok: true });
  if ("error" in lead) return reply({ error: lead.error }, 400);

  try {
    const sql = neon(process.env.DATABASE_URL);
    const now = new Date();
    const digits = lead.phone ? phoneDigits(lead.phone) : "";
    const existing = await sql`
      SELECT id FROM public.contacts
      WHERE owner_id = ${owner} AND (
        (${lead.email} <> '' AND lower(email) = ${lead.email}) OR
        (${digits} <> '' AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = ${digits.slice(-10)}))
      ORDER BY updated_at DESC LIMIT 1`;
    const [first, ...rest] = lead.name.split(/\s+/);
    const today = now.toISOString().slice(0, 10);
    let contactId: string;
    if (existing.length) {
      contactId = String(existing[0].id);
      await sql`UPDATE public.contacts SET follow_up_at = LEAST(COALESCE(follow_up_at, ${today}::date), ${today}::date),
          phone = CASE WHEN coalesce(phone,'') = '' THEN ${lead.phone} ELSE phone END,
          email = CASE WHEN coalesce(email,'') = '' THEN ${lead.email} ELSE email END,
          website = CASE WHEN coalesce(website,'') = '' THEN ${lead.website} ELSE website END,
          updated_at = now()
        WHERE id = ${contactId}::uuid AND owner_id = ${owner}`;
    } else {
      const rows = await sql`
        INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, follow_up_at, website)
        VALUES (${owner}, ${first ?? ""}, ${rest.join(" ")}, ${lead.company}, ${lead.email}, ${lead.phone}, 'lead', ${sourceFor(lead)}, ${notesFor(lead, now)}, ${today}::date, ${lead.website})
        RETURNING id`;
      contactId = String(rows[0].id);
    }
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${owner}, ${contactId}::uuid, 'note', 'note', 'other', ${("Submitted the website form. " + notesFor(lead, now)).slice(0, 3000)})`;
    await sql`INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id)
      VALUES (${owner}, ${("Call new inbound lead: " + lead.company).slice(0, 240)}, ${"They filled out your form. Speed wins: call within 5 minutes if you can.\n" + (lead.phone ? "Phone: " + lead.phone : "Email: " + lead.email)}, 'todo', 'urgent', now(), ${contactId}::uuid)`;
    console.info("Inbound lead captured", { existing: existing.length > 0 });
    return reply({ ok: true });
  } catch (error) {
    console.error("Inbound lead failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return reply({ error: "Something went wrong saving that. Please try again or email us." }, 500);
  }
}
