# Lifecycle implementation checkpoint — finance semantics

**Branch:** `feat/cinder-lifecycle-excluding-payment-verification`

## Completed in this checkpoint

- Updated `app/api/finance/route.ts` to make clear that this finance workflow is manual-record-only, not processor-verified.
- Revenue rows now include `collectionEvidence` with `manually_recorded` for records marked paid and `not_recorded` otherwise.
- Finance GET includes `collectionMode: "manual_record_only"`.
- Summary metrics include definitions that distinguish manually recorded paid revenue from expected receivables, contracted MRR, ARR, and recorded expenses.
- Revenue create/update responses explain that marking a record paid is a manual entry and is not payment verification.
- Updated `app/api/deals/route.ts` so a deal cannot be created or moved to `won` by silently auto-activating an agreement or inventing a signature timestamp. The API now requires an explicit signed date and active agreement before the won transition.
- Added `test-deal-agreement-contract.mjs` and included it in `npm test` to guard the signed-agreement lifecycle contract.

## Why this matters

Cinder can track agency finances without falsely claiming that a payment processor confirmed a transaction. The existing finance status field remains a manual bookkeeping input. It must not be presented as a verified payment event.

## Not yet completed or tested

- The full `npm test`, build, and lint commands have not yet been run in an executable checkout. GitHub source-level contract checks passed, but they do not replace running the actual test suite.
- The finance UI has not yet been inspected to confirm it visibly surfaces the new response metadata and metric definitions.
- Meeting invitations/reminders, proposal records and UI, a complete agreement UI, onboarding completion, client handoff failure recovery, and the full acceptance journey remain open work. The agreement API guard is a partial foundation, not a finished user-facing workflow.
- Existing deal conversion creates a project and expected revenue entries idempotently by deal/source key, but complete partial-failure recovery still needs verification.
- No payment processor or payment verification was added.
