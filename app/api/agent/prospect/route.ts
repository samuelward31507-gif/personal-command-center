import { isUuid } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/prospect?id=<uuid>: one prospect, the last 25 things that happened, and the research already on file. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const id = new URL(request.url).searchParams.get("id");
  if (!isUuid(id)) return agentJson({ error: "id must be a contact's id." }, 400);
  try {
    const [c] = await g.sql`SELECT id, first_name, last_name, company, role, phone, website, location, status, source, notes, follow_up_at, instagram, facebook, created_at
      FROM public.contacts WHERE owner_id = ${g.owner} AND id = ${id}::uuid` as Record<string, unknown>[];
    if (!c) return agentJson({ error: "No prospect with that id." }, 404);
    const [activities, research, suppressed] = await Promise.all([
      g.sql`SELECT channel, action, outcome, notes, occurred_at FROM public.contact_activities WHERE owner_id = ${g.owner} AND contact_id = ${id}::uuid ORDER BY occurred_at DESC LIMIT 25`,
      g.sql`SELECT id, artifact_type, title, author, status, confidence, left(content, 4000) AS content, updated_at FROM public.research_artifacts
        WHERE owner_id = ${g.owner} AND contact_id = ${id}::uuid AND status <> 'archived' ORDER BY updated_at DESC LIMIT 6`,
      g.sql`SELECT 1 FROM public.contact_suppressions WHERE owner_id = ${g.owner} AND contact_id = ${id}::uuid LIMIT 1`,
    ]);
    return agentJson({
      prospect: {
        id: String(c.id), business: String(c.company ?? ""), name: [c.first_name, c.last_name].filter(Boolean).join(" "), role: String(c.role ?? ""),
        phone: String(c.phone ?? ""), website: String(c.website ?? ""), location: String(c.location ?? ""), status: String(c.status ?? ""),
        source: String(c.source ?? ""), notes: String(c.notes ?? "").slice(0, 2000), followUpOn: c.follow_up_at ? String(c.follow_up_at).slice(0, 10) : null,
        instagram: String(c.instagram ?? ""), facebook: String(c.facebook ?? ""), doNotContact: suppressed.length > 0,
      },
      activities: activities.map(a => ({ channel: String(a.channel), action: String(a.action), outcome: String(a.outcome), notes: String(a.notes ?? "").slice(0, 500), at: new Date(String(a.occurred_at)).toISOString() })),
      research: research.map(r => ({ id: String(r.id), type: String(r.artifact_type), title: String(r.title), author: String(r.author), status: String(r.status), confidence: String(r.confidence), content: String(r.content ?? ""), updatedAt: new Date(String(r.updated_at)).toISOString() })),
    });
  } catch (e) {
    console.error("Agent prospect failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not load the prospect." }, 500);
  }
}
