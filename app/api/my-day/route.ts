import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { buildQueue, GROUP_LABELS, type QueueInput } from "@/lib/my-day";
import { reportSection } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const dateOnly = (v: unknown) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(s).toISOString().slice(0, 10);
};
function shortVerdict(content: unknown): string | null {
  if (typeof content !== "string") return null;
  const section = reportSection(content, "Verdict") || reportSection(content, "1\\. Executive verdict");
  const v = section.replace(/\*\*/g, "").replace(/^[-*•]\s+/, "").split(/[.!]\s/)[0].trim();
  return v ? "Audit: " + v.slice(0, 90) : null;
}

/**
 * GET /api/my-day?today=YYYY-MM-DD&dayEnd=ISO&windowEnd=ISO
 * today/dayEnd come from the browser so "today" means the owner's local day.
 */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const params = new URL(request.url).searchParams;
    const today = params.get("today") ?? "";
    const dayEnd = params.get("dayEnd") ?? "";
    const windowEnd = params.get("windowEnd") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(dayEnd)) || Number.isNaN(Date.parse(windowEnd))) {
      return fail("today, dayEnd and windowEnd are required.", 400);
    }
    const sql = db();
    const owner = user.id;

    const dayStart = new Date(Date.parse(dayEnd) - 86400000).toISOString();
    const [outreach, activeIds, followUps, meetings, deals, projects, milestones, receivables, tasks, prospects, firstTouches] = await Promise.all([
      sql`SELECT id, contact_id, current_step, next_action_at FROM public.contact_outreach
        WHERE owner_id = ${owner} AND status = 'active' AND next_action_at < ${dayEnd}::timestamptz ORDER BY next_action_at LIMIT 100`,
      sql`SELECT DISTINCT contact_id FROM public.contact_outreach WHERE owner_id = ${owner} AND status = 'active'`,
      sql`SELECT id, follow_up_at FROM public.contacts c WHERE owner_id = ${owner} AND follow_up_at <= ${today}::date
        AND NOT EXISTS (SELECT 1 FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id AND s.contact_id = c.id)
        ORDER BY follow_up_at LIMIT 100`,
      sql`SELECT e.id, e.title, e.starts_at, e.event_type, e.contact_id, d.title AS deal_title,
          EXISTS (SELECT 1 FROM public.research_artifacts r WHERE r.owner_id = e.owner_id AND r.status <> 'archived'
            AND (r.calendar_event_id = e.id OR (e.contact_id IS NOT NULL AND r.contact_id = e.contact_id AND r.updated_at > now() - interval '30 days'))) AS has_prep
        FROM public.calendar_events e LEFT JOIN public.deals d ON d.id = e.deal_id AND d.owner_id = e.owner_id
        WHERE e.owner_id = ${owner} AND e.status = 'scheduled' AND e.event_type IN ('meeting','call')
          AND e.starts_at >= now() - interval '2 hours' AND e.starts_at < ${windowEnd}::timestamptz
        ORDER BY e.starts_at LIMIT 50`,
      sql`SELECT d.id, d.title, d.stage, d.expected_close_date, d.contact_id,
          (SELECT max(a.occurred_at) FROM public.contact_activities a WHERE a.owner_id = d.owner_id AND a.contact_id = d.contact_id) AS last_activity_at
        FROM public.deals d WHERE d.owner_id = ${owner} AND d.stage NOT IN ('won','lost') LIMIT 100`,
      sql`SELECT id, name, status, target_date FROM public.projects
        WHERE owner_id = ${owner} AND status NOT IN ('completed','cancelled','on_hold')
          AND (status = 'blocked' OR target_date <= ${today}::date) LIMIT 50`,
      sql`SELECT m.id, m.title, m.status, m.due_at, p.name AS project FROM public.project_milestones m
        JOIN public.projects p ON p.id = m.project_id AND p.owner_id = m.owner_id
        WHERE m.owner_id = ${owner} AND m.status NOT IN ('done','cancelled') AND p.status NOT IN ('completed','cancelled','on_hold')
          AND (m.status = 'blocked' OR m.due_at < ${dayEnd}::timestamptz) LIMIT 50`,
      sql`SELECT r.id, r.title, r.amount, r.status, r.due_date,
          coalesce(nullif(p.client_name,''), nullif(c.company,''), trim(concat_ws(' ', c.first_name, c.last_name))) AS client
        FROM public.revenue_entries r
        LEFT JOIN public.projects p ON p.id = r.project_id AND p.owner_id = r.owner_id
        LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
        WHERE r.owner_id = ${owner} AND (r.status = 'overdue' OR (r.status = 'expected' AND r.due_date <= ${today}::date)) LIMIT 50`,
      sql`SELECT t.id, t.title, t.status, t.priority, t.due_at,
          trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, d.title AS deal_title
        FROM public.tasks t
        LEFT JOIN public.contacts c ON c.id = t.contact_id AND c.owner_id = t.owner_id
        LEFT JOIN public.deals d ON d.id = t.deal_id AND d.owner_id = t.owner_id
        WHERE t.owner_id = ${owner} AND t.status NOT IN ('done','cancelled')
          AND (t.status = 'blocked' OR t.priority = 'urgent' OR t.due_at < ${dayEnd}::timestamptz) LIMIT 100`,
      // Never-contacted prospects: no logged call outcome, no follow-up, no sequence, not suppressed.
      sql`SELECT c.id, c.location, c.website, c.created_at FROM public.contacts c
        WHERE c.owner_id = ${owner} AND c.status IN ('lead','contact','prospect') AND c.phone <> '' AND c.follow_up_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.outcome <> 'initiated')
          AND NOT EXISTS (SELECT 1 FROM public.contact_outreach o WHERE o.owner_id = c.owner_id AND o.contact_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id AND s.contact_id = c.id)
        ORDER BY c.created_at LIMIT 300`,
      sql`SELECT count(*)::int AS n FROM (SELECT contact_id, min(occurred_at) AS first_at FROM public.contact_activities
          WHERE owner_id = ${owner} AND outcome <> 'initiated' GROUP BY contact_id) x WHERE x.first_at >= ${dayStart}::timestamptz`,
    ]);

    // One lookup for every contact referenced: name, phone, last call outcome, latest audit verdict.
    const contactIds = [...new Set([
      ...outreach.map(r => r.contact_id), ...followUps.map(r => r.id),
      ...meetings.map(r => r.contact_id), ...deals.map(r => r.contact_id), ...prospects.map(r => r.id),
    ].filter(Boolean).map(String))];
    const refs = contactIds.length ? await sql`
      SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company, c.phone,
        la.outcome AS last_outcome, la.occurred_at AS last_at, au.content AS audit
      FROM public.contacts c
      LEFT JOIN LATERAL (SELECT outcome, occurred_at FROM public.contact_activities a
        WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.outcome <> 'initiated' ORDER BY occurred_at DESC LIMIT 1) la ON true
      LEFT JOIN LATERAL (SELECT content FROM public.research_artifacts r
        WHERE r.owner_id = c.owner_id AND r.contact_id = c.id AND r.artifact_type = 'audit_prep' AND r.status <> 'archived'
        ORDER BY created_at DESC LIMIT 1) au ON true
      WHERE c.owner_id = ${owner} AND c.id = ANY(${contactIds}::uuid[])` : [];
    const byId = new Map(refs.map(r => [String(r.id), {
      id: String(r.id), name: String(r.name || r.company || "Unnamed contact"), company: String(r.company ?? ""),
      phone: String(r.phone ?? ""), lastOutcome: r.last_outcome ? String(r.last_outcome) : null,
      lastAt: iso(r.last_at), verdict: shortVerdict(r.audit),
    }]));
    const ref = (id: unknown) => (id ? byId.get(String(id)) ?? null : null);

    const input: QueueInput = {
      today, now: new Date().toISOString(),
      outreach: outreach.filter(r => ref(r.contact_id)).map(r => ({ id: String(r.id), step: Number(r.current_step), nextActionAt: iso(r.next_action_at)!, contact: ref(r.contact_id)! })),
      activeOutreachContactIds: activeIds.map(r => String(r.contact_id)),
      followUps: followUps.filter(r => ref(r.id)).map(r => ({ followUpAt: dateOnly(r.follow_up_at)!, contact: ref(r.id)! })),
      meetings: meetings.map(r => ({ id: String(r.id), title: String(r.title), startsAt: iso(r.starts_at)!, type: String(r.event_type), hasPrep: r.has_prep === true, contact: ref(r.contact_id), dealTitle: r.deal_title ? String(r.deal_title) : null })),
      deals: deals.map(r => ({ id: String(r.id), title: String(r.title), stage: String(r.stage), closeDate: dateOnly(r.expected_close_date), lastActivityAt: iso(r.last_activity_at), contact: ref(r.contact_id) })),
      delivery: [
        ...projects.map(r => ({ id: String(r.id), kind: "project" as const, title: String(r.name), project: String(r.name), status: String(r.status), due: dateOnly(r.target_date) })),
        ...milestones.map(r => ({ id: String(r.id), kind: "milestone" as const, title: String(r.title), project: String(r.project), status: String(r.status), due: iso(r.due_at) })),
      ],
      receivables: receivables.map(r => ({ id: String(r.id), title: String(r.title), amount: Number(r.amount), status: String(r.status), due: dateOnly(r.due_date), client: String(r.client ?? "") })),
      prospects: prospects.filter(r => ref(r.id)).map(r => ({ contact: ref(r.id)!, location: String(r.location ?? ""), website: String(r.website ?? ""), createdAt: iso(r.created_at)! })),
      firstTouchesToday: Number(firstTouches[0]?.n ?? 0),
      tasks: tasks.map(r => ({ id: String(r.id), title: String(r.title), status: String(r.status), priority: String(r.priority), dueAt: iso(r.due_at), contactName: r.contact_name ? String(r.contact_name) : null, dealTitle: r.deal_title ? String(r.deal_title) : null })),
    };
    const items = buildQueue(input);
    return Response.json({ items, groups: GROUP_LABELS, generatedAt: input.now }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("My Day queue failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return fail("Could not build today's queue.", 500);
  }
}
