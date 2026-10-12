# Cinder Personal Command Center

Cinder is a private workspace for running the founder's day-to-day business operations. It brings personal CRM, sales, delivery, finance, tasks, and business memory into one place.

## Product areas

- **Home and My day** — business snapshot, founder routine, daily notes, and date-specific completion tracking.
- **Contacts and growth** — contacts, CSV import/export, call activity, outreach, and sales pipeline.
- **Tasks and Needs you** — task tracking and a consolidated queue of overdue follow-ups, blockers, renewals, approvals, and failed agent runs.
- **Projects and client success** — delivery projects, milestones, client health, and support tickets.
- **Money** — revenue entries, payment status, recurring revenue, and expenses.
- **AI workforce and Strategy & memory** — agent profiles/runs, approvals, and durable business memory.

The workspace currently provides the operational foundation. **Hermes is not connected yet**: saving business memory does not automatically inject it into Hermes prompts, and this application does not autonomously execute external actions.

## Tech stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS v4
- Neon Serverless Postgres
- Neon Auth

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required environment variables

Configure these in your local environment and deployment environment; never commit secret values.

- `DATABASE_URL` — Neon Postgres connection string.
- `NEON_AUTH_BASE_URL` — Neon Auth base URL for the workspace.
- `NEON_AUTH_COOKIE_SECRET` — secret used to secure auth cookies.

The database must have the tables and constraints referenced by the API routes. Authentication and database access are required for CRM pages and API requests.

## Quality checks

Run before merging changes:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions runs ESLint and TypeScript checks on pushes and pull requests to `feat/crm-foundation`. Vercel deployment status is tracked separately from these checks.

## Database migrations

SQL migrations are stored in `db/migrations`. Test schema changes on an isolated Neon branch first, then apply the same migration to the intended target branch and verify the resulting indexes/constraints before relying on them in application code.

The project handoff migration adds database-level uniqueness for one delivery project per deal and one milestone title per project (case-insensitive after trimming). The migration is idempotent and is applied to the current Neon `main` branch.

## Safety and implementation notes

- API handlers require a signed-in user and scope database queries to that user's records.
- Linked contacts, deals, and projects are validated against the current workspace before being attached.
- Keep database credentials and auth secrets out of source control.
- Treat the Vercel deployment as unverified until the latest commit has a successful deployment and the critical workflows have been smoke-tested.
