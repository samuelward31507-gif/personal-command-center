// Run with: node --experimental-strip-types test-call-drafts.mjs
import assert from "node:assert/strict";
import { buildDraft, isPool } from "./lib/call-drafts.ts";
import { timeZoneFor, localCallInfo } from "./lib/local-time.ts";
let n = 0; const ok = fn => { fn(); n++; };
const base = { firstName: "Mike", company: "Tripp Fence Company", me: "Samuel", bookingLink: "https://cal.com/x/15min" };
ok(() => assert.match(buildDraft("info_text", { ...base, pain: "You miss calls on installs." }).body, /we just talked\. Like you said, you miss calls on installs\. That's what I fix/));
ok(() => assert.doesNotMatch(buildDraft("info_text", base).body, /Like you said|  /), "no pain → sentence dropped cleanly");
ok(() => assert.match(buildDraft("info_text", base).body, /within a minute/));
ok(() => assert.doesNotMatch(buildDraft("info_text", base).body, /10 seconds/));
ok(() => assert.match(buildDraft("info_text", { ...base, company: "Blue Haven Pools" }).body, /books a design consult/));
ok(() => assert.equal(buildDraft("info_email", base).subject, "What we talked about"));
ok(() => assert.match(buildDraft("info_dm", base).body, /^Hey Mike, Samuel from the call earlier/));
ok(() => assert.match(buildDraft("stay_in_touch", { ...base, firstName: "" }).body, /^Appreciate you taking the call\. /));
ok(() => assert.equal(isPool("Swim Inc."), true));
ok(() => assert.equal(isPool("Doctor Fence"), false));
for (const d of ["info_text", "info_dm", "info_email", "stay_in_touch"]) ok(() => assert.doesNotMatch(buildDraft(d, base).body, /\$\d/), "no prices in drafts");
ok(() => assert.equal(timeZoneFor("Atlanta, GA"), "America/New_York"));
ok(() => assert.equal(timeZoneFor("Memphis, TN 38103"), "America/Chicago"));
ok(() => assert.equal(timeZoneFor("Denver, Colorado"), "America/Denver"));
ok(() => assert.equal(timeZoneFor("West Virginia"), "America/New_York"));
ok(() => assert.equal(timeZoneFor(""), null));
ok(() => assert.equal(localCallInfo("Atlanta, GA", new Date("2026-11-04T12:30:00Z")).window, "good")); // 7:30am ET Wed
ok(() => assert.equal(localCallInfo("Atlanta, GA", new Date("2026-11-04T17:00:00Z")).window, "ok"));   // noon ET
ok(() => assert.equal(localCallInfo("Atlanta, GA", new Date("2026-11-05T01:30:00Z")).window, "late")); // 8:30pm ET
console.log(`Call draft + local time checks passed (${n} assertions).`);
