import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { AGENT_AUTHOR } from "@/lib/agent-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent-activity: what Grok did in the last 24 hours (briefs, drafts, routine runs), for the panel on Today. */
export async function GET() {
  const s = await getAllowedSession();
  const owner = s?.data?.session && s?.data?.user?.id ? String(s.data.user.id) : null;
  if (!owner) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ briefs: [], drafts: 0, runs: [] });
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [briefs, drafts, runs] = await Promise.all([
      sql`SELECT r.id, r.contact_id, r.artifact_type, r.updated_at, coalesce(nullif(c.company, ''), trim(concat_ws(' ', c.first_name, c.last_name))) AS who
        FROM public.research_artifacts r LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
        WHERE r.owner_id = ${owner} AND r.author = ${AGENT_AUTHOR} AND r.status <> 'archived' AND r.updated_at > now() - interval '24 hours'
        ORDER BY r.updated_at DESC LIMIT 30`,
      sql`SELECT count(*)::int AS n FROM public.follow_up_drafts WHERE owner_id = ${owner} AND author = ${AGENT_AUTHOR} AND status = 'ready'`,
      sql`SELECT agent_name, task_title, status, summary, finished_at FROM public.agent_runs
        WHERE owner_id = ${owner} AND agent_name LIKE 'Grok:%' AND created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 6`,
    ]);
    return Response.json({
      briefs: briefs.map(b => ({ id: String(b.id), contactId: b.contact_id ? String(b.contact_id) : null, type: String(b.artifact_type), who: String(b.who ?? ""), at: new Date(String(b.updated_at)).toISOString() })),
      drafts: Number(drafts[0]?.n ?? 0),
      runs: runs.map(r => ({ agent: String(r.agent_name).replace(/^Grok:\s*/, ""), task: String(r.task_title), status: String(r.status), summary: String(r.summary ?? ""), at: r.finished_at ? new Date(String(r.finished_at)).toISOString() : null })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Agent activity failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return Response.json({ briefs: [], drafts: 0, runs: [] });
  }
}
