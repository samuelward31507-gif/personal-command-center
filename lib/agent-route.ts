// I/O side of the agent API: auth, rate limit and the database handle, shared by every /api/agent route.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { agentAuth, AGENT_HOURLY_LIMIT } from "@/lib/agent-api";
export { AGENT_TZ, dayRange, todayIn } from "@/lib/agent-api";
import { allowEvent } from "@/lib/rate-limit";

export const agentJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** Auth, then the hourly limit. Returns the owner-scoped handle, or the Response to send back. */
export async function agentGuard(request: Request): Promise<{ sql: NeonQueryFunction<false, false>; owner: string } | Response> {
  const auth = agentAuth(request.headers.get("authorization"), process.env);
  if (!auth.ok) return agentJson({ error: auth.error }, auth.status);
  if (!(await allowEvent("agent", auth.owner, AGENT_HOURLY_LIMIT, 60))) return agentJson({ error: "Over the hourly limit. Try again later." }, 429);
  return { sql: neon(process.env.DATABASE_URL!), owner: auth.owner };
}
