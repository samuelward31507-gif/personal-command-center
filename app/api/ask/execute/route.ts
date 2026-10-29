import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { validateAction } from "@/lib/ask";
import { runDealHandoff, HandoffNotReady } from "@/lib/deal-handoff";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/ask/execute { kind, label, params } — runs ONE change the founder confirmed from Ask Cinder.
 * Re-validates everything; every statement is owner-scoped. Never deletes, never marks money paid.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const action = validateAction(await request.json().catch(() => null));
    if (typeof action === "string") return fail(action, 400);
    const sql = neon(process.env.DATABASE_URL);
    const owner = user.id;
    const p = action.params;

    const ownsContact = async (id: unknown) => !id || (await sql`SELECT 1 FROM public.contacts WHERE id = ${String(id)}::uuid AND owner_id = ${owner}`).length > 0;
    const ownsDeal = async (id: unknown) => !id || (await sql`SELECT 1 FROM public.deals WHERE id = ${String(id)}::uuid AND owner_id = ${owner}`).length > 0;
    if (!(await ownsContact(p.contactId))) return fail("Contact not found.", 404);
    if (!(await ownsDeal(p.dealId))) return fail("Deal not found.", 404);

    switch (action.kind) {
      case "create_contact": {
        const [first, ...rest] = String(p.name).split(/\s+/);
        const rows = await sql`
          INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, website, location)
          VALUES (${owner}, ${first ?? ""}, ${rest.join(" ")}, ${p.company}, ${p.email}, ${p.phone}, ${p.status}, 'Ask Cinder', ${p.notes}, ${p.website}, ${p.location})
          RETURNING id`;
        return Response.json({ ok: true, message: "Contact added.", href: "/crm?contact=" + rows[0].id });
      }
      case "set_follow_up": {
        await sql`UPDATE public.contacts SET follow_up_at = ${p.date}::date, updated_at = now() WHERE id = ${p.contactId}::uuid AND owner_id = ${owner}`;
        return Response.json({ ok: true, message: `Follow-up set for ${new Date(String(p.date) + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}.`, href: "/crm?contact=" + p.contactId });
      }
      case "add_note": {
        await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes) VALUES (${owner}, ${p.contactId}::uuid, 'note', 'note', 'other', ${p.note})`;
        return Response.json({ ok: true, message: "Note added.", href: "/crm?contact=" + p.contactId });
      }
      case "create_task": {
        await sql`
          INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id, deal_id)
          VALUES (${owner}, ${p.title}, ${p.description}, 'todo', ${p.priority}, ${p.dueDate ? p.dueDate + "T17:00:00Z" : null}::timestamptz, ${p.contactId}::uuid, ${p.dealId}::uuid)`;
        return Response.json({ ok: true, message: "Task created.", href: "/crm/tasks" });
      }
      case "create_deal": {
        const rows = await sql`
          INSERT INTO public.deals (owner_id, contact_id, title, service_type, stage, setup_fee, monthly_fee, source, agreement_status)
          VALUES (${owner}, ${p.contactId}::uuid, ${p.title}, ${p.serviceType}, ${p.stage}, ${p.setupFee}, ${p.monthlyFee}, 'Ask Cinder', 'pending')
          RETURNING id`;
        return Response.json({ ok: true, message: "Deal created.", href: "/crm/pipeline?deal=" + rows[0].id });
      }
      case "move_deal": {
        const rows = await sql`
          UPDATE public.deals SET stage = ${p.stage},
            lost_reason = CASE WHEN ${p.stage} = 'lost' THEN ${p.lostReason ?? ""} ELSE lost_reason END,
            agreement_status = CASE WHEN ${p.stage} = 'won' AND stage <> 'won' THEN 'active' ELSE agreement_status END,
            signed_at = CASE WHEN ${p.stage} = 'won' THEN coalesce(signed_at, now()) ELSE signed_at END,
            effective_at = CASE WHEN ${p.stage} = 'won' THEN coalesce(effective_at, CURRENT_DATE) ELSE effective_at END,
            updated_at = now()
          WHERE id = ${p.dealId}::uuid AND owner_id = ${owner} RETURNING id`;
        if (!rows.length) return fail("Deal not found.", 404);
        let message = `Deal moved to ${String(p.stage).replace("_", " ")}.`;
        if (p.stage === "won") {
          // Won starts delivery and books *expected* receivables. It never marks anything paid.
          try { await runDealHandoff(sql, owner, String(p.dealId)); message += " Onboarding project and expected payments created."; }
          catch (e) { message += e instanceof HandoffNotReady ? ` Onboarding not started: ${e.message}` : " Onboarding could not start; open the pipeline to retry."; }
        }
        return Response.json({ ok: true, message, href: "/crm/pipeline?deal=" + p.dealId });
      }
      case "schedule_event": {
        const start = new Date(String(p.startsAt));
        const end = new Date(start.getTime() + Number(p.durationMinutes) * 60000);
        await sql`
          INSERT INTO public.calendar_events (owner_id, title, starts_at, ends_at, event_type, contact_id, deal_id)
          VALUES (${owner}, ${p.title}, ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, ${p.eventType}, ${p.contactId}::uuid, ${p.dealId}::uuid)`;
        return Response.json({ ok: true, message: "Added to your calendar.", href: "/crm/calendar" });
      }
    }
  } catch (error) {
    console.error("Ask execute failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Couldn't make that change. Nothing was saved.", 500);
  }
}
