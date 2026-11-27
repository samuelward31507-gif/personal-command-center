import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { CHAT_LIMITS, chatSystem, cleanReply, validateChat } from "@/lib/site-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const ALLOWED = [/^https:\/\/(www\.)?cinderrevenue\.com$/, /^https:\/\/cinder-revenue-company[a-z0-9-]*\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const BOOK = "Book the free audit and we will go through it with you.";
// If the rate-limit table is not there yet, fall back to a per-instance count so the endpoint is never wide open.
const seen = new Map<string, { n: number; day: string }>();

/**
 * POST /api/site-chat — the assistant in the corner of cinderrevenue.com. Takes the conversation so far and returns one
 * short reply that points at the build that fits and at booking the audit. Message text is sent to the model and not stored;
 * only a hashed IP and a time are kept, to rate-limit.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED.some((r) => r.test(origin))) return reply({ error: "Not allowed." }, 403);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return reply({ error: "offline" }, 503);
  const input = validateChat(await request.json().catch(() => null));
  if ("error" in input) return input.error === "limit" ? reply({ reply: "That is about as far as I can take it here. " + BOOK, done: true }) : reply(input, 400);

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update("cinder-chat:" + ip).digest("hex").slice(0, 32);
  let over = false;
  try {
    if (!process.env.DATABASE_URL) throw new Error("no database");
    const sql = neon(process.env.DATABASE_URL);
    const c = await sql`SELECT count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip, count(*)::int AS total FROM public.site_chat_turns WHERE at > now() - interval '1 day'` as { ip: number; total: number }[];
    over = (c[0]?.ip ?? 0) >= CHAT_LIMITS.perIpDay || (c[0]?.total ?? 0) >= CHAT_LIMITS.totalDay;
    if (!over) await sql`INSERT INTO public.site_chat_turns (ip_hash) VALUES (${ipHash})`;
  } catch {
    const day = new Date().toISOString().slice(0, 10), e = seen.get(ipHash);
    const n = e && e.day === day ? e.n + 1 : 1; seen.set(ipHash, { n, day }); over = n > CHAT_LIMITS.perIpDay;
    if (seen.size > 5000) seen.clear();
  }
  if (over) return reply({ reply: "I have answered a lot of questions today. " + BOOK, done: true });

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      // Newer models may think before answering and thinking counts against max_tokens, so leave room for both.
      body: JSON.stringify({ model: process.env.CINDER_CHAT_MODEL?.trim() || "claude-haiku-5-5", max_tokens: 4000, system: chatSystem(), messages: input.messages }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch { return reply({ error: "offline" }, 502); }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) { console.error("site-chat provider error", { status: res.status, type: payload?.error?.type }); return reply({ error: "offline" }, 502); }
  const text = (Array.isArray(payload.content) ? payload.content : []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  if (!text) return reply({ error: "offline" }, 502);
  return reply({ reply: cleanReply(text) });
}
