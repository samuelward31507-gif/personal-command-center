// Reports for one business over a period, with the period before it for comparison. Definitions follow what
// ServiceTitan, Jobber and Housecall Pro use, so an owner switching over reads the same numbers:
//   book rate   = leads that got an estimate booked / new leads
//   quote rate  = leads that got a quote / leads booked
//   close rate  = leads won / leads quoted
//   avg job     = won value / jobs won
//   sales cycle = average days from first contact to won
//   time to pay = average days from invoice sent to paid
// "Leads" are new conversations from real lead sources: imports, review asks and follow-up rounds don't count.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export type Period = 30 | 90 | 365;
export type Funnel = { leads: number; booked: number; quoted: number; won: number; wonValue: number; lost: number };
export type ReportNumbers = Funnel & {
  /** Won jobs with costs logged: their value, their costs, and how many. Profit is value minus costs. */
  costed: number; costedValue: number; costs: number;
  replySec: number | null; afterHoursLeads: number; afterHoursWon: number; afterHoursValue: number;
  cycleDays: number | null; payDays: number | null; collected: number; invoiced: number;
  appts: number; noShows: number; reviews: number;
};
/** paid: money actually collected (payments recorded) on the jobs that came from this source. */
export type SourceRow = { source: string; leads: number; booked: number; quoted: number; won: number; wonValue: number; paid: number };
export type Point = { label: string; leads: number; booked: number; won: number; wonValue: number; collected: number };
export type Report = { days: Period; now: ReportNumbers; before: ReportNumbers; sources: SourceRow[]; lostReasons: { reason: string; n: number }[]; openQuotes: { n: number; value: number }; series: Point[] };

const NOT_LEADS = ["import", "review", "due", "quote", "rehash"];

