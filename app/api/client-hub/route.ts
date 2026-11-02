import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { hubSummary } from "@/lib/client-hub";
import { GO_LIVE_STEP } from "@/lib/deal-handoff";
import { maskEin } from "@/lib/kickoff";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/** GET /api/client-hub?id=<project id> — one client: agreement, kickoff, delivery, money, reports, health, tasks, recent activity. Read-only. */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    if (!process.env.DATABASE_URL) return reply({ error: "DATABASE_URL is not configured." }, 503);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!UUID.test(id)) return reply({ error: "Valid client id is required." }, 400);
    const sql = neon(process.env.DATABASE_URL);
    const owner = user.id;
    const pr = await sql`
      SELECT p.id, p.name, p.client_name, p.status, p.service_type, p.start_date, p.target_date, p.monthly_value, p.setup_value, p.deal_id, p.contact_id,
        c.first_name, c.last_name, c.company, c.email, c.phone, c.location, c.website
      FROM public.projects p LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
      WHERE p.id = ${id}::uuid AND p.owner_id = ${owner}` as Record<string, unknown>[];
    if (!pr.length) return reply({ error: "Client not found." }, 404);
    const p = pr[0];
    const dealId = p.deal_id ? String(p.deal_id) : null;
    const contactId = p.contact_id ? String(p.contact_id) : null;
    const none = Promise.resolve([] as Record<string, unknown>[]);
    const [deal, kickoff, milestones, money, reports, success, tasks, activity] = await Promise.all([
      dealId ? sql`SELECT id, title, service_type, contract_status, signed_at, effective_at, ended_at, agreement_status, setup_fee, monthly_fee FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${owner}` as Promise<Record<string, unknown>[]> : none,
      dealId ? sql`SELECT status, submitted_at, answers, tier FROM public.kickoff_requests WHERE deal_id = ${dealId}::uuid AND owner_id = ${owner} AND status <> 'void' ORDER BY created_at DESC LIMIT 1` as Promise<Record<string, unknown>[]> : none,
      sql`SELECT id, title, status, due_at, completed_at FROM public.project_milestones WHERE project_id = ${id}::uuid AND owner_id = ${owner} ORDER BY sort_order, due_at NULLS LAST` as Promise<Record<string, unknown>[]>,
      sql`SELECT id, title, revenue_type, amount, status, due_date, paid_at, invoice_number, invoice_sent_at FROM public.revenue_entries
          WHERE owner_id = ${owner} AND (project_id = ${id}::uuid OR (${dealId}::uuid IS NOT NULL AND deal_id = ${dealId}::uuid)) AND status <> 'cancelled' ORDER BY COALESCE(due_date, paid_at) DESC NULLS LAST LIMIT 50` as Promise<Record<string, unknown>[]>,
      sql`SELECT period, status, updated_at FROM public.client_reports WHERE project_id = ${id}::uuid AND owner_id = ${owner} ORDER BY period DESC LIMIT 12` as Promise<Record<string, unknown>[]>,
      sql`SELECT id, status, health_score, renewal_date, next_review_date, goals, results, risk_notes FROM public.client_success WHERE owner_id = ${owner} AND project_id = ${id}::uuid ORDER BY updated_at DESC LIMIT 1` as Promise<Record<string, unknown>[]>,
      (contactId || dealId) ? sql`SELECT id, title, status, priority, due_at FROM public.tasks WHERE owner_id = ${owner} AND status NOT IN ('done','cancelled')
          AND ((${contactId}::uuid IS NOT NULL AND contact_id = ${contactId}::uuid) OR (${dealId}::uuid IS NOT NULL AND deal_id = ${dealId}::uuid)) ORDER BY due_at NULLS LAST LIMIT 10` as Promise<Record<string, unknown>[]> : none,
      contactId ? sql`SELECT channel, action, outcome, notes, occurred_at FROM public.contact_activities WHERE owner_id = ${owner} AND contact_id = ${contactId}::uuid ORDER BY occurred_at DESC LIMIT 8` as Promise<Record<string, unknown>[]> : none,
    ]);
    const ws = await loadWorkspace(owner);
    const today = todayIn(ws.timezone);
    const d = deal[0];
    const k = kickoff[0];
    const s = success[0];
    const summary = hubSummary({
      today, goLiveTitle: GO_LIVE_STEP,
      deal: d ? { contractStatus: String(d.contract_status), signedAt: iso(d.signed_at), effectiveAt: day(d.effective_at), endedAt: day(d.ended_at), agreementStatus: String(d.agreement_status) } : null,
      kickoff: k ? { status: String(k.status), submittedAt: iso(k.submitted_at) } : null,
      milestones: milestones.map(m => ({ title: String(m.title), status: String(m.status), dueAt: iso(m.due_at), completedAt: iso(m.completed_at) })),
      money: money.map(m => ({ status: String(m.status), amount: Number(m.amount), dueDate: day(m.due_date), paidAt: day(m.paid_at), invoiceSentAt: iso(m.invoice_sent_at) })),
      reports: reports.map(r => ({ period: String(r.period), status: String(r.status) })),
      success: s ? { health: Number(s.health_score), renewalDate: day(s.renewal_date), nextReview: day(s.next_review_date), status: String(s.status) } : null,
    });
    const answers = (k?.answers && typeof k.answers === "object" ? k.answers : {}) as Record<string, string>;
    return reply({
      today, summary,
      client: {
        id: String(p.id), name: String(p.company || p.client_name || p.name), person: [p.first_name, p.last_name].filter(Boolean).join(" "),
        email: String(p.email ?? ""), phone: String(p.phone ?? ""), location: String(p.location ?? ""), website: String(p.website ?? ""),
        contactId, dealId, projectStatus: String(p.status), monthly: Number(p.monthly_value), setup: Number(p.setup_value),
        plan: d ? (String(d.service_type) === "tier2_revenue_system" ? ws.tier2.label : String(d.service_type) === "tier1_speed_to_lead" ? ws.tier1.label : String(d.title).split(" — ").slice(1).join(" — ")) : "",
      },
      agreement: d ? { status: String(d.contract_status), signedAt: iso(d.signed_at), agreementStatus: String(d.agreement_status) } : null,
      kickoff: k ? { status: String(k.status), submittedAt: iso(k.submitted_at), highlights: [
        ["Business phone", answers.business_phone], ["Owner cell", answers.owner_cell], ["Calendar", answers.calendar], ["Service area", answers.service_area],
        ["Lead sources", answers.lead_sources], ["EIN", answers.ein ? maskEin(answers.ein) : ""],
      ].filter(([, v]) => v).map(([label, value]) => ({ label, value: String(value).slice(0, 240) })) } : null,
      milestones: milestones.map(m => ({ id: String(m.id), title: String(m.title), status: String(m.status), dueAt: day(m.due_at), completedAt: day(m.completed_at) })),
      money: money.map(m => ({ id: String(m.id), title: String(m.title), type: String(m.revenue_type), amount: Number(m.amount), status: String(m.status), dueDate: day(m.due_date), paidAt: day(m.paid_at), invoiceNumber: m.invoice_number == null ? null : Number(m.invoice_number) })),
      reports: reports.map(r => ({ period: String(r.period), status: String(r.status) })),
      success: s ? { id: String(s.id), status: String(s.status), health: Number(s.health_score), renewalDate: day(s.renewal_date), nextReview: day(s.next_review_date), goals: String(s.goals ?? ""), results: String(s.results ?? ""), risks: String(s.risk_notes ?? "") } : null,
      tasks: tasks.map(t => ({ id: String(t.id), title: String(t.title), priority: String(t.priority), dueAt: iso(t.due_at) })),
      activity: activity.map(a => ({ channel: String(a.channel), action: String(a.action), outcome: String(a.outcome ?? ""), notes: String(a.notes ?? "").slice(0, 200), at: iso(a.occurred_at) })),
    });
  } catch (error) {
    console.error("Client hub failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return reply({ error: "Couldn't load this client." }, 500);
  }
}
