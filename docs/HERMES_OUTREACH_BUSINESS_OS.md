# Hermes Outreach + Business Operating System

Status: implementation source of truth for the Hermes/Cinder internal workspace  
Base: `feat/crm-foundation`  
Scope: internal agency operations only. This is not Trackpr and must not change Trackpr.

## Product principle

Hermes prepares and organizes the work; the founder controls external outreach and business decisions. The interactive CRM is the primary interface and the durable source of truth for agency records. Research, outreach, meetings, deals, clients, delivery, finances, and reporting must share connected records rather than create parallel silos.

## Primary workspaces

1. **Today** — ranked actions due today: outreach touches, replies needing attention, prospect research to review, meeting preparation, deal follow-ups, delivery blockers, overdue invoices, and founder tasks.
2. **Outreach** — prioritized queue, sequence state, next touch, editable call scripts and permitted message drafts, outcome logging, and follow-up scheduling.
3. **Prospects / CRM** — searchable contact and company records, qualification, research evidence, owner/contact information, consent and suppression status, activity timeline, next action, and related deals.
4. **Preparation** — research briefs, website/offer analysis, evidence-backed pain hypotheses, personalized call preparation, free-audit preparation, meeting briefs, and follow-up drafts.
5. **Pipeline** — deals from new through qualified, discovery, proposal, negotiation, signed/won, and lost; setup fee, recurring price, scope, decision maker, expected close, signed date, and loss reason.
6. **Clients & Delivery** — signed agreements, commercial terms, onboarding, projects, milestones, launch status, recurring commitments, renewal dates, risks, and client notes.
7. **Money** — MRR/ARR, new MRR, expansion, contraction, churn, one-time/setup revenue, cash collected, expected and overdue receivables, expenses, net cash flow, and deal-level economics.
8. **Calendar & Tasks** — interactive calendar and persistent tasks linked to prospects, deals, clients, projects, and meetings.
9. **Intelligence / Reports** — funnel conversion, outreach outcomes, meetings booked, close rate, average deal value, sales cycle, revenue movement, delivery health, and a concise end-of-day report.
10. **Hermes / Workforce** — agent status, research runs, proposed actions, approvals, evidence, and execution history. Keep agent-generated suggestions distinguishable from verified facts and completed actions.

## End-to-end operating loop

1. Build a prospect list for the target lane and deduplicate against existing contacts and suppression records.
2. Research and qualify each business. Store source URLs, observation date, confidence, and an explicit distinction between verified facts and hypotheses. Do not invent missing information.
3. Present a ranked review queue with why the prospect fits, the likely problem, the outreach angle, missing data, and recommended next action.
4. Prepare channel-appropriate call scripts and editable drafts. Hermes does not place calls or send messages.
5. Founder manually completes the touch and records the outcome. The CRM appends an activity event and updates the next action/sequence state.
6. A reply, meeting booking, opt-out, or other terminal outcome changes the workflow immediately. Replies pause automated follow-up progression until reviewed; opt-outs create a permanent cross-channel do-not-contact suppression.
7. Prepare meetings from the full contact, company, activity, and deal history. Capture agenda, goals, questions, likely objections, evidence, and recommended next step.
8. A signed/won deal connects commercial terms to the client and delivery workflow. It must not be counted as cash received merely because it is signed.
9. Money reporting reconciles signed commitments, scheduled invoices/receivables, and actual paid entries without mixing them.
10. Use actual outcomes to improve targeting and preparation; show the evidence behind recommendations.

## Business data model and source-of-truth rules

Use additive migrations and preserve existing records. Keep owner-scoped authorization in every API route and validate all linked record ownership.

