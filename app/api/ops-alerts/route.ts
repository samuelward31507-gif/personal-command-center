import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { allApproved, cleanMessages, guaranteeClock } from "@/lib/client-ops";
import { dueState } from "@/lib/compliance";
import { GO_LIVE_STEP } from "@/lib/deal-handoff";
import { buildOpsAlerts } from "@/lib/ops-alerts";
import { lastMonth, periodLabel } from "@/lib/client-report";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const dd = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000);

/** GET /api/ops-alerts — operations items that need you today: guarantee clocks, approvals, deadlines, billing, reports, report opens, renewals. Read-only. */
export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const sql = neon(process.env.DATABASE_URL);
  const owner = user.id;
  const ws = await loadWorkspace(owner);
  const today = todayIn(ws.timezone);
  const monthStart = today.slice(0, 7) + "-01";
  const period = lastMonth(new Date(today + "T12:00:00Z"));
  const [projects, opens, compliance] = await Promise.all([
    sql`SELECT p.id, COALESCE(NULLIF(c.company,''), p.client_name, p.name) AS client, p.deal_id, d.effective_at, d.ended_at,
        (SELECT k.submitted_at FROM public.kickoff_requests k WHERE k.deal_id = p.deal_id AND k.owner_id = p.owner_id AND k.status = 'submitted' ORDER BY k.submitted_at DESC LIMIT 1) AS kickoff_at,
        (SELECT m.completed_at FROM public.project_milestones m WHERE m.project_id = p.id AND m.owner_id = p.owner_id AND m.title = ${GO_LIVE_STEP} AND m.status = 'done' LIMIT 1) AS go_live_at,
        o.messages, o.approval_sent_at,
        EXISTS (SELECT 1 FROM public.client_reports r WHERE r.project_id = p.id AND r.owner_id = p.owner_id AND r.period = ${period} AND r.status = 'sent') AS report_sent,
        EXISTS (SELECT 1 FROM public.revenue_entries r WHERE r.owner_id = p.owner_id AND r.revenue_type = 'monthly_retainer' AND r.status <> 'cancelled' AND (r.project_id = p.id OR (p.deal_id IS NOT NULL AND r.deal_id = p.deal_id))
          AND COALESCE(r.due_date, r.paid_at, r.created_at::date) >= ${monthStart}::date) AS billed
      FROM public.projects p LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
      LEFT JOIN public.deals d ON d.id = p.deal_id AND d.owner_id = p.owner_id
      LEFT JOIN public.client_ops o ON o.project_id = p.id AND o.owner_id = p.owner_id
      WHERE p.owner_id = ${owner} AND p.status NOT IN ('completed','cancelled')` as Promise<Record<string, unknown>[]>,
    sql`SELECT r.contact_id, r.company, r.view_count, r.last_viewed_at,
        EXISTS (SELECT 1 FROM public.prospect_touches t WHERE t.contact_id = r.contact_id AND t.at > r.last_viewed_at) AS touched
      FROM public.prospect_reports r WHERE r.owner_id = ${owner} AND r.view_count > 0 AND r.contact_id IS NOT NULL AND r.last_viewed_at > now() - interval '8 days'` as Promise<Record<string, unknown>[]>,
    sql`SELECT title, due_date, status FROM public.compliance_items WHERE owner_id = ${owner} AND status = 'open'` as Promise<Record<string, unknown>[]>,
  ]);
  const live = (p: Record<string, unknown>) => !!(day(p.effective_at) && day(p.effective_at)! <= today && (!p.ended_at || day(p.ended_at)! > today));
  const alerts = buildOpsAlerts({
    today,
    clocks: projects.map(p => ({ projectId: String(p.id), client: String(p.client), ...guaranteeClock(iso(p.kickoff_at), iso(p.go_live_at), today) })),
    approvals: projects.filter(p => cleanMessages(p.messages).length).map(p => { const m = cleanMessages(p.messages); return { projectId: String(p.id), client: String(p.client), changes: m.filter(x => x.status === "changes").length, allApproved: allApproved(m), sentAt: iso(p.approval_sent_at) }; }),
    compliance: compliance.map(c => ({ title: String(c.title), dueDate: day(c.due_date), state: dueState(day(c.due_date), String(c.status), today) })),
    unbilled: projects.filter(p => live(p) && !p.billed).map(p => ({ projectId: String(p.id), client: String(p.client) })),
    reportsDue: projects.filter(p => live(p) && day(p.effective_at)!.slice(0, 7) <= period && !p.report_sent).map(p => ({ projectId: String(p.id), client: String(p.client), period: periodLabel(period) })),
    reportOpens: opens.map(o => ({ contactId: String(o.contact_id), company: String(o.company), views: Number(o.view_count), lastViewedAt: iso(o.last_viewed_at)!, touchedSince: o.touched === true })),
    upsells: projects.filter(live).map(p => { const eff = day(p.effective_at)!; const [y, m, d] = eff.split("-").map(Number); const end = new Date(Date.UTC(y, m - 1 + 3, d)).toISOString().slice(0, 10);
      return { projectId: String(p.id), client: String(p.client), daysLive: dd(eff, today), minTermEndsInDays: dd(today, end) }; }),
  });
  return reply({ today, alerts });
}
