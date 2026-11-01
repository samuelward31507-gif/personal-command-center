import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { billingStatus, goalForecast, periodSummary } from "@/lib/money-plan";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/money-plan — this month and this year's profit with tax set-aside, the goal forecast and each client's billing this month. Read-only. */
export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const sql = neon(process.env.DATABASE_URL);
  const owner = user.id;
  const ws = await loadWorkspace(owner);
  const today = todayIn(ws.timezone);
  const yearStart = today.slice(0, 4) + "-01-01", monthStart = today.slice(0, 7) + "-01";
  const [paid, expenses, open, projects, monthEntries] = await Promise.all([
    sql`SELECT amount, paid_at, revenue_type FROM public.revenue_entries WHERE owner_id = ${owner} AND status = 'paid' AND paid_at >= ${yearStart}::date` as Promise<Record<string, unknown>[]>,
    sql`SELECT amount, expense_date FROM public.business_expenses WHERE owner_id = ${owner} AND expense_date >= ${yearStart}::date` as Promise<Record<string, unknown>[]>,
    sql`SELECT COALESCE(SUM(amount), 0) AS total FROM public.revenue_entries WHERE owner_id = ${owner} AND status IN ('expected','overdue') AND (due_date IS NULL OR due_date <= ${ws.goalBy}::date)` as Promise<Record<string, unknown>[]>,
    sql`SELECT p.id, COALESCE(NULLIF(c.company,''), p.client_name, p.name) AS name, p.monthly_value, p.deal_id,
          EXISTS (SELECT 1 FROM public.deals d WHERE d.id = p.deal_id AND d.owner_id = p.owner_id AND d.effective_at IS NOT NULL AND d.effective_at <= ${today}::date AND (d.ended_at IS NULL OR d.ended_at > ${today}::date)) AS live,
          (SELECT max(r.paid_at) FROM public.revenue_entries r WHERE r.owner_id = p.owner_id AND r.status = 'paid' AND r.revenue_type = 'monthly_retainer' AND (r.project_id = p.id OR (p.deal_id IS NOT NULL AND r.deal_id = p.deal_id))) AS last_paid
        FROM public.projects p LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
        WHERE p.owner_id = ${owner} AND p.status NOT IN ('completed','cancelled') ORDER BY name` as Promise<Record<string, unknown>[]>,
    sql`SELECT project_id, deal_id, amount, status, due_date FROM public.revenue_entries WHERE owner_id = ${owner} AND revenue_type = 'monthly_retainer' AND status <> 'cancelled'
        AND COALESCE(due_date, paid_at, created_at::date) >= ${monthStart}::date AND COALESCE(due_date, paid_at, created_at::date) < (${monthStart}::date + interval '1 month')` as Promise<Record<string, unknown>[]>,
  ]);
  const P = paid.map(r => ({ amount: Number(r.amount), paidAt: day(r.paid_at)!, type: String(r.revenue_type) }));
  const E = expenses.map(r => ({ amount: Number(r.amount), date: day(r.expense_date)! }));
  const month = periodSummary(P, E, monthStart, today, ws.taxSetAsidePct);
  const year = periodSummary(P, E, yearStart, today, ws.taxSetAsidePct);
  const liveMrr = projects.filter(p => p.live === true).reduce((s, p) => s + Number(p.monthly_value), 0);
  const forecast = goalForecast({ goal: ws.goalAmount, goalBy: ws.goalBy, today, collectedThisYear: year.collected, openReceivables: Number(open[0]?.total ?? 0), mrr: liveMrr });
  const clients = projects.map(p => {
    const entry = monthEntries.find(e => String(e.project_id) === String(p.id) || (p.deal_id && String(e.deal_id) === String(p.deal_id)));
    const bill = { projectId: String(p.id), name: String(p.name), monthly: Number(p.monthly_value), live: p.live === true, lastPaidAt: day(p.last_paid),
      thisMonth: entry ? { status: String(entry.status), amount: Number(entry.amount), dueDate: day(entry.due_date) } : null };
    return { ...bill, ...billingStatus(bill, today) };
  });
  return reply({ today, taxPct: ws.taxSetAsidePct, month, year, forecast, mrr: liveMrr, clients });
}
