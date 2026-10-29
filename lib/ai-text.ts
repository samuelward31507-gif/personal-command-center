import { classifyProviderError, sanitizeForLog } from "@/lib/business-audit";

export class AiTextError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "AiTextError"; }
}

/** One non-streaming Claude call that returns plain text. Errors become short, safe client messages. */
export async function claudeText(opts: { apiKey: string; system: string; user: string; maxTokens?: number; timeoutMs?: number; label: string }): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.CINDER_ASK_MODEL?.trim() || "claude-sonnet-5-5", max_tokens: opts.maxTokens ?? 4000, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
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
  if (!text) throw new AiTextError("The draft came back empty. Try again.", 502);
  return text;
}
