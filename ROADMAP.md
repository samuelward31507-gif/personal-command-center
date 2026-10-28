# Cinder CRM — Roadmap to a Finished Agency Operating System

**Product goal:** Cinder is the private command center for running the AI revenue-optimization agency end to end. It should help the founder acquire customers, convert opportunities, deliver outcomes, and understand cash flow from one trusted workspace—not become another CRM that needs constant admin.

**Definition of finished:** After the morning gym/trading block, the founder can open Cinder, see the highest-value actions for the day, work a qualified prospect queue, manually make calls/send approved messages, record outcomes in seconds, manage meetings and deals, onboard and retain clients, and see accurate setup revenue/MRR/cash obligations without spreadsheets.

## Product guardrails

- Cinder is internal agency operations; Trackpr is a separate client-facing product. Do not modify Trackpr.
- Preserve the existing minimal/premium visual direction. No cosmetic redesign detours while core workflows are incomplete.
- Do not send cold SMS or automatically place prospecting calls from Cinder. Draft and prepare actions; the founder executes them. Text only after explicit consent.
- Cal.ai is an explicit integration: use it for controlled scheduling calls, meeting confirmations/reminders, and opted-in follow-up where appropriate. Keep it separately configured, visible, auditable, and disabled until credentials and workflows are deliberately configured. Never let it bypass contact suppression or consent rules.
- Do not touch n8n or Twilio without explicit approval. Do not introduce Resend, Firebase, Prisma, Drizzle, MongoDB, Airtable, HubSpot, GoHighLevel, Zapier, Make, or replacement platforms.
- Keep auth, owner scoping, secret handling, suppression, and approval boundaries intact. No destructive production database changes without explicit approval.
- Build on existing tables/routes after auditing them; do not rebuild working features just because they are not yet unified in the UI.

## Current implementation checkpoint — 2026-10-27

- [x] Current repository branch and Vercel preview branch identified: `feat/cinder-agency-operating-roadmap`.
- [x] Existing database foundation verified for contacts, contact activity/outreach/suppressions, deals, tasks, calendar events, projects, and agent runs.
- [x] Existing outreach UI/API reviewed: manual call launch, explicit SMS consent gate, activity/outcome logging, and sequence stop conditions are present.
- [x] My Day already has a revenue-action list for due outreach and standalone contact follow-ups, with duplicate follow-ups filtered when a contact has an active outreach sequence.
- [x] Added source-level regression guards for My Day revenue actions, duplicate follow-up filtering, SMS consent, and sequence stop conditions.
- [x] Added initial Cal.ai/Cal.com booking-sync implementation: setup page, HMAC-SHA256-verified webhook endpoint, booking create/reschedule/cancel/meeting-ended handling, and an additive migration for provider IDs and webhook event tracking.
- [x] Corrected webhook parsing for Cal.com's documented nested booking-event payloads while retaining the flat `MEETING_ENDED` shape; rescheduling now updates the original Cinder calendar row to the new provider UID instead of leaving a stale meeting beside a duplicate. Added unit and source-level regression coverage; both GitHub CI workflows passed on commit `9f650ba46274682517fe0ad6ab7eed9a3c824236`.
- [ ] Apply migration through the release process, configure `CAL_AI_WEBHOOK_SECRET`, configure the Cal.com webhook and Cal.ai workflows, and run an end-to-end test booking. The integration is **not live or verified yet**.
- [x] GitHub Actions passed regression/unit tests, lint, TypeScript, and production build on the latest preview commit.
- [x] Verified the latest Vercel preview is READY and returns the sign-in page; unauthenticated `/crm` requests are gated back to sign-in.
- [x] Identified the repeated preview `Invalid origin` cause: the latest deployment hostname was missing from the isolated preview Neon Auth trusted-domain list. Added the exact current preview origin to preview branch `br-aged-hall-b79og5zb` and verified it is now listed. Production auth configuration was not changed.
- [x] User confirmed authenticated sign-in and desktop/sidebar visibility on the current preview. Mobile navigation was not confirmed; added an accessible responsive slide-out menu and backdrop to the shared sidebar. Still requires a deployed mobile viewport/tap-through smoke test before marking mobile verified.

**Current priority:** get the current feature branch building reliably, run tests, then finish the prospect → outreach → meeting → deal path before expanding into other modules.

## Business Audit / database checkpoint — 2026-10-28

