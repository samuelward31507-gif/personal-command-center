# Cinder Personal Command Center

Cinder Personal Command Center is the private operating workspace for running the entire AI agency: customer acquisition, sales, client delivery, finance, tasks, planning, and business memory. It is an internal agency operating system, not a client-facing product.

## Product boundaries

- **This workspace runs the agency as a whole.** It tracks the agency's prospects, customers, deals, delivery, finances, priorities, and AI workforce.
- **Trackpr is separate.** Trackpr is a product the agency sells; it is not this CRM, and this project must not modify Trackpr's codebase, database, deployment, or product roadmap. Trackpr can be tracked as an agency product/opportunity in the future, but its internal product systems remain separate.
- **Cinder is not the agency's public marketing website.** Keep this project focused on private operations and founder leverage.

## Product areas

- **Home and My day** — business snapshot, founder routine, daily notes, live calendar events, and task deadlines.
- **Interactive calendar** — month/week/day views, date navigation, meetings/calls/focus/personal blocks, editable events, contact/deal links, and task deadline overlays.
- **Growth** — contacts, CSV import/export, call activity, outreach, and sales pipeline for the agency's own acquisition and relationships.
- **Tasks and Needs you** — task tracking and a consolidated queue of overdue follow-ups, blockers, renewals, approvals, and failed agent runs.
- **Projects and client success** — delivery projects, milestones, client health, and support tickets.
- **Money** — revenue entries, payment status, recurring revenue, and expenses.
- **AI workforce and Strategy & memory** — agent profiles/runs, approvals, and durable business memory for operating the agency.

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
cp .env.example .env.local
# Fill in the required database and auth values in .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required environment variables

Configure these in your local environment and deployment environment; never commit secret values.

- `DATABASE_URL` — Neon Postgres connection string.
- `NEON_AUTH_BASE_URL` — server-side Neon Auth base URL for the workspace.
- `NEXT_PUBLIC_NEON_AUTH_URL` — client-side Neon Auth URL used by `createAuthClient()`; set it to the same Neon Auth endpoint as `NEON_AUTH_BASE_URL`.
- `NEON_AUTH_COOKIE_SECRET` — secret used to secure auth cookies.
- `HERMES_BRIDGE_TOKEN` — optional server-to-server bearer secret (at least 32 characters) for the read-only Hermes brief endpoint.
- `HERMES_BRIDGE_OWNER_ID` — the single workspace owner ID that the Hermes bridge is allowed to read.

The database must have the tables and constraints referenced by the API routes. Authentication and database access are required for CRM pages and API requests.

## Quality checks

Run before merging changes:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions runs ESLint and TypeScript checks on pushes and pull requests to `feat/crm-foundation`. Vercel deployment status is tracked separately from these checks.

## Hermes read-only bridge

`GET /api/hermes/brief` provides a bounded read-only snapshot of due follow-ups, open deals, overdue/blocked tasks and projects, pending approvals, failed agent runs, client risks, and finance totals. It requires `Authorization: Bearer <HERMES_BRIDGE_TOKEN>` and always scopes queries to the server-configured `HERMES_BRIDGE_OWNER_ID`; callers cannot choose an owner. The endpoint returns no-store responses and does not create records, send messages, or execute actions.

Keep both Hermes bridge variables server-side. Do not put the token in client code, a URL, or a public environment variable. The bridge remains disabled until the variables are configured in the deployment environment and the endpoint is smoke-tested.

## Database migrations

SQL migrations are stored in `db/migrations`. Test schema changes on an isolated Neon branch first, then apply the same migration to the intended target branch and verify the resulting indexes/constraints before relying on them in application code.

The project handoff migration adds database-level uniqueness for one delivery project per deal and one milestone title per project (case-insensitive after trimming). The calendar migration adds owner-scoped events with time-range constraints and indexes. These additive migrations are idempotent; the calendar event table has been applied to the current Neon `main` branch and its schema has been verified.

## Safety and implementation notes

- API handlers require a signed-in user and scope database queries to that user's records.
- Linked contacts, deals, and projects are validated against the current workspace before being attached.
- Keep database credentials and auth secrets out of source control.
- Treat the Vercel deployment as unverified until the latest commit has a successful deployment and the critical workflows have been smoke-tested.
