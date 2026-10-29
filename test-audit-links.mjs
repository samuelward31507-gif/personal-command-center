// Regression tests for overnight audits and audit links. Run with: node --experimental-strip-types test-audit-links.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveLink } from "./lib/ask.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const id = "3baafaf6-d182-463a-98c9-5272c063cb73";
ok(() => assert.equal(resolveLink(`cinder://audit/${id}`), "/crm/audits/" + id));
ok(() => assert.equal(resolveLink(`cinder://deal/${id}`), "/crm/deals/" + id));
const cron = readFileSync("app/api/cron/pre-audit/route.ts", "utf8");
ok(() => assert.match(cron, /authorization"\) !== `Bearer \$\{secret\}`/, "cron requires the bearer secret"));
ok(() => assert.match(cron, /if \(!secret/, "no secret configured means no run"));
ok(() => assert.match(cron, /DAILY_CAP = 20/, "spend is capped"));
ok(() => assert.match(cron, /NOT EXISTS \(SELECT 1 FROM public\.research_artifacts/, "never re-audits a contact that already has one"));
ok(() => assert.doesNotMatch(cron, /sms|twilio|sendEmail|INSERT INTO public\.contact_activities/i, "research only — no outreach"));
ok(() => assert.doesNotMatch(cron, /console\.\w+\([^)]*secret/i, "secret never logged"));
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
ok(() => assert.equal(vercel.crons[0].path, "/api/cron/pre-audit"));
const prep = readFileSync("app/crm/preparation/page.tsx", "utf8");
ok(() => assert.match(prep, /proposal:"Proposal"/, "proposal artifacts have a label (no crash)"));
ok(() => assert.match(prep, /\(types\[a\.type\]\?\?a\.type\)/, "unknown types never crash the list"));
console.log(`Audit link + pre-audit regression checks passed (${n} assertions).`);