Evidence from Vercel runtime-error clusters (7-day window) and env metadata (names/scopes only, no values read):
- [x] **Audit root cause confirmed:** 3× `404 not_found_error` from Anthropic on deployment `dpl_7wG6mNkcZpd5RrRgoWTw4cwH73iw` (commit `6d403d5`), which called `claude-sonnet-4-5`. The configured model was unavailable to the API key; `CINDER_AUDIT_MODEL` is not set in any environment.
- [x] Fix deployed to preview `dpl_ESA8NLiKzC2ot6EwyZcgdV4BQ3q9` (commit `cc29382`, branch `feat/cinder-business-audit-engine`, READY): default model `claude-sonnet-5-5`, per-cause provider error messages, sanitized logs, website discovery when no URL, bare-domain normalization, pause_turn continuation, 300s function budget. CI (tests incl. 47 new audit assertions, lint, tsc, build) passed.
- [x] **Database errors root cause confirmed:** every `NeonDbError: connection string … is not a valid URL` cluster (contacts, projects, outreach, tasks, deals, finance, calendar, daily plan, workforce) came from `feat/cinder-agency-operating-roadmap` deployment `dpl_6PAavMcQDwGtsQb6gfLbP8pihu9w`. The value passed to `neon()` was a Vercel *encrypted* env blob, not a `postgresql://` URL — the result of copying env values via API without decrypting. That branch's `DATABASE_URL` was replaced at 2026-10-28 00:19Z; no errors since, but not yet re-verified with signed-in requests.
- [x] The audit branch's `DATABASE_URL` is a valid URL format (audit requests reached the provider call, which runs after `neon()` is constructed). Production env vars were not inspected for values and not changed.
- [x] Signed-in live run on preview `dpl_ESA8NLiKzC2ot6EwyZcgdV4BQ3q9` (2026-10-28 14:00Z): Horizon Pools audit completed; official site verified, similarly named businesses listed and excluded, fit decision, decision-maker, call opener and next CRM action present. Saved as artifact `86bf1b3a-57a0-4f27-af99-707604f6a7b7`: same owner as the linked Horizon Pools contact, 21 source URLs, 7 verified facts, 8 hypotheses, meta block stripped, no duplicate. Zero runtime errors in the 3h window.
- [x] Short report format, structured results view, Contacts "Latest audit" panel and sidebar routing fix deployed (`26f2f17`). User confirmed the layout live; DB check: 3 short-format audits (All-Star Fence, Sabrina Layne Pools, Dive Deep Custom Pools) each saved under the correct owner and linked contact, with Future upsells, no meta leakage, ~4.2k chars vs 16.8k before. Zero runtime errors.
- [ ] Discovery path with NO website on the contact record is still unverified live (every test contact had one).
- [ ] Preparation page still renders saved audits as raw text; reuse AuditReport there.
- [ ] Every audit so far self-rated "low" confidence; review calibration once more audits exist.
- [ ] Retry idempotency for audits (needs an additive migration or request key; not built).
- [ ] Vercel plan is Hobby: runtime logs retain 1 hour, so live debugging must happen within an hour of the failing request.

## Release + Phase 2 slice 1 — 2026-10-28

- [x] **Production release** (user-approved "ship it"): `ANTHROPIC_API_KEY` extended to Production (value not read); PRs #15 → #14 merged into `feat/cinder-minimal-premium-home` (`cfdf10f`); fresh production build `dpl_Dbcm5qgtKLmmvfHEpgDLo8kiQD3D` READY on production aliases. Not promoted from preview (that would reuse preview env/DB). Signed-out smoke test passed; signed-in production check pending. Rollback candidate: `dpl_Eh7VoRjGtGopVvFNgNMGYGdgUd5X`. Note: production does not auto-deploy from git; each release is a deliberate production build.
- [x] **One-tap call outcomes** on the contact detail (`f1bf8ce`, `5c3ea4b`, preview): `/api/contacts/outcome` updates activity, follow-up, sequence, suppression and deals in one transaction. Agreed mapping: interested → qualified, meeting booked → discovery, not a fit / do not contact → lost (with reason); others leave deals alone; forward-only. CI green (49 new assertions); every write statement EXPLAIN-checked against the preview schema.
- [x] **Bug fixed:** `contact_activities` CHECK rejected `not_a_fit` / `wrong_contact` although the outreach UI offered them. Migration `0017` applied to the **preview DB only**.
- [ ] Apply migration `0017` to production (needs approval), then release this slice.
- [ ] Signed-in live test of each outcome on the preview.

