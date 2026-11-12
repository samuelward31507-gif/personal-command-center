// The morning check on every live client's system, so Sam hears about a problem before the client does.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export type Health = { name: string; failed: number; unanswered: number; quiet: boolean; slow: number; waiting: number; guarantee_days: number | null; guarantee_booked: number };

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
          AND coalesce((SELECT min(r.at) FROM public.client_texts r WHERE r.thread_id = t.id AND r.direction = 'out' AND r.ok AND r.at >= f.at), now()) > f.at + interval '60 seconds') AS slow,
      (SELECT count(*)::int FROM public.client_threads t WHERE t.project_id = o.project_id AND t.status = 'paused'
        AND t.handoff_at > now() - interval '3 days' AND t.handoff_at < now() - interval '2 hours'
        AND NOT EXISTS (SELECT 1 FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'out' AND x.at > t.handoff_at
          AND (x.author = 'owner' OR (x.author = 'system' AND x.body = 'You called them back')))) AS waiting,
      -- Book & Close guarantee: 5 booked appointments in the first 30 days after go-live.
      CASE WHEN p.service_type = 'tier2_revenue_system' AND (o.launch->>'ownerOkAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        AND (o.launch->>'ownerOkAt')::timestamptz > now() - interval '30 days'
        THEN floor(extract(epoch FROM now() - (o.launch->>'ownerOkAt')::timestamptz) / 86400)::int END AS guarantee_days,
      (SELECT count(*)::int FROM public.client_appointments a WHERE a.project_id = o.project_id AND a.status <> 'canceled'
        AND (o.launch->>'ownerOkAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND a.created_at >= (o.launch->>'ownerOkAt')::timestamptz) AS guarantee_booked
    FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id
    WHERE o.owner_id = ${owner} AND coalesce(o.setup->>'texting_number', '') <> ''` as unknown as Health[];
  return rows.filter(r => r.failed || r.unanswered || r.quiet || r.slow || r.waiting || behind(r));
}

/** Behind pace on the 5-appointment guarantee: from day 7, fewer bookings than a straight line to 5 by day 30. */
export function behind(r: Pick<Health, "guarantee_days" | "guarantee_booked">): boolean {
  return r.guarantee_days != null && r.guarantee_days >= 7 && r.guarantee_booked < 5 && r.guarantee_booked < Math.floor((5 * r.guarantee_days) / 30);
}

export function healthLines(h: Health[]): string[] {
  return h.map(r => [
    r.failed ? `${r.failed} text${r.failed === 1 ? "" : "s"} failed to send` : "",
    r.unanswered ? `${r.unanswered} customer text${r.unanswered === 1 ? "" : "s"} never got a reply` : "",
    r.slow ? `${r.slow} new lead${r.slow === 1 ? "" : "s"} waited over 60 seconds for the first reply (the guarantee)` : "",
    r.waiting ? `${r.waiting} customer${r.waiting === 1 ? " is" : "s are"} waiting on the owner for over 2 hours (nudge the owner)` : "",
    behind(r) ? `${r.guarantee_booked} of 5 guaranteed appointments booked on day ${r.guarantee_days} of 30 (behind pace: revive old leads or check their lead flow)` : "",
    r.quiet ? "no calls or texts in 7 days (check their call forwarding)" : "",
  ].filter(Boolean).join(", ")).map((t, i) => `${h[i].name}: ${t}. Open their Live tab.`);
}
