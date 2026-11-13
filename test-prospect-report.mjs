// Prospect report checks. Run with: node --experimental-strip-types test-prospect-report.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leakMath, validateReport, readInputs, viewLabel, SPEEDS, FOLLOW_UP_LIFT, FINDING_CHOICES } from "./lib/prospect-report.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const base = { leads: 40, jobValue: 12000, closeRate: 25, speed: "hour", followsUp: false };
// Same numbers as the website calculator's defaults: $22,800 a month, $273,600 a year.
ok(() => assert.equal(Math.round(leakMath(base).month), 22800));
ok(() => assert.equal(Math.round(leakMath(base).year), 273600));
ok(() => assert.equal(Math.round(leakMath(base).half), 136800));
ok(() => assert.equal(leakMath({ ...base, followsUp: true }).followUpJobs, 0));
ok(() => assert.ok(leakMath({ ...base, speed: "next" }).month > leakMath({ ...base, speed: "5min" }).month));
// The website calculator (site/calc.js) shows one number: the monthly loss, with a fixed 30% close rate.
const site = readFileSync("site/calc.js", "utf8");
ok(() => assert.match(site, /CLOSE = 0\.3[,;]/, "site calculator close rate"));
ok(() => assert.ok(!/MONTHLY|697/.test(site), "site calculator never mentions the plan price"));
// Validation
const good = { company: "Front Range Fence", trade: "fence", inputs: { leads: "40", jobValue: "$7,000", closeRate: "30%", speed: "day", followsUp: false }, findings: [FINDING_CHOICES[0], "  ", "Own note"], note: "Hi" };
ok(() => assert.equal(validateReport(good).inputs.jobValue, 7000));
ok(() => assert.deepEqual(validateReport(good).findings, [FINDING_CHOICES[0], "Own note"]));
ok(() => assert.match(validateReport({ ...good, company: "" }).error, /company/));
ok(() => assert.match(validateReport({ ...good, inputs: { ...good.inputs, closeRate: 0 } }).error, /Win rate/));
ok(() => assert.equal(validateReport({ ...good, trade: "roofing" }).trade, "other"));
ok(() => assert.equal(validateReport({ ...good, inputs: { ...good.inputs, speed: "bogus" } }).inputs.speed, "hour"));
ok(() => assert.equal(readInputs({ leads: -3 }, "pool").leads, 25, "bad stored values fall back to trade defaults"));
ok(() => assert.equal(viewLabel(0, null), "Not opened yet"));
ok(() => assert.match(viewLabel(3, "2026-11-02T15:00:00Z"), /^Opened 3 times, last Nov 2$/));
// Public route: only the token's report, no contact data, and owner previews don't count as opens.
const api = readFileSync("app/api/report/route.ts", "utf8");
ok(() => assert.match(api, /WHERE token = \$\{token\}/));
ok(() => assert.doesNotMatch(api, /contacts|email, phone|DELETE/i));
ok(() => assert.match(api, /isOwnerPreview/));
const priv = readFileSync("app/api/prospect-reports/route.ts", "utf8");
ok(() => assert.match(priv, /owner_id = \$\{user\.id\}/, "scoped to the signed-in owner"));
ok(() => assert.doesNotMatch(priv, /sendEmail|twilio|resend|fetch\(/i, "never sends anything"));
const site2 = readFileSync("site/vercel.json", "utf8");
ok(() => assert.match(site2, /"\/report\/:token"/));
console.log(`Prospect report checks passed (${n} assertions).`);
