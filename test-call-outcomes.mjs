// Regression tests for one-tap call outcomes on a contact.
// Run with: node --experimental-strip-types test-call-outcomes.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CALL_OUTCOMES, isCallOutcome, followUpDate, sequenceStatusFor, dealChangeFor } from "./lib/call-outcomes.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const from = new Date("2026-10-28T15:00:00Z");

// Outcome set
ok(() => assert.deepEqual([...CALL_OUTCOMES].sort(), ["callback_requested", "connected", "do_not_contact", "interested", "meeting_booked", "no_answer", "not_a_fit", "voicemail", "wrong_contact"]));
ok(() => assert.equal(isCallOutcome("initiated"), false, "'initiated' is the launch marker, not an outcome"));
ok(() => assert.equal(isCallOutcome("drop table"), false));

// Follow-ups
ok(() => assert.equal(followUpDate("no_answer", from), "2026-10-30"));
ok(() => assert.equal(followUpDate("voicemail", from), "2026-10-30"));
ok(() => assert.equal(followUpDate("callback_requested", from), "2026-10-29"));
ok(() => assert.equal(followUpDate("connected", from), "2026-10-31"));
ok(() => assert.equal(followUpDate("interested", from), "2026-10-30"));
ok(() => assert.equal(followUpDate("callback_requested", from, "2026-11-04"), "2026-11-04", "user-chosen callback date wins"));
for (const o of ["meeting_booked", "not_a_fit", "wrong_contact", "do_not_contact"]) {
  ok(() => assert.equal(followUpDate(o, from, "2026-11-04"), null, `${o} clears the follow-up even with an override`));
}

// Sequences stop on replies, bookings, close-outs and opt-outs only
ok(() => assert.equal(sequenceStatusFor("meeting_booked"), "meeting_booked"));
ok(() => assert.equal(sequenceStatusFor("interested"), "interested"));
ok(() => assert.equal(sequenceStatusFor("not_a_fit"), "completed"));
ok(() => assert.equal(sequenceStatusFor("wrong_contact"), "parked"));
ok(() => assert.equal(sequenceStatusFor("do_not_contact"), "do_not_contact"));
for (const o of ["no_answer", "voicemail", "connected", "callback_requested"]) ok(() => assert.equal(sequenceStatusFor(o), null, `${o} keeps the cadence`));

// Agreed deal mapping (2026-10-28)
ok(() => assert.deepEqual(dealChangeFor("interested", "new"), { stage: "qualified" }));
ok(() => assert.deepEqual(dealChangeFor("meeting_booked", "new"), { stage: "discovery" }));
ok(() => assert.deepEqual(dealChangeFor("meeting_booked", "qualified"), { stage: "discovery" }));
ok(() => assert.equal(dealChangeFor("interested", "discovery"), null, "deals never move backwards"));
ok(() => assert.equal(dealChangeFor("meeting_booked", "proposal"), null, "deals never move backwards"));
ok(() => assert.deepEqual(dealChangeFor("not_a_fit", "proposal"), { stage: "lost", lostReason: "Not a fit" }));
ok(() => assert.deepEqual(dealChangeFor("do_not_contact", "new"), { stage: "lost", lostReason: "Do not contact" }));
for (const o of ["no_answer", "voicemail", "callback_requested", "wrong_contact", "connected"]) ok(() => assert.equal(dealChangeFor(o, "new"), null, `${o} leaves the deal alone`));
for (const s of ["won", "lost"]) ok(() => assert.equal(dealChangeFor("not_a_fit", s), null, `${s} deals are never touched`));
ok(() => assert.equal(dealChangeFor("interested", "bogus"), null));

// Route guards
const route = readFileSync("app/api/contacts/outcome/route.ts", "utf8");
ok(() => assert.match(route, /if \(!user\) return fail\("Unauthorized", 401\)/));
ok(() => assert.match(route, /FROM public\.contacts WHERE id = \$\{contactId\}::uuid AND owner_id = \$\{user\.id\}/, "contact ownership checked"));
ok(() => assert.match(route, /sql\.transaction\(queries\)/, "all writes are one transaction"));
ok(() => assert.match(route, /AND stage = \$\{d\.from\}/, "deal update guarded against concurrent edits"));
ok(() => assert.match(route, /contact_suppressions[\s\S]*'call_outcome'/, "do-not-contact suppresses"));
ok(() => assert.match(route, /status <> 'do_not_contact'/, "do-not-contact stops every sequence"));
ok(() => assert.doesNotMatch(route, /\bfetch\(|twilio|sendSms|\bdial\(/i, "logging an outcome never sends or dials"));
const ui = readFileSync("app/crm/page.tsx", "utf8");
ok(() => assert.match(ui, /\/api\/contacts\/outcome/, "contact detail logs outcomes"));
ok(() => assert.match(ui, /confirm\("Mark "\+contact\.name\+" do not contact\?/, "do-not-contact asks for confirmation"));
ok(() => assert.match(ui, /setCallFor\(contact\.id\)/, "placing a call prompts for its outcome"));
const callLogs = readFileSync("app/api/call-logs/route.ts", "utf8");
ok(() => assert.match(callLogs, /"not_a_fit", "wrong_contact"/, "call log accepts every outcome the UI offers"));
const migration = readFileSync("db/migrations/0017_activity_outcomes_not_a_fit_wrong_contact.sql", "utf8");
ok(() => assert.match(migration, /'not_a_fit','wrong_contact'/, "DB constraint allows not_a_fit and wrong_contact"));

console.log(`Call outcome regression checks passed (${n} assertions).`);
