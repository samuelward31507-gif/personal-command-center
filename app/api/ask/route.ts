import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { ASK_TOOLS, buildSystemPrompt, validateAction, type AskAction } from "@/lib/ask";
import { runAskTool, type AskRequestContext } from "@/lib/ask-data";
import { classifyProviderError, sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 10;
const BUDGET_MS = 110_000;

const STATUS: Record<string, string> = {
  search_contacts: "Searching contacts", get_contact: "Opening the contact", list_deals: "Checking the pipeline",
  business_snapshot: "Pulling the numbers", today_queue: "Building today's queue", list_tasks: "Checking tasks",
  calendar: "Checking the calendar", list_audits: "Looking through audits", get_audit: "Reading the audit",
  money: "Checking money", propose_action: "Preparing a change for you to confirm",
};

async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

type Block = { type: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: unknown };

/**
 * POST /api/ask  { query, history?: [{role, content}], today, dayEnd, windowEnd, timeZone, tzOffsetMinutes }
 * Streams NDJSON: {type:"status",text} … {type:"answer",text,actions,sources} | {type:"error",error}
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("Ask Cinder needs ANTHROPIC_API_KEY in the deployment environment.", 503);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);

  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 2000) : "";
  if (!query) return fail("Type something to ask.", 400);
  const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const dayEnd = !Number.isNaN(Date.parse(body.dayEnd)) ? new Date(body.dayEnd).toISOString() : new Date(Date.parse(today + "T00:00:00Z") + 86400000).toISOString();
  const windowEnd = !Number.isNaN(Date.parse(body.windowEnd)) ? new Date(body.windowEnd).toISOString() : new Date(Date.parse(dayEnd) + 86400000).toISOString();
  const timeZone = typeof body.timeZone === "string" ? body.timeZone.slice(0, 60) : "UTC";
  const tzOffsetMinutes = Number.isFinite(Number(body.tzOffsetMinutes)) ? Math.max(-900, Math.min(900, Number(body.tzOffsetMinutes))) : 0;
  const nowLocal = new Date().toLocaleString("en-US", { timeZone: safeTz(timeZone), weekday: "long", hour: "numeric", minute: "2-digit" });
  const ctx: AskRequestContext = { today, dayEnd, windowEnd, timeZone, tzOffsetMinutes, now: nowLocal, weekday: nowLocal.split(",")[0] };

  // Prior turns are text only (the UI keeps them); cap them so a long chat stays cheap.
  const history: Msg[] = (Array.isArray(body.history) ? body.history : [])
    .filter((m: unknown): m is { role: string; content: string } => !!m && typeof m === "object" && typeof (m as Msg).content === "string" && ((m as Msg).role === "user" || (m as Msg).role === "assistant"))
    .slice(-8).map((m: { role: string; content: string }) => ({ role: m.role as Msg["role"], content: m.content.slice(0, 4000) }));
  while (history.length && history[0].role !== "user") history.shift();

  const model = process.env.CINDER_ASK_MODEL?.trim() || DEFAULT_MODEL;
  const sql = neon(process.env.DATABASE_URL);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const started = Date.now();
      const actions: AskAction[] = [];
      const sources = new Map<string, string>();
      const messages: Msg[] = [...history, { role: "user", content: query }];
      let text = "";
      try {
        send({ type: "status", text: "Thinking" });
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const remaining = BUDGET_MS - (Date.now() - started);
          if (remaining < 4000) throw Object.assign(new Error("budget"), { name: "TimeoutError" });
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model, max_tokens: 4000, system: buildSystemPrompt(ctx), messages,
              tools: [...ASK_TOOLS, { type: "web_search_20250305", name: "web_search", max_uses: 4 }],
            }),
            signal: AbortSignal.timeout(remaining),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            const failure = classifyProviderError(res.status, payload?.error?.type, payload?.error?.message);
            console.error("Ask provider error", { status: res.status, type: payload?.error?.type, message: sanitizeForLog(payload?.error?.message) });
            send({ type: "error", error: failure.clientMessage.replace(/research provider/g, "AI provider").replace("CINDER_AUDIT_MODEL", "CINDER_ASK_MODEL").replace(/audit request/g, "request") });
            return controller.close();
          }
          const content: Block[] = Array.isArray(payload.content) ? payload.content : [];
          const stop = String(payload.stop_reason ?? "");
          for (const b of content) {
            if (b.type === "text") {
              text += String(b.text ?? "");
              for (const c of (Array.isArray(b.citations) ? b.citations : []) as Array<{ url?: string; title?: string }>) if (c.url) sources.set(c.url, c.title || c.url);
            }
            if (b.type === "server_tool_use" && b.name === "web_search") send({ type: "status", text: "Searching the web" + (typeof (b.input as { query?: string })?.query === "string" ? ` for “${(b.input as { query: string }).query.slice(0, 60)}”` : "") });
          }
          if (stop === "pause_turn") { messages.push({ role: "assistant", content }); continue; }
          if (stop !== "tool_use") break;

          messages.push({ role: "assistant", content });
          const results: Block[] = [];
          for (const b of content.filter(x => x.type === "tool_use")) {
            const toolName = String(b.name);
            send({ type: "status", text: STATUS[toolName] ?? "Working" });
            let result: unknown;
            try {
              if (toolName === "propose_action") {
                const checked = validateAction(b.input);
                if (typeof checked === "string") result = { error: checked };
                else if (actions.length >= 8) result = { error: "Too many proposed changes in one answer." };
                else { actions.push(checked); result = { ok: true, note: "Shown to the founder as a card. Not executed until they confirm." }; }
              } else {
                result = await runAskTool(sql, user.id, ctx, toolName, (b.input ?? {}) as Record<string, unknown>);
              }
            } catch (error) {
              console.error("Ask tool failed", { tool: toolName, name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
              result = { error: "That lookup failed. Tell the founder plainly if it matters." };
            }
            results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(result).slice(0, 60000) });
          }
          messages.push({ role: "user", content: results });
          text = ""; // keep only the final turn's prose
        }
        send({ type: "answer", text: text.trim() || (actions.length ? "Ready for you to confirm:" : "I couldn't find an answer to that."), actions, sources: [...sources].slice(0, 6).map(([url, title]) => ({ url, title })) });
      } catch (error) {
        const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        console.error("Ask failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
        send({ type: "error", error: timeout ? "That took too long. Try a narrower question." : "Something went wrong answering that. Try again." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

function safeTz(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "UTC"; }
}
