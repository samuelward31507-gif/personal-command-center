// The 60-second guarantee, measured: for every lead, the time from when it reached Cinder (its first inbound
// event: missed call, text, form or lead-site request) to the first reply sent after it.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export const GUARANTEE_SEC = 60;
export type ReplySummary = { leads: number; replied: number; over: number; medianSec: number | null; slowestSec: number | null; met: boolean };

/** Pure: seconds per lead (null = never replied) → the month's guarantee figures. Met = at most 1 in 100 over 60s. */
export function replySummary(secs: (number | null)[]): ReplySummary {
  const done = secs.filter((s): s is number => s != null && s >= 0).sort((a, b) => a - b);
  const over = secs.filter(s => s == null || s > GUARANTEE_SEC).length;
  const mid = done.length ? (done.length % 2 ? done[(done.length - 1) / 2] : (done[done.length / 2 - 1] + done[done.length / 2]) / 2) : null;
  return { leads: secs.length, replied: done.length, over, medianSec: mid == null ? null : Math.round(mid), slowestSec: done.length ? Math.round(done[done.length - 1]) : null, met: secs.length === 0 || over / secs.length <= 0.01 };
}

export function replyLine(r: ReplySummary): string {
  if (!r.leads) return "Reply speed: no new leads this period.";
  return `Reply speed: ${r.leads} new lead${r.leads === 1 ? "" : "s"}, typical first reply ${r.medianSec ?? "–"} sec, slowest ${r.slowestSec ?? "–"} sec. ${r.over ? `${r.over} over 60 seconds.` : "Every one under 60 seconds."}${r.met ? "" : " The 60-second guarantee was missed: this month is free."}`;
}

/** Per-lead seconds for one client between two times. Opted-out and review/quote/revive threads Cinder started don't count. */
export async function replySecs(sql: Sql, projectId: string, from: string, to: string): Promise<(number | null)[]> {
  const rows = await sql`SELECT extract(epoch FROM (
        (SELECT min(o.at) FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out' AND o.ok AND o.at >= f.at) - f.at))::float AS sec
      FROM public.client_threads t
      CROSS JOIN LATERAL (SELECT min(i.at) AS at FROM public.client_texts i WHERE i.thread_id = t.id AND i.direction = 'in') f
      WHERE t.project_id = ${projectId}::uuid AND t.source NOT IN ('quote','rehash','review') AND f.at >= ${from}::timestamptz AND f.at < ${to}::timestamptz` as unknown as { sec: number | null }[];
  return rows.map(r => (r.sec == null ? null : Number(r.sec)));
}
