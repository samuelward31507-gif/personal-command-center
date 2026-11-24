import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: everything the Outbound page needs that isn't email (email comes from the Gmail endpoints).
 * - loop: today's Find / Score / Reach / Reply / Book numbers (Sam's day, Denver time)
 * - text: texts ready to send by hand (info text only for people who asked: no texts after a voicemail (that would be a cold text) after "send info"/"interested")
 * - linkedin: people to connect with and people who accepted and still need the first message
 * - log: what happened today, newest first
 * Cinder never sends a text or touches LinkedIn: these are drafts Sam sends himself.
 */
const TZ = "America/Denver";
const STOP = ["do_not_contact", "not_interested", "not_a_fit", "meeting_booked", "wrong_contact", "client", "won", "lost"];

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");

export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  try {
    const [d0] = await sql`SELECT (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS d` as { d: string }[];
    const dayStart = new Date(d0.d).toISOString();
    const [counts, textQueue, liContacts, liLog, log] = await Promise.all([
      sql`SELECT
          (SELECT count(*) FROM public.contacts WHERE owner_id = ${o} AND created_at >= ${dayStart}::timestamptz)::int AS found,
          (SELECT count(*) FROM public.contacts WHERE owner_id = ${o} AND created_at >= ${dayStart}::timestamptz AND notes ~* '^[[:space:]]*Lead grade:[[:space:]]*A([^[:alnum:]]|$)')::int AS grade_a,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz
            AND (action IN ('outbound_text','outbound_call') OR notes LIKE 'Email sent: %' OR notes LIKE 'LinkedIn: connect %' OR notes LIKE 'LinkedIn: message %'))::int AS touches,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz AND action = 'outbound_text')::int AS texts,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz AND action = 'inbound_text')::int AS text_replies,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz AND notes LIKE 'Email reply:%')::int AS email_replies,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz AND outcome = 'interested')::int AS interested,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz AND outcome = 'meeting_booked')::int AS booked,
          (SELECT count(*) FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at >= ${dayStart}::timestamptz AND action = 'outbound_text'
            AND contact_id IN (SELECT contact_id FROM public.contact_activities WHERE owner_id = ${o} AND outcome = 'meeting_booked'))::int AS text_booked`,
      // The last call per contact in the past 3 days, when it calls for a text that hasn't gone out since.
      sql`WITH last_call AS (
          SELECT DISTINCT ON (a.contact_id) a.contact_id, a.outcome, a.occurred_at
          FROM public.contact_activities a
          WHERE a.owner_id = ${o} AND a.action = 'outbound_call' AND a.occurred_at > now() - interval '3 days'
          ORDER BY a.contact_id, a.occurred_at DESC)
        SELECT c.id, c.first_name, c.last_name, c.company, c.phone, c.time_zone, c.niche, c.notes, lc.outcome, lc.occurred_at
        FROM last_call lc JOIN public.contacts c ON c.id = lc.contact_id AND c.owner_id = ${o}
        WHERE lc.outcome IN ('send_info','interested')
          AND coalesce(trim(c.phone), '') <> ''
          AND NOT EXISTS (SELECT 1 FROM public.contact_activities t WHERE t.owner_id = ${o} AND t.contact_id = c.id AND t.action = 'outbound_text' AND t.occurred_at >= lc.occurred_at)
          AND NOT (lc.outcome = 'voicemail' AND EXISTS (SELECT 1 FROM public.contact_activities t WHERE t.owner_id = ${o} AND t.contact_id = c.id AND t.action = 'outbound_text' AND t.template = 'T-VM'))
          AND NOT EXISTS (SELECT 1 FROM public.contact_activities t WHERE t.owner_id = ${o} AND t.contact_id = c.id AND t.action = 'inbound_text' AND t.notes ~* '(^|[^[:alpha:]])(stop|stopall|unsubscribe)([^[:alpha:]]|$)')
          AND NOT EXISTS (SELECT 1 FROM public.contact_suppressions x WHERE x.owner_id = ${o}
            AND (x.contact_id = c.id OR (x.phone_normalized <> '' AND x.phone_normalized = regexp_replace(c.phone, '[^0-9]', '', 'g'))))
        ORDER BY lc.occurred_at DESC LIMIT 40`,
      sql`SELECT c.id, c.first_name, c.last_name, c.company, c.role, c.location, c.niche, c.notes, c.linkedin_url, c.status
        FROM public.contacts c
        WHERE c.owner_id = ${o} AND coalesce(trim(c.linkedin_url), '') <> '' AND NOT (coalesce(c.status, '') = ANY(${STOP}::text[]))
          AND NOT EXISTS (SELECT 1 FROM public.contact_suppressions x WHERE x.owner_id = ${o} AND x.contact_id = c.id)
        ORDER BY (c.notes ~* '^[[:space:]]*Lead grade:[[:space:]]*A([^[:alnum:]]|$)') DESC, c.created_at DESC LIMIT 300`,
      sql`SELECT contact_id, notes, occurred_at FROM public.contact_activities
        WHERE owner_id = ${o} AND notes LIKE 'LinkedIn: %' ORDER BY occurred_at DESC LIMIT 3000`,
      sql`SELECT a.occurred_at, a.action, a.outcome, a.notes, a.channel, c.company, c.first_name, c.last_name
        FROM public.contact_activities a LEFT JOIN public.contacts c ON c.id = a.contact_id AND c.owner_id = ${o}
        WHERE a.owner_id = ${o} AND a.occurred_at >= ${dayStart}::timestamptz
          AND (a.action IN ('outbound_text','inbound_text') OR a.outcome IN ('meeting_booked','interested')
            OR a.notes LIKE 'Email sent: %' OR a.notes LIKE 'Email reply:%' OR a.notes LIKE 'Email bounced:%' OR a.notes LIKE 'LinkedIn: %')
        ORDER BY a.occurred_at DESC LIMIT 60`,
    ]);

    const c = (counts[0] ?? {}) as Row;
    const [probe] = await sql`SELECT count(*)::int AS calls, count(*) FILTER (WHERE outcome IN ('voicemail','send_info','interested'))::int AS textable
      FROM public.contact_activities WHERE owner_id = ${o} AND action = 'outbound_call' AND occurred_at > now() - interval '3 days'` as { calls: number; textable: number }[];
    console.log(`outbound-probe ${JSON.stringify({ owner: o.slice(0, 6), calls3d: probe?.calls ?? -1, textable: probe?.textable ?? -1, queue: textQueue.length })}`);
    const name = (r: Row) => [s(r.first_name), s(r.last_name)].filter(Boolean).join(" ").trim();

    // LinkedIn: where each person is, from the steps Sam logged.
    const steps = new Map<string, { connect?: string; accepted?: string; message?: string; skipped?: string }>();
    for (const r of liLog as Row[]) {
      const id = s(r.contact_id), step = s(r.notes).slice("LinkedIn: ".length).split(/\s/)[0];
      const m = steps.get(id) ?? {};
      if ((step === "connect" || step === "accepted" || step === "message" || step === "skipped") && !m[step]) m[step] = iso(r.occurred_at);
      steps.set(id, m);
    }
    const weekAgo = Date.now() - 7 * 86400000, startToday = Date.parse(dayStart);
    let connectsWeek = 0, accepted = 0, messagesToday = 0;
    for (const m of steps.values()) {
      if (m.connect && Date.parse(m.connect) > weekAgo) connectsWeek++;
      if (m.accepted) accepted++;
      if (m.message && Date.parse(m.message) >= startToday) messagesToday++;
    }
    const person = (r: Row) => ({ contactId: s(r.id), name: name(r), company: s(r.company), role: s(r.role), location: s(r.location), niche: s(r.niche), notes: s(r.notes), profile: s(r.linkedin_url), gradeA: /^\s*Lead grade:\s*A\b/i.test(s(r.notes)) });
    const toConnect = (liContacts as Row[]).filter(r => { const m = steps.get(s(r.id)); return !m || (!m.connect && !m.skipped); }).slice(0, 25).map(person);
    const toMessage = (liContacts as Row[]).filter(r => { const m = steps.get(s(r.id)); return m?.accepted && !m.message; }).slice(0, 25).map(r => ({ ...person(r), acceptedAt: steps.get(s(r.id))?.accepted ?? "" }));
    const waitingRows = (liContacts as Row[]).filter(r => { const m = steps.get(s(r.id)); return m?.connect && !m.accepted; });
    const waiting = waitingRows.length;
    const toAccept = waitingRows.slice(0, 10).map(r => ({ ...person(r), sentAt: steps.get(s(r.id))?.connect ?? "" }));

    // Today's log, in plain words.
    const who = (r: Row) => s(r.company) || name(r) || "Someone";
    const lines = (log as Row[]).map(r => {
      const n = s(r.notes), at = iso(r.occurred_at);
      if (r.outcome === "meeting_booked") return { at, channel: "book", what: `${who(r)} booked a meeting` };
      if (r.action === "outbound_text") return { at, channel: "text", what: `Text sent to ${who(r)}` };
      if (r.action === "inbound_text") return { at, channel: "text", what: `${who(r)} texted back`, quote: n.slice(0, 140) };
      if (n.startsWith("Email sent: ")) return { at, channel: "email", what: `${({ intro: "First email", follow_up: "Follow-up", breakup: "Last email" } as Record<string, string>)[n.slice(12).split(/\s/)[0]] ?? "Email"} sent to ${who(r)}` };
      if (n.startsWith("Email reply:")) return { at, channel: "email", what: `${who(r)} replied by email`, quote: n.split("\n").slice(1).join(" ").slice(0, 140) };
      if (n.startsWith("Email bounced:")) return { at, channel: "email", what: `Email to ${who(r)} bounced` };
      if (n.startsWith("LinkedIn: connect")) return { at, channel: "linkedin", what: `Connection request sent to ${name(r) || who(r)}` };
      if (n.startsWith("LinkedIn: accepted")) return { at, channel: "linkedin", what: `${name(r) || who(r)} accepted on LinkedIn` };
      if (n.startsWith("LinkedIn: message")) return { at, channel: "linkedin", what: `LinkedIn message sent to ${name(r) || who(r)}` };
      if (r.outcome === "interested") return { at, channel: "call", what: `${who(r)} is interested` };
      return null;
    }).filter(Boolean);
    // Group sends so 25 emails read as one line, not 25.
    const grouped: { at: string; channel: string; what: string; quote?: string; count?: number }[] = [];
    for (const l of lines as { at: string; channel: string; what: string; quote?: string }[]) {
      const prev = grouped[grouped.length - 1];
      const kind = (w: string) => w.replace(/ (to|for) .*/, "");
      if (prev && prev.channel === l.channel && !l.quote && !prev.quote && kind(prev.what) === kind(l.what) && /sent|request/.test(l.what)) { prev.count = (prev.count ?? 1) + 1; continue; }
      grouped.push({ ...l });
    }
    const added = Number(c.found ?? 0);

    return Response.json({
      loop: { found: added, gradeA: Number(c.grade_a ?? 0), touches: Number(c.touches ?? 0), replies: Number(c.text_replies ?? 0) + Number(c.email_replies ?? 0), interested: Number(c.interested ?? 0), booked: Number(c.booked ?? 0) },
      text: {
        sentToday: Number(c.texts ?? 0), repliesToday: Number(c.text_replies ?? 0),
        queue: (textQueue as Row[]).map(r => ({ contactId: s(r.id), name: name(r), firstName: s(r.first_name), company: s(r.company), phone: s(r.phone), timeZone: s(r.time_zone) || null, niche: s(r.niche), template: r.outcome === "voicemail" ? "T-VM" : "T-INFO", reason: r.outcome === "voicemail" ? "Left a voicemail" : r.outcome === "interested" ? "Interested on the call" : "Asked for info", callAt: iso(r.occurred_at) })),
      },
      linkedin: { connectsWeek, accepted, waiting, messagesToday, toConnect, toMessage, toAccept },
      log: grouped.slice(0, 14),
      added,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Outbound GET failed", e);
    return Response.json({ error: "Couldn't load outbound." }, { status: 500 });
  }
}
