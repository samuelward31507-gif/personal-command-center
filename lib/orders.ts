// Material orders, the pure part: what an order may hold, its total, a list pulled from the quote at the owner's own
// costs, and the order as plain text for the supplier. No database here, so every rule is tested on its own.

export const ORDER_STATUS = [["draft", "Draft"], ["ordered", "Ordered"], ["received", "Received"], ["canceled", "Canceled"]] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number][0];
export const isOrderStatus = (v: unknown): v is OrderStatus => ORDER_STATUS.some(s => s[0] === v);
export type OrderLine = { name: string; qty: number; unit: string; cost: number };
export type OrderIn = { supplier: string; supplier_email: string; items: OrderLine[]; needed_on: string | null; note: string };
export type Order = OrderIn & { id: string; thread_id: string; status: OrderStatus; ordered_at: string | null; received_at: string | null; created_at: string; customer?: string };

const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The lines: up to 60, each a name; quantity above zero; cost per unit optional (0 = not known yet). */
export function cleanOrderLines(v: unknown): OrderLine[] {
  const out: OrderLine[] = [];
  for (const x of Array.isArray(v) ? v.slice(0, 60) : []) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const name = ctl(o.name, 120);
    const qty = Math.round(Number(String(o.qty ?? 1).replace(/[^\d.]/g, "")) * 100) / 100;
    const cost = r2(Number(String(o.cost ?? 0).replace(/[$,\s]/g, "")) || 0);
    if (!name || !(qty > 0) || qty > 100000 || cost < 0 || cost > 1_000_000) continue;
    out.push({ name, qty, unit: ctl(o.unit, 12), cost });
  }
  return out;
}

/** One order from the form, checked. A supplier email must look like one; the date is a plain YYYY-MM-DD. */
export function cleanOrder(input: unknown): OrderIn | { error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const items = cleanOrderLines(o.items);
  if (!items.length) return { error: "Add at least one line: what to order and how many." };
  const email = ctl(o.supplier_email, 120).toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return { error: "That supplier email doesn't look right." };
  const needed = /^\d{4}-\d{2}-\d{2}$/.test(String(o.needed_on ?? "")) ? String(o.needed_on) : null;
  return { supplier: ctl(o.supplier, 80), supplier_email: email, items, needed_on: needed, note: ctl(o.note, 500) };
}

export const orderTotal = (items: OrderLine[]) => r2(items.reduce((a, i) => a + i.qty * i.cost, 0));

/**
 * The materials on the quote, at what they cost the owner (the price list's "your cost", matched by name). Optional
 * add-ons are left out; with good-better-best tiers, only `picked` (else the first tier, as the quote page shows it).
 */
export function linesFromQuote(items: { name: string; qty: number; unit: string; price: number; tier?: string; opt?: boolean }[], catalog: { name: string; cost?: number }[], picked?: string): OrderLine[] {
  const cost = new Map(catalog.map(c => [c.name.trim().toLowerCase(), c.cost ?? 0]));
  const tier = picked ?? items.find(i => i.tier)?.tier;
  return items.filter(i => !i.opt && (!i.tier || i.tier === tier) && i.name.trim())
    .map(i => ({ name: i.name.trim().slice(0, 120), qty: i.qty > 0 ? i.qty : 1, unit: (i.unit || "").slice(0, 12), cost: r2(cost.get(i.name.trim().toLowerCase()) ?? 0) }));
}

/** The order as the supplier reads it: who, for which job, by when, the lines. Costs stay out (the supplier prices it). */
export function orderText(o: Pick<OrderIn, "items" | "needed_on" | "note" | "supplier">, ctx: { business: string; owner?: string; phone?: string; address?: string }): string {
  const when = o.needed_on ? new Date(o.needed_on + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "";
  return [
    `${o.supplier ? `Hi ${o.supplier},` : "Hi,"}`, "",
    `Please quote and confirm this order for ${ctx.business || "us"}${ctx.address ? `, job at ${ctx.address}` : ""}.${when ? ` Needed by ${when}.` : ""}`, "",
    ...o.items.map(i => `- ${i.qty}${i.unit ? " " + i.unit : ""} ${i.name}`),
    ...(o.note ? ["", o.note] : []), "",
    `Thanks,`, [ctx.owner, ctx.phone].filter(Boolean).join(", ") || ctx.business,
  ].join("\n");
}
