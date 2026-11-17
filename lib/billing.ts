// Quotes with line items and invoices, without the money ever passing through Cinder. Pure functions shared by the
// server, the app and the customer's pages. Amounts are dollars with cents; totals are worked out here, never typed.

/** A quote or invoice line. `tier`: belongs to one option the customer picks between (Good, Better, Best).
 *  `opt`: an add-on the customer can tick. Lines with neither are always included. */
export type Item = { name: string; qty: number; unit: string; price: number; tier?: string; opt?: boolean };
export type Choice = { tier: string | null; addons: number[] };
export type Totals = { subtotal: number; tax: number; total: number };

const cents = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : NaN; };

/** Up to 30 lines, each with a name, a quantity above zero and a price of zero or more. Anything else is dropped. */
export function cleanItems(input: unknown): Item[] {
  if (!Array.isArray(input)) return [];
  const out: Item[] = [];
  for (const r of input.slice(0, 30)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = String(o.name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
    const qty = num(o.qty ?? 1), price = num(o.price);
    if (!name || !(qty > 0) || qty > 100000 || !(price >= 0) || price > 10_000_000) continue;
    const tier = String(o.tier ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 40);
    out.push({ name, qty: cents(qty), unit: String(o.unit ?? "").trim().slice(0, 12), price: cents(price), ...(tier ? { tier } : {}), ...(o.opt === true && !tier ? { opt: true } : {}) });
  }
  return out;
}
/** Tax as a percentage, 0 to 20. */
export const cleanTax = (v: unknown): number => { const n = num(v); return n >= 0 && n <= 20 ? cents(n) : 0; };
export function totals(items: Item[], taxRate = 0): Totals {
  const subtotal = cents(items.reduce((a, i) => a + i.qty * i.price, 0));
  const tax = cents(subtotal * (taxRate / 100));
  return { subtotal, tax, total: cents(subtotal + tax) };
}
export const lineTotal = (i: Item) => cents(i.qty * i.price);
/** The options on a quote, in the order the owner added them. Empty when there's only one way to do the job. */
export const tiersOf = (items: Item[]) => [...new Set(items.map(i => i.tier).filter((t): t is string => !!t))];
/** What the customer is buying for a choice: the lines always included, the chosen option's lines, ticked add-ons. */
export function chosen(items: Item[], c: Choice | null): Item[] {
  const tiers = tiersOf(items), tier = c?.tier && tiers.includes(c.tier) ? c.tier : tiers[0] ?? null;
  return items.filter((i, k) => i.opt ? !!c?.addons.includes(k) : !i.tier || i.tier === tier).map(({ tier: _t, opt: _o, ...rest }) => { void _t; void _o; return rest; });
}
/** Cleans a customer's choice against the quote's own lines. */
export function cleanChoice(v: unknown, items: Item[]): Choice {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const tiers = tiersOf(items), tier = typeof o.tier === "string" && tiers.includes(o.tier) ? o.tier : tiers[0] ?? null;
  const addons = Array.isArray(o.addons) ? [...new Set(o.addons.map(Number).filter(k => Number.isInteger(k) && items[k]?.opt))] : [];
  return { tier, addons };
}
export const dollars = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

// ---------- Invoices ----------
export const INVOICE_TOKEN = /^[A-Za-z0-9_-]{24}$/;
export const DUE_DAYS = [0, 7, 14, 30] as const;
export type InvoiceState = "draft" | "sent" | "paid" | "void";
/** Overdue once the due date has passed and it isn't paid. */
export const overdue = (status: string, dueOn: string | null, today: string) => status === "sent" && !!dueOn && dueOn < today;
/** The pay link the owner already uses (Square, Stripe, PayPal, his own site). https only, no credentials in it. */
export function cleanPayLink(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? u.toString().slice(0, 400) : ""; }
  catch { return ""; }
}
export function invoiceText(v: { first: string; business: string; number: number; total: number; due: string | null; url: string }): string {
  const biz = v.business.trim().replace(/\.+$/, "") || "us";
  return `Hi${v.first ? " " + v.first : ""}, here's invoice #${v.number} from ${biz} for ${dollars(v.total)}${v.due ? `, due ${v.due}` : ""}. You can see it and pay here: ${v.url}`;
}
/**
 * Payment reminders for a sent invoice: the day after it's due, a week later, then two weeks later. Three at most;
 * a reply, a payment or the owner pausing them stops them.
 */
