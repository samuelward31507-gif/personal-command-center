// Money plan, compliance, prospect queue and ops alerts. Run with: node --experimental-strip-types test-operations.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { periodSummary, goalForecast, monthsLeft, billingStatus } from "./lib/money-plan.ts";
import { addMonthsTo, commonDue, COMMON_ITEMS, dueState, cleanItem } from "./lib/compliance.ts";
import { touchState, pickNew } from "./lib/prospect-queue.ts";
import { buildOpsAlerts } from "./lib/ops-alerts.ts";

let n = 0; const ok = fn => { fn(); n++; };
// Money plan
const s = periodSummary([{ amount: 1500, paidAt: "2026-11-03", type: "setup_fee" }, { amount: 997, paidAt: "2026-10-03", type: "monthly_retainer" }], [{ amount: 200, date: "2026-11-05" }], "2026-11-01", "2026-11-30", 28);
ok(() => assert.deepEqual(s, { collected: 1500, spent: 200, profit: 1300, taxSetAside: 364, takeHome: 936 }));
ok(() => assert.equal(periodSummary([], [{ amount: 50, date: "2026-11-02" }], "2026-11-01", "2026-11-30", 28).taxSetAside, 0, "no tax set aside on a loss"));
ok(() => assert.equal(monthsLeft("2026-11-01", "2026-12-31"), 2));
ok(() => assert.equal(monthsLeft("2027-01-02", "2026-12-31"), 0));
const f = goalForecast({ goal: 50000, goalBy: "2026-12-31", today: "2026-11-01", collectedThisYear: 2500, openReceivables: 1000, mrr: 997 });
ok(() => assert.equal(f.projected, 4497));
ok(() => assert.equal(f.perMonthNeeded, 23750));
ok(() => assert.equal(f.onTrack, false));
ok(() => assert.equal(billingStatus({ live: false, thisMonth: null }, "2026-11-10").state, "not_live"));
ok(() => assert.equal(billingStatus({ live: true, thisMonth: null }, "2026-11-10").state, "not_billed"));
ok(() => assert.equal(billingStatus({ live: true, thisMonth: { status: "expected", amount: 997, dueDate: "2026-11-05" } }, "2026-11-10").state, "overdue"));
ok(() => assert.equal(billingStatus({ live: true, thisMonth: { status: "paid", amount: 997, dueDate: null } }, "2026-11-10").state, "paid"));
// Compliance
ok(() => assert.equal(addMonthsTo("2026-01-31", 1), "2026-02-28"));
ok(() => assert.equal(commonDue(COMMON_ITEMS.find(c => c.title.includes("Q1")), "2026-11-01"), "2027-04-15"));
ok(() => assert.equal(commonDue(COMMON_ITEMS.find(c => c.title.includes("Q4")), "2026-11-01"), "2027-01-15"));
ok(() => assert.equal(dueState("2026-11-10", "open", "2026-11-01"), "due_soon"));
ok(() => assert.equal(dueState("2026-10-10", "open", "2026-11-01"), "overdue"));
ok(() => assert.equal(dueState(null, "open", "2026-11-01"), "no_date"));
ok(() => assert.match(cleanItem({ title: "" }).error, /name/));
ok(() => assert.equal(cleanItem({ title: "x", kind: "weird", repeatMonths: 99 }).ok.repeatMonths, null));
// Prospect queue
ok(() => assert.equal(touchState([], "2026-11-02").state, "new"));
ok(() => assert.deepEqual(touchState([{ kind: "dm_sent", at: "2026-11-02T16:00:00Z" }], "2026-11-04"), { state: "waiting", due: "2026-11-05", followUps: 0 }));
ok(() => assert.equal(touchState([{ kind: "dm_sent", at: "2026-11-02T16:00:00Z" }], "2026-11-05").state, "follow_up_due"));
ok(() => assert.equal(touchState([{ kind: "dm_sent", at: "2026-11-02T16:00:00Z" }, { kind: "follow_up_sent", at: "2026-11-05T16:00:00Z" }], "2026-11-09").due, "2026-11-09"));
ok(() => assert.equal(touchState([{ kind: "dm_sent", at: "2026-11-02T00:00:00Z" }, { kind: "follow_up_sent", at: "2026-11-05T00:00:00Z" }, { kind: "follow_up_sent", at: "2026-11-09T00:00:00Z" }], "2026-12-01").state, "closed", "stops after two follow-ups"));
ok(() => assert.equal(touchState([{ kind: "dm_sent", at: "2026-11-02T00:00:00Z" }, { kind: "replied", at: "2026-11-03T00:00:00Z" }], "2026-12-01").state, "replied"));
const cands = [{ id: "a", followUpAt: null, hasReport: false, hasSocial: true, niche: true, createdAt: "1" }, { id: "b", followUpAt: "2026-11-02", hasReport: false, hasSocial: false, niche: false, createdAt: "2" }, { id: "c", followUpAt: null, hasReport: true, hasSocial: true, niche: true, createdAt: "3" }, { id: "d", followUpAt: null, hasReport: false, hasSocial: false, niche: true, createdAt: "0" }];
ok(() => assert.deepEqual(pickNew(cands, "2026-11-02").map(c => c.id), ["b", "c", "a"], "scheduled first, then reports; no DM channel is skipped"));
// Ops alerts
const alerts = buildOpsAlerts({ today: "2026-11-20", clocks: [{ projectId: "p", client: "Double R", state: "at_risk", label: "Day 17 of 21" }], compliance: [{ title: "LLC report", state: "due_soon", dueDate: "2026-11-25" }],
  reportsDue: [], approvals: [{ projectId: "p", client: "Double R", changes: 1, allApproved: false, sentAt: "2026-11-15" }], upsells: [{ projectId: "p", client: "Double R", daysLive: 50, minTermEndsInDays: 40 }], unbilled: [],
  reportOpens: [{ contactId: "x", company: "Apex", views: 2, lastViewedAt: "2026-11-20T10:00:00Z", touchedSince: false }, { contactId: "y", company: "Old", views: 1, lastViewedAt: "2026-11-01T10:00:00Z", touchedSince: false }] });
ok(() => assert.equal(alerts[0].level, "urgent"));
ok(() => assert.ok(alerts.some(a => a.text.includes("Apex opened your report 2 times today"))));
ok(() => assert.ok(!alerts.some(a => a.text.includes("Old")), "opens older than a week drop off"));
ok(() => assert.ok(alerts.some(a => a.kind === "upsell")));
// Routes: owner-scoped, never send anything
for (const f of ["app/api/money-plan/route.ts", "app/api/compliance/route.ts", "app/api/prospect-queue/route.ts", "app/api/ops-alerts/route.ts"]) {
  const src = readFileSync(f, "utf8");
  ok(() => assert.match(src, /owner_id = \$\{owner\}/, f + " is owner-scoped"));
  ok(() => assert.doesNotMatch(src, /twilio|sendEmail|resend|fetch\(/i, f + " sends nothing"));
}
console.log(`Operations checks passed (${n} assertions).`);
