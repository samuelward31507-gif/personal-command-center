import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?since=ISO: meetings booked through your Cal.com link since that time (newest first), for the in-app alert. */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ bookings: [] });
  const raw = new URL(req.url).searchParams.get("since") ?? "";
  const t = Date.parse(raw);
  const since = new Date(Number.isFinite(t) ? Math.max(t, Date.now() - 7 * 86400000) : Date.now() - 3600000).toISOString();
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT e.id, e.title, e.starts_at, e.created_at, e.contact_id,
      trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company
    FROM public.calendar_events e LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
    WHERE e.owner_id = ${o} AND e.provider = 'cal_ai' AND e.status <> 'cancelled' AND e.created_at > ${since}::timestamptz
    ORDER BY e.created_at DESC LIMIT 20`;
  // Meetings that started 10+ minutes ago (last 7 days) with no outcome yet: "Did they show?"
  const pending = await sql`SELECT e.id, e.title, e.starts_at, trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company
    FROM public.calendar_events e LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
    WHERE e.owner_id = ${o} AND e.event_type IN ('meeting', 'call') AND e.status <> 'cancelled' AND e.outcome IS NULL AND NOT e.all_day
      AND e.starts_at < now() - interval '10 minutes' AND e.starts_at > now() - interval '7 days'
    ORDER BY e.starts_at DESC LIMIT 5`.catch(() => []);
  // Positive email replies since the last check (interested, questions, booking): the inbox sorter files them.
  const replies = await sql`SELECT g.id, g.from_name, g.from_addr, g.summary, g.category, g.received_at FROM public.gmail_inbox g
    WHERE g.owner_id = ${o} AND g.handled_at IS NULL AND g.category IN ('interested', 'meeting', 'question') AND g.created_at > ${since}::timestamptz
    ORDER BY g.received_at DESC LIMIT 5`.catch(() => []);
  const signing = await sql`SELECT s.id, s.viewed_at, s.signed_at, s.signer_name, s.deal_id, coalesce(c.company, d.title) AS who
    FROM public.signing_requests s JOIN public.deals d ON d.id = s.deal_id AND d.owner_id = s.owner_id LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    WHERE s.owner_id = ${o} AND (s.viewed_at > ${since}::timestamptz OR s.signed_at > ${since}::timestamptz) ORDER BY coalesce(s.signed_at, s.viewed_at) DESC LIMIT 5`.catch(() => []);
  return Response.json({
    signing: signing.map(x => ({ id: String(x.id) + (x.signed_at ? ":s" : ":v"), dealId: String(x.deal_id), who: String(x.who ?? ""), signed: !!x.signed_at })),
    pending: pending.map(x => ({ id: String(x.id), title: String(x.title ?? ""), startsAt: new Date(x.starts_at as string).toISOString(), who: String(x.company || x.name || x.title || "").trim() })),
    replies: replies.map(x => ({ id: String(x.id), who: String(x.from_name || x.from_addr), summary: String(x.summary ?? ""), category: String(x.category) })),
    now: new Date().toISOString(),
    bookings: rows.map(x => ({ id: String(x.id), title: String(x.title ?? ""), startsAt: new Date(x.starts_at as string).toISOString(),
      createdAt: new Date(x.created_at as string).toISOString(), contactId: x.contact_id ? String(x.contact_id) : null,
      who: String(x.company || x.name || "").trim() })),
  });
}