- **Contact / Company:** prospect or relationship identity, contact methods, website, niche, research evidence, consent state, suppression state, notes, and lifecycle.
- **Outreach enrollment:** one current sequence state per contact/enrollment, current step, next touch, pause reason, and terminal status. Persist individual touch attempts separately in the activity timeline.
- **Activity:** append-only, timestamped calls, manually sent communications, replies, meetings, notes, stage changes, opt-outs, and financial events. Do not claim a message was sent unless the user logs that it was sent.
- **Deal:** opportunity and proposed commercial terms. Store setup fee and monthly fee separately, stage, probability if used, expected close date, and decision dates.
- **Signed agreement / client commitment:** explicit signed date and agreed setup/recurring terms. A deal marked won should trigger a controlled conversion/review flow rather than silently inventing a payment.
- **Client / delivery project:** onboarding and fulfillment state, linked to the won deal and client, with agreed scope, launch criteria, milestones, and recurring service status.
- **Receivable / revenue entry:** what is expected, due date, paid date, amount, type, and links to the agreement/deal/client. Expected is not paid. Avoid duplicate revenue entries when converting a signed deal.
- **Expense:** one-time or recurring expense, category, date, and amount.
- **Task / calendar event:** owner, due date/time, status, priority, and optional links to contact, deal, client, or project.
- **Research artifact:** target record, sources, gathered-at timestamp, confidence, verified facts, hypotheses, and generated drafts.
- **Suppression record:** contact/channel, reason, recorded-at, and source. An opt-out is permanent and applies across channels; do not re-enroll or reactivate a suppressed contact.

### Financial definitions

- **Contracted MRR:** recurring monthly value of signed, active agreements, excluding one-time setup fees. Define agreement status and effective dates explicitly.
- **Live-service MRR:** recurring monthly value currently being delivered. Report separately from contracted MRR if onboarding delays make them differ.
- **New MRR:** MRR activated in the selected period.
- **Expansion / contraction:** change in recurring value for existing clients.
- **Churned MRR:** recurring value removed from cancelled/ended agreements.
- **ARR:** contracted MRR multiplied by 12, labelled as an annualized run rate, not cash collected.
- **Cash collected:** only entries explicitly marked paid, grouped by paid date.
- **Expected / overdue:** unpaid receivables, grouped by due date and status.
- **One-time revenue:** setup and other non-recurring amounts, tracked separately from MRR.
- **Net cash flow:** cash collected minus expenses recorded in the same period. Do not label this accounting profit unless all relevant costs and accounting treatment are covered.

Do not use project monthly value as the sole MRR source. It is a delivery metric and can differ from the signed contract. Reconcile existing records before changing dashboard calculations.

## Outreach guardrails

- Hermes can research, rank, prepare, and draft; it must never autonomously send messages, place calls, or represent an external action as completed.
- Do not draft cold SMS. Text only after explicit consent.
- Do not draft outreach for X or LinkedIn.
- Treat any opt-out as permanent do-not-contact across every channel.
- Replies pause the follow-up sequence pending human review.
- Never fabricate a personal detail, business fact, result, testimonial, or research citation.
- Make the next action, its reason, channel, and due time visible.
- Record attempts and outcomes honestly; preserve history rather than silently overwriting it.
- Keep external execution behind explicit user action and authorization.

## UX rules

- The default landing page should answer: What needs my attention? What should I do next? What is the state of my business?
- Use a clean, restrained, Attio-inspired CRM interface with dense but readable information and strong search/filtering.
- Contact, deal, client, and project records should link to each other and show a chronological activity timeline.
- Prefer inline edits, clear status changes, useful empty/error/loading states, and fast keyboard-friendly workflows.
- Never make fake demo metrics appear to be live business data. Clearly label sample/empty data.
- Keep business metrics visible without overwhelming the outreach workspace; Today and Outreach remain the primary daily surfaces.

## Current implementation checkpoint (2026-10-21)

