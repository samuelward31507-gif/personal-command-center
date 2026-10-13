import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Read-only, owner-scoped snapshot for a future Hermes bridge. */
export async function GET() {
  try {
    const result = await auth.getSession();
    const session = result?.data?.session;
    const user = result?.data?.user;
    if (!session || !user?.id) return error("Unauthorized", 401);

    const ownerId = String(user.id);
    const sql = db();
    const [tasks, deals, contacts, projects, approvals] = await Promise.all([
      sql`SELECT id, title, description, status, priority, due_at, contact_id, deal_id, created_at, updated_at
          FROM public.tasks WHERE owner_id = ${ownerId}
          ORDER BY CASE WHEN status IN ('done','cancelled') THEN 1 ELSE 0 END,
            CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            due_at ASC NULLS LAST LIMIT 100`,
      sql`SELECT id, title, service_type, stage, setup_fee, monthly_fee, expected_close_date, contact_id, updated_at
          FROM public.deals WHERE owner_id = ${ownerId}
          ORDER BY CASE WHEN stage IN ('won','lost') THEN 1 ELSE 0 END,
            expected_close_date ASC NULLS LAST, updated_at DESC LIMIT 100`,
      sql`SELECT id, first_name, last_name, company, role, status, source, follow_up_at, updated_at
          FROM public.contacts WHERE owner_id = ${ownerId}
          ORDER BY follow_up_at ASC NULLS LAST, updated_at DESC LIMIT 100`,
      sql`SELECT id, name, client_name, service_type, status, target_date, monthly_value, setup_value, contact_id, deal_id, updated_at
          FROM public.projects WHERE owner_id = ${ownerId}
          ORDER BY CASE WHEN status IN ('completed','cancelled') THEN 1 ELSE 0 END,
            target_date ASC NULLS LAST, updated_at DESC LIMIT 100`,
      sql`SELECT id, title, description, action_type, status, created_at
          FROM public.approval_requests WHERE owner_id = ${ownerId} AND status = 'pending'
          ORDER BY created_at ASC LIMIT 100`,
    ]);

    return Response.json({
      readOnly: true,
      generatedAt: new Date().toISOString(),
      tasks,
      deals: deals.map((d: Record<string, unknown>) => ({
        ...d,
        setup_fee: Number(d.setup_fee ?? 0),
        monthly_fee: Number(d.monthly_fee ?? 0),
      })),
      contacts,
      projects: projects.map((p: Record<string, unknown>) => ({
        ...p,
        monthly_value: Number(p.monthly_value ?? 0),
        setup_value: Number(p.setup_value ?? 0),
      })),
      pendingApprovals: approvals,
      limitations: [
        "Read-only snapshot; no agent execution or external actions.",
        "Approval requests are listed but never executed.",
        "Contact phone numbers, email addresses, and private notes are excluded.",
      ],
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (e) {
    console.error("Workforce context GET failed", e);
    return error("Unable to load read-only business context.", 500);
  }
}
