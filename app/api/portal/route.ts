import { neon } from "@neondatabase/serverless";
import { isTokenShape } from "@/lib/esign";
import { allApproved, cleanMessages, guaranteeClock } from "@/lib/client-ops";
import { GO_LIVE_STEP } from "@/lib/deal-handoff";
import { stageOf } from "@/lib/client-hub";
import { periodLabel } from "@/lib/client-report";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";
import { liveFor } from "@/lib/client-live";
import { sendAlert } from "@/lib/notify";
import { allowEvent, clientIp } from "@/lib/rate-limit";

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
  if (token === "demo") return reply(demoPortal(new URL(request.url).searchParams.get("thread")));
  if (!isTokenShape(token)) return reply({ error: "This link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT o.project_id, o.owner_id, o.setup, o.messages, o.approval_token, o.approved_at, p.name, p.client_name, p.deal_id
      FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id AND p.owner_id = o.owner_id WHERE o.portal_token = ${token} LIMIT 1` as Record<string, unknown>[];
    const o = rows[0];
    if (!o) return reply({ error: "This link is no longer active." }, 404);
    const owner = String(o.owner_id), pid = String(o.project_id), dealId = o.deal_id ? String(o.deal_id) : null;
    // One conversation's texts, for the client reading along.
    const th = new URL(request.url).searchParams.get("thread") ?? "";
    if (/^[0-9a-f-]{36}$/i.test(th)) {
      const texts = await sql`SELECT x.direction, x.author, x.body, x.at FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
        WHERE x.thread_id = ${th}::uuid AND t.project_id = ${pid}::uuid ORDER BY x.at LIMIT 300`;
      return reply({ texts: texts.map(t => ({ direction: String(t.direction), author: String(t.author), body: String(t.body), at: iso(t.at) })) });
    }
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
    const live = await liveFor(sql, pid);
    const msgs = await sql`SELECT author, body, created_at FROM public.client_messages WHERE project_id = ${pid}::uuid ORDER BY created_at DESC LIMIT 100`.catch(() => []) as Record<string, unknown>[];
    await sql`UPDATE public.client_messages SET read_at = now() WHERE project_id = ${pid}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => null);
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
      live,
      messages: msgs.reverse().map(m => ({ from: String(m.author), body: String(m.body), at: iso(m.created_at) })),
    });
  } catch (error) {
    console.error("Portal fetch failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Unavailable right now." }, 500);
  }
}


/** /portal/demo: what an owner's app looks like, with made-up numbers for an example fence company. */
function demoPortal(thread: string | null) {
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const messages = [
    { from: "client", body: "Can we add the Saturday hours to the texts? We do estimates Saturday mornings now.", at: ago(30) },
    { from: "owner", body: "Done. Saturday 8 to noon is live, and Cinder offers those times now. Anything else?", at: ago(27) },
  ];
  if (thread) {
    const t: Record<string, { direction: string; author: string; body: string; at: string }[]> = {
      d1: [
        { direction: "in", author: "system", body: "Missed call", at: ago(3.1) },
        { direction: "out", author: "template", body: "Hey, it's Mike with Ridgeline Fence. Sorry I missed you, I'm on a job. What can I help with?", at: ago(3.09) },
        { direction: "in", author: "customer", body: "Need a quote on about 120 ft of cedar privacy fence. The old one's leaning bad", at: ago(3.07) },
        { direction: "out", author: "ai", body: "Got it. Cedar privacy with tear-out usually runs $42-56 a foot. I can measure Thursday at 8 or Friday at 3. Which works?", at: ago(3.06) },
        { direction: "in", author: "customer", body: "Thursday works", at: ago(3.04) },
        { direction: "out", author: "ai", body: "You're set for Thursday at 8am. Mike will text when he's on the way.", at: ago(3.03) },
      ],
    };
    return { texts: t[thread] ?? t.d1 };
  }
  return {
    demo: true, messages, client: "Ridgeline Fence Co.", from: { name: "Cinder Revenue Company", owner: "Sam", email: "sam.cinderrevenue@gmail.com" },
    stage: { key: "live", label: "Live" }, clock: { state: "live", label: "Live in 9 business days", deadline: null },
    milestones: [], waiting: [], invoices: [], reports: [],
    live: {
      leads: 38, answered: 38, booked: 14, replySec: 9, chasing: 9, chasingValue: 61400, won: 4, wonValue: 27350, revived: 6, reviews: 11,
      weeks: [{ week: "w1", leads: 6, booked: 2 }, { week: "w2", leads: 8, booked: 3 }, { week: "w3", leads: 7, booked: 2 }, { week: "w4", leads: 9, booked: 4 }, { week: "w5", leads: 11, booked: 4 }, { week: "w6", leads: 8, booked: 3 }, { week: "w7", leads: 10, booked: 4 }, { week: "w8", leads: 12, booked: 5 }],
      conversations: [
        { id: "d1", name: "Dana Ruiz", source: "missed_call", status: "booked", at: ago(3), last: "You're set for Thursday at 8am. Mike will text when he's on the way." },
        { id: "d2", name: "Marcus Hill", source: "web chat", status: "booked", at: ago(6), last: "Perfect, see you Friday at 3." },
        { id: "d3", name: "Priya Shah", source: "quote", status: "auto", at: ago(20), last: "Happy to walk through the quote, or look at a smaller option if that would help." },
        { id: "d4", name: "Tom Becker", source: "text", status: "paused", at: ago(26), last: "Can you do $40 a foot if we pay cash?" },
        { id: "d5", name: "Lisa Moreno", source: "review", status: "closed", at: ago(50), last: "Left you 5 stars! Fence looks great." },
      ],
    },
  };
}

/**
 * POST /api/portal { token, body } — public: the client sends Sam a message from their portal.
 * Rate-limited; Sam gets an email alert with a link to reply from the CRM.
 */
export async function POST(request: Request) {
  const b = await request.json().catch(() => null) as { token?: string; body?: string; website?: string } | null;
  if (!b || !isTokenShape(b.token ?? null)) return reply({ error: "This link isn't valid." }, 404);
  if (b.website) return reply({ ok: true }); // honeypot
  const body = String(b.body ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, 4000);
  if (!body) return reply({ error: "Write a message first." }, 400);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  if (!(await allowEvent("portal-msg", clientIp(request), 20, 60))) return reply({ error: "Too many messages in an hour. Try again soon." }, 429);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [o] = await sql`SELECT o.project_id, o.owner_id, o.setup, p.client_name, p.name FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id WHERE o.portal_token = ${b.token} LIMIT 1` as Record<string, unknown>[];
    if (!o) return reply({ error: "This link is no longer active." }, 404);
    await sql`INSERT INTO public.client_messages (owner_id, project_id, author, body) VALUES (${String(o.owner_id)}, ${String(o.project_id)}::uuid, 'client', ${body})`;
    const who = ((o.setup ?? {}) as Record<string, string>).display_name || String(o.client_name || o.name);
    await sendAlert({ subject: `Message from ${who}`, lines: [`${who} wrote from their portal:`, body.slice(0, 1200)], link: { label: "Reply in the CRM", path: `/crm/client-success/${String(o.project_id)}` } }).catch(() => false);
    return reply({ ok: true });
  } catch (e) {
    console.error("Portal message failed", { name: e instanceof Error ? e.name : typeof e });
    return reply({ error: "Couldn't send that. Try again." }, 500);
  }
}
