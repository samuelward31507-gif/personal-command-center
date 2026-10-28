import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const result = await auth.getSession();
    const session = result?.data?.session;
    const user = result?.data?.user;
    if (!session || !user?.id) return fail("Unauthorized", 401);

    const eventId = new URL(request.url).searchParams.get("eventId") || "";
    if (!uuid.test(eventId)) return fail("A valid calendar event id is required.", 400);

    const sql = db();
    const events = await sql`
      SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.status,
        e.contact_id, e.deal_id, e.provider,
        c.first_name, c.last_name, c.company, c.role, c.email, c.phone, c.website,
        c.location, c.status AS contact_status, c.source, c.notes AS contact_notes,
        c.follow_up_at,
        d.id AS linked_deal_id, d.title AS deal_title, d.stage AS deal_stage,
        d.service_type, d.setup_fee, d.monthly_fee, d.expected_close_date, d.notes AS deal_notes
      FROM public.calendar_events e
      LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
      LEFT JOIN public.deals d ON d.id = e.deal_id AND d.owner_id = e.owner_id
      WHERE e.id = ${eventId}::uuid AND e.owner_id = ${String(user.id)}
      LIMIT 1
    `;
    if (!events.length) return fail("Calendar event not found.", 404);
    const e = events[0] as Record<string, unknown>;
    const contactId = e.contact_id ? String(e.contact_id) : "";
    const [activities, tasks, deals] = contactId ? await Promise.all([
      sql`SELECT channel, action, outcome, notes, occurred_at FROM public.contact_activities
          WHERE owner_id = ${String(user.id)} AND contact_id = ${contactId}::uuid
          ORDER BY occurred_at DESC LIMIT 8`,
      sql`SELECT id, title, description, status, priority, due_at FROM public.tasks
          WHERE owner_id = ${String(user.id)} AND contact_id = ${contactId}::uuid
            AND status NOT IN ('done','cancelled')
          ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            due_at ASC NULLS LAST LIMIT 8`,
      sql`SELECT id, title, stage, service_type, setup_fee, monthly_fee, expected_close_date, notes
          FROM public.deals WHERE owner_id = ${String(user.id)} AND contact_id = ${contactId}::uuid
          ORDER BY updated_at DESC LIMIT 8`
    ]) : [[], [], []];

    return Response.json({
      event: {
        id: e.id, title: e.title, description: e.description, startsAt: e.starts_at,
        endsAt: e.ends_at, status: e.status, provider: e.provider,
      },
      contact: contactId ? {
        id: contactId, name: [e.first_name, e.last_name].filter(Boolean).join(" "),
        company: e.company, role: e.role, email: e.email, phone: e.phone, website: e.website,
        location: e.location, status: e.contact_status, source: e.source,
        notes: e.contact_notes, followUpAt: e.follow_up_at,
      } : null,
      linkedDeal: e.linked_deal_id ? {
        id: e.linked_deal_id, title: e.deal_title, stage: e.deal_stage,
        serviceType: e.service_type, setupFee: Number(e.setup_fee || 0),
        monthlyFee: Number(e.monthly_fee || 0), expectedCloseDate: e.expected_close_date,
        notes: e.deal_notes,
      } : null,
      relatedDeals: deals.map((d: Record<string, unknown>) => ({
        id: d.id, title: d.title, stage: d.stage, serviceType: d.service_type,
        setupFee: Number(d.setup_fee || 0), monthlyFee: Number(d.monthly_fee || 0),
        expectedCloseDate: d.expected_close_date, notes: d.notes,
      })),
      recentActivity: activities.map((a: Record<string, unknown>) => ({
        channel: a.channel, action: a.action, outcome: a.outcome, notes: a.notes, occurredAt: a.occurred_at,
      })),
      openTasks: tasks.map((t: Record<string, unknown>) => ({
        id: t.id, title: t.title, description: t.description, status: t.status,
        priority: t.priority, dueAt: t.due_at,
      })),
      checklist: [
        "Review the prospect's business and likely lead-conversion bottleneck",
        "Confirm the current situation and quantify missed or delayed leads",
        "Agree on the next step before ending the call",
      ],
      unlinked: !contactId,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Meeting prep GET failed", error);
    return fail("Unable to prepare meeting brief.", 500);
  }
}
