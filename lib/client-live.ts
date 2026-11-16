// What Cinder did for one client: 30-day numbers, weekly trend and recent conversations.
// Shared by the client portal and the Cinder app.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

export async function liveFor(sql: Sql, pid: string, limit = 15, tz = "America/Denver") {
  // Leads that arrived outside 8 to 6 on a weekday, in the owner's time zone: the ones a phone that's off would have missed.
  const [ah] = await sql`WITH t AS (SELECT t.id, t.customer_phone, t.created_at AT TIME ZONE ${tz} AS local FROM public.client_threads t
      WHERE t.project_id = ${pid}::uuid AND t.source NOT IN ('import', 'owner', 'quote', 'rehash', 'review') AND t.created_at > now() - interval '30 days'),
    a AS (SELECT * FROM t WHERE extract(hour FROM local) < 8 OR extract(hour FROM local) >= 18 OR extract(isodow FROM local) >= 6)
    SELECT (SELECT count(*)::int FROM a) AS leads,
      (SELECT count(*)::int FROM a WHERE EXISTS (SELECT 1 FROM public.client_quotes q WHERE q.project_id = ${pid}::uuid AND q.status = 'won'
        AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(a.customer_phone, '[^0-9]', '', 'g'), 10))) AS won,
      (SELECT coalesce(sum(q.amount), 0)::float FROM public.client_quotes q WHERE q.project_id = ${pid}::uuid AND q.status = 'won' AND q.last_step_at > now() - interval '30 days'
        AND EXISTS (SELECT 1 FROM a WHERE right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(a.customer_phone, '[^0-9]', '', 'g'), 10))) AS won_value`.catch(() => [{ leads: 0, won: 0, won_value: 0 }]) as Record<string, unknown>[];
  const [k] = await sql`WITH t AS (
      SELECT t.id, t.created_at, t.last_out_at, t.status, t.updated_at,
        (SELECT extract(epoch FROM (min(o.at) - t.created_at)) FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out') AS first_sec
      FROM public.client_threads t WHERE t.project_id = ${pid}::uuid AND t.source <> 'import' AND t.hidden_at IS NULL)
    SELECT count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS leads,
      count(*) FILTER (WHERE status = 'paused')::int AS needs,
      count(*) FILTER (WHERE created_at > now() - interval '30 days' AND last_out_at IS NOT NULL)::int AS answered,
      count(*) FILTER (WHERE status = 'booked' AND updated_at > now() - interval '30 days')::int AS booked,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY first_sec) FILTER (WHERE created_at > now() - interval '30 days' AND first_sec IS NOT NULL) AS reply_sec,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY first_sec) FILTER (WHERE created_at > now() - interval '7 days' AND first_sec IS NOT NULL AND first_sec >= 0) AS reply_sec_week,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS leads_week,
      count(*) FILTER (WHERE created_at > date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})::int AS leads_today
    FROM t` as Record<string, unknown>[];
  const [q] = await sql`SELECT count(*) FILTER (WHERE status = 'open' AND kind = 'quote')::int AS chasing,
      coalesce(sum(amount) FILTER (WHERE status = 'open' AND kind = 'quote'), 0)::float AS chasing_value,
      count(*) FILTER (WHERE status = 'won')::int AS won, coalesce(sum(amount) FILTER (WHERE status = 'won'), 0)::float AS won_value,
      count(*) FILTER (WHERE kind = 'rehash' AND status = 'replied')::int AS revived
    FROM public.client_quotes WHERE project_id = ${pid}::uuid` as Record<string, unknown>[];
  const [rv] = await sql`SELECT count(*)::int AS n FROM public.client_reviews WHERE project_id = ${pid}::uuid AND sent_at > now() - interval '30 days'` as Record<string, unknown>[];
  const weeks = await sql`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS wk, count(*)::int AS leads, count(*) FILTER (WHERE status = 'booked')::int AS booked
    FROM public.client_threads WHERE project_id = ${pid}::uuid AND source <> 'import' AND created_at > now() - interval '8 weeks' GROUP BY 1 ORDER BY 1` as Record<string, unknown>[];
  const convs = await sql`SELECT t.id, t.customer_name, t.customer_phone, t.source, t.status, t.updated_at, t.created_at, t.stage,
      (SELECT extract(epoch FROM (min(o.at) - coalesce((SELECT min(i.at) FROM public.client_texts i WHERE i.thread_id = t.id AND i.direction = 'in'), t.created_at)))
        FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out' AND o.author <> 'system') AS reply_sec,
      (SELECT x.direction FROM public.client_texts x WHERE x.thread_id = t.id AND x.author <> 'system' ORDER BY x.at DESC LIMIT 1) AS last_dir,
      (SELECT x.body FROM public.client_texts x WHERE x.thread_id = t.id AND x.author <> 'system' ORDER BY x.at DESC LIMIT 1) AS last,
      (SELECT x.body FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'in' AND x.author <> 'system' ORDER BY x.at DESC LIMIT 1) AS ask
    FROM public.client_threads t WHERE t.project_id = ${pid}::uuid AND t.hidden_at IS NULL AND (t.source <> 'import' OR t.last_in_at IS NOT NULL OR t.last_out_at IS NOT NULL)
    ORDER BY t.updated_at DESC LIMIT ${limit}` as Record<string, unknown>[];
  return {
    leads: Number(k?.leads ?? 0), needs: Number(k?.needs ?? 0), answered: Number(k?.answered ?? 0), booked: Number(k?.booked ?? 0), replySec: k?.reply_sec == null ? null : Math.round(Number(k.reply_sec)),
    replySecWeek: k?.reply_sec_week == null ? null : Math.round(Number(k.reply_sec_week)), leadsWeek: Number(k?.leads_week ?? 0), leadsToday: Number(k?.leads_today ?? 0),
    chasing: Number(q?.chasing ?? 0), chasingValue: Number(q?.chasing_value ?? 0), won: Number(q?.won ?? 0), wonValue: Number(q?.won_value ?? 0), revived: Number(q?.revived ?? 0), reviews: Number(rv?.n ?? 0),
    afterHours: { leads: Number(ah?.leads ?? 0), won: Number(ah?.won ?? 0), wonValue: Number(ah?.won_value ?? 0) },
    weeks: weeks.map(w => ({ week: String(w.wk), leads: Number(w.leads), booked: Number(w.booked) })),
    conversations: convs.map(c => ({ id: String(c.id), name: String(c.customer_name || "") || String(c.customer_phone), source: String(c.source), status: String(c.status), at: iso(c.updated_at), last: String(c.last ?? ""), ask: String(c.ask ?? ""),
      created: iso(c.created_at), replySec: c.reply_sec == null || Number(c.reply_sec) < 0 ? null : Math.round(Number(c.reply_sec)), lastDir: c.last_dir ? String(c.last_dir) : "", stage: c.stage ? String(c.stage) : "" })),
  };
}
