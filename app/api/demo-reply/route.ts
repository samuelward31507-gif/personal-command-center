import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { claudeText, AiTextError } from "@/lib/ai-text";
import { demoPrompt, parseDemo, rateDecision, validateDemo } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/demo-reply — public website demo. Writes the instant reply a fence or pool company's customer would get.
 * Nothing is texted or emailed, and no lead is created. Only a hashed IP and time are kept, to rate-limit abuse.
 */
export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || !process.env.DATABASE_URL) return reply({ error: "The demo is offline right now." }, 503);
  const input = validateDemo(await request.json().catch(() => null));
  if (input === "spam") return reply({ error: "Something went wrong." }, 400);
  if ("error" in input) return reply(input, 400);
  const sql = neon(process.env.DATABASE_URL);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update("cinder-demo:" + ip).digest("hex").slice(0, 32);
  const counts = await sql`SELECT count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip, count(*)::int AS total FROM public.demo_runs WHERE at > now() - interval '1 day'` as { ip: number; total: number }[];
  const gate = rateDecision(counts[0]?.ip ?? 0, counts[0]?.total ?? 0);
  if (!gate.ok) return reply({ error: gate.error }, 429);
  await sql`INSERT INTO public.demo_runs (ip_hash) VALUES (${ipHash})`;
  const started = Date.now();
  try {
    const p = demoPrompt(input);
    const text = await claudeText({ apiKey: key, system: p.system, user: p.user, maxTokens: 500, timeoutMs: 20_000, label: "Demo reply", model: process.env.CINDER_DEMO_MODEL?.trim() || "claude-haiku-5-5" });
    const out = parseDemo(text);
    if (!out) return reply({ error: "The demo hiccuped. Try again." }, 502);
    return reply({ ...out, business: input.business, ms: Date.now() - started });
  } catch (e) {
    return reply({ error: e instanceof AiTextError ? "The demo hiccuped. Try again." : "The demo hiccuped. Try again." }, 502);
  }
}
