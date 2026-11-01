// Client operations checks. Run with: node --experimental-strip-types test-client-ops.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { businessDaysBetween, addBusinessDays, guaranteeClock, prefillSetup, cleanSetup, setupGaps, draftMessages, cleanMessages, applyApproval, allApproved, cleanLaunch, launchState, LAUNCH_STEPS } from "./lib/client-ops.ts";

let n = 0; const ok = fn => { fn(); n++; };
// Business days: Fri Oct 30 2026 -> Mon Nov 2 is 1 business day.
ok(() => assert.equal(businessDaysBetween("2026-10-30", "2026-11-02"), 1));
ok(() => assert.equal(businessDaysBetween("2026-11-02", "2026-11-02"), 0));
ok(() => assert.equal(addBusinessDays("2026-11-02", 21), "2026-12-01"));
ok(() => assert.equal(addBusinessDays("2026-10-30", 1), "2026-11-02"));
// Guarantee clock
ok(() => assert.equal(guaranteeClock(null, null, "2026-11-10").state, "not_started"));
ok(() => assert.equal(guaranteeClock("2026-11-02", null, "2026-11-04").state, "on_track"));
ok(() => assert.equal(guaranteeClock("2026-11-02", null, "2026-11-18").state, "watch"));   // day 12
ok(() => assert.equal(guaranteeClock("2026-11-02", null, "2026-11-25").state, "at_risk")); // day 17
ok(() => assert.equal(guaranteeClock("2026-11-02", null, "2026-12-02").state, "overdue")); // day 22
ok(() => assert.match(guaranteeClock("2026-11-02", "2026-11-16T15:00:00Z", "2026-12-20").label, /^Live in 10 business days$/));
ok(() => assert.equal(guaranteeClock("2026-11-02", null, "2026-11-04").deadline, "2026-12-01"));
// Setup sheet
const pre = prefillSetup({ owner_name: "Rod" }, { service_area: "OKC metro", questions: "Footage?" }, { company: "Double R Fence", ownerName: "Rodney" });
ok(() => assert.equal(pre.owner_name, "Rod", "saved values win over kickoff"));
ok(() => assert.equal(pre.service_area, "OKC metro"));
ok(() => assert.equal(pre.display_name, "Double R Fence"));
ok(() => assert.equal(prefillSetup({}, {}, { company: "Double R Fence, LLC" }).display_name, "Double R Fence", "legal suffix dropped from the name customers see"));
ok(() => assert.equal(pre.a2p_status, "Not started"));
ok(() => assert.deepEqual(cleanSetup({ trade: "Roofing", hours: "  8-5 ", bogus: "x" }), { hours: "8-5" }, "unknown fields and bad options dropped"));
ok(() => assert.ok(setupGaps({}).includes("Booking link")));
// Messages and approval
const msgs = draftMessages({ display_name: "Double R Fence", owner_name: "Rod", booking_link: "https://cal.com/rr", trade: "Fence" });
ok(() => assert.ok(msgs.every(m => !/\{business\}|\{owner\}|\{link\}/.test(m.body)), "business, owner and link filled in"));
ok(() => assert.ok(msgs.some(m => m.body.includes("{first}")), "first name stays live"));
ok(() => assert.match(draftMessages({ trade: "Pool" })[0].body, /pool/i));
ok(() => assert.equal(cleanMessages([{ key: "x", body: "" }, { key: "a b", body: "hi", status: "nope" }])[0].key, "ab"));
const ans = Object.fromEntries(msgs.map(m => [m.key, { decision: "approve" }]));
ok(() => assert.equal(allApproved(applyApproval(msgs, ans)), true));
ok(() => assert.match(applyApproval(msgs, { first_reply: { decision: "change", note: "" } }).error, /what to change/));
ok(() => assert.equal(applyApproval(msgs, { first_reply: { decision: "change", note: "shorter" } })[0].status, "changes"));
// Launch test
const all = Object.fromEntries(LAUNCH_STEPS.map(s => [s.key, { pass: true, seconds: s.key.includes("form") || s.key === "missed_call" || s.key === "fb_lead" ? 30 : null }]));
ok(() => assert.equal(launchState(cleanLaunch({ steps: all }), true).ready, false, "needs the owner's OK"));
ok(() => assert.equal(launchState(cleanLaunch({ steps: all, ownerOk: "go live" }), true).ready, true));
ok(() => assert.equal(launchState(cleanLaunch({ steps: { ...all, form_hours: { pass: true, seconds: 75 } }, ownerOk: "go" }), true).ready, false, "slow reply fails"));
ok(() => assert.equal(launchState(cleanLaunch({ steps: {} }), false).total, LAUNCH_STEPS.length - 1, "Tier 1 skips follow-ups"));
// Public routes expose only their own record
const approve = readFileSync("app/api/approve/route.ts", "utf8"), portal = readFileSync("app/api/portal/route.ts", "utf8"), ops = readFileSync("app/api/client-ops/route.ts", "utf8");
ok(() => assert.match(approve, /approval_token = \$\{token\}/));
ok(() => assert.match(portal, /portal_token = \$\{token\}/));
ok(() => assert.doesNotMatch(portal, /health_score|risk_notes|answers|client_success/, "portal shows no internal notes, health or kickoff answers"));
ok(() => assert.doesNotMatch(approve + portal + ops, /twilio|DELETE FROM/i, "nothing sends texts or deletes"));
ok(() => assert.match(ops, /owner_id = \$\{owner\}/, "owner-scoped"));
console.log(`Client ops checks passed (${n} assertions).`);
