import { handleRpc, toolCall } from "@/lib/agent-api";
import { agentAuthAsync, agentJson } from "@/lib/agent-route";
import { GET as callList } from "../call-list/route";
import { GET as prospect } from "../prospect/route";
import { GET as meetings } from "../meetings/route";
import { POST as brief } from "../brief/route";
import { POST as drafts } from "../drafts/route";
import { GET as myTexts } from "../my-texts/route";
import { POST as runs } from "../runs/route";
import { POST as replies } from "../replies/route";
import { POST as addProspects } from "../prospects/route";
import { GET as content, POST as contentUpdate } from "../content/route";
import { POST as contactInfo } from "../contact-info/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLERS: Record<string, (r: Request) => Promise<Response>> = {
  "/api/agent/call-list": callList, "/api/agent/prospect": prospect, "/api/agent/meetings": meetings,
  "/api/agent/brief": brief, "/api/agent/drafts": drafts,
  "/api/agent/my-texts": myTexts, "/api/agent/runs": runs,
  "/api/agent/replies": replies, "/api/agent/prospects": addProspects, "/api/agent/contact-info": contactInfo,
};

/** Runs one tool by calling the matching REST handler with the same key, so both doors share every rule. */
async function runTool(request: Request, name: string, args: Record<string, unknown>) {
  const call = toolCall(name, args)!;
  const url = new URL(call.path, request.url);
  for (const [k, v] of Object.entries(call.query ?? {})) url.searchParams.set(k, v);
  const inner = new Request(url, {
    method: call.method,
    headers: { authorization: request.headers.get("authorization") ?? "", "x-api-key": request.headers.get("x-api-key") ?? "", "content-type": "application/json", "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "" },
    body: call.method === "POST" ? JSON.stringify(call.body ?? {}) : undefined,
  });
  const handler = call.path === "/api/agent/content" ? (call.method === "GET" ? content : contentUpdate) : HANDLERS[call.path];
  const res = await handler(inner);
  const text = await res.text();
  return { content: [{ type: "text", text }], isError: res.status >= 400 };
}

/** POST /api/agent/mcp: the agent API as a remote MCP server (Streamable HTTP, JSON responses, no sessions). */
export async function POST(request: Request) {
  const auth = await agentAuthAsync(request);
  if (!auth.ok) return agentJson({ jsonrpc: "2.0", id: null, error: { code: -32001, message: auth.error } }, auth.status);
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return agentJson({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]).slice(0, 20);
  const replies: unknown[] = [];
  for (const m of msgs) {
    const r = handleRpc(m);
    if ("notify" in r) continue;
    if ("reply" in r) { replies.push(r.reply); continue; }
    try {
      replies.push({ jsonrpc: "2.0", id: r.call.id, result: await runTool(request, r.call.name, r.call.args) });
    } catch (e) {
      console.error("Agent MCP tool failed", r.call.name, e instanceof Error ? e.message.slice(0, 200) : e);
      replies.push({ jsonrpc: "2.0", id: r.call.id, result: { content: [{ type: "text", text: "The tool failed. Try again shortly." }], isError: true } });
    }
  }
  if (!replies.length) return new Response(null, { status: 202 });
  return agentJson(batch ? replies : replies[0]);
}

/** No server-to-client stream: everything is request and response. */
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

/** Stateless: there's no session to end. */
export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
