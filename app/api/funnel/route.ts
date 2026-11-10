import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { CONVERSATIONS } from "@/lib/call-outcomes";
import { funnelSteps, leak } from "@/lib/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=7|30|90: dials → conversations → meetings booked → showed → won, plus no-shows and cash collected. */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const days = [7, 30, 90].includes(Number(new URL(req.url).searchParams.get("days"))) ? Number(new URL(req.url).searchParams.get("days")) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const sql = neon(process.env.DATABASE_URL);
  const [calls] = await sql`SELECT count(*) FILTER (WHERE outcome <> 'initiated')::int AS dials,
      count(*) FILTER (WHERE outcome = ANY(${CONVERSATIONS as string[]}))::int AS conversations,
      count(*) FILTER (WHERE outcome = 'meeting_booked')::int AS booked_calls
    FROM public.contact_activities WHERE owner_id = ${o} AND action = 'outbound_call' AND occurred_at >= ${since}::timestamptz`;
  const [mt] = await sql`SELECT count(*) FILTER (WHERE created_at >= ${since}::timestamptz AND event_type = 'meeting')::int AS booked,
      count(*) FILTER (WHERE starts_at >= ${since}::timestamptz AND outcome = 'showed')::int AS showed,
      count(*) FILTER (WHERE starts_at >= ${since}::timestamptz AND outcome = 'no_show')::int AS no_show,
      count(*) FILTER (WHERE starts_at >= ${since}::timestamptz AND starts_at < now() AND outcome IS NULL AND status <> 'cancelled' AND event_type = 'meeting')::int AS unmarked
    FROM public.calendar_events WHERE owner_id = ${o}`;
  const [won] = await sql`SELECT count(*)::int AS n FROM public.deals WHERE owner_id = ${o} AND signed_at >= ${since}::timestamptz`;
  const [cash] = await sql`SELECT coalesce(sum(amount), 0)::float AS total FROM public.revenue_entries WHERE owner_id = ${o} AND status = 'paid' AND paid_at >= ${since.slice(0, 10)}::date`.catch(() => [{ total: 0 }]);
  const c = { dials: calls.dials, conversations: calls.conversations, booked: Math.max(mt.booked, calls.booked_calls), held: mt.showed + mt.no_show, showed: mt.showed, noShow: mt.no_show, won: won.n, cash: Number(cash?.total ?? 0) };
  return Response.json({ days, counts: c, unmarked: mt.unmarked, steps: funnelSteps(c), leak: leak(c) }, { headers: { "Cache-Control": "no-store" } });
}
