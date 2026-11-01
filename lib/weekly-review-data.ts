import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { ReviewData } from "@/lib/weekly-review";

type Sql = NeonQueryFunction<false, false>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const name = (r: Record<string, unknown>) => String(r.company || String(r.title ?? "").split(" — ")[0] || "A deal");

/** Everything the Sunday review needs, for one owner. Read-only. */
export async function loadReviewData(sql: Sql, owner: string): Promise<ReviewData> {
  const [act, props, won, pipe, paid, exp, over, agr, pw, om, ls, lm, ot] = await Promise.all([
    sql`SELECT count(*) FILTER (WHERE action = 'outbound_call')::int AS calls,
          count(*) FILTER (WHERE action = 'outbound_call' AND outcome IN ('answered','meeting_booked'))::int AS conv,
          count(*) FILTER (WHERE outcome = 'meeting_booked')::int AS meetings
        FROM public.contact_activities WHERE owner_id = ${owner} AND created_at >= now() - interval '7 days'`,
    sql`SELECT count(*)::int AS n FROM public.deals WHERE owner_id = ${owner} AND proposal_sent_at >= now() - interval '7 days'`,
    sql`SELECT count(*)::int AS n, COALESCE(sum(monthly_fee),0) AS v FROM public.deals WHERE owner_id = ${owner} AND stage = 'won' AND signed_at >= now() - interval '7 days'`,
    sql`SELECT stage, count(*)::int AS n, COALESCE(sum(monthly_fee),0) AS m FROM public.deals WHERE owner_id = ${owner} AND stage NOT IN ('won','lost') GROUP BY stage`,
    sql`SELECT COALESCE(sum(amount),0) AS v FROM public.revenue_entries WHERE owner_id = ${owner} AND status = 'paid' AND paid_at >= CURRENT_DATE - 7`,
    sql`SELECT COALESCE(sum(amount),0) AS v FROM public.revenue_entries WHERE owner_id = ${owner} AND status = 'expected' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14`,
    sql`SELECT COALESCE(sum(amount),0) AS v FROM public.revenue_entries WHERE owner_id = ${owner} AND (status = 'overdue' OR (status = 'expected' AND due_date < CURRENT_DATE))`,
    sql`SELECT d.id, d.title, c.company, (CURRENT_DATE - d.contract_sent_at::date)::int AS days FROM public.deals d
        LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
        WHERE d.owner_id = ${owner} AND d.contract_status = 'sent' AND d.stage NOT IN ('won','lost') AND d.contract_sent_at < now() - interval '2 days' ORDER BY d.contract_sent_at LIMIT 5`,
    sql`SELECT d.id, d.title, c.company, (CURRENT_DATE - d.proposal_sent_at::date)::int AS days FROM public.deals d
        LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
        WHERE d.owner_id = ${owner} AND d.proposal_status = 'sent' AND d.stage NOT IN ('won','lost') AND d.proposal_sent_at < now() - interval '3 days' ORDER BY d.proposal_sent_at LIMIT 5`,
    sql`SELECT title, amount, (CURRENT_DATE - due_date)::int AS days FROM public.revenue_entries
        WHERE owner_id = ${owner} AND (status = 'overdue' OR (status = 'expected' AND due_date < CURRENT_DATE)) ORDER BY due_date LIMIT 5`,
    sql`SELECT d.id, d.title, d.next_step, c.company, (CURRENT_DATE - d.next_step_at)::int AS days FROM public.deals d
        LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
        WHERE d.owner_id = ${owner} AND d.stage NOT IN ('won','lost') AND d.next_step_at < CURRENT_DATE ORDER BY d.next_step_at LIMIT 10`,
    sql`SELECT m.title, p.client_name, (CURRENT_DATE - m.due_at::date)::int AS days FROM public.project_milestones m
        JOIN public.projects p ON p.id = m.project_id AND p.owner_id = m.owner_id
        WHERE m.owner_id = ${owner} AND m.status NOT IN ('done','cancelled') AND m.due_at < CURRENT_DATE AND p.status NOT IN ('completed','cancelled','on_hold') ORDER BY m.due_at LIMIT 10`,
    sql`SELECT count(*)::int AS n FROM public.tasks WHERE owner_id = ${owner} AND status NOT IN ('done','cancelled') AND due_at < now()`,
  ]);
  return {
    week: { calls: num(act[0].calls), conversations: num(act[0].conv), meetings: num(act[0].meetings), proposals: num(props[0].n), won: num(won[0].n), wonValue: num(won[0].v) },
    pipeline: pipe.map(r => ({ stage: String(r.stage), count: num(r.n), monthly: num(r.m) })),
    money: { paidThisWeek: num(paid[0].v), expectedNext14: num(exp[0].v), overdue: num(over[0].v) },
    agreementsWaiting: agr.map(r => ({ company: name(r), days: num(r.days), dealId: String(r.id) })),
    proposalsWaiting: pw.map(r => ({ company: name(r), days: num(r.days), dealId: String(r.id) })),
    overdueMoney: om.map(r => ({ title: String(r.title), amount: num(r.amount), days: num(r.days) })),
    lateSteps: ls.map(r => ({ company: name(r), step: String(r.next_step ?? ""), days: num(r.days), dealId: String(r.id) })),
    lateMilestones: lm.map(r => ({ client: String(r.client_name || "a client"), title: String(r.title), days: num(r.days) })),
    overdueTasks: num(ot[0].n),
  };
}
