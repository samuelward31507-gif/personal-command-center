import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { answerChangeOrder, publicChangeOrder, type PublicChangeOrder } from "@/lib/client-service-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// /c/example: what a customer sees, for the example business and sales calls. Nothing is stored.
const EXAMPLE: PublicChangeOrder = { business: "Ridgeline Fence Co.", owner: "Mike", phone: "+17205550100", customer: "Carla", number: 1, title: "Add a second walk gate on the east side",
  items: [{ name: "4 ft vinyl walk gate, installed", qty: 1, unit: "", price: 760 }, { name: "Gate post in concrete", qty: 1, unit: "", price: 140 }], tax_rate: 0, total: 900,
  note: "Matches the new fence. Goes in the same day as the install.", sent: new Date().toISOString(), state: "open", answeredAt: null, signedBy: "",
  terms: "The change is added to your final invoice. Everything else on your original quote stays the same." };

/** GET /api/c?token=… — public: one change order behind its private link. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token === "example") return reply(EXAMPLE as unknown as Record<string, unknown>);
  if (!process.env.DATABASE_URL) return reply({ error: "This change order is unavailable right now." }, 503);
  try {
    const q = await publicChangeOrder(neon(process.env.DATABASE_URL), token);
    return q ? reply(q as unknown as Record<string, unknown>) : reply({ error: "This link isn't valid. Text the business and they'll send a new one." }, 404);
  } catch (e) { console.error("Change order page failed", e instanceof Error ? e.message : e); return reply({ error: "This change order is unavailable right now." }, 500); }
}

/** POST { token, answer: approve | decline, name } — the customer's answer. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { token?: string; answer?: string; name?: string };
  const token = String(b.token ?? "");
  if (b.answer !== "approve" && b.answer !== "decline") return reply({ error: "Pick approve or no thanks." }, 400);
  if (token === "example") return reply({ ok: true, state: b.answer === "approve" ? "approved" : "declined" });
  if (!(await allowEvent("co-answer", clientIp(req), 12, 60))) return reply({ error: "Too many tries. Text the business instead." }, 429);
  if (!process.env.DATABASE_URL) return reply({ error: "This change order is unavailable right now." }, 503);
  try {
    const r = await answerChangeOrder(neon(process.env.DATABASE_URL), token, b.answer, String(b.name ?? ""));
    return r.ok ? reply({ ok: true, state: r.state }) : reply({ error: r.error }, 400);
  } catch (e) { console.error("Change order answer failed", e instanceof Error ? e.message : e); return reply({ error: "That didn't go through. Try again, or text the business." }, 500); }
}
