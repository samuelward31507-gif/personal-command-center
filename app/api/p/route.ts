import { neon } from "@neondatabase/serverless";
import { portalPhoto, publicPortal, rateJob, requestWork, type PublicPortal } from "@/lib/client-portal-run";
import { allowEvent } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const day = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA");

// /p/example: the customer page for the example business. Nothing is stored.
const EXAMPLE: PublicPortal = { business: "Ridgeline Fence Co.", owner: "Mike", phone: "+17205550100", customer: "Carla", payLink: "https://square.link/u/example", address: "905 Cherry St, Centennial",
  quotes: [{ amount: 6900, status: "approved", sent: day(-6), url: "/q/example", line: "" }],
  invoices: [{ number: 1043, total: 1500, balance: 0, status: "paid", due_on: day(-3), url: "/i/example", issued: new Date(Date.now() - 6 * 86400000).toISOString() },
    { number: 1044, total: 7800, balance: 6300, status: "sent", due_on: day(7), url: "/i/example", issued: new Date().toISOString() }],
  changeOrders: [{ number: 1, title: "Add a second walk gate on the east side", total: 900, status: "approved", url: "/c/example" }],
  coming: [{ kind: "install", date: day(0), time: "08:00", what: "Install day" }, { kind: "visit", date: day(92), time: "09:00", what: "Seasonal fence wash" }],
  photos: [], signoff: null, canRate: true, rating: null, reviewLink: "https://g.page/r/example" };

/** GET /api/p?token=… — public: one customer's page. &photo=<id> returns one of their after photos. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, token = q.get("token") ?? "";
  if (token === "example") return reply(EXAMPLE as unknown as Record<string, unknown>);
  if (!process.env.DATABASE_URL) return reply({ error: "This page is unavailable right now." }, 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const photo = q.get("photo");
    if (photo) {
      const p = await portalPhoto(sql, token, photo);
      return p ? new Response(new Uint8Array(p.bytes), { headers: { "Content-Type": p.mime || "image/jpeg", "Cache-Control": "private, max-age=86400" } }) : new Response("Not found", { status: 404 });
    }
    const r = await publicPortal(sql, token);
    return r ? reply(r.portal as unknown as Record<string, unknown>) : reply({ error: "This link isn't valid. Text the business and they'll send a new one." }, 404);
  } catch (e) { console.error("Customer page failed", e instanceof Error ? e.message : e); return reply({ error: "This page is unavailable right now." }, 500); }
}

/** POST { token, action: "rate", rating, comment } or { token, action: "request", text }: from the customer's page. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { token?: string; action?: string; rating?: unknown; comment?: unknown; text?: unknown };
  const token = String(b.token ?? "");
  if (token === "example") return reply({ ok: true });
  if (!process.env.DATABASE_URL) return reply({ error: "This page is unavailable right now." }, 503);
  if (!(await allowEvent("portal-post", token.slice(0, 40), 10, 60))) return reply({ error: "That's a lot at once. Try again in a bit, or text the business." }, 429);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const r = b.action === "rate" ? await rateJob(sql, token, b.rating, b.comment) : b.action === "request" ? await requestWork(sql, token, b.text) : { ok: false, error: "Unknown." };
    return r.ok ? reply({ ok: true }) : reply({ error: r.error }, 400);
  } catch (e) { console.error("Customer page post failed", e instanceof Error ? e.message : e); return reply({ error: "That didn't go through. Text the business instead." }, 500); }
}
