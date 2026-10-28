import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const channels = new Set(["call", "text", "note"]);
const actions = new Set(["outbound_call", "outbound_text", "note"]);
const outcomes = new Set(["initiated", "answered", "connected", "no_answer", "voicemail", "callback_requested", "reply_received", "interested", "meeting_booked", "not_a_fit", "wrong_contact", "do_not_contact", "completed", "other"]);

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  const session = result?.data?.session;
  const user = result?.data?.user;
  if (!session || !user?.id) return null;
  return { id: String(user.id) };
}
function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const sql = db();
    const rows = contactId
      ? await sql`SELECT id, contact_id, channel, action, outcome, notes, sequence_step, occurred_at FROM public.contact_activities WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid ORDER BY occurred_at DESC LIMIT 100`
      : await sql`SELECT id, contact_id, channel, action, outcome, notes, sequence_step, occurred_at FROM public.contact_activities WHERE owner_id = ${user.id} ORDER BY occurred_at DESC LIMIT 250`;
    return Response.json({ activities: rows });
  } catch (error) {
    console.error("CRM call log GET failed", error);
    return jsonError("Unable to load activity history.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    const channel = typeof body.channel === "string" ? body.channel : "";
    const action = typeof body.action === "string" ? body.action : "";
    const outcome = typeof body.outcome === "string" ? body.outcome : "initiated";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : "";
    const sequenceStep = Number.isInteger(body.sequenceStep) && body.sequenceStep >= 1 && body.sequenceStep <= 6 ? body.sequenceStep : null;
    if (!contactId) return jsonError("Contact id is required.", 400);
    if (!channels.has(channel) || !actions.has(action) || !outcomes.has(outcome)) return jsonError("Invalid activity details.", 400);
    const sql = db();
    const owned = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
    if (!owned.length) return jsonError("Contact not found.", 404);
    const rows = await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, sequence_step) VALUES (${user.id}, ${contactId}::uuid, ${channel}, ${action}, ${outcome}, ${notes}, ${sequenceStep}) RETURNING id, contact_id, channel, action, outcome, notes, sequence_step, occurred_at`;
    return Response.json({ activity: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("CRM call log POST failed", error);
    return jsonError("Unable to save activity.", 500);
  }
}
