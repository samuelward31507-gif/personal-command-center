import { classifyProviderError, sanitizeForLog } from "@/lib/business-audit";

export class AiTextError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "AiTextError"; }
}

/** One non-streaming Claude call that returns plain text. Errors become short, safe client messages. */
/** Newer models may think before they answer, and thinking counts against max_tokens. A tight cap can be spent
 *  entirely on thinking and come back with no text, so every call gets room for both, and one retry with more. */
export const MIN_MAX_TOKENS = 4000;
export const RETRY_MAX_TOKENS = 12000;
export const tokenBudget = (asked: number | undefined) => Math.max(asked ?? MIN_MAX_TOKENS, MIN_MAX_TOKENS);

export async function claudeText(opts: { apiKey: string; system: string; user: string; maxTokens?: number; timeoutMs?: number; label: string; model?: string }): Promise<string> {
  const first = await claudeOnce(opts, tokenBudget(opts.maxTokens));
  if (first.text) return first.text;
  if (first.stop === "max_tokens") {
    const again = await claudeOnce(opts, RETRY_MAX_TOKENS);
    if (again.text) return again.text;
  }
  throw new AiTextError("The draft came back empty. Try again.", 502);
}

async function claudeOnce(opts: { apiKey: string; system: string; user: string; timeoutMs?: number; label: string; model?: string }, maxTokens: number): Promise<{ text: string; stop: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: opts.model || process.env.CINDER_ASK_MODEL?.trim() || "claude-sonnet-5-5", max_tokens: maxTokens, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 80_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new AiTextError(timeout ? "Drafting took too long. Try again." : "Couldn't reach the AI provider. Try again.", timeout ? 504 : 502);
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const f = classifyProviderError(res.status, payload?.error?.type, payload?.error?.message);
    console.error(`${opts.label} provider error`, { status: res.status, type: payload?.error?.type, message: sanitizeForLog(payload?.error?.message) });
    throw new AiTextError(f.clientMessage.replace(/research provider/g, "AI provider").replace(/audit request/g, "request"), f.status);
  }
  const text = (Array.isArray(payload.content) ? payload.content : []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  if (!text) console.error(`${opts.label} came back empty`, { model: payload?.model, stop: payload?.stop_reason, maxTokens, blocks: (payload?.content ?? []).map((b: { type: string }) => b.type) });
  return { text, stop: String(payload?.stop_reason ?? "") };
}