async function numbers(sql: Sql, pid: string, tz: string, from: string, to: string): Promise<ReportNumbers> {
  const [f] = await sql`WITH l AS (
      SELECT t.id, t.customer_phone, t.stage, t.status, t.value, t.created_at, t.stage_at, (t.created_at AT TIME ZONE ${tz}) AS local,
        coalesce((t.job_costs->>'materials')::numeric, 0) + coalesce((t.job_costs->>'labor')::numeric, 0) + coalesce((t.job_costs->>'other')::numeric, 0) AS cost,
        EXISTS (SELECT 1 FROM public.client_appointments a WHERE a.thread_id = t.id) AS has_appt,
        q.amount AS q_amount, q.status AS q_status, q.id IS NOT NULL AS has_quote,
        (SELECT extract(epoch FROM (min(o.at) - t.created_at)) FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out' AND o.author <> 'system') AS first_sec
      FROM public.client_threads t
      LEFT JOIN LATERAL (SELECT amount, status, id FROM public.client_quotes q WHERE q.project_id = t.project_id AND q.kind = 'quote'
        AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10) ORDER BY q.created_at DESC LIMIT 1) q ON true
      WHERE t.project_id = ${pid}::uuid AND t.source <> ALL(${NOT_LEADS}::text[]) AND t.created_at >= ${from}::timestamptz AND t.created_at < ${to}::timestamptz),
    m AS (SELECT *, (stage = 'won' OR q_status = 'won') AS is_won,
        (has_appt OR stage IN ('booked', 'quoted', 'won') OR status = 'booked') AS is_booked,
        (has_quote OR stage IN ('quoted', 'won')) AS is_quoted,
        (extract(hour FROM local) < 8 OR extract(hour FROM local) >= 18 OR extract(isodow FROM local) >= 6) AS after_hours FROM l)
    SELECT count(*)::int AS leads, count(*) FILTER (WHERE is_booked OR is_quoted OR is_won)::int AS booked,
      count(*) FILTER (WHERE is_quoted OR is_won)::int AS quoted, count(*) FILTER (WHERE is_won)::int AS won,
      coalesce(sum(coalesce(value, q_amount)) FILTER (WHERE is_won), 0)::float AS won_value, count(*) FILTER (WHERE stage = 'lost')::int AS lost,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY first_sec) FILTER (WHERE first_sec IS NOT NULL AND first_sec >= 0) AS reply_sec,
      count(*) FILTER (WHERE after_hours)::int AS ah_leads, count(*) FILTER (WHERE after_hours AND is_won)::int AS ah_won,
      coalesce(sum(coalesce(value, q_amount)) FILTER (WHERE after_hours AND is_won), 0)::float AS ah_value,
      avg(extract(epoch FROM (stage_at - created_at)) / 86400) FILTER (WHERE is_won AND stage_at IS NOT NULL AND stage_at > created_at) AS cycle_days,
      count(*) FILTER (WHERE is_won AND cost > 0)::int AS costed, coalesce(sum(coalesce(value, q_amount)) FILTER (WHERE is_won AND cost > 0), 0)::float AS costed_value,
      coalesce(sum(cost) FILTER (WHERE is_won AND cost > 0), 0)::float AS costs
    FROM m` as Record<string, unknown>[];
  const [m] = await sql`SELECT
      coalesce((SELECT sum(amount) FROM public.client_payments WHERE project_id = ${pid}::uuid AND paid_on >= ${from}::date AND paid_on < ${to}::date), 0)
        + coalesce((SELECT sum(total) FROM public.client_invoices i WHERE i.project_id = ${pid}::uuid AND i.status = 'paid' AND i.paid_at >= ${from}::timestamptz AND i.paid_at < ${to}::timestamptz
          AND NOT EXISTS (SELECT 1 FROM public.client_payments p WHERE p.invoice_id = i.id)), 0)
        - coalesce((SELECT sum(amount) FROM public.client_refunds WHERE project_id = ${pid}::uuid AND refunded_on >= ${from}::date AND refunded_on < ${to}::date), 0) AS collected,
      coalesce((SELECT sum(total) FROM public.client_invoices WHERE project_id = ${pid}::uuid AND status <> 'void' AND sent_at >= ${from}::timestamptz AND sent_at < ${to}::timestamptz), 0) AS invoiced,
      (SELECT avg(extract(epoch FROM (paid_at - sent_at)) / 86400) FROM public.client_invoices WHERE project_id = ${pid}::uuid AND status = 'paid' AND sent_at IS NOT NULL AND paid_at >= ${from}::timestamptz AND paid_at < ${to}::timestamptz) AS pay_days,
      (SELECT count(*) FROM public.client_appointments WHERE project_id = ${pid}::uuid AND starts_at >= ${from}::timestamptz AND starts_at < least(${to}::timestamptz, now()) AND status <> 'canceled')::int AS appts,
      (SELECT count(*) FROM public.client_appointments WHERE project_id = ${pid}::uuid AND starts_at >= ${from}::timestamptz AND starts_at < ${to}::timestamptz AND status = 'no_show')::int AS no_shows,
      (SELECT count(*) FROM public.client_reviews WHERE project_id = ${pid}::uuid AND sent_at >= ${from}::timestamptz AND sent_at < ${to}::timestamptz)::int AS reviews` as Record<string, unknown>[];
  const n = (v: unknown) => Number(v) || 0, opt = (v: unknown) => (v == null ? null : Math.round(Number(v) * 10) / 10);
  return { costed: n(f?.costed), costedValue: n(f?.costed_value), costs: n(f?.costs), leads: n(f?.leads), booked: n(f?.booked), quoted: n(f?.quoted), won: n(f?.won), wonValue: n(f?.won_value), lost: n(f?.lost),
    replySec: f?.reply_sec == null ? null : Math.round(Number(f.reply_sec)), afterHoursLeads: n(f?.ah_leads), afterHoursWon: n(f?.ah_won), afterHoursValue: n(f?.ah_value),
    cycleDays: opt(f?.cycle_days), payDays: opt(m?.pay_days), collected: n(m?.collected), invoiced: n(m?.invoiced), appts: n(m?.appts), noShows: n(m?.no_shows), reviews: n(m?.reviews) };
}

