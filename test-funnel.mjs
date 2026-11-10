// Funnel steps, rates and the one-line diagnosis.
import assert from "node:assert/strict";
import { funnelSteps, leak } from "./lib/funnel.ts";
import { noShowEmail, whenPhrase, tomorrowAt } from "./lib/meeting-outcome.ts";
let n = 0; const ok = f => { f(); n++; };
const c = { dials: 377, conversations: 151, booked: 3, held: 2, showed: 1, noShow: 1, won: 0, cash: 0 };
const s = funnelSteps(c);
ok(() => assert.equal(s[1].rate, 40.1)); ok(() => assert.equal(s[2].rate, 2)); ok(() => assert.equal(s[3].rate, 50));
ok(() => assert.match(leak(c), /^Booking is the leak: 2%/));
ok(() => assert.match(leak({ ...c, dials: 20 }), /Not enough dials/));
ok(() => assert.equal(funnelSteps({ ...c, dials: 0, conversations: 0 })[1].rate, null, "no divide by zero"));
ok(() => assert.match(noShowEmail({ firstName: "Mark", company: "JC", me: "Sam", bookingLink: "https://cal.com/x", when: "this morning" }).body, /^Hi Mark,\n\nLooks like we missed each other this morning\./));
ok(() => assert.equal(whenPhrase("2026-11-10T17:00:00Z", new Date("2026-11-10T17:20:00Z"), "America/Denver"), "this morning"));
ok(() => assert.equal(tomorrowAt(10, "America/Denver", new Date("2026-11-10T17:20:00Z")).toISOString(), "2026-11-11T17:00:00.000Z"));
console.log(`Funnel checks passed (${n} assertions).`);
