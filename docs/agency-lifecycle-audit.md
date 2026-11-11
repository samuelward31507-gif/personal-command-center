# Cinder Agency Lifecycle Audit

**Scope:** Source-level review of `feat/cinder-minimal-premium-home`. This is a planning/audit artifact, not evidence that the live application has passed end-to-end tests.

## Executive summary

Cinder has a useful internal CRM foundation: contacts, outreach, deals, calendar events, tasks, projects/milestones, finance records, client-success tracking, and a read-only Hermes brief endpoint. It is not yet verified as a complete lead-to-cash operating system.

The most important unclosed gap is **real payment collection and recurring billing**. The reviewed `package.json` does not include Stripe or another payment SDK. Finance records and revenue summaries do not, by themselves, collect money or prove a charge succeeded.

## Lifecycle status

Legend:
- **Source present**: relevant route/data workflow exists; still requires behavior testing.
- **Verify**: implementation exists but end-to-end behavior is not established by this audit.
- **Gap**: no implementation evidence was found in the reviewed source paths.

| Stage | Status | Evidence / work required |
|---|---|---|
| Contact records | Source present | `app/api/contacts/route.ts` supports owner-scoped contact operations and follow-up fields. Test create, edit, list, deletion/archiving behavior, and owner isolation. |
| CSV lead import | Verify | Prior project work indicates import/preview exists. Locate its current route and test preview, duplicates, invalid rows, commit, and rollback. |
| Prospect outreach | Source present | `app/api/outreach/route.ts` enrolls contacts and schedules next actions. Test state transitions, retries, reply stopping, and do-not-contact enforcement. |
| Activity/call logging | Verify | Contacts query latest `contact_activities`; test that call outcomes and notes are created and visible consistently. |
| Sales pipeline | Source present | `app/api/deals/route.ts` tracks stages, setup/monthly fees, expected close date, and agreement status. Test transitions and validation. |
| Meeting/calendar | Verify | `app/api/calendar-events/route.ts` supports owner-scoped events linked to contacts/deals. External booking links, invitations, reminders, timezone behavior, reschedules, and no-show flow are not established. |
| Proposals | Gap | Add proposal records/version/status and a rendered proposal flow; do not assume deal notes are a proposal. |
| Agreement/e-signature | Gap | Agreement status fields exist on deals, but signature delivery and verified signature events are not established. |
| Deal conversion | Verify | `app/api/deals/convert/route.ts` exists. Test eligibility, idempotency, partial failure recovery, and duplicate prevention. |
| Invoice and collection | Gap | Finance records can represent expected/paid revenue, but no processor checkout/payment-intent integration was found in reviewed paths. |
| Recurring subscriptions | Gap | A calculated MRR figure is not an active subscription. Add subscription lifecycle, webhook-backed payment state, failed-payment handling, and cancellation. |
| Client onboarding | Verify | Projects and tasks exist. Verify a won deal creates the correct client/project/onboarding checklist exactly once. |
| Delivery and milestones | Source present | `app/api/projects/route.ts` tracks projects and milestone counts. Test status transitions, ownership, deadlines, and blocked work. |
| Expenses and profit | Verify | Finance endpoint and summary calculations exist. Reconcile revenue, paid dates, expenses, and reporting periods against fixture data. |
| Client health/retention | Source present | `app/api/client-success/route.ts` exists. Test health, risks, renewal dates, and follow-up actions. |
| Daily command center | Verify | Validate that overdue follow-ups, upcoming meetings, stalled deals, overdue tasks, blocked projects, payment issues, and at-risk clients appear correctly. |
| Hermes bridge | Partial | `app/api/hermes/brief/route.ts` is read-only and uses a fixed owner scope. Verify required env configuration and authorization; never expose secrets in logs or UI. |

## Critical acceptance journey

Do not declare the lifecycle complete until these tests pass in a non-production environment:

1. Import a test lead; verify duplicate and invalid-row handling.
2. Qualify the lead, record a call outcome, and schedule a follow-up.
3. Book a meeting linked to the contact and deal; verify timezone and rescheduling behavior.
4. Move a deal through discovery/proposal/negotiation to won.
5. Record a signed agreement only after the signature provider confirms it.
6. Collect a test implementation payment; mark it paid only from a verified processor event.
7. Create a monthly subscription and process a test renewal, failed payment, retry, and cancellation.
8. Convert the won deal to a client/project exactly once, even if the request is retried.
9. Complete onboarding and delivery milestones.
10. Reconcile contracted fees, invoices, confirmed cash, outstanding receivables, expenses, and MRR independently.
11. Confirm every query and mutation is scoped to the authenticated owner.
12. Confirm Hermes remains read-only and only reads the fixed owner's data.

## Recommended implementation order

### P0 — Payment foundation
- Choose a payment provider and add its SDK only after provider and environment configuration are agreed. Stripe is a reasonable candidate, but this branch currently has no Stripe dependency.
- Define durable invoice and subscription records with currency, amount in integer minor units, status, due date, external IDs, timestamps, and owner/client/deal references.
- Implement checkout/invoice creation and subscription management behind authenticated server routes.
- Verify webhook signatures using the raw request body; make event processing idempotent and persist provider event IDs.
- Never treat a checkout URL, client redirect, or unverified browser callback as proof of payment.
- Test success, failure, duplicate events, out-of-order events, refunds, cancellation, and reconciliation.
- Do not enable live charges until test-mode verification and required environment variables are in place.

### P1 — Meeting → agreement → cash
- Add meeting booking/invitation/reminder and reschedule/no-show handling.
- Add proposal and agreement records with explicit status transitions and provider references.
- Link deal, contact, agreement, invoice, payment, subscription, client, and project through stable IDs.
- Make won-deal conversion transactional/idempotent where possible, with recovery for partial failures.

### P2 — Delivery and daily command center
- Standardize onboarding checklist and launch acceptance.
- Surface overdue and blocked work, upcoming meetings, stalled deals, unpaid invoices, failed subscriptions, and at-risk clients.
- Verify finance metrics with deterministic fixtures and reconciliation tests.

### P3 — Production readiness
- Run lint, typecheck/build, unit tests, and lifecycle integration tests.
- Verify owner isolation, authentication, webhook security, and secret handling.
- Deploy to preview, test the complete journey, and only then discuss promotion. Do not merge to `main` or touch production data as part of this audit.

## Guardrails

- Cinder is the agency's internal command center; Trackpr remains a separate client product.
- Do not add payment credentials or secret values to the repository.
- Do not send messages or make calls automatically. Hermes can research and draft; the founder approves consequential outreach.
- Do not generate cold SMS without appropriate consent.
- Do not mark invoices paid from user input alone; payment status must be reconciled against trusted provider events.
- Preserve checkpoint/rollback discipline and keep this work isolated on a feature branch.
