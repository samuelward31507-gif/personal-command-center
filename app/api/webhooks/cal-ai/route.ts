import { unwrapCalAiPayload, validCalAiEmail, verifyCalAiSignature, validCalAiDate } from "@/lib/cal-ai-webhook";
import { sendAlert } from "@/lib/notify";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { bookingPerson, bookingAnswers, splitName, stageAfterBooking, stageAfterMeeting, localDate, lastTenDigits } from "@/lib/cal-booking";
import { suggestOffer } from "@/lib/offers";
import { offersFrom } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Person = { email?: unknown; name?: unknown; phone?: unknown };
type BookingPayload = {
  triggerEvent?: unknown;
  type?: unknown;
  uid?: unknown;
  rescheduleUid?: unknown;
  title?: unknown;
  description?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  attendees?: unknown;
  organizer?: unknown;
  cancellationReason?: unknown;
  createdAt?: unknown;
  metadata?: unknown;
  responses?: unknown;
};

type Sql = NeonQueryFunction<false, false>;
const TZ = () => process.env.CINDER_TIMEZONE?.trim() || "America/Denver";

/** The contact's open deal (newest first), if any. */
async function openDeal(sql: Sql, ownerId: string, contactId: string) {
  const rows = await sql`SELECT id, stage, next_step FROM public.deals WHERE owner_id = ${ownerId} AND contact_id = ${contactId}::uuid AND stage NOT IN ('won','lost') ORDER BY updated_at DESC LIMIT 1`;
  return rows[0] ? { id: String(rows[0].id), stage: String(rows[0].stage) } : null;
}

/**
 * A booking means a sales conversation: make sure there's an open deal at Meeting booked with
 * the call as its next step, link the meeting to it, and leave a prep task. Idempotent on retries.
 */
async function bookingToDeal(sql: Sql, ownerId: string, contactId: string, who: string, uid: string, startsIso: string, created: boolean) {
  const day = localDate(startsIso, TZ());
  let deal = await openDeal(sql, ownerId, contactId);
  if (!deal && created) {
    const offer = suggestOffer(who, null, offersFrom(await loadWorkspace(ownerId)));
    const rows = await sql`
      INSERT INTO public.deals (owner_id, contact_id, title, service_type, stage, setup_fee, monthly_fee, source, notes, next_step, next_step_at)
      VALUES (${ownerId}, ${contactId}::uuid, ${`${who || "New lead"} — ${offer.label}`.slice(0, 240)}, ${offer.serviceType}, 'meeting_booked',
        ${offer.setupFee}, ${offer.monthlyFee}, 'Cal.com booking', 'Booked a call through Cal.com.', 'Discovery call', ${day}::date)
      RETURNING id, stage`;
    deal = { id: String(rows[0].id), stage: "meeting_booked" };
  } else if (deal) {
    const next = stageAfterBooking(deal.stage);
    await sql`UPDATE public.deals SET stage = COALESCE(${next}, stage), next_step = 'Discovery call', next_step_at = ${day}::date, updated_at = now()
      WHERE id = ${deal.id}::uuid AND owner_id = ${ownerId} AND stage NOT IN ('won','lost')`;
  }
  if (deal) await sql`UPDATE public.calendar_events SET deal_id = ${deal.id}::uuid WHERE owner_id = ${ownerId} AND provider = 'cal_ai' AND provider_event_id = ${uid} AND deal_id IS NULL`;
  if (created) {
    const title = `Prep for your call with ${who || "a new lead"}`.slice(0, 240);
    const exists = await sql`SELECT 1 FROM public.tasks WHERE owner_id = ${ownerId} AND contact_id = ${contactId}::uuid AND title = ${title} AND status NOT IN ('done','cancelled') LIMIT 1`;
    if (!exists.length) {
      const due = new Date(Math.max(Date.now(), Date.parse(startsIso) - 60 * 60 * 1000)).toISOString();
      await sql`INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id, deal_id)
        VALUES (${ownerId}, ${title}, ${"They booked a call. Run an audit (Call mode or Business audit) and skim their site before you dial in."}, 'todo', 'high', ${due}::timestamptz, ${contactId}::uuid, ${deal?.id ?? null}::uuid)`;
    }
  }
  return deal?.id ?? null;
}

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function personList(value: unknown): Person[] {
  return Array.isArray(value) ? value.filter((p): p is Person => !!p && typeof p === "object") : [];
}
function safeSummary(payload: BookingPayload) {
  return {
    uid: text(payload.uid, 300),
    type: text(payload.type, 200),
    title: text(payload.title, 300),
    startTime: text(payload.startTime, 100),
    endTime: text(payload.endTime, 100),
  };
}

