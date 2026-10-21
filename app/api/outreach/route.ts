import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { enrollContactInOutreach, DoNotContactError } from "@/lib/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses = new Set(["active", "parked", "interested", "meeting_booked", "do_not_contact", "completed"]);
const dayOffsets = [0, 1, 2, 4, 6, 7];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
        c.phone, c.status AS contact_status, c.notes AS contact_notes, c.sms_consent
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
      contactStatus: r.contact_status, contactNotes: r.contact_notes, smsConsent: r.sms_consent === true,
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
    if (!uuid.test(contactId)) return jsonError("Contact id must be a valid UUID.", 400);
    const niche = typeof body.niche === "string" ? body.niche.slice(0, 120) : "";
    const painPoint = typeof body.painPoint === "string" ? body.painPoint.slice(0, 1000) : "";
    const researchNotes = typeof body.researchNotes === "string" ? body.researchNotes.slice(0, 5000) : "";
    const sql = db();
    const owned = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
    if (!owned.length) return jsonError("Contact not found.", 404);
    if (body.smsConsentConfirmed === true) {
      await sql`UPDATE public.contacts SET sms_consent = true, sms_consent_at = now(),
        sms_consent_source = 'user_confirmed_in_outreach' , updated_at = now()
        WHERE id = ${contactId}::uuid AND owner_id = ${user.id}`;
    }
    try {
      const outreach = await enrollContactInOutreach(sql, user.id, contactId, niche, painPoint, researchNotes);
      return Response.json({ outreach: { id: outreach.id, contact_id: outreach.contactId, status: outreach.status, current_step: outreach.currentStep, next_action_at: outreach.nextActionAt } }, { status: 201 });
    } catch (e) {
      if (e instanceof DoNotContactError) return jsonError(e.message, 409);
      throw e;
    }
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
    if (!uuid.test(id)) return jsonError("Outreach id must be a valid UUID.", 400);
    const sql = db();
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !statuses.has(body.status)) return jsonError("Invalid outreach status.", 400);
      const before = await sql`
        SELECT id, contact_id, status, current_step FROM public.contact_outreach
        WHERE id = ${id}::uuid AND owner_id = ${user.id} LIMIT 1
      `;
      if (!before.length) return jsonError("Outreach record not found.", 404);
      if (body.status === "active" && (before[0].status === "do_not_contact" || before[0].status === "interested" || before[0].status === "meeting_booked")) {
        return jsonError("This sequence cannot be reactivated after a reply, meeting, or opt-out. Create a new reviewed workflow only if appropriate.", 409);
      }
      if (body.status === "active") {
        const suppressed = await sql`SELECT id FROM public.contact_suppressions WHERE owner_id = ${user.id} AND contact_id = ${before[0].contact_id} LIMIT 1`;
        if (suppressed.length) return jsonError("This contact is permanently suppressed from outreach.", 409);
      }
      const rows = await sql`
        UPDATE public.contact_outreach SET status = ${body.status}, updated_at = now(),
          current_step = CASE WHEN ${body.status} = 'active' AND status = 'parked' THEN 1 ELSE current_step END,
          started_at = CASE WHEN ${body.status} = 'active' AND status = 'parked' THEN now() ELSE started_at END,
          next_action_at = CASE WHEN ${body.status} = 'active' THEN now() ELSE next_action_at END
        WHERE id = ${id}::uuid AND owner_id = ${user.id}
        RETURNING id, contact_id, status, current_step, next_action_at
      `;
      if (!rows.length) return jsonError("Outreach record not found.", 404);
      // Keep the activity timeline truthful even for clients that use the
      // status endpoint directly instead of the outcome form for an opt-out.
      if (body.status === "do_not_contact") {
        await sql`INSERT INTO public.contact_suppressions(owner_id, contact_id, reason, source)
          VALUES (${user.id}, ${before[0].contact_id}, 'do_not_contact', 'outreach_status_action')
          ON CONFLICT (owner_id, contact_id) DO NOTHING`;
      }
      if (body.status === "do_not_contact" && before[0].status !== "do_not_contact") {
        const step = Number(before[0].current_step);
        const channel = step === 3 || step === 5 ? "text" : "call";
        await sql`
          INSERT INTO public.contact_activities
            (owner_id, contact_id, channel, action, outcome, notes, sequence_step)
          VALUES (
            ${user.id}, ${before[0].contact_id},
            ${channel}, ${channel === "text" ? "outbound_text" : "outbound_call"},
            'do_not_contact', 'Marked do-not-contact from outreach status action.', ${step}
          )
        `;
      }
      return Response.json({ outreach: rows[0] });
    }
    const allowedOutcomes = new Set(["initiated", "answered", "connected", "no_answer", "voicemail", "callback_requested", "reply_received", "interested", "meeting_booked", "do_not_contact", "completed", "other"]);
    const outcome = typeof body.outcome === "string" && allowedOutcomes.has(body.outcome) ? body.outcome : "other";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 3000) : "";
    const rows = await sql`
      SELECT o.id, o.contact_id, o.current_step FROM public.contact_outreach o
      WHERE o.id = ${id}::uuid AND o.owner_id = ${user.id} AND o.status = 'active' LIMIT 1
    `;
    if (!rows.length) return jsonError("Active outreach record not found.", 404);
    const record = rows[0];
    const step = Number(record.current_step);
    const contactRows = await sql`SELECT sms_consent FROM public.contacts WHERE id = ${record.contact_id} AND owner_id = ${user.id} LIMIT 1`;
    const hasSmsConsent = contactRows[0]?.sms_consent === true;
    // "not interested / do not contact" suppresses the prospect immediately and
    // permanently (re-enrollment is blocked server-side in enrollContactInOutreach
    // until a deliberate status change) rather than continuing the normal cadence.
    if (outcome === "do_not_contact") {
      await sql`INSERT INTO public.contact_suppressions(owner_id, contact_id, reason, source)
        VALUES (${user.id}, ${record.contact_id}, 'do_not_contact', 'outreach_outcome')
        ON CONFLICT (owner_id, contact_id) DO NOTHING`;
      const updated = await sql`
        UPDATE public.contact_outreach SET status = 'do_not_contact', updated_at = now()
        WHERE id = ${id}::uuid AND owner_id = ${user.id}
        RETURNING id, contact_id, status, current_step, next_action_at
      `;
      const dncChannel = Number(record.current_step) === 3 || Number(record.current_step) === 5 ? "text" : "call";
      const dncAction = dncChannel === "text" ? "outbound_text" : "outbound_call";
      const recentInitiatedDnc = await sql`
        UPDATE public.contact_activities SET outcome = 'do_not_contact',
          notes = CASE WHEN ${notes}::text = '' THEN notes ELSE concat_ws(chr(10), NULLIF(notes, ''), ${notes}::text) END
        WHERE id = (
          SELECT id FROM public.contact_activities
          WHERE owner_id = ${user.id} AND contact_id = ${record.contact_id}
            AND channel = ${dncChannel} AND action = ${dncAction} AND outcome = 'initiated'
            AND sequence_step = ${step} AND occurred_at >= now() - interval '30 minutes'
          ORDER BY occurred_at DESC LIMIT 1
        )
        RETURNING id
      `;
      if (!recentInitiatedDnc.length) {
        await sql`
          INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, sequence_step)
          VALUES (${user.id}, ${record.contact_id}, ${dncChannel}, ${dncAction}, 'do_not_contact', ${notes}, ${step})
        `;
      }
      return Response.json({ outreach: updated[0], finished: true });
    }
    if (!hasSmsConsent && (step === 3 || step === 5)) {
      return jsonError("This SMS step has no recorded consent. Refresh the queue; the sequence should continue with the next call step.", 409);
    }
    let nextStep = step + 1;
    // SMS steps are never drafted or scheduled without recorded explicit consent.
    // Skip them and continue to the next call step; the founder can still record
    // the actual call outcome and the sequence history remains truthful.
    if (!hasSmsConsent && (nextStep === 3 || nextStep === 5)) nextStep += 1;
    const finalStep = step >= 6 || nextStep > 6;
    const stopForResponse = outcome === "meeting_booked" || outcome === "reply_received" || outcome === "interested";
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
        notes = CASE WHEN ${notes}::text = '' THEN notes ELSE concat_ws(chr(10), NULLIF(notes, ''), ${notes}::text) END
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
