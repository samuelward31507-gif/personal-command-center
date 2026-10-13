# Cinder CRM data foundation

## Status
This file began as a pre-implementation proposal and is now historical context, not the current system description. The current application uses authenticated server routes and owner-scoped Neon Postgres records for contacts, deals, tasks, daily plans, projects and milestones, outreach, finance, client success, workforce records, and calendar events. Do not rely on the older local-prototype statements below as current behavior; verify the actual migration files and API handlers before making schema changes.

## Proposed entities
- contacts: person identity, channels, status, source, timestamps, archive marker.
- companies: name, website, industry, location, notes.
- contact_company_roles: many-to-many people/company links, role/title and primary marker.
- activities: call, email, SMS, meeting, note, task outcome; time, summary, outcome and links.
- tasks: title, description, due date, priority, status, linked contact/company/project, completion metadata.
- opportunities: name, company/contact, stage, amount/currency, expected close date, next step, outcome timestamps.
- projects: name, status, priority, milestones and next action.
- daily_plans: date, routine item state and daily notes.
- audit_events: actor, action, entity type/id, timestamp and minimal change metadata.

## Required integrity and security
1. Select a dedicated Cinder database; never reuse the unrelated peptide project.
2. Decide authentication and single-user/workspace ownership model before remote CRUD.
3. Every record must have an owner/workspace key and server-side authorization checks.
4. Validate all input server-side; never trust client-supplied ownership or role fields.
5. Add migrations, foreign keys, constraints, indexes, and explicit archive behavior.
6. Keep secrets server-only. Do not expose database credentials through NEXT_PUBLIC variables.
7. Define backups, restore test, retention and export before critical data entry.
8. Never fabricate contacts, interactions, deals, amounts, or history.

## Foundation acceptance criteria (ongoing)
- Create/edit/search/filter contacts and persist them through authenticated API routes.
- Follow-up dates, task deadlines, and calendar events use local dates consistently.
- CSV import/export validates fields and handles duplicate contacts safely.
- Every read and write is owner-scoped on the server; linked records are validated against the same owner.
- Database changes are additive, migration-backed, and checked against the intended Neon branch.
- Keep the CRM private and treat authenticated end-to-end tests, backup/restore checks, and integration verification as release requirements.
