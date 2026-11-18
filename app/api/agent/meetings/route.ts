import { dateParam } from "@/lib/agent-api";
import { agentGuard, agentJson, dayRange, todayIn } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/meetings?date=YYYY-MM-DD: Sam's booked meetings and calls that day (Mountain time), with the prospect. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const date = dateParam(new URL(request.url).searchParams.get("date"), todayIn());
  if (!date) return agentJson({ error: "date must be YYYY-MM-DD." }, 400);
  try {
    const { start, end } = dayRange(date);
    const rows = await g.sql`SELECT e.id, e.title, e.starts_at, e.ends_at, e.event_type, e.contact_id, c.company, c.first_name, c.last_name, c.phone, c.website, c.location,
        EXISTS (SELECT 1 FROM public.research_artifacts r WHERE r.owner_id = e.owner_id AND r.calendar_event_id = e.id AND r.status <> 'archived') AS has_brief
      FROM public.calendar_events e LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
      WHERE e.owner_id = ${g.owner} AND e.status = 'scheduled' AND e.event_type IN ('meeting', 'call')
        AND e.starts_at >= ${start}::timestamptz AND e.starts_at < ${end}::timestamptz
      ORDER BY e.starts_at LIMIT 30` as Record<string, unknown>[];
    return agentJson({
      date,
      meetings: rows.map(r => ({
        id: String(r.id), title: String(r.title), type: String(r.event_type),
        startsAt: new Date(String(r.starts_at)).toISOString(), endsAt: new Date(String(r.ends_at)).toISOString(),
        prospectId: r.contact_id ? String(r.contact_id) : null, business: String(r.company ?? ""),
        name: [r.first_name, r.last_name].filter(Boolean).join(" "), phone: String(r.phone ?? ""), website: String(r.website ?? ""), location: String(r.location ?? ""),
        hasBrief: Boolean(r.has_brief),
      })),
    });
  } catch (e) {
    console.error("Agent meetings failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not load meetings." }, 500);
  }
}
