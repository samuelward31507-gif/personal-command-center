// Regression tests for the public lead form. Run with: node --experimental-strip-types test-inbound.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInbound, phoneDigits, sourceFor, notesFor } from "./lib/inbound.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const t0 = Date.now() - 10_000;
const good = { name: "Tony Ruiz", company: "Fence Masters OKC", phone: "(405) 555-0142", email: "Tony@FenceMasters.com", trade: "Fence", leadVolume: "10–25", challenge: "Missed calls on job sites", heardFrom: "Instagram", startedAt: t0 };
ok(() => assert.equal(validateInbound({ ...good, fax: "x" }), "spam", "honeypot"));
ok(() => assert.equal(validateInbound({ ...good, startedAt: Date.now() }), "spam", "too fast"));
ok(() => assert.equal(validateInbound(good).email, "tony@fencemasters.com"));
ok(() => assert.match(validateInbound({ ...good, name: "" }).error, /name/));
ok(() => assert.match(validateInbound({ ...good, phone: "", email: "" }).error, /phone number or email/));
ok(() => assert.match(validateInbound({ ...good, phone: "555" }).error, /too short/));
ok(() => assert.match(validateInbound({ ...good, email: "nope" }).error, /email/));
ok(() => assert.equal(validateInbound({ ...good, trade: "<script>" }).trade, "Other"));
ok(() => assert.equal(phoneDigits("+1 (405) 555-0142"), "4055550142"));
ok(() => assert.equal(sourceFor(validateInbound(good)), "Website form · Instagram"));
ok(() => assert.match(notesFor(validateInbound(good), new Date("2026-10-29T10:00:00Z")), /Biggest challenge: Missed calls/));
const api = readFileSync("app/api/inbound-lead/route.ts", "utf8");
ok(() => assert.match(api, /CINDER_OWNER_ID/, "filed under the configured owner only"));
ok(() => assert.doesNotMatch(api, /sms|twilio|sendEmail|resend|fetch\(/i, "never contacts the lead"));
ok(() => assert.doesNotMatch(api, /DELETE FROM/i));
ok(() => assert.match(api, /'urgent'/, "creates an urgent call task"));
console.log(`Inbound lead regression checks passed (${n} assertions).`);
