# Phase 0 audit: the two-CRM build brief (claude-build-pack, Nov 24 2026)

Stack stays as is: Next.js 16 (App Router), React, plain CSS per area (`app/(agency)/spec.css`, `app/(client)/app/app.css`), Neon Postgres via `@neondatabase/serverless`, Neon Auth, no chart library (hand-drawn SVG). Tests: `npm test` (about 90 node test files, no UI snapshot tests yet).

## Client CRM (app.cinderrevenue.com/app): one page, tab state, demo mode at /app?demo=1

| Brief tab | Exists today | Work |
|---|---|---|
| 1 Today | Today (`today.tsx`, Nov 20 redesign) | Re-layout: hero Won chart + Owed + First reply cards, Needs you (52px rows), Next on calendar |
| 2 Inbox | Inbox (`inbox.tsx`) | Re-layout to 3 panes + lead card. Money-question hand-off rule (pause auto-replies) is new logic |
| 3 Calendar | Calendar (Week/Crew/Route, Google sync, How did it go?) | Restyle |
| 4 Jobs | Jobs board (`jobs.tsx`), stages new/booked/quoted/won/lost | Restyle; lost reason required (new); labels "Estimate booked" |
| 5 Quotes | Quotes (Good/Better/Best, deposit, follow-ups 2/5/10/monthly, photos) | Restyle; "Not now, 7 days" snooze (new) |
| 6 Money | Money (page titled Money, nav says Money already) | Restyle: KPI row, running-total chart, expenses, invoices, payments |
| 7 Plans | Service plans (in More) | Restyle; "Offer a plan after the install" (new) |
| 8 Customers | Customers (in More) + record page | Timeline panel beside the list |
| 9 Crew | Parts exist (crew view, clock-in, walk-through, timesheets) | New tab assembling them. Ask Sam before expanding timesheets |
| 10 Reviews | Review asks exist (automations) | New tab; referral tracking is new data |
| 11 Numbers | "Reports" tab | Rename + rebuild: both rates defined, funnel, source table, cohort rule |
| 12 Settings | Settings/connections/price list/move-in (`system.tsx`, `records.tsx`) | Restyle; Help moves in here |
| Mobile Today | Phone tabs Today/Inbox/Jobs/Calendar/More | Tabs become Today/Inbox(2)/Jobs/Quotes/More |

Demo data: replace `app/(client)/app/demo.ts` figures with `example-data.json` (fixes the 9 quoted vs 5+4+3=12 bug). Today in demo = Sun Nov 22 2026.

## Sam's sales CRM (/crm): 22 screens today → 11

| Brief tab | Today's routes folded in | Notes |
|---|---|---|
| 1 Today | /crm/needs-you, /crm/calendar (meetings) | Trim to 4 sections: MRR hero vs $6,000 line, dials, open deals, Needs you, meetings |
| 2 Call | /crm/call, /crm/preparation (why now, audit) | Outcome keys 1-9 exist; price lines updated to the new Tier 2 name |
| 3 Outbound | /crm/outbound (Nov 21), /crm/email, /crm/linkedin, /crm/leads | **Text column removed** (brief: no texting in Sam's outreach). Email + LinkedIn only |
| 4 Prospects | /crm (contacts), /crm/preparation "to review" | Grades A/B/C, status breakdown |
| 5 Deals | /crm/pipeline (10 stages) | 4 open stages + Won/Lost. Real data maps without changes: interested 24, meeting_booked 3, meeting_held 3 → "Demo held", lost 1. Close date + next step required on new/edited deals; existing deals show "add a close date" until set |
| 6 Clients | /crm/client-success, /crm/projects (Delivery), /crm/reports | Onboarding checklist + weekly report preview |
| 7 Money | /crm/finance | $50k goal pace, 28% tax set-aside, waterfall |
| 8 Content | /crm/content, /crm/groups | |
| 9 Practice | /crm/practice | Score trend (new) |
| 10 Numbers | /crm/funnel (website analytics dropped), /crm/scoreboard | Per-100-touches by channel, both rates |
| 11 Settings | /crm/settings (offers, goals, automations, account) | Tier prices display-only |
| — | Ask Cinder → sidebar search (⌘K); Speed (planned) not in brief | Ask Sam where Speed goes |

URLs stay; page titles follow nav names (Deals=/crm/pipeline, Money=/crm/finance).

## Conflicts and decisions for Sam
1. **Tier 2 name.** Brief renames "Book & Close" → "Every Lead Booked" everywhere in both CRMs. The website, terms and Stripe products still say "Book & Close". Rename those too? (Standing rule: tier names change only with Sam's OK.)
2. **No texting in Sam's outreach.** Brief removes texting from prospecting entirely; this replaces the Nov 21 "compliant texting queue" idea (docs/outbound-plan.md Part 4) and removes the Outbound Text column. Voicemail texts after calls go too.
3. **Deals stages.** 10 → 4 open + Won/Lost, mapped by label (no data rewrite). OK?
4. **Crew tab timesheets.** Brief flags it; build last, light export only.
5. **Speed monitor** (Nov 21 mockup) isn't in the brief. Keep it as a Settings section or a 12th tab later?
6. **Font.** Brief recommends Inter (matches the site). Keeping Inter; mono labels in Geist Mono or similar.

## Build order (from the brief)
- Phase 1: one `tokens.css` + shared components (AppShell, PageHeader, Button, Pill, Card, KpiCard, charts, DataTable, NeedsYouRow, Timeline, Board, EmptyState, Skeleton) with empty/loading/error states.
- Phase 2: client screens: Today → Inbox → Jobs → Quotes → Money → Numbers → Customers → Calendar → Settings → Plans → Reviews → Crew → mobile Today.
- Phase 3: sales screens: Today → Call → Deals → Outbound → Prospects → Clients → Money → Numbers → Settings → Content → Practice → mobile Today.
- Phase 4: proposed features behind flags. Phase 5: polish.
- Every screen: seed-data figure tests (example-data.json), one primary button, AA contrast, 390px layout, copy lint (no "!", no "AI").

## Already waiting on the feature branch (not deployed)
Outbound phone fix + text-queue probe log, Grok prospects with email/LinkedIn, the new slash-C logo everywhere.
