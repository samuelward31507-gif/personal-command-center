// Expenses and mileage, the pure part: what an entry may hold, the mileage rate, and the sums job costing and the
// Money screen use. No database here, so every rule is tested on its own.

export const EXPENSE_CATS = [
  ["materials", "Materials"], ["fuel", "Fuel"], ["equipment", "Tools and equipment rental"], ["subcontractor", "Subcontractor"],
  ["permit", "Permits and fees"], ["dump", "Dump and disposal"], ["vehicle", "Vehicle"], ["meals", "Meals"], ["office", "Office and software"], ["other", "Other"],
] as const;
export type ExpenseCat = (typeof EXPENSE_CATS)[number][0];
export const catLabel = (k: string) => EXPENSE_CATS.find(c => c[0] === k)?.[1] ?? "Other";

/** The IRS standard business mileage rate for 2025, the default until the owner sets their own. */
export const DEFAULT_MILEAGE_RATE = 0.7;
export const mileageRate = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return n > 0 && n <= 5 ? Math.round(n * 1000) / 1000 : DEFAULT_MILEAGE_RATE; };

export type ExpenseIn = { kind: "expense" | "mileage"; vendor: string; category: ExpenseCat; amount: number; miles: number | null; spent_on: string; note: string; thread: string | null };
const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** One entry from the form, checked. Mileage becomes miles times the rate. Dates are the last two years up to today. */
export function cleanExpense(input: unknown, rate: number, today: string): ExpenseIn | { error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const kind = o.kind === "mileage" ? "mileage" : "expense";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(o.spent_on ?? "")) ? String(o.spent_on) : today;
  const back = new Date(Date.parse(today + "T12:00:00Z") - 730 * 86400000).toISOString().slice(0, 10);
  if (day > today || day < back) return { error: "Pick a date in the last two years, not in the future." };
  const thread = typeof o.thread === "string" && /^[0-9a-f-]{36}$/i.test(o.thread) ? o.thread : null;
  const note = ctl(o.note, 300);
  if (kind === "mileage") {
    const miles = Math.round(Number(String(o.miles ?? "").replace(/[^\d.]/g, "")) * 10) / 10;
    if (!(miles > 0) || miles > 2000) return { error: "Add the miles driven (up to 2,000 for one trip)." };
    return { kind, vendor: "", category: "vehicle", amount: Math.round(miles * rate * 100) / 100, miles, spent_on: day, note, thread };
  }
  const amount = Math.round(Number(String(o.amount ?? "").replace(/[$,\s]/g, "")) * 100) / 100;
  if (!(amount > 0) || amount > 1_000_000) return { error: "Add the amount spent." };
  const category = (EXPENSE_CATS.some(c => c[0] === o.category) ? o.category : "other") as ExpenseCat;
  return { kind, vendor: ctl(o.vendor, 80), category, amount, miles: null, spent_on: day, note, thread };
}

export type Expense = { id: string; kind: "expense" | "mileage"; vendor: string; category: string; amount: number; miles: number | null; spent_on: string; note: string; member: string; thread_id: string | null; customer?: string; receipt: boolean };
/** Spent on each job, for job costing. */
export function byJob(list: Pick<Expense, "thread_id" | "amount">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of list) if (e.thread_id) m.set(e.thread_id, Math.round(((m.get(e.thread_id) ?? 0) + e.amount) * 100) / 100);
  return m;
}
/** This month's spend, miles, and the biggest categories. */
export function monthSummary(list: Pick<Expense, "amount" | "miles" | "category" | "spent_on">[], month: string): { spent: number; miles: number; cats: { cat: string; amount: number }[] } {
  const inMonth = list.filter(e => e.spent_on.startsWith(month));
  const cats = new Map<string, number>();
  for (const e of inMonth) cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
  return { spent: Math.round(inMonth.reduce((a, e) => a + e.amount, 0) * 100) / 100, miles: Math.round(inMonth.reduce((a, e) => a + (e.miles ?? 0), 0) * 10) / 10,
    cats: [...cats.entries()].map(([cat, amount]) => ({ cat, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount) };
}
