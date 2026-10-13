import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses = new Set(["active", "parked", "interested", "meeting_booked", "do_not_contact", "completed"]);
const dayOffsets = [0, 1, 2, 4, 6, 7];
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
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const sql = db();
    const rows = await sql`
      SELECT o.id AS outreach_id, o.contact_id, o.status AS outreach_status,
        o.current_step, o.started_at, o.next_action_at, o.niche, o.pain_point,
        o.research_notes, c.first_name, c.last_name, c.company, c.role, c.email,
        c.phone, c.status AS contact_status, c.notes AS contact_notes
      FROM public.contact_outreach o
      JOIN public.contacts c ON c.id = o.contact_id AND c.owner_id = o.owner_id
      WHERE o.owner_id = ${user.id}
      ORDER BY CASE WHEN o.status = 'active' AND o.next_action_at <= now() THEN 0 ELSE 1 END,
        o.next_action_at ASC, o.created_at DESC
      LIMIT 500
    `;
    return Response.json({ outreach: rows.map((r: Record<string, unknown>) => ({
      id: r.outreach_id, contactId: r.contact_id, status: r.outreach_status,
      currentStep: Number(r.current_step), startedAt: r.started_at,
      nextActionAt: r.next_action_at, niche: r.niche, painPoint: r.pain_point,
      researchNotes: r.research_notes,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "),
      company: r.company, role: r.role, email: r.email, phone: r.phone,
      contactStatus: r.contact_status, contactNotes: r.contact_notes,
    })) });
  } catch (error) {
    console.error("CRM outreach GET failed", error);
    return jsonError("Unable to load outreach queue.", 500);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    if (!contactId) return jsonError("Contact id is required.", 400);
    const niche = typeof body.niche === "string" ? body.niche.slice(0, 120) : "";
    const painPoint = typeof body.painPoint === "string" ? body.painPoint.slice(0, 1000) : "";
    const researchNotes = typeof body.researchNotes === "string" ? body.researchNotes.slice(0, 5000) : "";
    const sql = db();
    const owned = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
    if (!owned.length) return jsonError("Contact not found.", 404);
    const existing = await sql`
      SELECT status FROM public.contact_outreach
      WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid LIMIT 1
    `;
    if (existing[0]?.status === "do_not_contact") {
      return jsonError("This prospect is marked do not contact and cannot be re-enrolled.", 409);
    }
    const rows = await sql`
      INSERT INTO public.contact_outreach (owner_id, contact_id, niche, pain_point, research_notes, started_at, next_action_at)
      VALUES (${user.id}, ${contactId}::uuid, ${niche}, ${painPoint}, ${researchNotes}, now(), now())
      ON CONFLICT (owner_id, contact_id) DO UPDATE SET
        niche = EXCLUDED.niche, pain_point = EXCLUDED.pain_point,
        research_notes = EXCLUDED.research_notes,
        status = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN 'active' ELSE public.contact_outreach.status END,
        current_step = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN 1 ELSE public.contact_outreach.current_step END,
        started_at = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN now() ELSE public.contact_outreach.started_at END,
        next_action_at = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN now() ELSE public.contact_outreach.next_action_at END,
        updated_at = now()
      RETURNING id, contact_id, status, current_step, next_action_at
    `;
    return Response.json({ outreach: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("CRM outreach POST failed", error);
    return jsonError("Unable to add prospect to outreach.", 500);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return jsonError("Outreach id is required.", 400);
    const sql = db();
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !statuses.has(body.status)) return jsonError("Invalid outreach status.", 400);
      const rows = await sql`
        UPDATE public.contact_outreach SET status = ${body.status}, updated_at = now(),
          current_step = CASE WHEN ${body.status} = 'active' AND status = 'parked' THEN 1 ELSE current_step END,
          started_at = CASE WHEN ${body.status} = 'active' AND status = 'parked' THEN now() ELSE started_at END,
          next_action_at = CASE WHEN ${body.status} = 'active' THEN now() ELSE next_action_at END
        WHERE id = ${id}::uuid AND owner_id = ${user.id}
        RETURNING id, contact_id, status, current_step, next_action_at
      `;
      if (!rows.length) return jsonError("Outreach record not found.", 404);
      return Response.json({ outreach: rows[0] });
    }
    const allowedOutcomes = new Set(["initiated", "answered", "no_answer", "voicemail", "reply_received", "meeting_booked", "completed", "other"]);
    const outcome = typeof body.outcome === "string" && allowedOutcomes.has(body.outcome) ? body.outcome : "other";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 3000) : "";
    const rows = await sql`
      SELECT o.id, o.contact_id, o.current_step FROM public.contact_outreach o
      WHERE o.id = ${id}::uuid AND o.owner_id = ${user.id} AND o.status = 'active' LIMIT 1
    `;
    if (!rows.length) return jsonError("Active outreach record not found.", 404);
    const record = rows[0];
    const step = Number(record.current_step);
    const nextStep = step + 1;
    const finalStep = step >= 6;
    const stopForResponse = outcome === "meeting_booked" || outcome === "reply_received";
    const nextStatus = stopForResponse ? (outcome === "meeting_booked" ? "meeting_booked" : "interested") : finalStep ? "parked" : "active";
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (dayOffsets[Math.min(nextStep - 1, 5)] - dayOffsets[step - 1]));
    const updated = await sql`
      UPDATE public.contact_outreach SET
        current_step = CASE WHEN ${finalStep} OR ${stopForResponse} THEN current_step ELSE ${nextStep} END,
        status = ${nextStatus},
        next_action_at = CASE WHEN ${finalStep} OR ${stopForResponse} THEN next_action_at ELSE ${nextDate.toISOString()}::timestamptz END,
        updated_at = now()
      WHERE id = ${id}::uuid AND owner_id = ${user.id}
      RETURNING id, contact_id, status, current_step, next_action_at
    `;
    const channel = Number(record.current_step) === 3 || Number(record.current_step) === 5 ? "text" : "call";
    const action = channel === "text" ? "outbound_text" : "outbound_call";
    const recentInitiated = await sql`
      UPDATE public.contact_activities SET outcome = ${outcome},
        notes = CASE WHEN ${notes} = '' THEN notes ELSE concat_ws(chr(10), NULLIF(notes, ''), ${notes}) END
      WHERE id = (
        SELECT id FROM public.contact_activities
        WHERE owner_id = ${user.id} AND contact_id = ${record.contact_id}
          AND channel = ${channel} AND action = ${action} AND outcome = 'initiated'
          AND sequence_step = ${step} AND occurred_at >= now() - interval '30 minutes'
        ORDER BY occurred_at DESC LIMIT 1
      )
      RETURNING id
    `;
    if (!recentInitiated.length) {
      await sql`
        INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, sequence_step)
        VALUES (${user.id}, ${record.contact_id}, ${channel}, ${action}, ${outcome}, ${notes}, ${step})
      `;
    }
    return Response.json({ outreach: updated[0], finished: finalStep || stopForResponse });
  } catch (error) {
    console.error("CRM outreach PATCH failed", error);
    return jsonError("Unable to update outreach step.", 500);
  }
}
