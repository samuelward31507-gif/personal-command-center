// Regression tests for won deal -> onboarding -> money.
// Run with: node --experimental-strip-types test-deal-handoff.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ONBOARDING_TEMPLATE, LAUNCH_TARGET_DAYS } from "./lib/deal-handoff.ts";

let n = 0;
const ok = fn => { fn(); n++; };

// Template
ok(() => assert.equal(ONBOARDING_TEMPLATE.length, 9));
ok(() => assert.deepEqual(ONBOARDING_TEMPLATE.map(m => m.dueInDays), [...ONBOARDING_TEMPLATE.map(m => m.dueInDays)].sort((a, b) => a - b), "milestones are due in order"));
ok(() => assert.ok(ONBOARDING_TEMPLATE.every(m => m.dueInDays > 0), "every milestone has a due date so it surfaces in My Day"));
ok(() => assert.ok(ONBOARDING_TEMPLATE.filter(m => m.dueInDays <= LAUNCH_TARGET_DAYS).length === 7, "build and launch steps land by the launch target"));
ok(() => assert.equal(LAUNCH_TARGET_DAYS, 28, "~21 business days, per the live-within-21-business-days term"));
ok(() => {
  const launch = ONBOARDING_TEMPLATE.find(m => m.title === "Monitor launch and report outcomes").dueInDays;
  assert.equal(ONBOARDING_TEMPLATE.find(m => m.title === "7-day post-launch review").dueInDays, launch + 7);
  assert.equal(ONBOARDING_TEMPLATE.find(m => m.title === "30-day results review").dueInDays, launch + 30);
});

// Handoff safety
const lib = readFileSync("lib/deal-handoff.ts", "utf8");
ok(() => assert.match(lib, /ON CONFLICT \(owner_id, deal_id\) WHERE deal_id IS NOT NULL/, "one project per deal"));
ok(() => assert.match(lib, /ON CONFLICT \(owner_id, source_key\) WHERE source_key <> '' DO NOTHING/, "receivables never duplicate"));
ok(() => assert.equal((lib.match(/'expected'/g) || []).length, 2, "handoff only creates expected receivables"));
ok(() => assert.doesNotMatch(lib, /'paid'/, "handoff never records a payment"));
ok(() => assert.match(lib, /contact_outreach SET status = 'completed'[\s\S]*status = 'active'/, "signed clients stop receiving prospecting outreach"));
ok(() => assert.match(lib, /\+ \$\{LAUNCH_TARGET_DAYS\}::int, \$\{"deal:" \+ deal\.id \+ ":first_month"\}/, "first retainer is due at go-live, not signing"));
ok(() => assert.equal((lib.match(/owner_id = \$\{ownerId\}/g) || []).length >= 5, true, "every query owner-scoped"));

// Auto-handoff on won
const deals = readFileSync("app/api/deals/route.ts", "utf8");
ok(() => assert.match(deals, /stage === "won" \? await autoHandoff\(/, "creating a won deal starts delivery"));
ok(() => assert.match(deals, /body\.stage === "won" \? await autoHandoff\(/, "moving a deal to won starts delivery"));
ok(() => assert.match(deals, /error instanceof HandoffNotReady \? error\.message : "Delivery setup failed/, "raw database errors never reach the client"));
const pipeline = readFileSync("app/crm/pipeline/page.tsx", "utf8");
ok(() => assert.doesNotMatch(pipeline, /\/api\/project-milestones/, "pipeline no longer seeds a second, duplicate checklist"));
ok(() => assert.match(pipeline, /No payment was recorded/));

// Money page
const fin = readFileSync("app/api/finance/route.ts", "utf8");
ok(() => assert.match(fin, /stage NOT IN \('won','lost','nurture'\)/, "open pipeline excludes won, lost and nurture"));
ok(() => assert.match(fin, /dueNext30/));
const finUi = readFileSync("app/crm/finance/page.tsx", "utf8");
ok(() => assert.match(finUi, /Record payment received/, "payments are recorded manually, never verified automatically"));
ok(() => assert.match(finUi, /OPEN PIPELINE/));

const mig19 = readFileSync("db/migrations/0019_project_tier_service_types.sql", "utf8");
ok(() => assert.match(mig19, /'tier1_speed_to_lead','tier2_revenue_system'/, "projects accept tier service types (handoff of a tier deal failed without this)"));

console.log(`Deal handoff regression checks passed (${n} assertions).`);
