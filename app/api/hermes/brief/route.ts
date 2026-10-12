import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function hasValidBearer(request: Request, expected: string) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const supplied = Buffer.from(match[1], "utf8");
  const configured = Buffer.from(expected, "utf8");
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

/**
 * Read-only, service-to-service context for Hermes.
 * Scope is fixed by HERMES_BRIDGE_OWNER_ID; callers cannot choose an owner.
 */
export async function GET(request: Request) {
  const token = process.env.HERMES_BRIDGE_TOKEN;
  const ownerId = process.env.HERMES_BRIDGE_OWNER_ID;
  if (!process.env.DATABASE_URL || !token || token.length < 32 || !ownerId) {
    return error("Hermes read-only bridge is not configured.", 503);
  }
  if (!hasValidBearer(request, token)) return error("Unauthorized.", 401);

  try {
    const sql = neon(process.env.DATABASE_URL);
    const [
      contactStats,
      dueContacts,
      openDeals,
      dueTasks,
      attentionProjects,
      pendingApprovals,
      failedRuns,
      atRiskClients,
      finance,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('lead','prospect'))::int AS leads,
          COUNT(*) FILTER (WHERE follow_up_at <= CURRENT_DATE)::int AS due_follow_ups
        FROM public.contacts WHERE owner_id = ${ownerId}`,
      sql`SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)) AS name,
          c.company, c.email, c.phone, c.status, c.follow_up_at
        FROM public.contacts c
        WHERE c.owner_id = ${ownerId} AND c.follow_up_at <= CURRENT_DATE
        ORDER BY c.follow_up_at ASC, c.updated_at DESC LIMIT 25`,
      sql`SELECT d.id, d.title, d.stage, d.setup_fee, d.monthly_fee,
          d.expected_close_date, trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name,
          c.company
        FROM public.deals d
        LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
        WHERE d.owner_id = ${ownerId} AND d.stage NOT IN ('won','lost')
        ORDER BY d.expected_close_date ASC NULLS LAST, d.updated_at DESC LIMIT 25`,
      sql`SELECT t.id, t.title, t.status, t.priority, t.due_at,
          trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, d.title AS deal_title
        FROM public.tasks t
        LEFT JOIN public.contacts c ON c.id = t.contact_id AND c.owner_id = t.owner_id
        LEFT JOIN public.deals d ON d.id = t.deal_id AND d.owner_id = t.owner_id
        WHERE t.owner_id = ${ownerId} AND t.status NOT IN ('done','cancelled')
          AND (t.status = 'blocked' OR t.due_at <= now())
        ORDER BY CASE t.status WHEN 'blocked' THEN 0 ELSE 1 END,
          CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          t.due_at ASC NULLS LAST LIMIT 25`,
      sql`SELECT p.id, p.name, p.client_name, p.status, p.target_date
        FROM public.projects p
        WHERE p.owner_id = ${ownerId} AND p.status NOT IN ('completed','cancelled')
          AND (p.status = 'blocked' OR p.target_date < CURRENT_DATE)
        ORDER BY CASE WHEN p.status = 'blocked' THEN 0 ELSE 1 END,
          p.target_date ASC NULLS LAST LIMIT 25`,
      sql`SELECT id, title, action_type, description, created_at
        FROM public.approval_requests
        WHERE owner_id = ${ownerId} AND status = 'pending'
        ORDER BY created_at ASC LIMIT 25`,
      sql`SELECT id, agent_name, task_title, summary, updated_at
        FROM public.agent_runs
        WHERE owner_id = ${ownerId} AND status = 'failed'
        ORDER BY updated_at DESC LIMIT 25`,
      sql`SELECT id, client_name, service_name, status, health_score, renewal_date, next_review_date, risk_notes
        FROM public.client_success
        WHERE owner_id = ${ownerId}
          AND (status = 'at_risk' OR health_score <= 2
            OR (renewal_date IS NOT NULL AND renewal_date <= CURRENT_DATE + 30 AND status NOT IN ('paused','churned')))
        ORDER BY CASE WHEN status = 'at_risk' OR health_score <= 2 THEN 0 ELSE 1 END,
          renewal_date ASC NULLS LAST LIMIT 25`,
      sql`SELECT
          COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)::date), 0) AS collected_this_month,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('expected','overdue')), 0) AS expected_revenue,
          COALESCE(SUM(amount) FILTER (WHERE status = 'overdue' OR (status = 'expected' AND due_date < CURRENT_DATE)), 0) AS overdue_revenue
        FROM public.revenue_entries WHERE owner_id = ${ownerId}`,
    ]);

    const contacts = contactStats[0] as Record<string, unknown>;
    const money = finance[0] as Record<string, unknown>;
    return Response.json({
      generatedAt: new Date().toISOString(),
      readOnly: true,
      summary: {
        contacts: Number(contacts?.total || 0),
        leads: Number(contacts?.leads || 0),
        dueFollowUps: Number(contacts?.due_follow_ups || 0),
        openDeals: openDeals.length,
        dueOrBlockedTasks: dueTasks.length,
        blockedOrOverdueProjects: attentionProjects.length,
        pendingApprovals: pendingApprovals.length,
        failedAgentRuns: failedRuns.length,
        atRiskClients: atRiskClients.length,
        collectedThisMonth: Number(money?.collected_this_month || 0),
        expectedRevenue: Number(money?.expected_revenue || 0),
        overdueRevenue: Number(money?.overdue_revenue || 0),
      },
      dueContacts,
      openDeals: openDeals.map((d: Record<string, unknown>) => ({
        ...d, setup_fee: Number(d.setup_fee || 0), monthly_fee: Number(d.monthly_fee || 0),
        expected_close_date: d.expected_close_date ? String(d.expected_close_date).slice(0, 10) : null,
      })),
      dueTasks,
      attentionProjects: attentionProjects.map((p: Record<string, unknown>) => ({
        ...p, target_date: p.target_date ? String(p.target_date).slice(0, 10) : null,
      })),
      pendingApprovals,
      failedRuns,
      atRiskClients: atRiskClients.map((c: Record<string, unknown>) => ({
        ...c,
        renewal_date: c.renewal_date ? String(c.renewal_date).slice(0, 10) : null,
        next_review_date: c.next_review_date ? String(c.next_review_date).slice(0, 10) : null,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Hermes read-only brief failed", e);
    return error("Unable to load the Hermes workspace brief.", 500);
  }
}
