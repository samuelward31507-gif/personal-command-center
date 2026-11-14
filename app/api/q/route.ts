import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { answerQuote, publicQuote, type PublicQuote } from "@/lib/client-close-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// /q/example: what a customer sees, for the example business and sales calls. Nothing is stored.
const EXAMPLE: PublicQuote = { business: "Ridgeline Fence Co.", owner: "Mike", phone: "+17205550100", customer: "Dana", amount: 4200, line: "80 ft · 6 ft Wood privacy · 1 gate",
  note: "Tear out and haul away the old chain link. Cedar pickets, steel posts set in concrete, one 4 ft walk gate. Two-year workmanship warranty.", sent: new Date().toISOString().slice(0, 10), state: "open", answeredAt: null };

/** GET /api/q?token=… — public: one quote behind its private link. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token === "example") return reply(EXAMPLE as unknown as Record<string, unknown>);
  if (!process.env.DATABASE_URL) return reply({ error: "This quote is unavailable right now." }, 503);
  try {
    const q = await publicQuote(neon(process.env.DATABASE_URL), token);
    return q ? reply(q as unknown as Record<string, unknown>) : reply({ error: "This quote link isn't valid. Text the business and they'll send a new one." }, 404);
  } catch (e) { console.error("Quote page failed", e instanceof Error ? e.message : e); return reply({ error: "This quote is unavailable right now." }, 500); }
}

/** POST { token, answer: approve | decline, reason? } — the customer's answer. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { token?: string; answer?: string; reason?: string };
  const token = String(b.token ?? "");
  if (b.answer !== "approve" && b.answer !== "decline") return reply({ error: "Pick approve or no thanks." }, 400);
  if (token === "example") return reply({ ok: true, state: b.answer === "approve" ? "approved" : "declined" });
  if (!(await allowEvent("quote-answer", clientIp(req), 12, 60))) return reply({ error: "Too many tries. Text the business instead." }, 429);
  if (!process.env.DATABASE_URL) return reply({ error: "This quote is unavailable right now." }, 503);
  try {
    const r = await answerQuote(neon(process.env.DATABASE_URL), token, b.answer, String(b.reason ?? ""));
    return r.ok ? reply({ ok: true, state: r.state }) : reply({ error: r.error }, 404);
  } catch (e) { console.error("Quote answer failed", e instanceof Error ? e.message : e); return reply({ error: "That didn't go through. Try again, or text the business." }, 500); }
}
