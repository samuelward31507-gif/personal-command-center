import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { answerQuote, publicQuote, type PublicQuote } from "@/lib/client-close-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// /q/example: what a customer sees, for the example business and sales calls. Nothing is stored.
const EXAMPLE: PublicQuote = { business: "Ridgeline Fence Co.", owner: "Mike", phone: "+17205550100", customer: "Dana", amount: 4310, line: "80 ft, 6 ft Wood privacy, 1 gate",
  note: "Tear out and haul away the old chain link. Steel posts set in concrete and one 4 ft walk gate, whichever fence you pick. Two-year workmanship warranty.", sent: new Date().toISOString().slice(0, 10), state: "open", answeredAt: null,
  deposit: 1000, payLink: "https://square.link/u/example",
  items: [{ name: "6 ft Wood privacy, pine pickets", qty: 80, unit: "ft", price: 43, tier: "Good" }, { name: "6 ft Cedar privacy with cap and trim", qty: 80, unit: "ft", price: 52, tier: "Better" }, { name: "6 ft White vinyl privacy, lifetime warranty", qty: 80, unit: "ft", price: 64, tier: "Best" },
    { name: "Walk gate", qty: 1, unit: "", price: 550 }, { name: "Tear-out and haul-away", qty: 80, unit: "ft", price: 4 },
    { name: "Stain and seal", qty: 80, unit: "ft", price: 6, opt: true }, { name: "12 ft double drive gate", qty: 1, unit: "", price: 1200, opt: true }], tax_rate: 0,
  financing: { link: "https://example.com/financing", note: "Pay over time with Wisetack. See your rate in 30 seconds, no hit to your credit." }, warranty: "Two years on workmanship. Materials carry the maker's warranty.",
  terms: "Prices hold for 30 days. A deposit holds the install date and comes off the final invoice. The balance is due when the job is done. We call 811 before digging; the property line is the owner's to confirm." };

// The example business's other customers, so each quote link in the demo opens that customer's own quote.
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const EXAMPLES: Record<string, PublicQuote> = {
  "example-carla": { ...EXAMPLE, customer: "Carla", amount: 6900, line: "150 ft, 6 ft Vinyl, 1 gate", note: "The old fence is already down. White vinyl privacy, posts set in concrete, one 4 ft walk gate.", sent: day(-5), state: "approved", answeredAt: day(-4), deposit: 2300,
    items: [{ name: "6 ft White vinyl privacy", qty: 150, unit: "ft", price: 42 }, { name: "Walk gate, 4 ft", qty: 1, unit: "", price: 600 }], tax_rate: 0 },
  "example-lena": { ...EXAMPLE, customer: "Lena", amount: 7800, line: "160 ft, 6 ft Vinyl, 1 gate", note: "Remove the old wood fence, 6 ft white vinyl privacy, one 4 ft gate.", sent: day(-6), deposit: 1500,
    items: [{ name: "6 ft White vinyl privacy", qty: 160, unit: "ft", price: 42, tier: "Good" }, { name: "6 ft Vinyl privacy with lattice top", qty: 160, unit: "ft", price: 49, tier: "Better" }, { name: "6 ft Tan vinyl, heavy-duty posts, lifetime warranty", qty: 160, unit: "ft", price: 56, tier: "Best" },
      { name: "Walk gate", qty: 1, unit: "", price: 760 }, { name: "Tear-out and haul-away", qty: 160, unit: "ft", price: 2 }, { name: "Second walk gate", qty: 1, unit: "", price: 760, opt: true }, { name: "Post caps, solar lit", qty: 18, unit: "", price: 28, opt: true }], tax_rate: 0 },
  "example-kyle": { ...EXAMPLE, customer: "Kyle", amount: 12400, line: "900 ft, Ranch rail, 2 gates", note: "Three-rail ranch fence around the pasture, two 12 ft drive gates for the trailer.", sent: day(-3), deposit: null,
    items: [{ name: "Ranch rail, 3 rail", qty: 900, unit: "ft", price: 12 }, { name: "Double drive gate, 12 ft", qty: 2, unit: "", price: 800 }], tax_rate: 0 },
  "example-jen": { ...EXAMPLE, customer: "Jen", amount: 2870, line: "110 ft, 5 ft Chain link, 1 gate", note: "Galvanized chain link along the back and side, one 4 ft walk gate.", sent: day(-1), deposit: null,
    items: [{ name: "5 ft chain link, installed", qty: 110, unit: "ft", price: 22 }, { name: "Walk gate, 4 ft", qty: 1, unit: "", price: 450 }], tax_rate: 0 },
};
const example = (token: string) => EXAMPLES[token] ?? (token === "example" || token.startsWith("example-") ? EXAMPLE : null);

/** GET /api/q?token=… — public: one quote behind its private link. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ex = example(token); if (ex) return reply(ex as unknown as Record<string, unknown>);
  if (!process.env.DATABASE_URL) return reply({ error: "This quote is unavailable right now." }, 503);
  try {
    const q = await publicQuote(neon(process.env.DATABASE_URL), token);
    return q ? reply(q as unknown as Record<string, unknown>) : reply({ error: "This quote link isn't valid. Text the business and they'll send a new one." }, 404);
  } catch (e) { console.error("Quote page failed", e instanceof Error ? e.message : e); return reply({ error: "This quote is unavailable right now." }, 500); }
}

/** POST { token, answer: approve | decline, reason? } — the customer's answer. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { token?: string; answer?: string; reason?: string; name?: string; choice?: unknown; signature?: string };
  const token = String(b.token ?? "");
  if (b.answer !== "approve" && b.answer !== "decline") return reply({ error: "Pick approve or no thanks." }, 400);
  if (example(token)) return reply({ ok: true, state: b.answer === "approve" ? "approved" : "declined" });
  if (!(await allowEvent("quote-answer", clientIp(req), 12, 60))) return reply({ error: "Too many tries. Text the business instead." }, 429);
  if (!process.env.DATABASE_URL) return reply({ error: "This quote is unavailable right now." }, 503);
  try {
    const r = await answerQuote(neon(process.env.DATABASE_URL), token, b.answer, String(b.reason ?? ""), String(b.name ?? ""), b.choice ?? null, typeof b.signature === "string" ? b.signature : "");
    return r.ok ? reply({ ok: true, state: r.state }) : reply({ error: r.error }, 404);
  } catch (e) { console.error("Quote answer failed", e instanceof Error ? e.message : e); return reply({ error: "That didn't go through. Try again, or text the business." }, 500); }
}
