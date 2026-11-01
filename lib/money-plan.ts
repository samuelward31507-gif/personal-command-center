// Money plan: profit, tax set-aside, goal forecast and who's paid this month. Pure: no I/O.

export type Paid = { amount: number; paidAt: string; type: string };
export type Expense = { amount: number; date: string };
export type ClientBill = { projectId: string; name: string; monthly: number; live: boolean; thisMonth: { status: string; amount: number; dueDate: string | null } | null; lastPaidAt: string | null };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number) => Math.round(n * 100) / 100;

/** Profit and the tax set-aside for a period: everything collected in it, minus expenses in it. */
export function periodSummary(paid: Paid[], expenses: Expense[], from: string, to: string, taxPct: number) {
  const inRange = (d: string) => d >= from && d <= to;
  const collected = round(sum(paid.filter(p => inRange(p.paidAt)).map(p => p.amount)));
  const spent = round(sum(expenses.filter(e => inRange(e.date)).map(e => e.amount)));
  const profit = round(collected - spent);
  const taxSetAside = round(Math.max(0, profit) * taxPct / 100);
  return { collected, spent, profit, taxSetAside, takeHome: round(profit - taxSetAside) };
}

/** Whole months left from `today` up to and including the goal month (the current month counts if days remain). */
export function monthsLeft(today: string, goalBy: string): number {
  if (goalBy < today) return 0;
  const [ty, tm] = today.split("-").map(Number), [gy, gm] = goalBy.split("-").map(Number);
  return (gy - ty) * 12 + (gm - tm) + 1;
}

/**
 * Where you'll land by the goal date if nothing changes: collected so far this year + open invoices
 * + current monthly revenue for each remaining month. Also what each remaining month would need to be.
 */
export function goalForecast(o: { goal: number; goalBy: string; today: string; collectedThisYear: number; openReceivables: number; mrr: number }) {
  const months = monthsLeft(o.today, o.goalBy);
  const projected = round(o.collectedThisYear + o.openReceivables + o.mrr * Math.max(0, months - 1));
  const gap = round(Math.max(0, o.goal - o.collectedThisYear));
  const perMonthNeeded = months ? round(gap / months) : gap;
  const onTrack = projected >= o.goal;
  return { goal: o.goal, goalBy: o.goalBy, months, collected: o.collectedThisYear, projected, gap, perMonthNeeded, onTrack, pct: o.goal ? Math.min(100, Math.round((o.collectedThisYear / o.goal) * 100)) : 0 };
}

export type BillState = "paid" | "invoiced" | "overdue" | "not_billed" | "not_live";
/** This month's retainer status for each client: paid, invoiced, overdue, or not billed yet. */
export function billingStatus(c: ClientBill, today: string): { state: BillState; label: string } {
  if (!c.live) return { state: "not_live", label: "Not live yet" };
  const t = c.thisMonth;
  if (!t) return { state: "not_billed", label: "Not billed this month" };
  if (t.status === "paid") return { state: "paid", label: "Paid" };
  if (t.status === "overdue" || (t.dueDate && t.dueDate < today)) return { state: "overdue", label: `Overdue${t.dueDate ? ` since ${t.dueDate.slice(5)}` : ""}` };
  return { state: "invoiced", label: t.dueDate ? `Due ${t.dueDate.slice(5)}` : "Open" };
}