## Phase 0 — Baseline audit and release confidence
**Status: In progress — sign-in and desktop sidebar confirmed by user; mobile navigation implementation added, live mobile verification still open**
- [x] Confirm the active code branch, latest deployment, and what code is actually deployed.
- [ ] Map every page, API route, migration/table, and existing test to its real workflow.
- [x] Run lint, TypeScript, production build, and existing regression/unit tests in GitHub Actions; all passed on the latest commit.
- [ ] Smoke-test auth and the critical signed-in flows; verify mobile usability only where it affects daily execution.
- [ ] Produce a gap list separating broken, missing, duplicate, and already-working functionality.
**Exit criteria:** One trustworthy current-state inventory; no duplicate feature work; baseline checks and deployment status recorded.

## Phase 1 — The founder's daily command center
**Priority: P0**
- [ ] Make My Day the actual operating queue, not a dashboard of static cards.
- [ ] One prioritized action list for due follow-ups, new qualified prospects, callbacks, booked meetings, deal next steps, overdue delivery commitments, and urgent finance/admin items.
- [ ] Every item shows why it matters, linked contact/deal/client, last activity, next action, and a one-click path to do/log it.
- [ ] Prioritize revenue actions first; hide completed/suppressed items; distinguish overdue, due today, blocked, and waiting.
- [ ] Fast capture for a new prospect, task, meeting, expense, and deal without navigating through a maze.
**Exit criteria:** The founder can use My Day as the starting point and clear the day's sales work without spreadsheets or guessing what to do next.

## Phase 2 — Prospecting and outreach execution
**Priority: P0 — first major build**
- [ ] Make contact/company records reliable: owner, business, role, phone, email, website, Instagram/Facebook, source, niche, geography, qualification status, fit/evidence, notes, and do-not-contact/consent state.
- [ ] CSV import preview must clearly show import, duplicate, invalid, and skipped rows; preserve social fields; prevent accidental duplicates.
- [ ] A daily prospect queue with priority, reason, research evidence, suggested angle, and next action. Avoid manually researching the same business twice.
- [ ] A prospect brief: what the business does, visible revenue/lead-response gaps, relevant proof, likely decision-maker, call opener, discovery questions, and meeting objective.
- [ ] Outreach timeline records each call/message/reply/meeting and its outcome. One action should update activity, next follow-up, sequence state, and pipeline consistently.
- [ ] Clear outcomes: no answer, connected, follow-up requested, interested, meeting booked, not a fit, wrong contact, do-not-contact. Stop/hold follow-up immediately on replies, booking, or suppression as appropriate.
- [ ] Follow-up queue and sequence logic must never silently send messages. No cold SMS drafting; texts only after explicit consent.
**Exit criteria:** Import/qualify → prepare → manually contact → log outcome → schedule next step works end to end and is regression-tested.

## Phase 3 — Meetings and Cal.ai
**Priority: P0/P1**
- [ ] Define Cinder's meeting lifecycle: proposed → booked → confirmed → completed/no-show/cancelled → follow-up due.
- [ ] Integrate Cal.com/Cal.ai using supported APIs/workflows and server-side secrets only; inspect the current Cal.ai API/webhook options before implementation.
- [ ] First use cases: book a meeting from an interested prospect, confirmation/reminder calls, rescheduling, and no-show recovery. Keep the founder in control of prospecting and qualification.
- [ ] Link every booking/call to the correct Cinder contact and, when applicable, deal. Store provider IDs, status, timestamps, and relevant call outcome/transcript reference—not unnecessary sensitive content.
- [ ] Idempotent webhook handling: duplicate events must not create duplicate meetings or activities; reschedules/cancellations update the existing record.
- [ ] Make call/booking state visible in Cinder, with failure and retry visibility. Never imply a call was placed or a booking exists unless the provider confirms it.
- [ ] Add a Cal.ai settings/status page: connected/disconnected, configured event type/agent, last webhook, test status, usage/cost visibility if available, and explicit enable/disable controls.
- [ ] Respect applicable consent, do-not-call, opt-out, and calling rules. Do not enable bulk or cold AI calling by default.
**Exit criteria:** A test booking and reminder flow sync correctly both directions, errors are visible, and no action can bypass suppression/consent rules.
**Reference:** Cal.ai product overview: https://cal.com/ai. Official product material describes AI phone calls for scheduling, reminders, confirmations, and follow-up, with configurable triggers through Cal.com Workflows. Confirm current API capabilities before coding against them.