Implemented on `feat/hermes-outreach-business-os` and merged into `feat/crm-foundation`:
- Explicit SMS-consent fields default to false; text drafts are hidden/blocked unless consent is recorded.
- Outreach cadence skips SMS-only steps when consent is absent.
- A permanent cross-channel suppression ledger is backfilled from existing do-not-contact enrollments; API enrollment and reactivation checks enforce it.
- Replies, interested outcomes, meetings, and opt-outs stop the active sequence; opt-outs are not reactivated by the UI/API.
- Won deals carry agreement status/effective/signed dates; finance reports contracted MRR and annualized ARR separately from live-service MRR.
- Won-deal delivery handoff is idempotent: create/reuse a project, mark the linked contact as a customer, and create expected setup/first-period receivables without recording cash received.
- Existing onboarding checklist creation remains retry-safe.
- Added a persistent Preparation workspace for prospect research, call briefs, free-audit prep, meeting briefs, and follow-up drafts, linked to contacts, deals, and calendar events.
- Research artifacts keep source URLs, verified facts, hypotheses, confidence, and editable content separate; drafts surface in the Needs You action queue.
- Hermes' read-only brief now includes the preparation review queue without gaining any write or external-execution capability.

Database migrations `0013_outreach_consent_and_suppression.sql` and `0014_signed_deal_handoff.sql` have been applied to the Neon default branch and schema-checked there. A separate branch-scoped Neon database is configured for Vercel preview app data; synthetic smoke-test records were removed. Migrations 0013, 0014, and 0015 are applied and schema-verified on the Neon default branch and isolated preview database. The prior outreach/business OS milestone passed GitHub Actions regression tests, ESLint, TypeScript, and Next.js build; this new Preparation workspace is not yet verified. Authenticated UI smoke testing remains outstanding because preview access is SSO-protected; do not promote the foundation PR to `main` until account-level verification is completed.

## Implementation sequence

### Phase 0 — Audit and protect
- Confirm branch and deployment state; read current schema, migrations, APIs, and UI.
- Map existing records and identify duplicate/contradictory sources of truth.
- Verify authentication, owner scoping, validation, migration status, and existing tests.
- Do not change live database schema or deploy without a separately verified migration plan.

### Phase 1 — Outreach reliability
- Audit sequence dates and actual step/channel mapping against the approved playbook.
- Ensure activity logging and outcome handling update the same contact/outreach record.
- Ensure reply, meeting, and opt-out transitions suppress inappropriate future touches.
- Add tests for due queue ordering, duplicate enrollment, pause/resume, and do-not-contact invariants.

### Phase 2 — Signed deal to client and delivery
- Make won/signed conversion explicit and idempotent.
- Connect deal, signed commercial terms, client, project, and expected receivables without duplicate records.
- Capture signed date and contract status; preserve the original deal history.

### Phase 3 — Finance accuracy
- Establish agreement-backed contracted MRR and distinguish it from live-service MRR.
- Add clear MRR movement and date-effective rules.
- Separate cash collected from expected/overdue receivables and one-time setup fees.
- Add reconciliation views/tests before changing existing dashboard totals.

### Phase 4 — Preparation and daily command center
- Add evidence-backed research artifacts, draft review, meeting briefs, and a ranked Today queue.
- Link every recommendation to the underlying contact/deal/task and provide a clear next action.
- Build end-of-day reporting from actual CRM events.

### Phase 5 — QA and release
- Typecheck, lint, unit/integration tests, and production build.
- Smoke-test authenticated workflows: import prospect, review research, enroll, log call, record reply/opt-out, book meeting, create deal, mark signed, create client/project, record expected and paid revenue, add expense, and verify MRR/reporting.
- Verify deployment and database migration state before claiming production readiness.

## Acceptance criteria

- One prospect record carries its research, outreach sequence, touch history, tasks, meetings, and linked deals.
- The Today view shows prioritized work with an explicit reason and next action.
- No outreach is sent or call placed by Hermes.
- Opt-outs cannot be re-enrolled or contacted via another channel.
- Replies stop the next-touch sequence until reviewed.
- A signed deal has traceable setup and recurring terms, signed date, client/delivery links, and no duplicate financial entries.
- MRR can be traced to signed active agreements and is not inferred solely from projects or paid invoices.
- Cash collected includes only paid entries; expected and overdue amounts remain separate.
- All user-owned records are authorization-scoped, and changes are tested before release.
- Trackpr remains a separate customer-facing product and is untouched by this project.
