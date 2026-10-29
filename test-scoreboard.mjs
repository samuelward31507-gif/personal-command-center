// Regression tests for the scoreboard math. Run with: node --experimental-strip-types test-scoreboard.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { goalMath, funnelRates, daysLeft, monthsUntil, pct, REVENUE_GOAL, CONNECT_OUTCOMES } from "./lib/scoreboard.ts";
import { OFFERS } from "./lib/offers.ts";

let n = 0;
const ok = fn => { fn(); n++; };
ok(() => assert.equal(REVENUE_GOAL.amount, 50000));
ok(() => assert.equal(daysLeft("2026-10-29"), 63));
ok(() => assert.equal(daysLeft("2027-01-05"), 0));
ok(() => assert.equal(monthsUntil("2026-11-28"), 2));
ok(() => assert.equal(pct(1, 0), null));
const g = goalMath({ today: "2026-10-29", collected: 0, expectedByGoal: 0, offers: Object.values(OFFERS) });
ok(() => assert.equal(g.remaining, 50000));
ok(() => assert.equal(g.perDeal[0].valueByGoal, 1500 + 997 * 2, "tier 1: setup + two retainers by Dec 31"));
ok(() => assert.equal(g.perDeal[0].dealsNeeded, Math.ceil(50000 / 3494)));
ok(() => assert.equal(g.perDeal[1].valueByGoal, 3000 + 1500 * 2));
const g2 = goalMath({ today: "2026-10-29", collected: 10000, expectedByGoal: 5000, offers: Object.values(OFFERS) });
ok(() => assert.equal(g2.gapAfterExpected, 35000, "expected money narrows the gap but isn't counted as collected"));
ok(() => assert.equal(g2.progressPct, 20));
ok(() => assert.equal(g2.withExpectedPct, 30));
ok(() => assert.deepEqual(funnelRates({ calls: 40, connects: 10, meetingsBooked: 3, meetingsHeld: 2, proposalsSent: 2, won: 1, lost: 1 }), { connectRate: 25, meetingRate: 30, showRate: 67, closeRate: 50 }));
ok(() => assert.ok(!CONNECT_OUTCOMES.includes("no_answer") && !CONNECT_OUTCOMES.includes("voicemail")));
const api = readFileSync("app/api/scoreboard/route.ts", "utf8");
ok(() => assert.match(api, /status = 'paid'/, "collected counts only money marked paid"));
ok(() => assert.doesNotMatch(api, /\b(INSERT|UPDATE|DELETE)\b/, "read-only"));
ok(() => assert.ok((api.match(/owner_id = \$\{owner\}/g) || []).length >= 8, "owner-scoped"));
console.log(`Scoreboard regression checks passed (${n} assertions).`);
