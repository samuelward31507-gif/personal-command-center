import { neon } from "@neondatabase/serverless";
import { sendAlert } from "@/lib/notify";
import { consentLine, inboundTask, notesFor, phoneDigits, sourceFor, validateInbound } from "@/lib/inbound";
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
          sms_consent = sms_consent OR ${lead.smsConsent},
          sms_consent_at = CASE WHEN ${lead.smsConsent} AND NOT sms_consent THEN now() ELSE sms_consent_at END,
          sms_consent_source = CASE WHEN ${lead.smsConsent} AND NOT sms_consent THEN 'website_form' ELSE sms_consent_source END,
          updated_at = now()
        WHERE id = ${contactId}::uuid AND owner_id = ${owner}`;
    } else {
      const rows = await sql`
        INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, follow_up_at, website, sms_consent, sms_consent_at, sms_consent_source)
        VALUES (${owner}, ${first ?? ""}, ${rest.join(" ")}, ${lead.company}, ${lead.email}, ${lead.phone}, 'lead', ${sourceFor(lead)}, ${notesFor(lead, now)}, ${today}::date, ${lead.website},
          ${lead.smsConsent}, ${lead.smsConsent ? now.toISOString() : null}::timestamptz, ${lead.smsConsent ? "website_form" : ""})
        RETURNING id`;
      contactId = String(rows[0].id);
    }
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${owner}, ${contactId}::uuid, 'note', 'note', 'other', ${("Submitted the website form. " + notesFor(lead, now)).slice(0, 3000)})`;
    const task = inboundTask(lead);
    await sql`INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id)
      VALUES (${owner}, ${task.title}, ${task.description}, 'todo', 'urgent', now(), ${contactId}::uuid)`;
    console.info("Inbound lead captured", { existing: existing.length > 0 });
    const speed = lead.offer === "speed-test";
    await sendAlert({ subject: speed ? `Speed test request: ${lead.company}` : `New lead: ${lead.company}`, lines: [
      speed ? `${lead.name} from ${lead.company} asked for the free speed test (${lead.website}).` : `${lead.name} from ${lead.company} just filled out your form.`,
      [lead.phone && `Phone: ${lead.phone}`, lead.email && `Email: ${lead.email}`].filter(Boolean).join(" · "),
      [lead.trade && `Trade: ${lead.trade}`, lead.leadVolume && `Leads/month: ${lead.leadVolume}`].filter(Boolean).join(" · "),
      lead.challenge ? `Biggest headache: ${lead.challenge.slice(0, 300)}` : "",
      speed ? "Run the test, then send them the result within 48 hours." : "Speed wins. Call within 5 minutes if you can.",
      consentLine(lead),
    ].filter(Boolean), link: { label: "Open in Cinder", path: `/crm?contact=${contactId}` } });
    return reply({ ok: true });
  } catch (error) {
    console.error("Inbound lead failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return reply({ error: "Something went wrong saving that. Please try again or email us." }, 500);
  }
}
