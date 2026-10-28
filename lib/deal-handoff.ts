import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Delivery template for the agency's revenue-optimization offers. Offsets are days
 * from the agreement's effective date; launch lands inside the "live within 21
 * business days" term (~28 calendar days), then the 7- and 30-day reviews follow.
 */
export const ONBOARDING_TEMPLATE: readonly { title: string; description: string; dueInDays: number }[] = [
  { title: "Confirm scope and success criteria", description: "Confirm signed deliverables, exclusions, target outcome, owner, and acceptance criteria.", dueInDays: 1 },
  { title: "Collect access and baseline metrics", description: "Request only required system access and capture current lead response, booking, and conversion baselines.", dueInDays: 3 },
  { title: "Hold client kickoff", description: "Confirm stakeholders, communication channel, timeline, dependencies, and approval process.", dueInDays: 3 },
  { title: "Configure the agreed implementation", description: "Set up only the systems and workflows included in the signed scope.", dueInDays: 14 },
  { title: "Test the end-to-end lead journey", description: "Run test scenarios for intake, follow-up, routing, booking, exceptions, and handoff; record failures and fixes.", dueInDays: 21 },
  { title: "Review results and approve launch", description: "Walk through the working implementation with the client and obtain explicit launch approval.", dueInDays: 24 },
  { title: "Monitor launch and report outcomes", description: "Check early performance, resolve issues, and share an initial results summary with next steps.", dueInDays: 28 },
  { title: "7-day post-launch review", description: "Review the first week of leads, replies, bookings and missed calls with the client; fix what slipped.", dueInDays: 35 },
  { title: "30-day results review", description: "Share the monthly report, compare against the baseline, confirm the retainer value, and agree next priorities.", dueInDays: 58 },
] as const;
export const LAUNCH_TARGET_DAYS = 28;

export class HandoffNotReady extends Error {}

/**
 * Idempotent signed-deal → delivery handoff: one project per deal, missing template
 * milestones only, contact marked customer, and *expected* receivables (never paid).
 * Safe to call on every save of a won deal.
 */
export async function runDealHandoff(sql: NeonQueryFunction<false, false>, ownerId: string, dealId: string) {
  const deals = await sql`
    SELECT d.id, d.contact_id, d.title, d.service_type, d.stage, d.setup_fee, d.monthly_fee,
      d.agreement_status, d.signed_at, d.effective_at, d.conversion_completed_at,
      trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, c.company
    FROM public.deals d
    LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    WHERE d.id = ${dealId}::uuid AND d.owner_id = ${ownerId} LIMIT 1`;
  const deal = deals[0];
  if (!deal) throw new HandoffNotReady("Deal not found.");
  if (deal.stage !== "won" || deal.agreement_status !== "active" || !deal.signed_at) {
    throw new HandoffNotReady("Mark the deal won only after the agreement is signed, then retry this handoff.");
  }
  const clientName = String(deal.company || deal.contact_name || deal.title).slice(0, 240);
  const projects = await sql`
    INSERT INTO public.projects
      (owner_id, contact_id, deal_id, name, client_name, service_type, status,
       start_date, target_date, monthly_value, setup_value, notes)
    VALUES
      (${ownerId}, ${deal.contact_id}::uuid, ${deal.id}::uuid, ${String(deal.title).slice(0, 240)}, ${clientName},
       ${deal.service_type}, 'onboarding', COALESCE(${deal.effective_at}::date, CURRENT_DATE),
       COALESCE(${deal.effective_at}::date, CURRENT_DATE) + ${LAUNCH_TARGET_DAYS}::int,
       ${Number(deal.monthly_fee)}, ${Number(deal.setup_fee)},
       'Created from signed deal handoff. Confirm scope, access, milestones, and launch criteria.')
    ON CONFLICT (owner_id, deal_id) WHERE deal_id IS NOT NULL
    DO UPDATE SET target_date = COALESCE(public.projects.target_date, EXCLUDED.target_date), updated_at = now()
    RETURNING id, (xmax = 0) AS inserted`;
  const projectId = String(projects[0].id);
  const created = projects[0].inserted === true;

  let milestonesAdded = 0;
  for (const [index, m] of ONBOARDING_TEMPLATE.entries()) {
    const rows = await sql`
      INSERT INTO public.project_milestones (owner_id, project_id, title, description, status, sort_order, due_at)
      SELECT ${ownerId}, ${projectId}::uuid, ${m.title}, ${m.description}, 'todo', ${index},
        (COALESCE(${deal.effective_at}::date, CURRENT_DATE) + ${m.dueInDays}::int)::timestamp AT TIME ZONE 'UTC' + interval '17 hours'
      WHERE NOT EXISTS (SELECT 1 FROM public.project_milestones
        WHERE owner_id = ${ownerId} AND project_id = ${projectId}::uuid AND lower(trim(title)) = lower(trim(${m.title})))
      ON CONFLICT DO NOTHING
      RETURNING id`;
    milestonesAdded += rows.length;
  }

  if (deal.contact_id) {
    await sql`UPDATE public.contacts SET status = 'customer', follow_up_at = NULL, updated_at = now()
      WHERE id = ${deal.contact_id}::uuid AND owner_id = ${ownerId}`;
    // A signed client must never keep receiving prospecting outreach.
    await sql`UPDATE public.contact_outreach SET status = 'completed', updated_at = now()
      WHERE owner_id = ${ownerId} AND contact_id = ${deal.contact_id}::uuid AND status = 'active'`;
  }
  if (Number(deal.setup_fee) > 0) {
    await sql`INSERT INTO public.revenue_entries
      (owner_id, contact_id, deal_id, project_id, title, revenue_type, amount, status, due_date, source_key, notes)
      VALUES (${ownerId}, ${deal.contact_id}::uuid, ${deal.id}::uuid, ${projectId}::uuid,
        ${clientName + " — setup fee"}, 'setup_fee', ${Number(deal.setup_fee)}, 'expected',
        COALESCE(${deal.effective_at}::date, CURRENT_DATE), ${"deal:" + deal.id + ":setup"},
        'Expected receivable created by signed-deal handoff; not cash collected.')
      ON CONFLICT (owner_id, source_key) WHERE source_key <> '' DO NOTHING`;
  }
  if (Number(deal.monthly_fee) > 0) {
    // Terms: the monthly fee starts at go-live, so the first retainer is due at the launch target.
    await sql`INSERT INTO public.revenue_entries
      (owner_id, contact_id, deal_id, project_id, title, revenue_type, amount, status, due_date, source_key, notes)
      VALUES (${ownerId}, ${deal.contact_id}::uuid, ${deal.id}::uuid, ${projectId}::uuid,
        ${clientName + " — first monthly retainer"}, 'monthly_retainer', ${Number(deal.monthly_fee)}, 'expected',
        COALESCE(${deal.effective_at}::date, CURRENT_DATE) + ${LAUNCH_TARGET_DAYS}::int, ${"deal:" + deal.id + ":first_month"},
        'First-period expected receivable (monthly starts at go-live); future billing periods are not auto-generated.')
      ON CONFLICT (owner_id, source_key) WHERE source_key <> '' DO NOTHING`;
  }
  await sql`UPDATE public.deals SET conversion_completed_at = COALESCE(conversion_completed_at, now()), updated_at = now()
    WHERE id = ${deal.id}::uuid AND owner_id = ${ownerId}`;
  return { projectId, created, milestonesAdded };
}
