import { parseRun } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/agent/runs: one routine run, recorded in the workforce log. A failed run lands on Today with the other failed agent runs. */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseRun(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const r = parsed.run;
  const counts = Object.entries(r.counts).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(", ");
  try {
    const [row] = await g.sql`INSERT INTO public.agent_runs (owner_id, agent_name, task_title, status, summary, result_text, started_at, finished_at)
      VALUES (${g.owner}, ${"Grok: " + r.agent}, ${r.task}, ${r.status}, ${r.summary || counts}, ${counts}, now(), now()) RETURNING id` as { id: string }[];
    return agentJson({ id: String(row.id) }, 201);
  } catch (e) {
    console.error("Agent run log failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not record the run." }, 500);
  }
}
