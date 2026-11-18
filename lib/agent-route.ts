// I/O side of the agent API: auth, rate limit and the database handle, shared by every /api/agent route.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { agentAuth, AGENT_HOURLY_LIMIT, extractKey, hashKey, isKeyShape, type AuthResult } from "@/lib/agent-api";
export { AGENT_TZ, dayRange, todayIn } from "@/lib/agent-api";
import { allowEvent } from "@/lib/rate-limit";

export const agentJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** The env key first, then a key made in Settings (stored only as a hash). */
export async function agentAuthAsync(request: Request): Promise<AuthResult> {
  const auth = agentAuth(request.headers.get("authorization"), process.env, request.headers.get("x-api-key"));
  if (auth.ok || auth.status === 503) return auth;
  const key = extractKey(request.headers.get("authorization"), request.headers.get("x-api-key"));
  if (!isKeyShape(key)) return auth;
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`UPDATE public.agent_keys SET last_used_at = now() WHERE key_hash = ${hashKey(key)} AND revoked_at IS NULL RETURNING owner_id` as { owner_id: string }[];
    return rows[0] ? { ok: true, owner: String(rows[0].owner_id) } : auth;
  } catch {
    return auth;
  }
}

/** Auth, then the hourly limit. Returns the owner-scoped handle, or the Response to send back. */
export async function agentGuard(request: Request): Promise<{ sql: NeonQueryFunction<false, false>; owner: string } | Response> {
  const auth = await agentAuthAsync(request);
  if (!auth.ok) return agentJson({ error: auth.error }, auth.status);
  if (!(await allowEvent("agent", auth.owner, AGENT_HOURLY_LIMIT, 60))) return agentJson({ error: "Over the hourly limit. Try again later." }, 429);
  return { sql: neon(process.env.DATABASE_URL!), owner: auth.owner };
}
