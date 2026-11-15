// Quotes with line items and invoices, without the money ever passing through Cinder. Pure functions shared by the
// server, the app and the customer's pages. Amounts are dollars with cents; totals are worked out here, never typed.

export type Item = { name: string; qty: number; unit: string; price: number };
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
    out.push({ name, qty: cents(qty), unit: String(o.unit ?? "").trim().slice(0, 12), price: cents(price) });
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
export function fillInvoice(t: string, v: { first: string; business: string; owner: string; number: number; total: number; url: string }): string {
  return t.replace(/\s*\{first\}(?=[,!.?])/g, v.first ? " " + v.first : "").replace(/\{first\}/g, v.first || "there")
    .replace(/\{business\}/g, v.business.trim().replace(/\.+$/, "")).replace(/\{owner\}/g, v.owner || "we").replace(/\{number\}/g, String(v.number))
    .replace(/\{total\}/g, dollars(v.total)).replace(/\{url\}/g, v.url);
}
