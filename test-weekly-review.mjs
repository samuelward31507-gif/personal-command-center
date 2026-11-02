// Sunday review checks: ranking, honest numbers, wiring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { topMoves, buildWeeklyReview } from "./lib/weekly-review.ts";
let n = 0; const ok = f => { f(); n++; };
const empty = { week: { calls: 0, conversations: 0, meetings: 0, proposals: 0, won: 0, wonValue: 0 }, pipeline: [], money: { paidThisWeek: 0, expectedNext14: 0, overdue: 0 }, agreementsWaiting: [], proposalsWaiting: [], overdueMoney: [], lateSteps: [], lateMilestones: [], overdueTasks: 0 };
const busy = { ...empty,
  week: { calls: 40, conversations: 9, meetings: 3, proposals: 2, won: 1, wonValue: 997 },
  pipeline: [{ stage: "proposal", count: 2, monthly: 2497 }, { stage: "contacted", count: 5, monthly: 4985 }, { stage: "won", count: 3, monthly: 2991 }],
  money: { paidThisWeek: 1500, expectedNext14: 997, overdue: 997 },
  agreementsWaiting: [{ company: "Ridgeline Fence", days: 4, dealId: "d1" }],
  proposalsWaiting: [{ company: "Blue Mesa Pools", days: 6, dealId: "d2" }],
  overdueMoney: [{ title: "Aspen Ridge — first monthly retainer", amount: 997, days: 3 }],
  lateSteps: [{ company: "Summit Fence", step: "Send proposal", days: 2, dealId: "d3" }, { company: "Peak Pools", step: "", days: 1, dealId: "d4" }],
  lateMilestones: [{ client: "Clearwater Pools", title: "Test every path end to end", days: 1 }],
  overdueTasks: 2 };
const moves = topMoves(busy);
ok(() => assert.equal(moves.length, 5, "always five moves when there's enough to do"));
ok(() => assert.match(moves[0].text, /Ridgeline Fence to sign/, "signatures come first"));
ok(() => assert.match(moves[1].text, /Collect \$997/, "then money owed"));
ok(() => assert.match(moves[2].text, /Blue Mesa Pools proposal/, "then waiting proposals"));
ok(() => assert.match(moves[3].text, /Delivery: Test every path/, "then late delivery"));
ok(() => assert.match(topMoves(empty)[0].text, /send 20 DMs/, "a quiet week tells you to go book calls"));
const r = buildWeeklyReview(busy, "November 1");
const text = r.lines.join("\n");
ok(() => assert.match(text, /40 calls · 9 conversations · 3 meetings booked · 2 proposals sent · 1 won \(\$997\/mo\)/));
ok(() => assert.match(text, /\$1,500 collected · \$997 expected in the next 14 days · \$997 overdue/));
ok(() => assert.match(text, /7 open deals worth \$7,482\/mo: 5 Contacted · 2 Proposal/, "won deals aren't counted as open pipeline"));
ok(() => assert.match(text, /2 deal steps late · 1 delivery step late · 2 overdue tasks/));
ok(() => assert.match(text, /1\. Get Ridgeline Fence to sign/));
ok(() => assert.match(buildWeeklyReview(empty, "x").lines.join("\n"), /No open deals/));
ok(() => assert.equal(r.link.path, "/crm/needs-you"));
ok(() => assert.ok(r.subject.length <= 140));
const cron = readFileSync("app/api/cron/weekly-review/route.ts", "utf8");
ok(() => assert.match(cron, /bearerMatches\(request\.headers\.get\("authorization"\), secret\)/, "cron requires CRON_SECRET"));
ok(() => assert.match(cron, /logRun\(sql, "weekly-review"/, "every run is logged"));
const data = readFileSync("lib/weekly-review-data.ts", "utf8");
ok(() => assert.doesNotMatch(data, /\b(UPDATE|INSERT|DELETE)\b/, "the review is read-only"));
ok(() => assert.equal((data.match(/owner_id = \$\{owner\}/g) || []).length >= 12, true, "every query is owner-scoped"));
const vj = JSON.parse(readFileSync("vercel.json", "utf8"));
ok(() => assert.ok(vj.crons.some(c => c.path === "/api/cron/weekly-review" && / 0$/.test(c.schedule)), "scheduled on Sundays"));
console.log(`Weekly review checks passed (${n} assertions).`);
