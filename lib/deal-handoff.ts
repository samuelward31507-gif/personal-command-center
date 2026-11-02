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

// ---------- Plan playbooks: the exact build plan for each plan, matched to the agreement's Schedule A ----------
// Offsets are calendar days from the effective date. Go-live lands on day 28 (~21 business days).

export type PlaybookStep = { title: string; description: string; dueInDays: number };

export const GO_LIVE_STEP = "Go live (monthly billing starts)";
export const KICKOFF_STEP = "Collect the kickoff checklist";

export const TIER1_PLAYBOOK: readonly PlaybookStep[] = [
  { title: "Send the kickoff checklist link", description: "The client gets the link right after signing. Resend it if they haven't opened it.", dueInDays: 1 },
  { title: KICKOFF_STEP, description: "Items 1–9 of Schedule B. The 21-business-day clock starts when these are in.", dueInDays: 3 },
  { title: "Hold the kickoff call", description: "30 minutes: confirm qualifying questions, job rules, service area, estimate availability and who gets alerts.", dueInDays: 4 },
  { title: "Submit SMS registration (A2P 10DLC)", description: "Brand and campaign registration with the client's legal name, EIN and website. Carrier review usually takes 3–6 weeks (AT&T is slowest), so do this first. The go-live clock pauses during carrier review (agreement 3.3).", dueInDays: 5 },
  { title: "Set up the texting number and missed-call text-back", description: "Provision the business texting number and set up call forwarding or missed-call detection on the client's line.", dueInDays: 7 },
  { title: "Connect website forms and Facebook lead ads", description: "Every form and lead ad sends the lead into the system within seconds. Facebook page instant reply too.", dueInDays: 9 },
  { title: "Build the qualifying flow and job rules", description: "Client's questions, photo request, ballpark ranges with caveat, minimums, small jobs and service area.", dueInDays: 11 },
  { title: "Connect calendar booking and reminders", description: "Estimate booking on the client's calendar, address collected after booking, appointment reminders.", dueInDays: 13 },
  { title: "Set up owner alerts and takeover", description: "Lead summary to the owner's cell, owner takeover at any time, 'talk to a person' booked as a call, one follow-up nudge.", dueInDays: 13 },
  { title: "Send the message wording for approval", description: "Every message the system sends, in the client's voice. Nothing goes live without their written approval.", dueInDays: 15 },
  { title: "Test every path end to end", description: "Form, missed call, Facebook, after hours, booking, reschedule, STOP opt-out and owner takeover. Fix what fails.", dueInDays: 21 },
  { title: GO_LIVE_STEP, description: "System answers real leads. Record the Go-Live Date: the monthly fee and the 3-month minimum start today.", dueInDays: 28 },
  { title: "7-day post-launch review", description: "Read every conversation from week one, tighten wording and rules, and check the client is responding to handoffs.", dueInDays: 35 },
  { title: "Send the first monthly report", description: "Inquiries answered, response time, estimates booked, what we'll improve next. Build it from Clients → Monthly report.", dueInDays: 58 },
] as const;

export const TIER2_EXTRAS: readonly PlaybookStep[] = [
  { title: "Import the last 6 months of quotes", description: "Name, phone, job, amount and date for every open quote (Schedule B item 11).", dueInDays: 10 },
  { title: "Add budget, financing and feasibility questions", description: "Budget ranges, financing details, and site questions like access, HOA, slope and permits.", dueInDays: 11 },
  { title: "Set up two-step booking, zones and estimator rotation", description: "Video call first, then site visit; service zones by day; estimator schedules.", dueInDays: 14 },
  { title: "Build quote follow-up (days 1, 3, 7) and long-term nurture", description: "Proposal follow-up sequence plus monthly nurture for 'not yet' leads, within quiet hours.", dueInDays: 16 },
  { title: "Set up the daily owner summary and quiet hours", description: "One morning summary to the owner; no follow-ups outside 8 am–8 pm.", dueInDays: 17 },
  { title: "Connect the client's CRM", description: "Sync leads, bookings and outcomes with their CRM (Schedule B item 16).", dueInDays: 18 },
  { title: "Launch-week reactivation of old quotes", description: "One respectful message to the last 6 months of quotes, only contacts the client has permission to reach.", dueInDays: 30 },
  { title: "Turn on review and referral requests", description: "After completed jobs, using the client's Google review link (item 13).", dueInDays: 30 },
] as const;

export const TIER2_PLAYBOOK: readonly PlaybookStep[] = [...TIER1_PLAYBOOK, ...TIER2_EXTRAS].sort((a, b) => a.dueInDays - b.dueInDays);

/** The playbook for a deal's service type, or null when the deal isn't on Tier 1 or Tier 2. */
export function playbookFor(serviceType: string | null | undefined): readonly PlaybookStep[] | null {
  if (serviceType === "tier1_speed_to_lead") return TIER1_PLAYBOOK;
  if (serviceType === "tier2_revenue_system") return TIER2_PLAYBOOK;
  return null;
}

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
    throw new HandoffNotReady("Onboarding starts once the agreement is signed. Send it for e-signature, or press Signed on the deal's Agreement tab if they signed on paper.");
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

  // Tier 1 / Tier 2 deals get their plan's playbook; anything else gets the generic onboarding template.
  // An existing project only gets steps when it has none yet, so re-saving an old deal never appends a second plan.
  const template = playbookFor(deal.service_type ? String(deal.service_type) : null) ?? ONBOARDING_TEMPLATE;
  const existing = created ? 0 : Number((await sql`SELECT count(*)::int AS n FROM public.project_milestones WHERE owner_id = ${ownerId} AND project_id = ${projectId}::uuid`)[0].n);
  let milestonesAdded = 0;
  for (const [index, m] of (existing > 0 ? [] : template).entries()) {
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
