import { unwrapCalAiPayload, validCalAiEmail, verifyCalAiSignature, validCalAiDate } from "@/lib/cal-ai-webhook";
import { neon } from "@neondatabase/serverless";

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
};

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

  try {
    const sql = db();
    const attendeeEmails = personList(payload.attendees)
      .map((person) => text(person.email, 320).toLowerCase())
      .filter(validCalAiEmail);
    // Keep every imported booking inside Cinder's configured workspace.
    // Never let an attendee email from another workspace redirect calendar ownership.
    const configuredOwnerId = text(process.env.CINDER_OWNER_ID, 200);
    let contact: { id: string; owner_id: string } | undefined;
    for (const email of attendeeEmails) {
      const rows = configuredOwnerId
        ? await sql`
            SELECT id, owner_id FROM public.contacts
            WHERE owner_id = ${configuredOwnerId} AND lower(trim(email)) = ${email}
            ORDER BY updated_at DESC LIMIT 1
          `
        : await sql`
            SELECT id, owner_id FROM public.contacts
            WHERE lower(trim(email)) = ${email}
            GROUP BY id, owner_id
            LIMIT 2
          `;
      if (rows.length === 1 || (configuredOwnerId && rows[0])) {
        contact = { id: String(rows[0].id), owner_id: String(rows[0].owner_id) };
        break;
      }
    }
    const ownerId = configuredOwnerId || contact?.owner_id || "";
    const summary = safeSummary(payload);

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
    } else if (trigger === "MEETING_ENDED") {
      await sql`
        UPDATE public.calendar_events SET status = 'completed', updated_at = now()
        WHERE owner_id = ${ownerId} AND provider = 'cal_ai' AND provider_event_id = ${uid}
      `;
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
    return Response.json({ received: true, matched: !!contact, trigger });
  } catch (error) {
    console.error("Cal.ai webhook processing failed", error);
    return Response.json({ error: "Unable to process Cal.ai webhook." }, { status: 500 });
  }
}