export async function POST(request: Request) {
  const secret = process.env.CAL_AI_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "Cal.ai webhook is not configured." }, { status: 503 });

  const raw = await request.text();
  const signature = request.headers.get("x-cal-signature-256") || "";
  if (!verifyCalAiSignature(raw, signature, secret)) {
    return Response.json({ error: "Invalid Cal.com webhook signature." }, { status: 401 });
  }

  let payload: BookingPayload;
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = unwrapCalAiPayload(parsed);
    if (!normalized) throw new Error("Invalid payload");
    payload = normalized as BookingPayload;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const trigger = text(payload.triggerEvent, 100).toUpperCase();
  // Cal.com Ping diagnostics can be signed JSON without a booking trigger or UID.
  // Acknowledge those diagnostics; only booking events should require booking fields.
  if (!trigger) return Response.json({ received: true, ignored: true, diagnostic: true });
  // Acknowledge signed Cal.com diagnostic events before requiring booking-only fields.
  const supported = new Set(["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED", "MEETING_ENDED"]);
  if (!supported.has(trigger)) return Response.json({ received: true, ignored: true, trigger });
  const uid = text(payload.uid, 300);
  if (!uid) return Response.json({ error: "Webhook uid is required for booking events." }, { status: 400 });
  // Bookings always belong to the configured workspace; never match contacts across accounts.
  const configuredOwnerId = text(process.env.CINDER_OWNER_ID, 200);
  if (!configuredOwnerId) return Response.json({ error: "CINDER_OWNER_ID is not configured." }, { status: 503 });

  try {
    const sql = db();
    const attendeeEmails = personList(payload.attendees)
      .map((person) => text(person.email, 320).toLowerCase())
      .filter(validCalAiEmail);
    // Cal.com retries deliveries. An event that was already processed is acknowledged, not re-run,
    // so deal changes and alert emails never happen twice.
    const seen = await sql`SELECT 1 FROM public.cal_ai_webhook_events WHERE provider_event_id = ${uid + ":" + trigger} AND processing_status = 'processed' LIMIT 1`;
    if (seen.length) return Response.json({ received: true, duplicate: true, trigger });
    let contact: { id: string; owner_id: string } | undefined;
    for (const email of attendeeEmails) {
      const rows = await sql`
            SELECT id, owner_id FROM public.contacts
            WHERE owner_id = ${configuredOwnerId} AND lower(trim(email)) = ${email}
            ORDER BY updated_at DESC LIMIT 1
          `;
      if (rows[0]) {
        contact = { id: String(rows[0].id), owner_id: String(rows[0].owner_id) };
        break;
      }
    }
    const ownerId = configuredOwnerId;
    const summary = safeSummary(payload);
    const person = bookingPerson(payload);
    let createdContact = false;

    // People often book with a personal email that isn't the one in Cinder. Before creating a new
    // contact, match by phone, then by first name against someone Sam called in the last 3 days.
    let matchedBy: "phone" | "recent call" | null = null;
    if (!contact && person) {
      const digits = lastTenDigits(person.phone);
      if (digits) {
        const rows = await sql`SELECT id, owner_id FROM public.contacts
          WHERE owner_id = ${configuredOwnerId} AND right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = ${digits}
          ORDER BY updated_at DESC LIMIT 2`;
        if (rows.length === 1) { contact = { id: String(rows[0].id), owner_id: String(rows[0].owner_id) }; matchedBy = "phone"; }
      }
      const first = splitName(person.name).first.toLowerCase();
      if (!contact && first.length >= 2) {
        const rows = await sql`SELECT c.id, c.owner_id FROM public.contacts c
          WHERE c.owner_id = ${configuredOwnerId} AND lower(trim(c.first_name)) = ${first}
            AND EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id
              AND a.action = 'outbound_call' AND a.outcome <> 'initiated' AND a.occurred_at > now() - interval '3 days')
          LIMIT 2`;
        if (rows.length === 1) { contact = { id: String(rows[0].id), owner_id: String(rows[0].owner_id) }; matchedBy = "recent call"; }
      }
      if (contact && matchedBy) {
        await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
          VALUES (${configuredOwnerId}, ${contact.id}::uuid, 'note', 'note', 'other',
            ${`Booked through Cal.com as ${person.name || "unknown"}${person.email ? ` (${person.email})` : ""}${person.phone ? `, ${person.phone}` : ""}. Matched by ${matchedBy}.${bookingAnswers(person, true) ? " Booking form: " + bookingAnswers(person, true) : ""}`.slice(0, 3000)})`;
      }
    }

    // A booking from someone new is a new lead: create the contact instead of dropping it.
    if (!contact && ownerId && person && (trigger === "BOOKING_CREATED" || trigger === "BOOKING_RESCHEDULED")) {
      const { first, last } = splitName(person.name);
      const startDay = validCalAiDate(text(payload.startTime, 100)) ? localDate(new Date(text(payload.startTime, 100)).toISOString(), TZ()) : null;
      const rows = await sql`
        INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, follow_up_at)
        VALUES (${ownerId}, ${first}, ${last}, ${person.company}, ${person.email}, ${person.phone}, 'lead', 'Cal.com booking',
          ${(bookingAnswers(person) ? "From the booking form: " + bookingAnswers(person) : "Booked a call through Cal.com.").slice(0, 3000)}, ${startDay}::date)
        RETURNING id`;
      contact = { id: String(rows[0].id), owner_id: ownerId };
      createdContact = true;
      await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
        VALUES (${ownerId}, ${contact.id}::uuid, 'note', 'note', 'other', ${("Booked a call through Cal.com: " + (text(payload.title, 200) || "meeting")).slice(0, 3000)})`;
    }

    // An existing contact matched by email still gets the booking-form answers, once, on the first booking.
    if (contact && !createdContact && !matchedBy && person && trigger === "BOOKING_CREATED") {
      const answers = bookingAnswers(person, true);
      if (answers) {
        await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
          VALUES (${contact.owner_id}, ${contact.id}::uuid, 'note', 'note', 'other', ${("Booking form: " + answers).slice(0, 3000)})`;
      }
    }

    // Do not lose unlinked bookings: record a minimal event summary so setup
    // problems can be diagnosed without storing attendee PII or call content.
    if (!ownerId) {
      await sql`
        INSERT INTO public.cal_ai_webhook_events
          (provider_event_id, trigger_event, processing_status, processed_at, payload_summary)
        VALUES (${uid + ":" + trigger}, ${trigger}, 'unmatched_contact', now(), ${JSON.stringify(summary)}::jsonb)
        ON CONFLICT (provider_event_id) DO UPDATE SET
          trigger_event = EXCLUDED.trigger_event,
          processing_status = EXCLUDED.processing_status,
          processed_at = now(),
          payload_summary = EXCLUDED.payload_summary
      `;
      return Response.json({ received: true, matched: false });
    }

    if (trigger === "BOOKING_CANCELLED") {
      const rescheduleUid = text(payload.rescheduleUid, 300);
      // Cal.com payload variants may reference the booking being cancelled via
      // either uid or rescheduleUid. Mark matching rows cancelled; keep history.
      await sql`
        UPDATE public.calendar_events SET status = 'cancelled', updated_at = now()
        WHERE owner_id = ${ownerId} AND provider = 'cal_ai'
          AND provider_event_id IN (${uid}, ${rescheduleUid || uid})
      `;
      // Keep the deal open, but make rescheduling the next thing to do.
      const ev = await sql`SELECT deal_id FROM public.calendar_events WHERE owner_id = ${ownerId} AND provider = 'cal_ai' AND provider_event_id IN (${uid}, ${rescheduleUid || uid}) AND deal_id IS NOT NULL LIMIT 1`;
      if (ev[0]?.deal_id) {
        await sql`UPDATE public.deals SET next_step = 'Reschedule the cancelled call', next_step_at = ${localDate(new Date().toISOString(), TZ())}::date, updated_at = now()
          WHERE id = ${String(ev[0].deal_id)}::uuid AND owner_id = ${ownerId} AND stage = 'meeting_booked'`;
      }
    } else if (trigger === "BOOKING_CREATED" || trigger === "BOOKING_RESCHEDULED") {
      const startsAt = text(payload.startTime, 100);
      const endsAt = text(payload.endTime, 100);
      if (!validCalAiDate(startsAt) || !validCalAiDate(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt)) {
        return Response.json({ error: "Booking startTime/endTime are invalid." }, { status: 400 });
      }
      const title = text(payload.title, 300) || "Cal.ai meeting";
      const description = text(payload.description, 3000);
      const startsIso = new Date(startsAt).toISOString();
      const endsIso = new Date(endsAt).toISOString();
      const rescheduleUid = text(payload.rescheduleUid, 300);

      // Cal.com assigns a new UID when a booking is rescheduled. Update the
      // original Cinder row to the new UID first so the reschedule cannot leave
      // a stale meeting plus a duplicate new meeting.
      let updatedOriginal: unknown[] = [];
      if (trigger === "BOOKING_RESCHEDULED" && rescheduleUid && rescheduleUid !== uid) {
        updatedOriginal = await sql`
          UPDATE public.calendar_events SET
            title = ${title},
            description = ${description},
            starts_at = ${startsIso}::timestamptz,
            ends_at = ${endsIso}::timestamptz,
            status = 'scheduled',
            contact_id = COALESCE(${contact?.id || null}::uuid, contact_id),
            provider_event_id = ${uid},
            updated_at = now()
          WHERE owner_id = ${ownerId} AND provider = 'cal_ai' AND provider_event_id = ${rescheduleUid}
          RETURNING id
        `;
      }
      if (!updatedOriginal.length) {
        await sql`
          INSERT INTO public.calendar_events
            (owner_id, title, description, starts_at, ends_at, all_day, event_type, status, contact_id, provider, provider_event_id)
          VALUES
            (${ownerId}, ${title}, ${description}, ${startsIso}::timestamptz,
             ${endsIso}::timestamptz, false, 'meeting', 'scheduled',
             ${contact?.id || null}::uuid, 'cal_ai', ${uid})
          ON CONFLICT (owner_id, provider, provider_event_id)
            WHERE provider IS NOT NULL AND provider_event_id IS NOT NULL
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            starts_at = EXCLUDED.starts_at,
            ends_at = EXCLUDED.ends_at,
            status = 'scheduled',
            contact_id = COALESCE(EXCLUDED.contact_id, public.calendar_events.contact_id),
            updated_at = now()
        `;
      }
      if (contact) {
        // A booked call is a reply: stop any call/text sequence for this person.
        await sql`UPDATE public.contact_outreach SET status = 'meeting_booked', updated_at = now()
          WHERE owner_id = ${ownerId} AND contact_id = ${contact.id}::uuid AND status = 'active'`;
        const who = person?.company || person?.name || "";
        const dealId = await bookingToDeal(sql, ownerId, contact.id, who, uid, startsIso, trigger === "BOOKING_CREATED" || createdContact);
        const when = new Intl.DateTimeFormat("en-US", { timeZone: TZ(), weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(startsIso));
        await sendAlert({ subject: `${trigger === "BOOKING_RESCHEDULED" ? "Rescheduled" : "New booking"}: ${who || person?.email || "a call"} · ${when}`, lines: [
          `${person?.name || "Someone"}${person?.company ? ` (${person.company})` : ""} ${trigger === "BOOKING_RESCHEDULED" ? "moved their call to" : "booked a call for"} ${when}.`,
          [person?.phone && `Phone: ${person.phone}`, person?.email && `Email: ${person.email}`].filter(Boolean).join(" · "),
          person?.notes ? `They wrote: ${person.notes.slice(0, 300)}` : "",
          createdContact ? "New contact and deal created at Meeting booked, with a prep task." : "",
        ].filter(Boolean), link: { label: "Open the deal", path: dealId ? `/crm/deals/${dealId}` : `/crm?contact=${contact.id}` } });
      }
    } else if (trigger === "MEETING_ENDED") {
      const ev = await sql`
        UPDATE public.calendar_events SET status = 'completed', updated_at = now()
        WHERE owner_id = ${ownerId} AND provider = 'cal_ai' AND provider_event_id = ${uid}
        RETURNING deal_id, contact_id
      `;
      const dealId = ev[0]?.deal_id ? String(ev[0].deal_id) : null;
      const contactId = ev[0]?.contact_id ? String(ev[0].contact_id) : contact?.id ?? null;
      const deal = dealId
        ? (await sql`SELECT id, stage FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${ownerId}`).map(r => ({ id: String(r.id), stage: String(r.stage) }))[0] ?? null
        : contactId ? await openDeal(sql, ownerId, contactId) : null;
      const next = deal ? stageAfterMeeting(deal.stage) : null;
      if (deal && next) {
        await sql`UPDATE public.deals SET stage = ${next}, next_step = 'Fill in discovery and draft the proposal', next_step_at = ${localDate(new Date().toISOString(), TZ())}::date, updated_at = now()
          WHERE id = ${deal.id}::uuid AND owner_id = ${ownerId} AND stage NOT IN ('won','lost')`;
      }
      // Every finished call gets a follow-up task, linked to the contact and deal.
      if (contactId) {
        const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await sql`INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id, deal_id)
          VALUES (${ownerId}, ${"Follow up after the call"}, ${"Log what you learned in discovery, then send the recap or proposal while it's fresh."}, 'todo', 'high', ${due}::timestamptz, ${contactId}::uuid, ${deal?.id ?? null}::uuid)`;
      }
    }

    await sql`
      INSERT INTO public.cal_ai_webhook_events
        (provider_event_id, trigger_event, processing_status, processed_at, payload_summary)
      VALUES (${uid + ":" + trigger}, ${trigger}, 'processed', now(), ${JSON.stringify(summary)}::jsonb)
      ON CONFLICT (provider_event_id) DO UPDATE SET
        trigger_event = EXCLUDED.trigger_event,
        processing_status = EXCLUDED.processing_status,
        processed_at = now(),
        error_message = NULL,
        payload_summary = EXCLUDED.payload_summary
    `;
    return Response.json({ received: true, matched: !!contact, createdContact, trigger });
  } catch (error) {
    console.error("Cal.ai webhook processing failed", error);
    return Response.json({ error: "Unable to process Cal.ai webhook." }, { status: 500 });
  }
}
