// The morning check on every live client's system, so Sam hears about a problem before the client does.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export type Health = { name: string; failed: number; unanswered: number; quiet: boolean; slow: number };

/** Failed texts, customer texts Cinder never answered (15 min+), and live clients with no activity in 7 days. */
export async function clientHealth(sql: Sql, owner: string): Promise<Health[]> {
  const rows = await sql`SELECT coalesce(o.setup->>'display_name', p.client_name, p.name) AS name,
      (SELECT count(*)::int FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
        WHERE t.project_id = o.project_id AND x.direction = 'out' AND NOT x.ok AND x.at > now() - interval '24 hours') AS failed,
      (SELECT count(*)::int FROM public.client_threads t WHERE t.project_id = o.project_id AND t.status = 'auto'
        AND EXISTS (SELECT 1 FROM public.client_texts i WHERE i.thread_id = t.id AND i.direction = 'in' AND i.author = 'customer'
          AND i.at > now() - interval '24 hours' AND i.at < now() - interval '15 minutes'
          AND NOT EXISTS (SELECT 1 FROM public.client_texts r WHERE r.thread_id = t.id AND r.direction = 'out' AND r.at >= i.at))) AS unanswered,
      NOT EXISTS (SELECT 1 FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
        WHERE t.project_id = o.project_id AND x.at > now() - interval '7 days') AS quiet,
      (SELECT count(*)::int FROM public.client_threads t
        CROSS JOIN LATERAL (SELECT min(i.at) AS at FROM public.client_texts i WHERE i.thread_id = t.id AND i.direction = 'in') f
        WHERE t.project_id = o.project_id AND t.source NOT IN ('quote','rehash','review') AND f.at > now() - interval '24 hours' AND f.at < now() - interval '2 minutes'
          AND coalesce((SELECT min(r.at) FROM public.client_texts r WHERE r.thread_id = t.id AND r.direction = 'out' AND r.ok AND r.at >= f.at), now()) > f.at + interval '60 seconds') AS slow
    FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id
    WHERE o.owner_id = ${owner} AND coalesce(o.setup->>'texting_number', '') <> ''` as unknown as Health[];
  return rows.filter(r => r.failed || r.unanswered || r.quiet || r.slow);
}

export function healthLines(h: Health[]): string[] {
  return h.map(r => [
    r.failed ? `${r.failed} text${r.failed === 1 ? "" : "s"} failed to send` : "",
    r.unanswered ? `${r.unanswered} customer text${r.unanswered === 1 ? "" : "s"} never got a reply` : "",
    r.slow ? `${r.slow} new lead${r.slow === 1 ? "" : "s"} waited over 60 seconds for the first reply (the guarantee)` : "",
    r.quiet ? "no calls or texts in 7 days (check their call forwarding)" : "",
  ].filter(Boolean).join(", ")).map((t, i) => `${h[i].name}: ${t}. Open their Live tab.`);
}
