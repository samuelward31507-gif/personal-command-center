// Regression tests for Call mode's talk track. Run with: node --experimental-strip-types test-call-script.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildScript, buildObjections, nicheOf, cityOf, nextTwoWeekdays } from "./lib/call-script.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const base = { firstName: "Randy", company: "All-Star Fence Company", location: "Las Vegas, NV", notes: "", setupFee: 1500, monthlyFee: 997, today: new Date("2026-10-29T12:00:00") };

ok(() => assert.equal(nicheOf("Dive Deep Custom Pools").job, "pool"));
ok(() => assert.equal(nicheOf("All-Star Fence Company").job, "fence"));
ok(() => assert.equal(nicheOf("Acme Builders").niche, "contractors"));
ok(() => assert.equal(cityOf("Las Vegas, NV"), "Las Vegas"));
ok(() => assert.equal(cityOf("NOT FOUND"), ""));
ok(() => assert.deepEqual(nextTwoWeekdays(new Date("2026-10-30T12:00:00")), ["Monday", "Tuesday"], "skips the weekend"));
const s = buildScript(base);
ok(() => assert.match(s[0].say, /^Hey Randy, it's Samuel with Cinder Revenue Company/));
ok(() => assert.match(s[1].say, /fence companies around Las Vegas/));
ok(() => assert.match(s.find(x => x.key === "ask").say, /Friday or Monday/));
ok(() => assert.match(buildScript({ ...base, firstName: "" })[0].say, /^Hey there/));
const o = buildObjections(base);
ok(() => assert.ok(o.length >= 6));
ok(() => assert.match(o.find(x => x.key === "price").say, /\$1,500.*\$997/));
ok(() => assert.doesNotMatch(JSON.stringify([s, o]), /\d+%|guarantee/i, "no invented stats or guarantees"));
const page = readFileSync("app/crm/call/page.tsx", "utf8");
ok(() => assert.match(page, /tel:/, "the founder dials via tel:"));
ok(() => assert.doesNotMatch(page, /sms|twilio|sendText/i, "call mode never texts"));
ok(() => assert.match(page, /\/api\/contacts\/outcome/, "outcomes go through the shared outcome route"));
ok(() => assert.match(page, /confirm\(`Mark/, "do-not-contact asks first"));
console.log(`Call script regression checks passed (${n} assertions).`);
