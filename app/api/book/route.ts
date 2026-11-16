import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { cleanMessages } from "@/lib/client-ops";
import { bookingPageLead, bookingSlots, type Client } from "@/lib/client-runtime-run";
import { importPhone } from "@/lib/customer-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The business's own booking page (/b/<website key>): a customer picks an estimate time from the owner's real
// calendar and leaves a name, cell, address and what they need. No sign-in. Every booking is on the consent log.
const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

async function byKey(key: string): Promise<Client | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key) || !process.env.DATABASE_URL) return null;
  const [r] = await neon(process.env.DATABASE_URL)`SELECT project_id, owner_id, setup, messages FROM public.client_ops WHERE chat_key = ${key} LIMIT 1` as Record<string, unknown>[];
  return r ? { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup ?? {}) as Record<string, string>, messages: cleanMessages(r.messages) } : null;
}

const EXAMPLE_DAY = (k: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + k); d.setHours(h, m, 0, 0); return d; };
const example = () => ({ business: "Ridgeline Fence Co.", owner: "Mike", trade: "Fence", area: "Littleton, Highlands Ranch, Castle Rock and 25 miles around", phone: "+17205550100", calendar: true,
  slots: [1, 2, 3, 5, 6].flatMap(k => [[8, 0], [10, 30], [15, 0]].map(([h, m]) => { const s = EXAMPLE_DAY(k, h, m); return { start: s.toISOString(), end: new Date(s.getTime() + 3600000).toISOString() }; })).filter(s => new Date(s.start).getDay() !== 0) });

/** GET ?key= — what the page shows: the business, and the open times (none when the calendar isn't connected). */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (key === "example") return reply(example());
  const c = await byKey(key);
  if (!c || c.setup.booking_page === "no") return reply({ error: "This booking page isn't available." }, 404);
  const slots = await bookingSlots(neon(process.env.DATABASE_URL!), c).catch(() => null);
  return reply({ business: c.setup.display_name || "", owner: (c.setup.owner_name || "").split(" ")[0], trade: c.setup.trade || "", area: c.setup.service_area || "", phone: c.setup.texting_number || "",
    calendar: !!slots, slots: (slots ?? []).map(s => ({ start: s.start, end: s.end })) });
}

/** POST { key, start?, name, phone, address, message, consent } — book it, or ask for a time when there's no calendar. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { key?: string; start?: string | null; name?: string; phone?: string; address?: string; message?: string; consent?: boolean; website?: string };
  if (b.website) return reply({ ok: true, booked: false }); // honeypot
  const name = String(b.name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  const phone = importPhone(b.phone);
  const address = String(b.address ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 160);
  const message = String(b.message ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, 600);
  if (!name) return reply({ error: "Add your name." }, 400);
  if (!phone) return reply({ error: "A 10-digit cell number is needed so we can text you." }, 400);
  if (!b.consent) return reply({ error: "Check the box so we can text you about this." }, 400);
  const start = typeof b.start === "string" && !Number.isNaN(Date.parse(b.start)) ? new Date(b.start).toISOString() : null;
  if (b.key === "example") return reply({ ok: true, booked: !!start, when: start ? new Date(start).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "" });
  const ip = clientIp(req);
  if (!(await allowEvent("booking-page", ip, 8, 60))) return reply({ error: "Too many tries. Text the business instead." }, 429);
  const c = await byKey(String(b.key ?? ""));
  if (!c || c.setup.booking_page === "no") return reply({ error: "This booking page isn't available." }, 404);
  if (!c.setup.texting_number) return reply({ error: "Online booking isn't switched on yet. Call the business." }, 503);
  try {
    // Slot ids compare as ISO strings: match the calendar's own format.
    const slots = start ? await bookingSlots(neon(process.env.DATABASE_URL!), c, 60) : null;
    const picked = start ? slots?.find(s => new Date(s.start).toISOString() === start)?.start ?? start : null;
    const r = await bookingPageLead(neon(process.env.DATABASE_URL!), c, { name, phone, address, message, start: picked }, ip);
    return r.ok ? reply({ ok: true, booked: r.booked, when: r.when ?? "" }) : reply({ error: r.error }, 409);
  } catch (e) { console.error("Booking page failed", e instanceof Error ? e.message : e); return reply({ error: "That didn't go through. Text the business instead." }, 500); }
}
