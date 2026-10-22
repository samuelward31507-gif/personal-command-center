# Lifecycle implementation checkpoint — finance semantics

**Branch:** `feat/cinder-lifecycle-excluding-payment-verification`

## Completed in this checkpoint

- Updated `app/api/finance/route.ts` to make clear that this finance workflow is manual-record-only, not processor-verified.
- Revenue rows now include `collectionEvidence` with `manually_recorded` for records marked paid and `not_recorded` otherwise.
- Finance GET includes `collectionMode: "manual_record_only"`.
- Summary metrics include definitions that distinguish manually recorded paid revenue from expected receivables, contracted MRR, ARR, and recorded expenses.
- Revenue create/update responses explain that marking a record paid is a manual entry and is not payment verification.

## Why this matters

Cinder can track agency finances without falsely claiming that a payment processor confirmed a transaction. The existing finance status field remains a manual bookkeeping input. It must not be presented as a verified payment event.

## Not yet completed or tested

- This checkpoint has not been run through the app's build, lint, or test commands.
- The finance UI has not yet been inspected to confirm it visibly surfaces the new response metadata and metric definitions.
- Meeting invitations/reminders, proposal records, agreement workflow, onboarding completion, client handoff failure recovery, and the full acceptance journey remain open work.
- Existing deal conversion creates a project and expected revenue entries idempotently by deal/source key, but complete partial-failure recovery still needs verification.
- No payment processor or payment verification was added.