/** The report for the last `days`, the same-length period before it, leads by source and why jobs were lost. */
export async function reportFor(sql: Sql, pid: string, tz: string, days: Period): Promise<Report> {
  const now = new Date(), from = new Date(now.getTime() - days * 86400000), prev = new Date(from.getTime() - days * 86400000);
  const unit = days === 365 ? "month" : "week";
  const [cur, before, src, lost, open, ser, pay] = await Promise.all([
    numbers(sql, pid, tz, from.toISOString(), new Date(now.getTime() + 60000).toISOString()),
    numbers(sql, pid, tz, prev.toISOString(), from.toISOString()),
    sql`SELECT t.source,
        count(*)::int AS leads,
        count(*) FILTER (WHERE t.stage IN ('booked', 'quoted', 'won') OR t.status = 'booked' OR EXISTS (SELECT 1 FROM public.client_appointments a WHERE a.thread_id = t.id))::int AS booked,
        count(*) FILTER (WHERE t.stage IN ('quoted', 'won'))::int AS quoted,
        count(*) FILTER (WHERE t.stage = 'won')::int AS won,
        coalesce(sum(t.value) FILTER (WHERE t.stage = 'won'), 0)::float AS won_value,
        coalesce(sum((SELECT sum(p.amount) FROM public.client_payments p WHERE p.thread_id = t.id)), 0)::float
          - coalesce(sum((SELECT sum(r.amount) FROM public.client_refunds r WHERE r.thread_id = t.id)), 0)::float AS paid
      FROM public.client_threads t WHERE t.project_id = ${pid}::uuid AND t.source <> ALL(${NOT_LEADS}::text[]) AND t.created_at >= ${from.toISOString()}::timestamptz
      GROUP BY 1 ORDER BY 6 DESC, 2 DESC` as Promise<Record<string, unknown>[]>,
    sql`SELECT substring(z.body FROM '^Marked lost: (.+?)\\. Follow-ups stopped\\.$') AS reason, count(*)::int AS n
      FROM public.client_texts z JOIN public.client_threads t ON t.id = z.thread_id
      WHERE t.project_id = ${pid}::uuid AND z.author = 'system' AND z.body LIKE 'Marked lost:%' AND z.at >= ${from.toISOString()}::timestamptz GROUP BY 1 ORDER BY 2 DESC` as Promise<Record<string, unknown>[]>,
    sql`SELECT count(*)::int AS n, coalesce(sum(amount), 0)::float AS value FROM public.client_quotes WHERE project_id = ${pid}::uuid AND kind = 'quote' AND status IN ('open', 'replied')` as Promise<Record<string, unknown>[]>,
    // The trend: leads, booked and won by week (by month for a year), in the owner's time zone.
    sql`SELECT to_char(date_trunc(${unit}, t.created_at AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS k, count(*)::int AS leads,
        count(*) FILTER (WHERE t.stage IN ('booked', 'quoted', 'won') OR t.status = 'booked' OR EXISTS (SELECT 1 FROM public.client_appointments a WHERE a.thread_id = t.id))::int AS booked,
        count(*) FILTER (WHERE t.stage = 'won')::int AS won, coalesce(sum(t.value) FILTER (WHERE t.stage = 'won'), 0)::float AS won_value
      FROM public.client_threads t WHERE t.project_id = ${pid}::uuid AND t.source <> ALL(${NOT_LEADS}::text[]) AND t.created_at >= ${from.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as Promise<Record<string, unknown>[]>,
    sql`SELECT to_char(date_trunc(${unit}, d::timestamp), 'YYYY-MM-DD') AS k, sum(a)::float AS collected FROM (
        SELECT paid_on AS d, amount AS a FROM public.client_payments WHERE project_id = ${pid}::uuid AND paid_on >= ${from.toISOString()}::date
        UNION ALL SELECT refunded_on, -amount FROM public.client_refunds WHERE project_id = ${pid}::uuid AND refunded_on >= ${from.toISOString()}::date) m GROUP BY 1`.catch(() => []) as Promise<Record<string, unknown>[]>,
  ]);
  const paid = new Map(pay.map(r => [String(r.k), Number(r.collected) || 0]));
  return {
    days, now: cur, before,
    sources: src.map(r => ({ source: String(r.source), leads: Number(r.leads) || 0, booked: Number(r.booked) || 0, quoted: Number(r.quoted) || 0, won: Number(r.won) || 0, wonValue: Number(r.won_value) || 0, paid: Number(r.paid) || 0 })),
    lostReasons: lost.filter(r => r.reason).map(r => ({ reason: String(r.reason), n: Number(r.n) || 0 })),
    openQuotes: { n: Number(open[0]?.n) || 0, value: Number(open[0]?.value) || 0 },
    series: ser.map(r => ({ label: String(r.k), leads: Number(r.leads) || 0, booked: Number(r.booked) || 0, won: Number(r.won) || 0, wonValue: Number(r.won_value) || 0, collected: paid.get(String(r.k)) ?? 0 })),
  };
}
