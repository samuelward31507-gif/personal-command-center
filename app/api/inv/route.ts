import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { claimPaid, publicInvoice, type PublicInvoice } from "@/lib/client-billing-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// /i/example: what a customer sees, for the example business and sales calls. Nothing is stored.
const EXAMPLE: PublicInvoice = { business: "Ridgeline Fence Co.", owner: "Mike", phone: "+17205550100", customer: "Dana Ruiz", number: 1042,
  items: [{ name: "6 ft Wood privacy fence, installed", qty: 80, unit: "ft", price: 43 }, { name: "Walk gate", qty: 1, unit: "", price: 550 }, { name: "Tear-out and haul-away", qty: 80, unit: "ft", price: 4 }],
  tax_rate: 0, total: 4310, note: "Thanks for choosing us. Two-year workmanship warranty on everything we installed.", due_on: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  issued: new Date().toISOString().slice(0, 10), status: "open", pay_link: "https://square.link/u/example", claimed: false, address: "2210 Oak Dr, Littleton",
  paid_amount: 1000, payments: [{ amount: 1000, paid_on: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) }] };

/** GET /api/inv?token=… — public: one invoice behind its private link. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token === "example") return reply(EXAMPLE as unknown as Record<string, unknown>);
  if (!process.env.DATABASE_URL) return reply({ error: "This invoice is unavailable right now." }, 503);
  try {
    const r = await publicInvoice(neon(process.env.DATABASE_URL), token);
    return r ? reply(r as unknown as Record<string, unknown>) : reply({ error: "This invoice link isn't valid. Text the business and they'll send a new one." }, 404);
  } catch (e) { console.error("Invoice page failed", e instanceof Error ? e.message : e); return reply({ error: "This invoice is unavailable right now." }, 500); }
}

/** POST { token } — the customer says they paid. The owner checks and marks it. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { token?: string };
  const token = String(b.token ?? "");
  if (token === "example") return reply({ ok: true });
  if (!(await allowEvent("invoice-claim", clientIp(req), 10, 60))) return reply({ error: "Too many tries. Text the business instead." }, 429);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  try { const r = await claimPaid(neon(process.env.DATABASE_URL), token); return r.ok ? reply({ ok: true }) : reply({ error: r.error }, 404); }
  catch (e) { console.error("Invoice claim failed", e instanceof Error ? e.message : e); return reply({ error: "That didn't go through. Text the business." }, 500); }
}
