// Pure parts of the QuickBooks Online connection (no network, no database), so they can be tested on their own.
// The owner connects once; from then on each customer, invoice and payment Cinder records is pushed to their books.
import { createHmac, timingSafeEqual } from "node:crypto";

export const QBO_AUTH = "https://appcenter.intuit.com/connect/oauth2";
export const QBO_TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QBO_SCOPE = "com.intuit.quickbooks.accounting";
export const qboApiBase = () => process.env.QBO_ENV?.trim() === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";

export function qboConfigured(): boolean {
  return !!(process.env.QBO_CLIENT_ID?.trim() && process.env.QBO_CLIENT_SECRET?.trim() && (process.env.CINDER_TOKEN_KEY?.trim().length ?? 0) >= 32);
}
export const qboRedirect = (origin: string) => `${origin.replace(/\/$/, "")}/api/client-qbo/callback`;

const sign = (s: string) => createHmac("sha256", process.env.CINDER_TOKEN_KEY?.trim() || "").update(s).digest("base64url").slice(0, 32);
/** "qb.<project>.<expires>.<sig>", good for 7 days so the owner can open the link later. */
export function qboState(projectId: string, now = Date.now()): string {
  const body = `qb.${projectId}.${Math.floor(now / 1000) + 7 * 86400}`;
  return `${body}.${sign(body)}`;
}
export function readQboState(state: string, now = Date.now()): string | null {
  const m = state.match(/^(qb\.([0-9a-f-]{36})\.(\d+))\.([A-Za-z0-9_-]+)$/i);
  if (!m || +m[3] * 1000 < now) return null;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[4]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[2] : null;
}
export function qboAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({ client_id: process.env.QBO_CLIENT_ID!.trim(), redirect_uri: qboRedirect(origin), response_type: "code", scope: QBO_SCOPE, state });
  return `${QBO_AUTH}?${p}`;
}

/** A QuickBooks query string literal: backslash-escaped single quotes. */
export const qboQuote = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
/** QuickBooks display names are unique per company and at most 100 characters; a phone keeps two "Dana"s apart. */
export function displayName(name: string, phone: string): string {
  const n = (name || "").replace(/[:\t\n]/g, " ").replace(/\s+/g, " ").trim();
  const d = phone.replace(/\D/g, "").slice(-10);
  const ph = d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : "";
  return (n ? (ph ? `${n} ${ph}` : n) : ph || "Customer").slice(0, 100);
}
export function customerBody(c: { name: string; phone: string; email?: string; address?: string }): Record<string, unknown> {
  const parts = (c.name || "").trim().split(/\s+/);
  return { DisplayName: displayName(c.name, c.phone), ...(parts[0] ? { GivenName: parts[0].slice(0, 100) } : {}), ...(parts.length > 1 ? { FamilyName: parts.slice(1).join(" ").slice(0, 100) } : {}),
    PrimaryPhone: { FreeFormNumber: c.phone }, ...(c.email ? { PrimaryEmailAddr: { Address: c.email } } : {}), ...(c.address ? { BillAddr: { Line1: c.address.slice(0, 500) } } : {}) };
}
const r2 = (n: number) => Math.round(n * 100) / 100;
/**
 * One invoice in QuickBooks' shape. Every line books to the owner's "Services" item. Sales tax rides as its own line so the
 * total in QuickBooks matches the invoice the customer saw (QuickBooks' own tax engine isn't used).
 */
export function invoiceBody(inv: { number: number; items: { name: string; qty: number; price: number }[]; tax_rate: number; due_on: string | null; note: string }, customerId: string, itemId: string): Record<string, unknown> {
  const lines = inv.items.map(i => ({ Amount: r2(i.qty * i.price), DetailType: "SalesItemLineDetail", Description: i.name.slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: i.qty, UnitPrice: i.price } }));
  const sub = r2(inv.items.reduce((a, i) => a + i.qty * i.price, 0)), tax = r2(sub * (inv.tax_rate / 100));
  if (tax > 0) lines.push({ Amount: tax, DetailType: "SalesItemLineDetail", Description: `Sales tax (${inv.tax_rate}%)`, SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: tax } });
  return { CustomerRef: { value: customerId }, DocNumber: String(inv.number), Line: lines, ...(inv.due_on ? { DueDate: inv.due_on } : {}), ...(inv.note ? { CustomerMemo: { value: inv.note.slice(0, 1000) } } : {}) };
}
const METHOD: Record<string, string> = { card: "Card", cash: "Cash", check: "Check", bank: "Bank transfer", other: "Other" };
export function paymentBody(p: { amount: number; paid_on: string; method: string; note: string }, customerId: string, invoiceQboId: string): Record<string, unknown> {
  return { CustomerRef: { value: customerId }, TotalAmt: r2(p.amount), TxnDate: p.paid_on, PrivateNote: [METHOD[p.method] ?? "Other", p.note].filter(Boolean).join(", ").slice(0, 4000),
    Line: [{ Amount: r2(p.amount), LinkedTxn: [{ TxnId: invoiceQboId, TxnType: "Invoice" }] }] };
}
