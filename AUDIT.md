# Cinder Baseline Audit

Audit date: 2026-10-27
Target repository: `samuelward31507-gif/personal-command-center`
Audited code baseline: `feat/cinder-minimal-premium-home` at `c403fd88ea92ea20a6ec768cdd7b855ad68e5244`
Roadmap working branch: `feat/cinder-agency-operating-roadmap`

## Confirmed existing foundations

- Next.js App Router, TypeScript, Neon Postgres, Neon Auth.
- Authenticated, owner-scoped contacts API. Contact fields include website, Instagram, Facebook, location, and SMS consent metadata.
- Contact CSV import utilities and a DB-free test suite (`test-contact-import.mjs`).
- Contact outreach table/API, activity history API, contact suppression table, and a shared outreach enrollment helper.
- Deal API includes stage, service type, setup fee, monthly fee, agreement status, and effective/end dates.
- Tasks API includes status, priority, due date, and optional contact/deal links.
- Calendar events API supports meeting/call/focus/personal/deadline event types and optional contact/deal links.
- Project, finance/revenue, AI-run, and daily-plan database foundations exist.
- My Day renders real calendar events and task deadlines; the repeatable founder routine and daily notes are separate from the live action queue.
- The contacts page loads persisted contacts and activity and supports manual calling/logging.

## Verified gaps and risks

1. **Preview build failure on the roadmap branch:** The first Vercel build failed while collecting configuration for `/api/auth/[...path]`. The stack trace points to module-level validation in `lib/auth/server.ts`, because this new preview branch did not have branch-scoped Neon Auth/database environment variables. This was environment configuration, not a TypeScript compilation failure.
2. **Home contains placeholder views:** `app/page.tsx` has several view definitions that explicitly render “Needs implementation” and say they are not connected to persistent storage. Real CRM pages exist separately under `/crm`, so navigation should direct the founder to those working pages rather than imply every home view is implemented.
3. **Daily queue is fragmented:** My Day combines calendar events and tasks, while contacts, outreach, deals, projects, and client-success workflows live in separate screens. It does not yet provide a single ranked queue across revenue and delivery.
4. **Current test script is narrow:** `npm test` runs `test-contact-import.mjs`, which tests CSV normalization/validation/dedup helpers. It does not by itself verify live API routes, owner isolation, pipeline transitions, suppression, calendar lifecycle, or production workflows.
5. **Cal.ai not present in code search:** Integration is not yet implemented/confirmed. It needs an explicit settings/configuration path, provider-backed booking/call state, webhook idempotency, failure visibility, and consent/suppression enforcement.
6. **Hermes not connected:** The repository README states Hermes is not connected; durable business memory does not automatically enter Hermes prompts and the app does not autonomously execute external actions.
7. **Live verification remains incomplete:** This connector-based audit has not executed the repository's npm scripts locally or completed a signed-in browser smoke test. A green build alone will not count as completion.

## Safe preview configuration action taken

Added branch-scoped Preview environment variables for `feat/cinder-agency-operating-roadmap` by copying the existing isolated QA branch configuration from `feat/cinder-founder-first-simplification`. The four keys are `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEXT_PUBLIC_NEON_AUTH_URL`, and `NEON_AUTH_COOKIE_SECRET`. Values are not recorded in this document. This targets Preview only and does not alter Production variables or the production database configuration.

The deployment that initially failed was not automatically rebuilt just by adding environment variables. A new commit/redeployment is needed to verify the fix.

## Recommended implementation order after baseline

1. Get the isolated QA preview building and verify sign-in.
2. Audit/repair the complete prospect-to-follow-up action path, with regression tests for each outcome.
3. Make My Day a unified ranked action queue backed by real contacts, outreach, deals, meetings, tasks, and delivery data.
4. Connect pipeline transitions to onboarding/project creation and distinguish booked revenue from cash recorded.
5. Implement Cal.ai in a disabled-by-default, auditable configuration with scheduling/confirmation/reminder use cases first.
6. Add end-to-end regression coverage and run live critical-journey checks before declaring release readiness.

## Non-negotiable guardrails

- Never modify Trackpr as part of Cinder work.
- Never draft cold SMS; text only after explicit consent.
- Cinder must not autonomously send prospecting messages or place cold prospecting calls.
- Do not touch n8n or Twilio without explicit approval.
- Do not introduce prohibited replacement platforms or auth/email services.
- Preserve owner isolation, auth, suppression, and user approval boundaries.
- Do not modify the Calendar page content or styling unless explicitly asked.
- Do not claim a workflow is verified until it passes the corresponding live check.
