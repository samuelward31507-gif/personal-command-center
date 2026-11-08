import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { CONNECT_OUTCOMES, funnelRates, goalMath } from "@/lib/scoreboard";
import { goalLabel, offersFrom } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";
import { channelReport } from "@/lib/lead-source";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/** GET /api/scoreboard?today=YYYY-MM-DD&tz=<minutes behind UTC> — activity, funnel, pipeline and goal progress. */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const params = new URL(request.url).searchParams;
    const today = /^\d{4}-\d{2}-\d{2}$/.test(params.get("today") ?? "") ? params.get("today")! : new Date().toISOString().slice(0, 10);
    const tz = Math.max(-900, Math.min(900, Number(params.get("tz")) || 0));
    const sql = neon(process.env.DATABASE_URL);
    const owner = user.id;
    const ws = await loadWorkspace(owner);
    const connects = [...CONNECT_OUTCOMES];
    const from14 = new Date(Date.parse(today + "T00:00:00Z") - 13 * 86_400_000).toISOString().slice(0, 10);
    const from30 = new Date(Date.parse(today + "T00:00:00Z") - 29 * 86_400_000).toISOString().slice(0, 10);
    const from7 = new Date(Date.parse(today + "T00:00:00Z") - 6 * 86_400_000).toISOString().slice(0, 10);
    const yearStart = today.slice(0, 4) + "-01-01";

    const [daily, windows, meetingsHeld, deals, pipeline, money, mrr, streakRows] = await Promise.all([
      sql`SELECT (occurred_at - make_interval(mins => ${tz}))::date AS d,
            count(*) FILTER (WHERE channel = 'call')::int AS calls,
            count(*) FILTER (WHERE channel = 'call' AND outcome = ANY(${connects}::text[]))::int AS connects,
            count(*) FILTER (WHERE outcome = 'meeting_booked')::int AS meetings
          FROM public.contact_activities
          WHERE owner_id = ${owner} AND action <> 'note' AND outcome IS DISTINCT FROM 'initiated'
            AND (occurred_at - make_interval(mins => ${tz}))::date >= ${from14}::date
          GROUP BY 1 ORDER BY 1`,
      sql`SELECT w.k,
            count(a.*) FILTER (WHERE a.channel = 'call')::int AS calls,
            count(a.*) FILTER (WHERE a.channel = 'call' AND a.outcome = ANY(${connects}::text[]))::int AS connects,
            count(a.*) FILTER (WHERE a.outcome = 'meeting_booked')::int AS meetings
          FROM (VALUES ('today', ${today}::date), ('week', ${from7}::date), ('month', ${from30}::date)) AS w(k, since)
          LEFT JOIN public.contact_activities a ON a.owner_id = ${owner} AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated'
            AND (a.occurred_at - make_interval(mins => ${tz}))::date BETWEEN w.since AND ${today}::date
          GROUP BY w.k`,
      sql`SELECT count(*) FILTER (WHERE (starts_at - make_interval(mins => ${tz}))::date >= ${from7}::date)::int AS week,
                 count(*)::int AS month
          FROM public.calendar_events WHERE owner_id = ${owner} AND event_type IN ('meeting','call') AND status <> 'cancelled'
            AND starts_at < now() AND (starts_at - make_interval(mins => ${tz}))::date >= ${from30}::date`,
      sql`SELECT
            count(*) FILTER (WHERE proposal_sent_at IS NOT NULL AND (proposal_sent_at - make_interval(mins => ${tz}))::date >= ${from30}::date)::int AS proposals_month,
            count(*) FILTER (WHERE stage = 'won' AND signed_at IS NOT NULL AND (signed_at - make_interval(mins => ${tz}))::date >= ${from30}::date)::int AS won_month,
            count(*) FILTER (WHERE stage = 'lost' AND (updated_at - make_interval(mins => ${tz}))::date >= ${from30}::date)::int AS lost_month,
            count(*) FILTER (WHERE stage = 'won')::int AS won_all, count(*) FILTER (WHERE stage = 'lost')::int AS lost_all
          FROM public.deals WHERE owner_id = ${owner}`,
      sql`SELECT stage, count(*)::int AS n, coalesce(sum(setup_fee),0)::float AS setup, coalesce(sum(monthly_fee),0)::float AS monthly
          FROM public.deals WHERE owner_id = ${owner} AND stage NOT IN ('won','lost') GROUP BY stage`,
      sql`SELECT
            coalesce(sum(amount) FILTER (WHERE status = 'paid' AND paid_at >= ${yearStart}::date), 0)::float AS collected,
            coalesce(sum(amount) FILTER (WHERE status IN ('expected','overdue') AND (due_date IS NULL OR due_date <= ${ws.goalBy}::date)), 0)::float AS expected
          FROM public.revenue_entries WHERE owner_id = ${owner}`,
      sql`SELECT count(*)::int AS clients, coalesce(sum(monthly_fee),0)::float AS mrr FROM public.deals WHERE owner_id = ${owner} AND stage = 'won' AND agreement_status = 'active'`,
      sql`SELECT DISTINCT (occurred_at - make_interval(mins => ${tz}))::date AS d FROM public.contact_activities
          WHERE owner_id = ${owner} AND channel = 'call' AND outcome IS DISTINCT FROM 'initiated' AND occurred_at > now() - interval '120 days' ORDER BY 1 DESC`,
    ]);

    // Where deals come from: last 180 days, channel from the deal's source or the contact's.
    const srcRows = await sql`SELECT d.source, COALESCE(c.source, '') AS contact_source, d.stage, d.monthly_fee, d.setup_fee,
        EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = d.owner_id AND a.contact_id = d.contact_id AND a.outcome = 'meeting_booked') AS meeting
      FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.owner_id = ${owner} AND d.created_at > now() - interval '180 days'` as Record<string, unknown>[];
    const sources = channelReport(srcRows.map(r => ({ dealSource: String(r.source ?? ""), contactSource: String(r.contact_source ?? ""), stage: String(r.stage), meeting: r.meeting === true, monthlyFee: Number(r.monthly_fee), setupFee: Number(r.setup_fee) })));

    const byDay = new Map(daily.map(r => [day(r.d), r]));
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.parse(from14 + "T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
      const r = byDay.get(d);
      return { date: d, calls: r?.calls ?? 0, connects: r?.connects ?? 0, meetings: r?.meetings ?? 0 };
    });
    const w = Object.fromEntries(windows.map(r => [r.k, { calls: r.calls, connects: r.connects, meetings: r.meetings }]));
    // Streak: consecutive days with calls, ending today (or yesterday if none logged yet today).
    const callDays = new Set(streakRows.map(r => day(r.d)));
    let streak = 0;
    const cursor = new Date(today + "T00:00:00Z");
    if (!callDays.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (callDays.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }

    // Outreach you sent by DM (the main prospecting channel) and the size of deals you've won.
    const [dm] = await sql`SELECT count(*) FILTER (WHERE at > now() - interval '7 days')::int AS week, count(*) FILTER (WHERE at > now() - interval '30 days')::int AS month
      FROM public.prospect_touches WHERE owner_id = ${owner} AND kind IN ('dm_sent','follow_up_sent')` as { week: number; month: number }[];
    const [avg] = await sql`SELECT count(*)::int AS n, coalesce(avg(setup_fee),0)::float AS setup, coalesce(avg(monthly_fee),0)::float AS monthly
      FROM public.deals WHERE owner_id = ${owner} AND stage = 'won'` as { n: number; setup: number; monthly: number }[];
    // Every outreach channel, today and this week. Calls count when logged; email, replies and bounces count themselves;
    // LinkedIn counts what you mark on the LinkedIn page.
    const chan = await sql`SELECT w.k,
          count(a.*) FILTER (WHERE a.notes LIKE 'Email sent: %')::int AS emails,
          count(a.*) FILTER (WHERE a.notes LIKE 'Email reply:%')::int AS replies,
          count(a.*) FILTER (WHERE a.notes LIKE 'Email bounced:%')::int AS bounces,
          count(a.*) FILTER (WHERE a.notes LIKE 'LinkedIn: connect%')::int AS li_requests,
          count(a.*) FILTER (WHERE a.notes LIKE 'LinkedIn: accepted%')::int AS li_accepted,
          count(a.*) FILTER (WHERE a.notes LIKE 'LinkedIn: message%')::int AS li_messages,
          count(a.*) FILTER (WHERE a.action = 'outbound_text')::int AS texts,
          count(a.*) FILTER (WHERE a.action = 'inbound_text')::int AS text_replies
        FROM (VALUES ('today', ${today}::date), ('week', ${from7}::date)) AS w(k, since)
        LEFT JOIN public.contact_activities a ON a.owner_id = ${owner}
          AND (a.occurred_at - make_interval(mins => ${tz}))::date BETWEEN w.since AND ${today}::date
        GROUP BY w.k` as Record<string, unknown>[];
    const chanOf = (k: string) => { const r = chan.find(x => x.k === k) ?? {}; const n = (f: string) => Number(r[f] ?? 0);
      return { emails: n("emails"), replies: n("replies"), bounces: n("bounces"), liRequests: n("li_requests"), liAccepted: n("li_accepted"), liMessages: n("li_messages"), texts: n("texts"), textReplies: n("text_replies") }; };
    // What's working: dials, conversations and meetings by trade and by city, last 30 days.
    const split = await sql`SELECT CASE WHEN c.niche ~* 'detail' OR c.company ~* 'detail' THEN 'Detailers' ELSE 'Fence and trades' END AS trade,
          NULLIF(split_part(c.location, ',', 1), '') AS city, NULLIF(trim(split_part(c.location, ',', 2)), '') AS st,
          count(*)::int AS dials,
          count(*) FILTER (WHERE a.outcome = ANY(${connects}::text[]))::int AS convos,
          count(*) FILTER (WHERE a.outcome = 'meeting_booked')::int AS meetings
        FROM public.contact_activities a JOIN public.contacts c ON c.id = a.contact_id AND c.owner_id = a.owner_id
        WHERE a.owner_id = ${owner} AND a.channel = 'call' AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated'
          AND (a.occurred_at - make_interval(mins => ${tz}))::date >= ${from30}::date
        GROUP BY 1, 2, 3` as { trade: string; city: string | null; st: string | null; dials: number; convos: number; meetings: number }[];
    const roll = (key: (r: typeof split[number]) => string) => {
      const m = new Map<string, { label: string; dials: number; convos: number; meetings: number }>();
      for (const r of split) { const k = key(r); const x = m.get(k) ?? { label: k, dials: 0, convos: 0, meetings: 0 }; x.dials += r.dials; x.convos += r.convos; x.meetings += r.meetings; m.set(k, x); }
      return [...m.values()].sort((a, b) => b.dials - a.dials);
    };
    const working = { trades: roll(r => r.trade), cities: roll(r => r.city ? `${r.city}${r.st ? ", " + r.st : ""}` : "Unknown").slice(0, 8) };
    const dl = deals[0];
    const month = { calls: w.month?.calls ?? 0, connects: w.month?.connects ?? 0, meetingsBooked: w.month?.meetings ?? 0, meetingsHeld: meetingsHeld[0]?.month ?? 0, proposalsSent: dl.proposals_month, won: dl.won_month, lost: dl.lost_month };
    return Response.json({
      today: w.today ?? { calls: 0, connects: 0, meetings: 0 },
      week: { ...(w.week ?? { calls: 0, connects: 0, meetings: 0 }), meetingsHeld: meetingsHeld[0]?.week ?? 0 },
      month, rates: funnelRates(month),
      allTime: { won: dl.won_all, lost: dl.lost_all, closeRate: funnelRates({ ...month, won: dl.won_all, lost: dl.lost_all }).closeRate },
      days, streak,
      pipeline: pipeline.map(p => ({ stage: p.stage, deals: p.n, setup: p.setup, monthly: p.monthly })),
      recurring: { clients: mrr[0]?.clients ?? 0, mrr: mrr[0]?.mrr ?? 0 },
      goal: goalMath({ today, collected: money[0]?.collected ?? 0, expectedByGoal: money[0]?.expected ?? 0, offers: Object.values(offersFrom(ws)), goal: { amount: ws.goalAmount, by: ws.goalBy } }),
      targets: { goalLabel: goalLabel(ws), dailyCalls: ws.dailyCallTarget },
      sources,
      outreach: { dmWeek: dm?.week ?? 0, dmMonth: dm?.month ?? 0 },
      channels: { today: chanOf("today"), week: chanOf("week") },
      working,
      avgDeal: { deals: avg?.n ?? 0, setup: Math.round(avg?.setup ?? 0), monthly: Math.round(avg?.monthly ?? 0) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Scoreboard failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not build the scoreboard.", 500);
  }
}
