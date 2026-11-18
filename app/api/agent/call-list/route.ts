import { loadMyDay } from "@/lib/my-day-data";
import { dateParam } from "@/lib/agent-api";
import { agentGuard, agentJson, dayRange, todayIn } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/call-list?date=YYYY-MM-DD&limit=30: who Sam's call mode would put in front of him that day, in order. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const params = new URL(request.url).searchParams;
  const date = dateParam(params.get("date"), todayIn());
  if (!date) return agentJson({ error: "date must be YYYY-MM-DD." }, 400);
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get("limit") ?? "30", 10) || 30));
  try {
    const { end } = dayRange(date);
    const windowEnd = new Date(Date.parse(end) + 86_400_000).toISOString();
    const { items } = await loadMyDay(g.sql, g.owner, date, end, windowEnd, 1500);
    const calls = items.filter(i => i.callable && i.contact).slice(0, limit);
    const ids = calls.map(i => i.contact!.id);
    const rows = ids.length ? await g.sql`
      SELECT c.id, c.location, c.website, c.notes,
        EXISTS (SELECT 1 FROM public.research_artifacts r WHERE r.owner_id = c.owner_id AND r.contact_id = c.id AND r.artifact_type = 'audit_prep' AND r.status <> 'archived') AS has_audit,
        EXISTS (SELECT 1 FROM public.research_artifacts r WHERE r.owner_id = c.owner_id AND r.contact_id = c.id AND r.artifact_type = 'call_brief' AND r.author = 'grok' AND r.status <> 'archived' AND r.updated_at > now() - interval '30 days') AS has_scout
      FROM public.contacts c WHERE c.owner_id = ${g.owner} AND c.id = ANY(${ids}::uuid[])` as Record<string, unknown>[] : [];
    const extra = new Map(rows.map(r => [String(r.id), r]));
    return agentJson({
      date,
      prospects: calls.map((i, n) => {
        const c = i.contact!; const x: Record<string, unknown> = extra.get(c.id) ?? {};
        return { rank: n + 1, id: c.id, business: c.company || c.name, phone: c.phone, website: String(x.website ?? c.website ?? ""), location: String(x.location ?? ""),
          why: i.why, notes: String(x.notes ?? "").slice(0, 500), hasAudit: Boolean(x.has_audit), hasScoutBrief: Boolean(x.has_scout) };
      }),
    });
  } catch (e) {
    console.error("Agent call list failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not build the call list." }, 500);
  }
}