export const REMINDER_DAYS = [1, 7, 14] as const;
export function reminderDue(r: { status: string; dueOn: string | null; reminders: number; paused: boolean }, today: string): number | null {
  if (r.status !== "sent" || r.paused || !r.dueOn || r.reminders >= REMINDER_DAYS.length) return null;
  const days = Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(r.dueOn + "T12:00:00Z")) / 86400000);
  return days >= REMINDER_DAYS[r.reminders] ? r.reminders : null;
}
export const REMINDER_TEXTS = [
  "Hi {first}, a friendly reminder from {business}: invoice #{number} for {total} was due yesterday. You can pay here: {url}",
  "Hi {first}, {business} here. Invoice #{number} for {total} is still open. Here's the link to pay: {url} Any questions, just reply.",
  "Hi {first}, last reminder from {business} on invoice #{number} ({total}): {url} If something's off, reply and {owner} will sort it out.",
] as const;
/** The same three reminders as emails: a subject, a few short lines, and the pay button (the owner's own invoice page). */
export function reminderEmail(step: number, v: { first: string; business: string; owner: string; number: number; total: number; dueOn: string }): { subject: string; lines: string[]; button: string } {
  const biz = v.business.trim().replace(/\.+$/, "") || "us", hi = `Hi${v.first ? " " + v.first : ""},`, amt = dollars(v.total);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(v.dueOn) ? new Date(v.dueOn + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) : "";
  const s = Math.max(0, Math.min(2, Math.round(step)));
  return {
    subject: s === 0 ? `Reminder: invoice #${v.number} from ${biz}` : s === 1 ? `Invoice #${v.number} from ${biz} is still open` : `Last reminder: invoice #${v.number} from ${biz}`,
    lines: [hi, s === 0 ? `A friendly reminder that invoice #${v.number} for ${amt} was due${due ? ` ${due}` : ""}.` : s === 1 ? `Invoice #${v.number} for ${amt} is still open.` : `This is our last reminder about invoice #${v.number} for ${amt}.`,
      s === 2 ? `If something's off, just reply and ${v.owner || "we"} will sort it out.` : "You can see it and pay online. Questions? Just reply to this email.", `Thank you, ${biz}`],
    button: `Pay ${amt}`,
  };
}
/**
 * How a reminder goes out. Text when the business has a texting number and the customer a cell (and didn't opt out of
 * texts). Email when they have an address and either can't be texted or got the invoice by email in the first place.
 */
export function reminderChannels(o: { textingNumber: boolean; phone: string; optedOut: boolean; email: string; emailed: boolean }): { text: boolean; email: boolean } {
  const text = o.textingNumber && o.phone.replace(/\D/g, "").length >= 10 && !o.optedOut;
  const email = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(o.email.trim()) && (!text || o.emailed);
  return { text, email };
}
export function fillInvoice(t: string, v: { first: string; business: string; owner: string; number: number; total: number; url: string }): string {
  return t.replace(/\s*\{first\}(?=[,!.?])/g, v.first ? " " + v.first : "").replace(/\{first\}/g, v.first || "there")
    .replace(/\{business\}/g, v.business.trim().replace(/\.+$/, "")).replace(/\{owner\}/g, v.owner || "we").replace(/\{number\}/g, String(v.number))
    .replace(/\{total\}/g, dollars(v.total)).replace(/\{url\}/g, v.url);
}
