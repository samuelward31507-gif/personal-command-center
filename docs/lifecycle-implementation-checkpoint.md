# Lifecycle implementation checkpoint — finance semantics

**Branch:** `feat/cinder-lifecycle-excluding-payment-verification`

## Completed in this checkpoint

- Updated `app/api/finance/route.ts` to make clear that this finance workflow is manual-record-only, not processor-verified.
- Revenue rows now include `collectionEvidence` with `manually_recorded` for records marked paid and `not_recorded` otherwise.
- Finance GET includes `collectionMode: "manual_record_only"`.
- Summary metrics include definitions that distinguish manually recorded paid revenue from expected receivables, contracted MRR, ARR, and recorded expenses.
- Revenue create/update responses explain that marking a record paid is a manual entry and is not payment verification.
- Updated the finance UI to label revenue as manually marked paid and to state that this ledger is not processor-verified collection.
- Updated `app/api/deals/route.ts` so a deal cannot be created or moved to `won` by silently auto-activating an agreement or inventing a signature timestamp. The API now requires an explicit signed date and active agreement before the won transition.
- Added agreement status, signed date, and effective date controls to the sales pipeline deal editor so the API guard can be satisfied through the UI. Pipeline stage changes normalize stored timestamp values before sending date-only API fields.
- Expanded `test-deal-agreement-contract.mjs` to cover the agreement UI contract, date normalization, and finance dashboard wording; included it in `npm test`.
- Added a live-data meeting-preparation queue to Needs You. It checks the next seven days of calendar events and surfaces scheduled meetings/calls that have no prep notes, prioritizing items starting within 24 hours.
- Added regression assertions for the meeting-preparation queue and its manual-only behavior. It does not send invitations, messages, or calls.

## Why this matters

Cinder can track agency finances without falsely claiming that a payment processor confirmed a transaction. The existing finance status field remains a manual bookkeeping input. It must not be presented as a verified payment event.

## Not yet completed or tested

- The full `npm test` and lint commands have not yet been run in an executable checkout. Source-level checks were inspected, but they do not replace running the actual test suite.
- Vercel preview builds have failed during Next.js page-data collection for `/api/auth/[...path]` because the Neon Auth preview environment is not configured. This appears to be preview environment configuration, not a verified code regression; the latest deployment is still queued/building and needs confirmation.
- The finance and pipeline UI changes have not yet been browser-tested.
- Meeting invitations/reminders are still not sent or scheduled externally; the new queue is an in-app preparation cue only. Proposal records and UI, a complete agreement/signature workflow, onboarding completion verification, client handoff failure recovery, and the full acceptance journey remain open work. The agreement API guard is a partial foundation, not a finished user-facing workflow.
- Existing deal conversion creates a project and expected revenue entries idempotently by deal/source key, but complete partial-failure recovery still needs verification.
- No payment processor or payment verification was added.
