import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { isStop } from "@/lib/sms-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOP_RE = "\\m(stop|stopall|unsubscribe)\\M";
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/**
 * Logs a text Sam sent from his own phone (outbound, after "Mark sent") or a reply the prospect sent (inbound).
 * Nothing is sent from here. An inbound STOP / unsubscribe marks the contact do not contact on the spot.
 * body: { contactId, direction: "outbound" | "inbound", template?: "T-VM" | "T-INFO", body }
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const b = await request.json().catch(() => null);
    if (!b || typeof b !== "object") return fail("Invalid request body.", 400);
    const contactId = typeof b.contactId === "string" ? b.contactId : "";
    if (!uuid.test(contactId)) return fail("Invalid contact id.", 400);
    const direction = b.direction === "inbound" ? "inbound" : b.direction === "outbound" ? "outbound" : null;
    if (!direction) return fail("Direction must be inbound or outbound.", 400);
    const template = b.template === "T-VM" || b.template === "T-INFO" ? b.template : "";
    const text = typeof b.body === "string" ? b.body.trim().slice(0, 2000) : "";
    if (!text) return fail("The message is empty.", 400);

    const sql = db();
    const rows = await sql`SELECT c.id,
        (SELECT s.reason FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id
          AND (s.contact_id = c.id OR (s.phone_normalized <> '' AND s.phone_normalized = regexp_replace(c.phone, '[^0-9]', '', 'g'))) LIMIT 1) AS suppressed,
        EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.action = 'inbound_text'
          AND a.notes ~* ${STOP_RE}) AS replied_stop,
        (SELECT min(a.occurred_at) FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id
          AND a.action = 'outbound_text' AND a.template = 'T-VM') AS vm_sent_at
      FROM public.contacts c WHERE c.id = ${contactId}::uuid AND c.owner_id = ${user.id} LIMIT 1`;
    if (!rows.length) return fail("Contact not found in your workspace.", 404);
    const c = rows[0];

    if (direction === "outbound") {
      if (c.replied_stop) return fail("They replied STOP. Don't text them.", 409);
      if (c.suppressed) return fail("This contact is marked do not contact.", 409);
      if (template === "T-VM" && c.vm_sent_at) return fail("A voicemail text was already sent to this contact. Call instead.", 409);
      const [act] = await sql.transaction([
        sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, template)
          VALUES (${user.id}, ${contactId}::uuid, 'text', 'outbound_text', 'completed', ${text}, ${template})
          RETURNING id, contact_id, channel, action, outcome, notes, template, occurred_at`,
        sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${contactId}::uuid AND owner_id = ${user.id}`,
      ]);
      return Response.json({ activity: (act as unknown[])[0] ?? null, doNotContact: false }, { status: 201 });
    }

    // Inbound reply. STOP / unsubscribe → do not contact, stop outreach, cancel open reminders.
    const stop = isStop(text);
    const queries = [
      sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
        VALUES (${user.id}, ${contactId}::uuid, 'text', 'inbound_text', 'reply_received', ${text})
        RETURNING id, contact_id, channel, action, outcome, notes, template, occurred_at`,
    ];
    if (stop) {
      queries.push(
        sql`INSERT INTO public.contact_suppressions(owner_id, contact_id, email_normalized, phone_normalized, reason, source)
          SELECT c.owner_id, c.id, lower(trim(c.email)), regexp_replace(c.phone, '[^0-9]', '', 'g'), 'do_not_contact', 'stop_reply'
          FROM public.contacts c WHERE c.id = ${contactId}::uuid AND c.owner_id = ${user.id}
          ON CONFLICT DO NOTHING`,
        sql`UPDATE public.contact_outreach SET status = 'do_not_contact', updated_at = now()
          WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status <> 'do_not_contact'`,
        sql`UPDATE public.tasks SET status = 'cancelled', updated_at = now()
          WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status IN ('todo','in_progress')`,
        sql`UPDATE public.contacts SET follow_up_at = NULL, updated_at = now() WHERE id = ${contactId}::uuid AND owner_id = ${user.id}`,
      );
    }
    const results = await sql.transaction(queries);
    return Response.json({ activity: (results[0] as unknown[])[0] ?? null, doNotContact: stop }, { status: 201 });
  } catch (error) {
    console.error("Text log failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return fail("Could not log that text. Nothing was changed.", 500);
  }
}
