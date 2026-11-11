// What Cinder did for one client: 30-day numbers, weekly trend and recent conversations.
// Shared by the client portal and the Cinder app.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

export async function liveFor(sql: Sql, pid: string, limit = 15) {
  const [k] = await sql`WITH t AS (
      SELECT t.id, t.created_at, t.last_out_at, t.status, t.updated_at,
        (SELECT extract(epoch FROM (min(o.at) - t.created_at)) FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out') AS first_sec
      FROM public.client_threads t WHERE t.project_id = ${pid}::uuid)
    SELECT count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS leads,
      count(*) FILTER (WHERE status = 'paused')::int AS needs,
      count(*) FILTER (WHERE created_at > now() - interval '30 days' AND last_out_at IS NOT NULL)::int AS answered,
      count(*) FILTER (WHERE status = 'booked' AND updated_at > now() - interval '30 days')::int AS booked,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY first_sec) FILTER (WHERE created_at > now() - interval '30 days' AND first_sec IS NOT NULL) AS reply_sec
    FROM t` as Record<string, unknown>[];
  const [q] = await sql`SELECT count(*) FILTER (WHERE status = 'open' AND kind = 'quote')::int AS chasing,
      coalesce(sum(amount) FILTER (WHERE status = 'open' AND kind = 'quote'), 0)::float AS chasing_value,
      count(*) FILTER (WHERE status = 'won')::int AS won, coalesce(sum(amount) FILTER (WHERE status = 'won'), 0)::float AS won_value,
      count(*) FILTER (WHERE kind = 'rehash' AND status = 'replied')::int AS revived
    FROM public.client_quotes WHERE project_id = ${pid}::uuid` as Record<string, unknown>[];
  const [rv] = await sql`SELECT count(*)::int AS n FROM public.client_reviews WHERE project_id = ${pid}::uuid AND sent_at > now() - interval '30 days'` as Record<string, unknown>[];
  const weeks = await sql`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS wk, count(*)::int AS leads, count(*) FILTER (WHERE status = 'booked')::int AS booked
    FROM public.client_threads WHERE project_id = ${pid}::uuid AND created_at > now() - interval '8 weeks' GROUP BY 1 ORDER BY 1` as Record<string, unknown>[];
  const convs = await sql`SELECT t.id, t.customer_name, t.customer_phone, t.source, t.status, t.updated_at,
      (SELECT x.body FROM public.client_texts x WHERE x.thread_id = t.id AND x.author <> 'system' ORDER BY x.at DESC LIMIT 1) AS last
    FROM public.client_threads t WHERE t.project_id = ${pid}::uuid ORDER BY t.updated_at DESC LIMIT ${limit}` as Record<string, unknown>[];
  return {
    leads: Number(k?.leads ?? 0), needs: Number(k?.needs ?? 0), answered: Number(k?.answered ?? 0), booked: Number(k?.booked ?? 0), replySec: k?.reply_sec == null ? null : Math.round(Number(k.reply_sec)),
    chasing: Number(q?.chasing ?? 0), chasingValue: Number(q?.chasing_value ?? 0), won: Number(q?.won ?? 0), wonValue: Number(q?.won_value ?? 0), revived: Number(q?.revived ?? 0), reviews: Number(rv?.n ?? 0),
    weeks: weeks.map(w => ({ week: String(w.wk), leads: Number(w.leads), booked: Number(w.booked) })),
    conversations: convs.map(c => ({ id: String(c.id), name: String(c.customer_name || "") || String(c.customer_phone), source: String(c.source), status: String(c.status), at: iso(c.updated_at), last: String(c.last ?? "") })),
  };
}