## Phase 4 — Sales pipeline and revenue truth
**Priority: P0**
- [ ] Standardize pipeline: new → qualified → contacted → meeting booked → meeting held → proposal/decision → won/lost/nurture.
- [ ] Every open deal has value, offer, probability/stage if used, next step, due date, owner, source, and linked contact/company.
- [ ] Won deal creates/links onboarding project and expected revenue records without duplicating records.
- [ ] Track implementation/setup fee, recurring monthly revenue, start date, billing status, renewal/review dates, and expected vs collected revenue separately.
- [ ] Dashboard: pipeline value by stage, meetings booked/held, close rate, setup revenue, MRR, churn/lost deals, and follow-up coverage.
- [ ] Do not call a deal paid merely because it is marked won; distinguish deal won, invoice/payment recorded, and money received. No payment verification integration unless separately approved.
**Exit criteria:** Cinder can answer who may buy, what the next step is, what was sold, what MRR is expected, and what cash was actually recorded.

## Phase 5 — Client onboarding and delivery
**Priority: P1**
- [ ] Won deal → onboarding checklist/project, milestones, launch target, client owner/contact, scope, setup fee and recurring plan.
- [ ] Reusable delivery templates for the agency's revenue-optimization service: intake, access/assets, workflow design, QA, launch, 7/30-day review, reporting.
- [ ] Every client project has owner, status, next milestone, blockers, commitments, and due dates.
- [ ] Client health and risk queue: overdue deliverables, unresolved support, missed review, churn risk, or no recent outcome report.
- [ ] Track the outcome promised to the client and evidence/results so delivery leads to retention and case studies.
**Exit criteria:** Every won deal moves into a trackable launch plan and no client commitment exists only in memory.

## Phase 6 — Finance and agency economics
**Priority: P1**
- [ ] Separate revenue booked, revenue received, recurring run-rate, expenses, and estimated operating cash; label what is manual vs verified.
- [ ] Track software/vendor costs, client-specific costs, one-time implementation revenue, MRR, refunds/credits if applicable, and due dates.
- [ ] Basic monthly profit view and upcoming obligations; no false precision or invented accounting.
- [ ] Fast manual entry/import and links to the relevant client/deal.
**Exit criteria:** Founder can see current MRR, recent recorded cash in/out, major expenses, and upcoming obligations.

## Phase 7 — Hermes and AI assistance
**Priority: P1 after core workflows are reliable**
- [ ] Use the existing read-only Hermes bridge only after owner scoping and production configuration are verified.
- [ ] Hermes brief summarizes today's revenue actions, overdue follow-ups, meetings, open deals, client risks, blockers, and cash priorities.
- [ ] AI research can propose prospects and evidence, but label uncertain claims and preserve source links; no fabricated qualification.
- [ ] AI drafts call prep, discovery questions, meeting briefs, follow-up drafts only for permitted channels, and client reports.
- [ ] Approval gates for external side effects; log what was suggested, approved, and executed by whom.
**Exit criteria:** AI reduces research/admin time without becoming an opaque actor that sends messages or changes business records unexpectedly.

## Phase 8 — Reliability, security, and finish line
**Priority: continuous; release gate**
- [ ] Automated tests for owner isolation, authentication, imports/deduplication, activity timelines, pipeline transitions, suppression/consent, Cal.ai webhook idempotency, booking lifecycle, and revenue calculations.
- [ ] Verify database constraints/indexes, migration repeatability, server-side secrets, error handling, and audit logs.
- [ ] Test critical journeys in a real deployed environment, not just successful compilation.
- [ ] Verify mobile daily workflow, loading/empty/error states, backup/recovery path, and production environment variables.
- [ ] Remove dead-end UI, static placeholders, duplicate queues, and misleading status indicators.
- [ ] Write a short operator guide and release checklist.
**Exit criteria:** Critical workflows pass on the deployed build; data survives refresh/relogin; failures are visible and recoverable; no unapproved automation or security regression.

## Execution order
1. Finish Phase 0 audit.
2. Close the Phase 2 prospect-to-follow-up gaps that block daily use.
3. Make Phase 1 My Day reflect those real actions.
4. Finish Phase 4 pipeline/revenue linkage.
5. Add Phase 3 Cal.ai integration behind explicit configuration and safety gates.
6. Complete onboarding/delivery, finance, Hermes assistance, then final release hardening.

**Working rule:** Each slice must be implemented, tested, and deployed before moving on. Never report “done” based only on a code change or a green build; report separately what is implemented, what passed automated checks, and what was verified in the live app.
