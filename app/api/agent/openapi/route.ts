import { openApi } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/openapi: what the agent can do. Behind the same key, so the surface isn't advertised publicly. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  return agentJson(openApi(new URL(request.url).origin));
}
