# Cinder CRM data foundation

## Status
Planning/specification only. No production database is connected. The initial /crm route is a local browser prototype and must not be used for confidential or business-critical records.

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

## First milestone acceptance criteria
- Create/edit/search/filter/archive contacts from /crm.
- Contact list persists through reload in prototype mode; local-only warning remains visible.
- Follow-up dates and overdue counts calculate from saved records.
- CSV export works and correctly quotes commas, quotes and newlines.
- Keyboard-accessible form controls, empty states and responsive layout.
- Replace browser storage with authenticated database operations before production use.
