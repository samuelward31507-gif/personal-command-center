import { neon } from "@neondatabase/serverless";
import { isTokenShape } from "@/lib/esign";
import { allApproved, cleanMessages, guaranteeClock } from "@/lib/client-ops";
import { GO_LIVE_STEP } from "@/lib/deal-handoff";
import { stageOf } from "@/lib/client-hub";
import { periodLabel } from "@/lib/client-report";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const origin = (request: Request) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(request.url).origin;

/**
 * GET /api/portal?token=… — public: one client's own portal. Build status, what's waiting on them, sent reports
 * and their invoices. No internal notes, health scores, other clients or contact records.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT o.project_id, o.owner_id, o.setup, o.messages, o.approval_token, o.approved_at, p.name, p.client_name, p.deal_id
      FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id AND p.owner_id = o.owner_id WHERE o.portal_token = ${token} LIMIT 1` as Record<string, unknown>[];
    const o = rows[0];
    if (!o) return reply({ error: "This link is no longer active." }, 404);
    const owner = String(o.owner_id), pid = String(o.project_id), dealId = o.deal_id ? String(o.deal_id) : null;
    const none = Promise.resolve([] as Record<string, unknown>[]);
    const [deal, kick, ms, money, reports] = await Promise.all([
      dealId ? sql`SELECT contract_status, signed_at, effective_at, ended_at, agreement_status FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${owner}` as Promise<Record<string, unknown>[]> : none,
      dealId ? sql`SELECT status, submitted_at FROM public.kickoff_requests WHERE deal_id = ${dealId}::uuid AND owner_id = ${owner} AND status <> 'void' ORDER BY created_at DESC LIMIT 1` as Promise<Record<string, unknown>[]> : none,
      sql`SELECT title, status, due_at, completed_at FROM public.project_milestones WHERE project_id = ${pid}::uuid AND owner_id = ${owner} AND status <> 'cancelled' ORDER BY sort_order, due_at NULLS LAST` as Promise<Record<string, unknown>[]>,
      sql`SELECT title, amount, status, due_date, paid_at, invoice_number, invoice_token FROM public.revenue_entries
        WHERE owner_id = ${owner} AND (project_id = ${pid}::uuid OR (${dealId}::uuid IS NOT NULL AND deal_id = ${dealId}::uuid)) AND status <> 'cancelled' AND invoice_number IS NOT NULL
        ORDER BY COALESCE(due_date, paid_at) DESC NULLS LAST LIMIT 24` as Promise<Record<string, unknown>[]>,
      sql`SELECT period, figures FROM public.client_reports WHERE project_id = ${pid}::uuid AND owner_id = ${owner} AND status = 'sent' ORDER BY period DESC LIMIT 12` as Promise<Record<string, unknown>[]>,
    ]);
    const ws = await loadWorkspace(owner);
    const today = todayIn(ws.timezone);
    const d = deal[0], k = kick[0];
    const milestones = ms.map(m => ({ title: String(m.title), status: String(m.status), dueAt: day(m.due_at), completedAt: iso(m.completed_at) }));
    const goLive = milestones.find(m => m.title === GO_LIVE_STEP && m.status === "done");
    const stage = stageOf({ today, goLiveTitle: GO_LIVE_STEP, milestones, money: [], reports: [], success: null,
      deal: d ? { contractStatus: String(d.contract_status), signedAt: iso(d.signed_at), effectiveAt: day(d.effective_at), endedAt: day(d.ended_at), agreementStatus: String(d.agreement_status) } : null,
      kickoff: k ? { status: String(k.status), submittedAt: iso(k.submitted_at) } : null });
    const messages = cleanMessages(o.messages);
    const base = origin(request);
    const waiting: { text: string; href?: string }[] = [];
    if (!k || k.status !== "submitted") waiting.push({ text: "Fill out the kickoff checklist we emailed you. The build starts the day it's in." });
    if (messages.length && !allApproved(messages) && o.approval_token) waiting.push({ text: "Approve the messages your system will send.", href: `${base}/approve/${o.approval_token}` });
    const open = money.filter(m => m.status === "expected" || m.status === "overdue");
    for (const m of open) waiting.push({ text: `Invoice INV-${m.invoice_number}: $${Number(m.amount).toLocaleString("en-US")}${m.due_date ? ` due ${day(m.due_date)}` : ""}`, href: m.invoice_token ? `${base}/invoice/${m.invoice_token}` : undefined });
    const setup = (o.setup && typeof o.setup === "object" ? o.setup : {}) as Record<string, string>;
    return reply({
      client: setup.display_name || String(o.client_name || o.name),
      from: { name: ws.businessName, owner: ws.ownerFirstName, email: ws.contactEmail },
      stage, clock: guaranteeClock(iso(k?.status === "submitted" ? k.submitted_at : null), goLive?.completedAt ?? null, today),
      milestones: milestones.map(m => ({ title: m.title, done: m.status === "done", dueAt: m.dueAt })),
      waiting,
      invoices: money.map(m => ({ number: `INV-${m.invoice_number}`, title: String(m.title).split(" — ").slice(1).join(" — ") || String(m.title), amount: Number(m.amount), status: String(m.status), dueDate: day(m.due_date), paidAt: day(m.paid_at), link: m.invoice_token ? `${base}/invoice/${m.invoice_token}` : null })),
      reports: reports.map(r => ({ period: periodLabel(String(r.period)), figures: r.figures && typeof r.figures === "object" ? r.figures : {} })),
    });
  } catch (error) {
    console.error("Portal fetch failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Unavailable right now." }, 500);
  }
}
