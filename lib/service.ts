// Service plans, change orders and crew hours: the pure parts, shared by the server, the app and the example business.
import { cleanItems, cleanTax, totals, dollars, type Item } from "@/lib/billing";

// ---------- Service plans: a visit every N weeks or months ----------
export type PlanUnit = "week" | "month";
export type Plan = { id: string; thread_id: string; customer: string; phone: string; name: string; items: Item[]; tax_rate: number; total: number;
  every: number; unit: PlanUnit; next_on: string | null; time: string | null; ends_on: string | null; status: "active" | "paused" | "ended";
  remind: boolean; invoice: boolean; crew_member: string; visits_done: number; last_on: string | null; created_at: string };
export type Visit = { id: string; plan_id: string; thread_id: string; on_date: string; status: "done" | "skipped"; invoice_id: string | null };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ctl = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
export const cleanIsoDate = (v: unknown): string | null => typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(v + "T12:00:00Z")) ? v : null;
const cleanTime = (v: unknown): string | null => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
const plain = (items: Item[]) => items.map(({ tier: _t, opt: _o, ...rest }) => { void _t; void _o; return rest; });

/** The day one interval after `from`. Months keep the day of the month, clamped to the month's last day (Jan 31 to Feb 28). */
export function addInterval(from: string, every: number, unit: PlanUnit): string {
  const [y, m, d] = from.split("-").map(Number);
  if (unit === "week") return new Date(Date.UTC(y, m - 1, d + 7 * every)).toISOString().slice(0, 10);
  const target = new Date(Date.UTC(y, m - 1 + every, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
/** Every visit day from the plan's next visit through `to` (inclusive), at most `max`. Stops at the end date. */
export function visitDays(p: Pick<Plan, "next_on" | "every" | "unit" | "ends_on" | "status">, from: string, to: string, max = 60): string[] {
  if (p.status !== "active" || !p.next_on) return [];
  const out: string[] = [];
  for (let day = p.next_on, i = 0; day <= to && i < 400 && out.length < max; day = addInterval(day, p.every, p.unit), i++) {
    if (p.ends_on && day > p.ends_on) break;
    if (day >= from) out.push(day);
  }
  return out;
}
/** What a plan brings in a month, on average: weekly plans by 52/12, monthly by 1/N. */
export const monthlyValue = (p: Pick<Plan, "total" | "every" | "unit" | "status">) => p.status !== "active" ? 0 : Math.round((p.unit === "week" ? p.total * 52 / 12 / p.every : p.total / p.every) * 100) / 100;
export const everyLabel = (every: number, unit: PlanUnit) => unit === "month" && every === 12 ? "Once a year" : unit === "month" && every === 6 ? "Twice a year" : every === 1 ? (unit === "week" ? "Every week" : "Every month") : `Every ${every} ${unit}s`;
export const PLAN_PRESETS: [string, number, PlanUnit][] = [["Weekly", 1, "week"], ["Every 2 weeks", 2, "week"], ["Monthly", 1, "month"], ["Every 3 months", 3, "month"], ["Twice a year", 6, "month"], ["Once a year", 12, "month"]];

export type PlanInput = { name: string; items: Item[]; tax_rate: number; total: number; every: number; unit: PlanUnit; next_on: string; time: string | null; ends_on: string | null; remind: boolean; invoice: boolean; crew_member: string };
/** The owner's plan as typed: a name, at least one priced line, how often, and the first visit. */
export function cleanPlan(v: unknown): { ok: true; plan: PlanInput } | { ok: false; error: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = ctl(o.name, 80);
  if (!name) return { ok: false, error: "Name the plan, like Monthly pool service." };
  const items = plain(cleanItems(o.items));
  if (!items.length || totals(items, 0).total <= 0) return { ok: false, error: "Add what each visit costs." };
  const every = Math.round(Number(o.every));
  if (!(every >= 1 && every <= 52)) return { ok: false, error: "Pick how often." };
  const unit: PlanUnit = o.unit === "week" ? "week" : "month";
  const next_on = cleanIsoDate(o.next_on);
  if (!next_on) return { ok: false, error: "Pick the first visit day." };
  const ends_on = cleanIsoDate(o.ends_on);
  if (ends_on && ends_on < next_on) return { ok: false, error: "The end date is before the first visit." };
  const tax_rate = cleanTax(o.tax_rate);
  const crew = String(o.crew_member ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return { ok: true, plan: { name, items, tax_rate, total: totals(items, tax_rate).total, every, unit, next_on, time: cleanTime(o.time), ends_on, remind: o.remind !== false, invoice: o.invoice !== false, crew_member: crew.length === 10 ? "+1" + crew : "" } };
}
const clock12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`; };
/** The day-before text. One line, the business named, how to move it. */
export function visitReminderText(v: { first: string; business: string; plan: string; time: string | null }): string {
  const biz = v.business.trim().replace(/\.+$/, "") || "us";
  return `Hi${v.first ? " " + v.first : ""}, it's ${biz}. Reminder: your ${v.plan.trim().toLowerCase()} visit is tomorrow${v.time ? ` at ${clock12(v.time)}` : ""}. Reply here if you need to move it.`;
}

// ---------- Change orders: extra work mid-job the customer approves ----------
export type ChangeOrder = { id: string; thread_id: string; number: number; title: string; items: Item[]; tax_rate: number; total: number; note: string;
  status: "draft" | "sent" | "approved" | "declined" | "void"; url: string | null; sent_at: string | null; viewed_at: string | null; decided_at: string | null; signed_by: string; invoiced: boolean };
export const CO_TOKEN = /^[A-Za-z0-9_-]{24}$/;
export function cleanChangeOrder(v: unknown): { ok: true; title: string; items: Item[]; tax_rate: number; total: number; note: string } | { ok: false; error: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const title = ctl(o.title, 100);
  if (!title) return { ok: false, error: "Say what changed, like Add a second gate." };
  const items = plain(cleanItems(o.items));
  if (!items.length) return { ok: false, error: "Add at least one line with a price." };
  const tax_rate = cleanTax(o.tax_rate);
  return { ok: true, title, items, tax_rate, total: totals(items, tax_rate).total, note: ctl(o.note, 600) };
}
export function changeOrderText(v: { first: string; business: string; number: number; title: string; total: number; url: string }): string {
  const biz = v.business.trim().replace(/\.+$/, "") || "us";
  return `Hi${v.first ? " " + v.first : ""}, it's ${biz}. Here's change order #${v.number} (${v.title}) for ${dollars(v.total)}. You can look it over and approve it here: ${v.url}`;
}
/** The lines a change order adds to the invoice, each marked so the customer can see where it came from. */
export const changeOrderLines = (co: Pick<ChangeOrder, "number" | "items">): Item[] => co.items.map(i => ({ ...i, name: `Change order #${co.number}: ${i.name}`.slice(0, 120) }));
/** Approved change orders add to what the job is worth. */
export const approvedExtra = (cos: Pick<ChangeOrder, "status" | "total">[] | undefined) => (cos ?? []).filter(c => c.status === "approved").reduce((a, c) => a + c.total, 0);
/** What the job sells for: the invoice once there is one (approved change orders are on it), else the job value plus approved change orders. */
export function jobPrice(c: { invoice?: { total: number } | null; value: number | null; quote?: { amount: number | null } | null; changeOrders?: Pick<ChangeOrder, "status" | "total" | "invoiced">[] }): number | null {
  if (c.invoice?.total) return c.invoice.total;
  const base = c.value || c.quote?.amount || 0, extra = (c.changeOrders ?? []).filter(x => x.status === "approved").reduce((a, x) => a + x.total, 0);
  return base + extra || null;
}

// ---------- Crew hours ----------
export type TimeEntry = { id: string; thread_id: string | null; member: string; started_at: string; ended_at: string | null; note: string; customer?: string };
/** Minutes on an entry, an open one counting until now. Never negative, never more than 16 hours (a forgotten clock-out). */
export function minutesOf(e: Pick<TimeEntry, "started_at" | "ended_at">, now = Date.now()): number {
  const m = ((e.ended_at ? Date.parse(e.ended_at) : now) - Date.parse(e.started_at)) / 60000;
  return Math.max(0, Math.min(16 * 60, Math.round(m)));
}
export const hoursText = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; };
const d10 = (p: string) => p.replace(/\D/g, "").slice(-10);
/** The labor cost of a set of entries: each person's minutes at their hourly rate, the owner's own time and anyone without a rate at `ownerRate`. */
export function laborOf(entries: Pick<TimeEntry, "member" | "started_at" | "ended_at">[], rates: Record<string, number>, ownerRate: number, now = Date.now()): { minutes: number; cost: number } {
  let minutes = 0, cost = 0;
  for (const e of entries) { const m = minutesOf(e, now); minutes += m; cost += (m / 60) * (e.member ? rates[d10(e.member)] || ownerRate : ownerRate); }
  return { minutes, cost: Math.round(cost) };
}
export const cleanRate = (v: unknown) => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 && n <= 500 ? Math.round(n * 100) / 100 : 0; };
/** Rates by the last ten digits of each team member's cell. */
export const ratesOf = (team: { cell: string; rate?: number }[]) => Object.fromEntries(team.filter(m => m.rate).map(m => [d10(m.cell), m.rate!]));

// ---------- The price list: the owner's saved lines, picked while writing a quote or invoice ----------
export type CatalogItem = { name: string; unit: string; price: number; cost?: number };
/** Up to 300 saved lines, each with a name and a price of zero or more; the first of any duplicate name wins. */
export function cleanCatalog(v: unknown): CatalogItem[] {
  let arr: unknown = v;
  if (typeof v === "string") { try { arr = JSON.parse(v); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  const out: CatalogItem[] = [], seen = new Set<string>();
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = ctl(o.name, 120), key = name.toLowerCase();
    const price = Number(String(o.price ?? "").replace(/[$,\s]/g, "")), cost = Number(String(o.cost ?? "").replace(/[$,\s]/g, ""));
    if (!name || seen.has(key) || !Number.isFinite(price) || price < 0 || price > 10_000_000) continue;
    seen.add(key);
    out.push({ name, unit: ctl(o.unit, 12), price: Math.round(price * 100) / 100, ...(Number.isFinite(cost) && cost > 0 ? { cost: Math.round(cost * 100) / 100 } : {}) });
    if (out.length >= 300) break;
  }
  return out;
}
/** Saved lines that match what's being typed: names starting with it first, then names containing it. */
export function searchCatalog(list: CatalogItem[], q: string, max = 8): CatalogItem[] {
  const t = q.trim().toLowerCase();
  if (!t) return list.slice(0, max);
  const starts = list.filter(i => i.name.toLowerCase().startsWith(t)), has = list.filter(i => !i.name.toLowerCase().startsWith(t) && i.name.toLowerCase().includes(t));
  return [...starts, ...has].slice(0, max);
}

// ---------- Job sign-off: the customer signs on the crew's phone ----------
export type Signoff = { id: string; thread_id: string; signed_by: string; at: string; note: string; checklist: { label: string; done: boolean }[]; member: string };
export const SIG_MAX = 120_000;
export function cleanSignoff(v: unknown): { ok: true; signedBy: string; signature: string; note: string; checklist: { label: string; done: boolean }[] } | { ok: false; error: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const signedBy = ctl(o.signedBy, 80);
  if (signedBy.length < 2) return { ok: false, error: "Type the customer's name." };
  const signature = String(o.signature ?? "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > SIG_MAX) return { ok: false, error: "Have them sign in the box." };
  const checklist = (Array.isArray(o.checklist) ? o.checklist : []).slice(0, 20).map(x => { const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>; return { label: ctl(r.label, 80), done: r.done === true }; }).filter(x => x.label);
  return { ok: true, signedBy, signature, note: ctl(o.note, 600), checklist };
}

/** When a tap happened, for a clock-in or out sent later from a phone that was offline: the last 24 hours, never the future. */
export function tappedAt(v: unknown, now = Date.now()): string {
  const t = Date.parse(String(v ?? ""));
  return new Date(Number.isFinite(t) ? Math.min(now, Math.max(now - 24 * 3600000, t)) : now).toISOString();
}
