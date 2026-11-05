// Run with: node --experimental-strip-types test-call-drafts.mjs
import assert from "node:assert/strict";
import { buildDraft, isPool, watchLink, displayCompany, contactFirstName } from "./lib/call-drafts.ts";
import { timeZoneFor, timeZoneForPhone, localCallInfo } from "./lib/local-time.ts";
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
ok(() => assert.equal(timeZoneForPhone("(404) 555-0100"), "America/New_York"));
ok(() => assert.equal(timeZoneForPhone("+1 214 555 0100"), "America/Chicago"));
ok(() => assert.equal(timeZoneForPhone("602-555-0100"), "America/Phoenix"));
ok(() => assert.equal(timeZoneForPhone("555"), null));
ok(() => assert.equal(localCallInfo("", new Date("2026-11-04T17:00:00Z"), "901-555-0100").window, "ok"), "falls back to the area code when there's no location");
ok(() => assert.equal(contactFirstName("Mike Tripp", "Tripp Fence"), "Mike"));
ok(() => assert.equal(contactFirstName("Tripp Fence", "Tripp Fence"), ""), "company-as-name gets no first name");
// personal video link
ok(() => assert.equal(watchLink("Mike", "Tripp Fence Company"), "https://cinderrevenue.com/watch?n=Mike&b=Tripp+Fence+Company"));
ok(() => assert.equal(watchLink("", ""), "https://cinderrevenue.com/watch"));
ok(() => assert.equal(watchLink("Ana", "Peak Air, LLC"), "https://cinderrevenue.com/watch?n=Ana&b=Peak+Air"));
ok(() => assert.equal(displayCompany("Summit Roofing Inc."), "Summit Roofing"));
ok(() => assert.equal(displayCompany("Co-op Builders"), "Co-op Builders"), "only strips a trailing entity suffix");
ok(() => assert.match(watchLink("Jo", "A&B <Plumbing>"), /b=A%26B\+%3CPlumbing%3E$/), "special characters are URL-encoded");
for (const d of ["info_text", "info_dm", "info_email"]) ok(() => assert.match(buildDraft(d, base).body, /https:\/\/cinderrevenue\.com\/watch\?n=Mike&b=Tripp\+Fence\+Company/), d + " includes the personal video link");
for (const d of ["info_text", "info_dm", "info_email"]) ok(() => assert.match(buildDraft(d, base).body, /cal\.com\/x\/15min/), d + " still includes the booking link");
ok(() => assert.doesNotMatch(buildDraft("stay_in_touch", base).body, /watch/), "stay-in-touch stays short");
console.log(`Call draft + local time checks passed (${n} assertions).`);
