import type { NeonQueryFunction } from "@neondatabase/serverless";
import { reportSection } from "@/lib/business-audit";
import { loadMyDay } from "@/lib/my-day-data";
import type { AskContext } from "@/lib/ask";

type Sql = NeonQueryFunction<false, false>;
export type AskRequestContext = AskContext & { dayEnd: string; windowEnd: string; tzOffsetMinutes: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const d10 = (v: unknown) => (!v ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const s = (v: unknown, max = 400) => String(v ?? "").slice(0, max);
const name = (r: Record<string, unknown>) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
const like = (v: unknown) => (typeof v === "string" && v.trim() ? "%" + v.trim().replace(/[\\%_]/g, m => "\\" + m) + "%" : null);

export function auditVerdict(content: unknown): string {
  if (typeof content !== "string") return "";
  const section = reportSection(content, "Verdict") || reportSection(content, "1\\. Executive verdict");
  return section.replace(/\*\*/g, "").replace(/^[-*•]\s+/gm, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

/** Runs one read tool for one owner. Returns a JSON-serialisable result. Never writes. */
export async function runAskTool(sql: Sql, owner: string, ctx: AskRequestContext, tool: string, input: Record<string, unknown>): Promise<unknown> {
  switch (tool) {
    case "search_contacts": {
      const text = like(input.text), loc = like(input.location);
      const status = typeof input.status === "string" ? input.status.toLowerCase() : null;
      const fu = typeof input.follow_up === "string" ? input.follow_up : null;
      const weekEnd = new Date(Date.parse(ctx.today + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10);
      const limit = Math.min(Math.max(Number(input.limit) || 15, 1), 50);
      const lastOutcome = typeof input.last_outcome === "string" && input.last_outcome ? input.last_outcome : null;
      const rows = await sql`
        WITH base AS (
          SELECT c.id, c.first_name, c.last_name, c.company, c.status, c.phone, c.email, c.website, c.location, c.notes, c.follow_up_at,
            la.outcome AS last_outcome, la.occurred_at AS last_at,
            EXISTS (SELECT 1 FROM public.contact_suppressions x WHERE x.owner_id = c.owner_id AND x.contact_id = c.id) AS suppressed
          FROM public.contacts c
          LEFT JOIN LATERAL (SELECT outcome, occurred_at FROM public.contact_activities a
            WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.outcome IS DISTINCT FROM 'initiated' AND a.action <> 'note'
            ORDER BY occurred_at DESC LIMIT 1) la ON true
          WHERE c.owner_id = ${owner}
            AND (${text}::text IS NULL OR concat_ws(' ', c.company, c.first_name, c.last_name, c.location, c.email, c.phone, c.notes) ILIKE ${text})
            AND (${loc}::text IS NULL OR c.location ILIKE ${loc})
            AND (${status}::text IS NULL OR c.status = ${status})
            AND (${input.missing_website === true} = false OR coalesce(trim(c.website), '') = '')
            AND (${input.has_phone === true} = false OR coalesce(trim(c.phone), '') <> '')
            AND (${fu}::text IS NULL OR ${fu} = 'any' AND c.follow_up_at IS NOT NULL OR ${fu} = 'none' AND c.follow_up_at IS NULL
              OR ${fu} = 'overdue' AND c.follow_up_at < ${ctx.today}::date OR ${fu} = 'today' AND c.follow_up_at = ${ctx.today}::date
              OR ${fu} = 'this_week' AND c.follow_up_at BETWEEN ${ctx.today}::date AND ${weekEnd}::date)
        )
        SELECT *, count(*) OVER () AS total FROM base
        WHERE (${input.never_contacted === true} = false OR last_outcome IS NULL)
          AND (${lastOutcome}::text IS NULL OR last_outcome = ${lastOutcome})
        ORDER BY follow_up_at ASC NULLS LAST, company ASC
        LIMIT ${limit}`;
      return {
        total: Number(rows[0]?.total ?? 0), shown: rows.length,
        contacts: rows.map(r => ({ id: r.id, company: s(r.company, 120), name: name(r), status: r.status, location: s(r.location, 80),
          phone: s(r.phone, 40), hasWebsite: Boolean(String(r.website ?? "").trim()), website: s(r.website, 120), followUp: d10(r.follow_up_at),
          lastOutcome: r.last_outcome ?? null, lastTouch: d10(r.last_at), doNotContact: r.suppressed === true, notes: s(r.notes, 160) })),
      };
    }
    case "get_contact": {
      if (typeof input.id !== "string" || !UUID.test(input.id)) return { error: "Invalid contact id." };
      const id = input.id;
      const [c, acts, deals, tasks, events, audit, sup] = await Promise.all([
        sql`SELECT * FROM public.contacts WHERE id = ${id}::uuid AND owner_id = ${owner}`,
        sql`SELECT channel, action, outcome, notes, occurred_at FROM public.contact_activities WHERE owner_id = ${owner} AND contact_id = ${id}::uuid ORDER BY occurred_at DESC LIMIT 10`,
        sql`SELECT id, title, stage, setup_fee, monthly_fee, expected_close_date, lost_reason FROM public.deals WHERE owner_id = ${owner} AND contact_id = ${id}::uuid ORDER BY updated_at DESC LIMIT 10`,
        sql`SELECT id, title, priority, status, due_at FROM public.tasks WHERE owner_id = ${owner} AND contact_id = ${id}::uuid AND status NOT IN ('done','cancelled') LIMIT 10`,
        sql`SELECT id, title, starts_at, event_type FROM public.calendar_events WHERE owner_id = ${owner} AND contact_id = ${id}::uuid AND status = 'scheduled' AND starts_at > now() - interval '1 day' ORDER BY starts_at LIMIT 5`,
        sql`SELECT id, title, content, created_at FROM public.research_artifacts WHERE owner_id = ${owner} AND contact_id = ${id}::uuid AND artifact_type = 'audit_prep' AND status <> 'archived' ORDER BY created_at DESC LIMIT 1`,
        sql`SELECT 1 FROM public.contact_suppressions WHERE owner_id = ${owner} AND contact_id = ${id}::uuid LIMIT 1`,
      ]);
      if (!c.length) return { error: "Contact not found." };
      const r = c[0];
      return {
        id: r.id, company: r.company, name: name(r), role: r.role, status: r.status, phone: r.phone, email: r.email, website: r.website,
        instagram: r.instagram, facebook: r.facebook, location: r.location, source: r.source, notes: s(r.notes, 1500), followUp: d10(r.follow_up_at),
        doNotContact: sup.length > 0, addedOn: d10(r.created_at),
        activity: acts.map(a => ({ at: iso(a.occurred_at), channel: a.channel, outcome: a.outcome, notes: s(a.notes, 200) })),
        deals: deals.map(d => ({ id: d.id, title: d.title, stage: d.stage, setupFee: Number(d.setup_fee), monthlyFee: Number(d.monthly_fee), expectedClose: d10(d.expected_close_date), lostReason: d.lost_reason || undefined })),
        openTasks: tasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, due: d10(t.due_at) })),
        upcomingEvents: events.map(e => ({ id: e.id, title: e.title, startsAt: iso(e.starts_at), type: e.event_type })),
        latestAudit: audit[0] ? { id: audit[0].id, title: audit[0].title, date: d10(audit[0].created_at), verdict: auditVerdict(audit[0].content) } : null,
      };
    }
    case "list_deals": {
      const stage = typeof input.stage === "string" ? input.stage : null, text = like(input.text);
      const rows = await sql`
        SELECT d.id, d.title, d.stage, d.setup_fee, d.monthly_fee, d.expected_close_date, d.updated_at, d.contact_id, d.agreement_status,
          c.company, trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name
        FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
        WHERE d.owner_id = ${owner}
          AND (${stage}::text IS NULL OR d.stage = ${stage})
          AND (${input.open_only === true} = false OR d.stage NOT IN ('won','lost'))
          AND (${text}::text IS NULL OR concat_ws(' ', d.title, c.company) ILIKE ${text})
        ORDER BY CASE WHEN d.stage IN ('won','lost') THEN 1 ELSE 0 END, d.updated_at DESC LIMIT 50`;
      return { count: rows.length, deals: rows.map(d => ({ id: d.id, title: d.title, stage: d.stage, setupFee: Number(d.setup_fee), monthlyFee: Number(d.monthly_fee),
        expectedClose: d10(d.expected_close_date), lastUpdated: d10(d.updated_at), contactId: d.contact_id, company: d.company || d.contact_name || null, agreement: d.agreement_status })) };
    }
    case "business_snapshot": {
      const monthStart = ctx.today.slice(0, 8) + "01";
      const in30 = new Date(Date.parse(ctx.today + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
      const [contacts, followUps, pipeline, mrr, money, collected, expenses, tasks, projects, first] = await Promise.all([
        sql`SELECT status, count(*)::int AS n FROM public.contacts WHERE owner_id = ${owner} GROUP BY status`,
        sql`SELECT count(*) FILTER (WHERE follow_up_at < ${ctx.today}::date)::int AS overdue, count(*) FILTER (WHERE follow_up_at = ${ctx.today}::date)::int AS today FROM public.contacts WHERE owner_id = ${owner}`,
        sql`SELECT stage, count(*)::int AS n, coalesce(sum(setup_fee),0)::float AS setup, coalesce(sum(monthly_fee),0)::float AS monthly FROM public.deals WHERE owner_id = ${owner} GROUP BY stage`,
        sql`SELECT count(*)::int AS clients, coalesce(sum(monthly_fee),0)::float AS mrr FROM public.deals WHERE owner_id = ${owner} AND stage = 'won' AND agreement_status = 'active'`,
        sql`SELECT count(*) FILTER (WHERE status = 'overdue' OR status = 'expected' AND due_date < ${ctx.today}::date)::int AS overdue_n,
              coalesce(sum(amount) FILTER (WHERE status = 'overdue' OR status = 'expected' AND due_date < ${ctx.today}::date),0)::float AS overdue_amt,
              coalesce(sum(amount) FILTER (WHERE status = 'expected' AND due_date BETWEEN ${ctx.today}::date AND ${in30}::date),0)::float AS due30
            FROM public.revenue_entries WHERE owner_id = ${owner}`,
        sql`SELECT coalesce(sum(amount),0)::float AS amt FROM public.revenue_entries WHERE owner_id = ${owner} AND status = 'paid' AND paid_at >= ${monthStart}::date`,
        sql`SELECT coalesce(sum(amount),0)::float AS amt FROM public.business_expenses WHERE owner_id = ${owner} AND expense_date >= ${monthStart}::date`,
        sql`SELECT count(*)::int AS open, count(*) FILTER (WHERE due_at < ${ctx.dayEnd}::timestamptz)::int AS due FROM public.tasks WHERE owner_id = ${owner} AND status NOT IN ('done','cancelled')`,
        sql`SELECT count(*)::int AS active, count(*) FILTER (WHERE status = 'blocked')::int AS blocked FROM public.projects WHERE owner_id = ${owner} AND status NOT IN ('completed','cancelled','on_hold')`,
        sql`SELECT count(*)::int AS calls FROM public.contact_activities WHERE owner_id = ${owner} AND channel = 'call' AND outcome IS DISTINCT FROM 'initiated' AND occurred_at >= ${new Date(Date.parse(ctx.dayEnd) - 86400000).toISOString()}::timestamptz`,
      ]);
      return {
        contactsByStatus: Object.fromEntries(contacts.map(r => [r.status, r.n])),
        followUps: followUps[0], callsLoggedToday: first[0]?.calls ?? 0,
        pipelineByStage: pipeline.map(p => ({ stage: p.stage, deals: p.n, setupTotal: p.setup, monthlyTotal: p.monthly })),
        activeRecurring: { clients: mrr[0]?.clients ?? 0, monthlyRecurringRevenue: mrr[0]?.mrr ?? 0 },
        money: { overdueCount: money[0]?.overdue_n ?? 0, overdueAmount: money[0]?.overdue_amt ?? 0, expectedNext30Days: money[0]?.due30 ?? 0, collectedThisMonth: collected[0]?.amt ?? 0, expensesThisMonth: expenses[0]?.amt ?? 0 },
        tasks: tasks[0], projects: projects[0],
        note: "Money 'collected' only counts entries the founder marked paid. Won deals are not counted as paid.",
      };
    }
    case "today_queue": {
      const { items } = await loadMyDay(sql, owner, ctx.today, ctx.dayEnd, ctx.windowEnd);
      const group = typeof input.group === "string" ? input.group : null;
      const list = items.filter(i => !group || i.group === group);
      return { total: list.length, items: list.slice(0, 40).map(i => ({ group: i.group, status: i.status, title: i.title, why: i.why, contactId: i.contact?.id ?? null, phone: i.contact?.phone || undefined, href: i.href })) };
    }
    case "list_tasks": {
      const dueBy = typeof input.due_by === "string" && DATE.test(input.due_by) ? input.due_by : null;
      const rows = await sql`
        SELECT t.id, t.title, t.status, t.priority, t.due_at, t.contact_id, c.company, d.title AS deal
        FROM public.tasks t LEFT JOIN public.contacts c ON c.id = t.contact_id AND c.owner_id = t.owner_id
        LEFT JOIN public.deals d ON d.id = t.deal_id AND d.owner_id = t.owner_id
        WHERE t.owner_id = ${owner} AND (${input.include_done === true} OR t.status NOT IN ('done','cancelled'))
          AND (${dueBy}::date IS NULL OR t.due_at < (${dueBy}::date + 1))
        ORDER BY t.due_at ASC NULLS LAST, t.updated_at DESC LIMIT 50`;
      return { count: rows.length, tasks: rows.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due: iso(t.due_at), contactId: t.contact_id, company: t.company, deal: t.deal })) };
    }
    case "calendar": {
      const from = typeof input.from === "string" && DATE.test(input.from) ? input.from : ctx.today;
      const to = typeof input.to === "string" && DATE.test(input.to) ? input.to : from;
      // Dates are the founder's local days; shift by their UTC offset.
      const start = new Date(Date.parse(from + "T00:00:00Z") + ctx.tzOffsetMinutes * 60000).toISOString();
      const end = new Date(Date.parse(to + "T00:00:00Z") + 86400000 + ctx.tzOffsetMinutes * 60000).toISOString();
      const rows = await sql`
        SELECT e.id, e.title, e.starts_at, e.ends_at, e.event_type, e.status, e.contact_id, c.company
        FROM public.calendar_events e LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
        WHERE e.owner_id = ${owner} AND e.status <> 'cancelled' AND e.starts_at < ${end}::timestamptz AND e.ends_at > ${start}::timestamptz
        ORDER BY e.starts_at LIMIT 60`;
      return { count: rows.length, events: rows.map(e => ({ id: e.id, title: e.title, startsAt: iso(e.starts_at), endsAt: iso(e.ends_at), type: e.event_type, status: e.status, contactId: e.contact_id, company: e.company })) };
    }
    case "list_audits": {
      const text = like(input.text);
      const rows = await sql`
        SELECT r.id, r.title, r.content, r.created_at, r.contact_id, c.company
        FROM public.research_artifacts r LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
        WHERE r.owner_id = ${owner} AND r.artifact_type = 'audit_prep' AND r.status <> 'archived'
          AND (${text}::text IS NULL OR concat_ws(' ', r.title, c.company) ILIKE ${text})
        ORDER BY r.created_at DESC LIMIT 25`;
      return { count: rows.length, audits: rows.map(a => ({ id: a.id, title: a.title, date: d10(a.created_at), contactId: a.contact_id, company: a.company, verdict: auditVerdict(a.content) })) };
    }
    case "get_audit": {
      if (typeof input.id !== "string" || !UUID.test(input.id)) return { error: "Invalid audit id." };
      const rows = await sql`SELECT id, title, content, source_urls, created_at, contact_id FROM public.research_artifacts WHERE id = ${input.id}::uuid AND owner_id = ${owner}`;
      if (!rows.length) return { error: "Audit not found." };
      return { id: rows[0].id, title: rows[0].title, date: d10(rows[0].created_at), contactId: rows[0].contact_id, content: s(rows[0].content, 8000) };
    }
    case "money": {
      const status = typeof input.status === "string" && input.status !== "all" ? input.status : null;
      const days = Math.min(Math.max(Number(input.days) || 60, 1), 366);
      const lo = new Date(Date.parse(ctx.today + "T00:00:00Z") - days * 86400000).toISOString().slice(0, 10);
      const hi = new Date(Date.parse(ctx.today + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
      const [rev, exp] = await Promise.all([
        sql`SELECT r.id, r.title, r.revenue_type, r.amount, r.status, r.due_date, r.paid_at, c.company
          FROM public.revenue_entries r LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
          WHERE r.owner_id = ${owner} AND (${status}::text IS NULL OR r.status = ${status})
            AND coalesce(r.paid_at, r.due_date, r.created_at::date) BETWEEN ${lo}::date AND ${hi}::date
          ORDER BY coalesce(r.paid_at, r.due_date) DESC NULLS LAST LIMIT 50`,
        sql`SELECT title, category, amount, expense_date, recurring FROM public.business_expenses WHERE owner_id = ${owner} AND expense_date >= ${lo}::date ORDER BY expense_date DESC LIMIT 30`,
      ]);
      return {
        revenue: rev.map(r => ({ title: r.title, type: r.revenue_type, amount: Number(r.amount), status: r.status, due: d10(r.due_date), paidOn: d10(r.paid_at), client: r.company })),
        expenses: exp.map(e => ({ title: e.title, category: e.category, amount: Number(e.amount), date: d10(e.expense_date), recurring: e.recurring })),
      };
    }
    default:
      return { error: `Unknown tool ${tool}.` };
  }
}
