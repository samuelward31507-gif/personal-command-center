import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { isCallOutcome, followUpDate, sequenceStatusFor, dealChangeFor, OUTCOME_LABELS } from "@/lib/call-outcomes";
import { suggestDeal } from "@/lib/offers";
import { reportSection } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/**
 * One logged call outcome updates everything it affects, in a single transaction:
 * the activity timeline, the contact's next follow-up, any active outreach sequence
 * (stopped on replies, bookings, close-outs and opt-outs), suppression for
 * do-not-contact, and the linked open deal's stage. Nothing is sent or dialed.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid request body.", 400);
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    if (!uuid.test(contactId)) return fail("Invalid contact id.", 400);
    const rawOutcome: unknown = body.outcome;
    if (!isCallOutcome(rawOutcome)) return fail("Choose a valid call outcome.", 400);
    const outcome = rawOutcome;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 3000) : "";
    const override = typeof body.followUpDate === "string" ? body.followUpDate : null;
    if (override && !/^\d{4}-\d{2}-\d{2}$/.test(override)) return fail("Follow-up date must be YYYY-MM-DD.", 400);

    const sql = db();
    const contact = await sql`SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company,
        (SELECT r.content FROM public.research_artifacts r WHERE r.owner_id = c.owner_id AND r.contact_id = c.id
          AND r.artifact_type = 'audit_prep' AND r.status <> 'archived' ORDER BY r.created_at DESC LIMIT 1) AS audit
      FROM public.contacts c WHERE c.id = ${contactId}::uuid AND c.owner_id = ${user.id} LIMIT 1`;
    if (!contact.length) return fail("Contact not found in your workspace.", 404);

    const nextFollowUp = followUpDate(outcome, new Date(), override);
    const sequenceStatus = sequenceStatusFor(outcome);
    const openDeals = await sql`SELECT id, title, stage FROM public.deals
      WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND stage NOT IN ('won','lost')`;
    const dealChanges = openDeals
      .map(d => ({ id: String(d.id), title: String(d.title), from: String(d.stage), change: dealChangeFor(outcome, String(d.stage)) }))
      .filter((d): d is { id: string; title: string; from: string; change: { stage: string; lostReason?: string } } => d.change !== null);

    const queries = [
      // Attach the outcome to the call launched in the last 30 minutes, or record a new call.
      sql`WITH upd AS (
          UPDATE public.contact_activities SET outcome = ${outcome},
            notes = CASE WHEN ${notes}::text = '' THEN notes ELSE concat_ws(chr(10), NULLIF(notes, ''), ${notes}::text) END
          WHERE id = (SELECT id FROM public.contact_activities
            WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND channel = 'call'
              AND action = 'outbound_call' AND outcome = 'initiated' AND occurred_at >= now() - interval '30 minutes'
            ORDER BY occurred_at DESC LIMIT 1)
          RETURNING id, contact_id, channel, action, outcome, notes, sequence_step, occurred_at)
        , ins AS (
          INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
          SELECT ${user.id}, ${contactId}::uuid, 'call', 'outbound_call', ${outcome}, ${notes}
          WHERE NOT EXISTS (SELECT 1 FROM upd)
          RETURNING id, contact_id, channel, action, outcome, notes, sequence_step, occurred_at)
        SELECT * FROM upd UNION ALL SELECT * FROM ins`,
      sql`UPDATE public.contacts SET follow_up_at = ${nextFollowUp}::date, updated_at = now()
        WHERE id = ${contactId}::uuid AND owner_id = ${user.id}`,
    ];
    if (outcome === "do_not_contact") {
      queries.push(sql`INSERT INTO public.contact_suppressions(owner_id, contact_id, email_normalized, phone_normalized, reason, source)
        SELECT c.owner_id, c.id, lower(trim(c.email)), regexp_replace(c.phone, '[^0-9]', '', 'g'), 'do_not_contact', 'call_outcome'
        FROM public.contacts c WHERE c.id = ${contactId}::uuid AND c.owner_id = ${user.id}
        ON CONFLICT DO NOTHING`);
      queries.push(sql`UPDATE public.contact_outreach SET status = 'do_not_contact', updated_at = now()
        WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status <> 'do_not_contact'
        RETURNING id, status`);
    } else if (sequenceStatus) {
      queries.push(sql`UPDATE public.contact_outreach SET status = ${sequenceStatus}, updated_at = now()
        WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status = 'active'
        RETURNING id, status`);
    }
    for (const d of dealChanges) {
      // Guard on the stage we read so a concurrent edit is never overwritten.
      queries.push(sql`UPDATE public.deals SET stage = ${d.change.stage},
          lost_reason = CASE WHEN ${d.change.lostReason ?? null}::text IS NULL THEN lost_reason ELSE ${d.change.lostReason ?? ""} END,
          updated_at = now()
        WHERE id = ${d.id}::uuid AND owner_id = ${user.id} AND stage = ${d.from}
        RETURNING id`);
    }

    const results = await sql.transaction(queries);
    const activity = (results[0] as Record<string, unknown>[])[0] ?? null;
    const sequenceRows = results.length > 2 && (outcome === "do_not_contact" || sequenceStatus) ? (results[outcome === "do_not_contact" ? 3 : 2] as unknown[]) : [];
    const dealOffset = results.length - dealChanges.length;
    const movedDeals = dealChanges.filter((_, i) => (results[dealOffset + i] as unknown[]).length > 0)
      .map(d => ({ id: d.id, title: d.title, from: d.from, to: d.change.stage }));

    // Interest with no open deal: hand back a prefilled deal the founder can create in one tap.
    let suggestedDeal = null;
    if ((outcome === "interested" || outcome === "meeting_booked") && openDeals.length === 0) {
      const audit = typeof contact[0].audit === "string" ? contact[0].audit : "";
      const verdict = reportSection(audit, "Verdict") || reportSection(audit, "1\\. Executive verdict") || null;
      suggestedDeal = { contactId, ...suggestDeal({ name: String(contact[0].name ?? ""), company: String(contact[0].company ?? "") }, verdict, outcome) };
    }

    return Response.json({
      outcome, label: OUTCOME_LABELS[outcome], activity, nextFollowUp, suggestedDeal,
      sequenceStopped: sequenceRows.length > 0 ? sequenceStatus : null,
      suppressed: outcome === "do_not_contact",
      deals: movedDeals,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Call outcome failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return fail("Could not log this call outcome. Nothing was changed.", 500);
  }
}
