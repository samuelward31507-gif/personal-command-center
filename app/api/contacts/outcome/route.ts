import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { isCallOutcome, followUpDate, sequenceStatusFor, dealChangeFor, OUTCOME_LABELS, NO_CONTACT, ATTEMPT_LIMIT } from "@/lib/call-outcomes";
import { suggestDeal } from "@/lib/offers";
import { offersFrom } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";
import { reportSection } from "@/lib/business-audit";
import { planFor, resolveTimeZone, nicheFor, demoLinkFor, localDate, DEFAULT_SLOTS } from "@/lib/sms-templates";
import { timeZoneFor, timeZoneForPhone } from "@/lib/local-time";
import { contactFirstName } from "@/lib/call-drafts";
import { sendColdEmail } from "@/lib/gmail-send";
import { fillTemplate, mergeFor, TEMPLATE_SETS, trackOf } from "@/lib/email-outreach";
import { insertLine, fullSendFor, MISSED_CALL_LINE } from "@/lib/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Postgres word-boundary match for opt-out replies (same words as isStop in lib/sms-templates).
const STOP_RE = "\\m(stop|stopall|unsubscribe)\\M";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    const contact = await sql`SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company, c.first_name,
        c.phone, c.location, c.time_zone, c.notes, c.email, c.website,
        EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND (a.notes LIKE 'Email sent: %' OR a.notes LIKE 'Email reply:%' OR a.notes LIKE 'Email bounced:%')) AS emailed,
        COALESCE(NULLIF(c.niche, ''), (SELECT o.niche FROM public.contact_outreach o WHERE o.owner_id = c.owner_id AND o.contact_id = c.id ORDER BY o.updated_at DESC LIMIT 1)) AS niche,
        (SELECT s.reason FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id
          AND (s.contact_id = c.id OR (s.phone_normalized <> '' AND s.phone_normalized = regexp_replace(c.phone, '[^0-9]', '', 'g'))) LIMIT 1) AS suppressed,
        EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.action = 'inbound_text'
          AND a.notes ~* ${STOP_RE}) AS replied_stop,
        (SELECT min(a.occurred_at) FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id
          AND a.action = 'outbound_text' AND a.template = 'T-VM') AS vm_sent_at,
        (SELECT count(*)::int FROM public.tasks t WHERE t.owner_id = c.owner_id AND t.contact_id = c.id AND t.title LIKE 'Redial%'
          AND t.status IN ('todo','in_progress')) AS open_redials,
        (SELECT r.content FROM public.research_artifacts r WHERE r.owner_id = c.owner_id AND r.contact_id = c.id
          AND r.artifact_type = 'audit_prep' AND r.status <> 'archived' ORDER BY r.created_at DESC LIMIT 1) AS audit
      FROM public.contacts c WHERE c.id = ${contactId}::uuid AND c.owner_id = ${user.id} LIMIT 1`;
    if (!contact.length) return fail("Contact not found in your workspace.", 404);

    // No-contact attempts in a row (this one included). The fifth parks the lead for a month.
    let attempts = 0;
    if (NO_CONTACT.includes(outcome)) {
      const prior = await sql`SELECT outcome FROM public.contact_activities
        WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND action = 'outbound_call' AND outcome <> 'initiated'
        ORDER BY occurred_at DESC LIMIT 20`;
      let n = 0;
      for (const r of prior) { if (NO_CONTACT.includes(String(r.outcome) as never)) n++; else break; }
      attempts = n + 1;
    }
    // Consecutive plain no-answers (this one included) drive the redial plan: day 3, day 7, then close.
    let noAnswers = 0;
    if (outcome === "no_answer") {
      const prior = await sql`SELECT outcome FROM public.contact_activities
        WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND action = 'outbound_call' AND outcome <> 'initiated'
        ORDER BY occurred_at DESC LIMIT 10`;
      let k = 0;
      for (const r of prior) { if (String(r.outcome) === "no_answer") k++; else break; }
      noAnswers = k + 1;
    }
    const c0 = contact[0];
    const now = new Date();
    const tz = resolveTimeZone({ timeZone: String(c0.time_zone ?? ""), location: String(c0.location ?? ""), phone: String(c0.phone ?? "") }, timeZoneFor, timeZoneForPhone);
    const suppressedWhy = c0.replied_stop ? "they replied STOP" : c0.suppressed ? "marked do not contact" : null;
    const vmSentAt = c0.vm_sent_at ? new Date(String(c0.vm_sent_at)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" }) : null;
    const plan = planFor(outcome, { now, tz, suppressed: suppressedWhy, vmSentAt, consecutiveNoAnswers: noAnswers, hasOpenRedials: Number(c0.open_redials ?? 0) > 0 });
    const parked = NO_CONTACT.includes(outcome) && attempts >= ATTEMPT_LIMIT;
    if (parked) { plan.tasks = []; plan.followUp = undefined; }
    // followUpDate counts from the UTC date; after ~5pm Mountain that is already tomorrow, which pushed
    // follow-ups a day late. Count from Sam's local date instead (the same "today" My Day uses).
    const localToday = new Date(localDate(now, null) + "T12:00:00Z");
    const nextFollowUp = override || plan.followUp === undefined ? followUpDate(outcome, localToday, override, attempts) : plan.followUp;
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
    } else {
      // The call happened: push any running sequence's next touch to the follow-up date, so the
      // contact doesn't come straight back up in Call mode as "due" after you've already called them.
      queries.push(nextFollowUp
        ? sql`UPDATE public.contact_outreach SET next_action_at = (${nextFollowUp}::date + time '14:00') AT TIME ZONE 'UTC', updated_at = now()
            WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status = 'active'`
        : sql`UPDATE public.contact_outreach SET status = 'completed', updated_at = now()
            WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status = 'active'`);
    }
    // Tasks: call back / redials / info follow-ups, due 9:30am the prospect's time. Never duplicated.
    for (const t of plan.tasks) {
      queries.push(sql`INSERT INTO public.tasks (owner_id, title, description, due_at, contact_id, priority)
        SELECT ${user.id}, ${t.title}, ${`${String(c0.company || c0.name || "")} · after "${OUTCOME_LABELS[outcome]}"`}, ${t.due.toISOString()}::timestamptz, ${contactId}::uuid, 'medium'
        WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid
          AND title = ${t.title} AND status IN ('todo','in_progress'))`);
    }
    if (plan.completeRedials > 0) {
      queries.push(sql`UPDATE public.tasks SET status = 'done', updated_at = now()
        WHERE id IN (SELECT id FROM public.tasks WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid
          AND title LIKE 'Redial%' AND status IN ('todo','in_progress') ORDER BY due_at LIMIT ${plan.completeRedials})`);
    }
    if (!NO_CONTACT.includes(outcome)) {
      // Reached them (or closed them out): open call-back and redial reminders are moot.
      queries.push(sql`UPDATE public.tasks SET status = 'cancelled', updated_at = now()
        WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND status IN ('todo','in_progress')
          AND (title = 'Call back' OR title LIKE 'Redial%')`);
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
      const draft = suggestDeal({ name: String(contact[0].name ?? ""), company: String(contact[0].company ?? "") }, verdict, outcome, offersFrom(await loadWorkspace(user.id)));
      // A booked meeting or real interest always lands in the pipeline; no extra tap to forget.
      // Guarded so double-taps never create two open deals for the same contact.
      const created = await sql`INSERT INTO public.deals (owner_id, contact_id, title, service_type, stage, setup_fee, monthly_fee, source, notes, agreement_status)
        SELECT ${user.id}, ${contactId}::uuid, ${draft.title}, ${draft.serviceType}, ${draft.stage}, ${draft.setupFee}, ${draft.monthlyFee}, 'Call outcome', ${notes}, 'pending'
        WHERE NOT EXISTS (SELECT 1 FROM public.deals WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid AND stage NOT IN ('won','lost'))
        RETURNING id, title, stage`;
      if (created.length) movedDeals.push({ id: String(created[0].id), title: String(created[0].title), from: "none", to: String(created[0].stage) });
      else suggestedDeal = { contactId, ...draft };
    }
    if (outcome === "interested" || outcome === "meeting_booked") {
      await sql`UPDATE public.contacts SET status = 'contact', updated_at = now()
        WHERE id = ${contactId}::uuid AND owner_id = ${user.id} AND status = 'lead'`;
    }

    // What to draft. Cinder never sends: the panel lets Sam edit, copy, open Messages or skip.
    const firstName = String(c0.first_name ?? "").trim() ? contactFirstName(String(c0.first_name), String(c0.company ?? "")) : "";
    const text = {
      template: plan.template, notice: plan.notice,
      firstName, timeZone: tz, callAt: activity && typeof activity === "object" && "occurred_at" in activity ? String((activity as Record<string, unknown>).occurred_at) : now.toISOString(),
      niche: nicheFor(String(c0.niche ?? ""), String(c0.company ?? ""), String(c0.notes ?? "")),
      demoLink: demoLinkFor(nicheFor(String(c0.niche ?? ""), String(c0.company ?? ""), String(c0.notes ?? ""))),
      phone: String(c0.phone ?? ""), slots: [...DEFAULT_SLOTS],
      tasks: plan.tasks.map(t => ({ title: t.title, due: t.due.toISOString() })), closed: plan.close,
    };

    // Full send: missed the owner, so the intro email lands while the missed call is still on their phone.
    // Same checks as every cold email (suppression, inbox caps, mailing address); a failure never fails the log.
    let emailed: { from: string } | { error: string } | null = null;
    const email = String(c0.email ?? "").trim();
    if (!parked && !suppressedWhy && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) && fullSendFor(outcome, attempts, !!c0.emailed)) {
      try {
        const ws = await loadWorkspace(user.id);
        if (ws.address.trim()) {
          const t = TEMPLATE_SETS[trackOf(String(c0.niche ?? ""))].intro;
          const m = mergeFor({ name: String(c0.name ?? ""), company: String(c0.company ?? ""), location: String(c0.location ?? "") }, ws);
          const r = await sendColdEmail(sql, user.id, ws, { contactId, step: "intro", subject: fillTemplate(t.subject, m), body: insertLine(fillTemplate(t.body, m), MISSED_CALL_LINE) });
          emailed = r.ok ? { from: r.from } : { error: r.error };
        }
      } catch (e) { emailed = { error: e instanceof Error ? e.message.slice(0, 120) : "Email failed." }; }
    }

    return Response.json({
      outcome, label: OUTCOME_LABELS[outcome], activity, emailed, nextFollowUp, suggestedDeal, attempts, parked: attempts >= ATTEMPT_LIMIT, text,
      sequenceStopped: sequenceRows.length > 0 ? sequenceStatus : null,
      suppressed: outcome === "do_not_contact",
      deals: movedDeals,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Call outcome failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return fail("Could not log this call outcome. Nothing was changed.", 500);
  }
}
