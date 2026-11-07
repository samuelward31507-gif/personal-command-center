// Regression tests for Cal.com bookings → contacts, deals and tasks. Run with: node --experimental-strip-types test-cal-booking.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingPerson, bookingAnswers, splitName, stageAfterBooking, stageAfterMeeting, localDate, lastTenDigits } from "./lib/cal-booking.ts";

let n = 0;
const ok = fn => { fn(); n++; };

const payload = {
  organizer: { email: "samuel@cinder.test", name: "Samuel" },
  attendees: [{ email: "Samuel@Cinder.test", name: "Samuel" }, { email: "Dana@PeakPools.test", name: "Dana Whitfield", phoneNumber: "+1 719 555 0147" }],
  responses: { company: { value: "Peak Pools & Spas" }, notes: { value: "Weekend leads go cold" } },
};
ok(() => assert.deepEqual(bookingPerson(payload), { email: "dana@peakpools.test", name: "Dana Whitfield", phone: "+1 719 555 0147", company: "Peak Pools & Spas", notes: "Weekend leads go cold", trade: "", leadVolume: "" }));
const withForm = bookingPerson({ attendees: [{ email: "a@b.test", name: "Rosa" }], responses: { company: "Rosa Fence", trade: { value: "Fence" }, leads: { value: "10–30" }, notes: { value: "Weekend calls" } } });
ok(() => assert.equal(withForm.trade, "Fence")); ok(() => assert.equal(withForm.leadVolume, "10–30"));
ok(() => assert.equal(bookingAnswers(withForm), "Trade: Fence · Leads a month: 10–30 · Wants fixed: Weekend calls"));
ok(() => assert.equal(bookingAnswers(withForm, true), "Business: Rosa Fence · Trade: Fence · Leads a month: 10–30 · Wants fixed: Weekend calls"));
ok(() => assert.equal(bookingAnswers({ company: "", trade: "", leadVolume: "", notes: "" }), "", "no answers, no line"));
ok(() => assert.equal(bookingPerson({ organizer: { email: "me@x.test" }, attendees: [{ email: "me@x.test", name: "Me" }] }), null, "your own test booking never becomes a contact"));
ok(() => assert.equal(bookingPerson({ attendees: [{ email: "not-an-email" }] }), null));
ok(() => assert.equal(bookingPerson({ attendees: [{ email: "a@b.test", phoneNumber: "call me" }] }).phone, "", "junk phone dropped"));
ok(() => assert.equal(bookingPerson({ attendees: [{ email: "a@b.test" }], responses: { attendeePhoneNumber: { value: "(303) 555-0182" } } }).phone, "(303) 555-0182"));
ok(() => assert.equal(bookingPerson({ attendees: [{ email: "a@b.test" }], responses: { name: "Rosa Martinez" } }).name, "Rosa Martinez"));
ok(() => assert.deepEqual(splitName("  Dana   Lee Whitfield "), { first: "Dana", last: "Lee Whitfield" }));
ok(() => assert.deepEqual(splitName(""), { first: "", last: "" }));
ok(() => assert.equal(stageAfterBooking("contacted"), "meeting_booked"));
ok(() => assert.equal(stageAfterBooking("nurture"), "meeting_booked"));
ok(() => assert.equal(stageAfterBooking("proposal"), null, "a booking never drags a later deal backwards"));
ok(() => assert.equal(stageAfterMeeting("meeting_booked"), "meeting_held"));
ok(() => assert.equal(stageAfterMeeting("proposal"), null));
ok(() => assert.equal(stageAfterMeeting("won"), null));
ok(() => assert.equal(localDate("2026-10-30T03:30:00.000Z", "America/Denver"), "2026-10-29", "dates are the founder's local day"));

const route = readFileSync("app/api/webhooks/cal-ai/route.ts", "utf8");
ok(() => assert.match(route, /INSERT INTO public\.contacts/, "new bookers become contacts"));
ok(() => assert.match(route, /'meeting_booked'/));
ok(() => assert.match(route, /stage NOT IN \('won','lost'\)/, "closed deals are never touched"));
ok(() => assert.match(route, /Fill in discovery and draft the proposal/));
ok(() => assert.match(route, /Reschedule the cancelled call/));
ok(() => assert.match(route, /verifyCalAiSignature/, "still signature-checked"));
ok(() => assert.doesNotMatch(route, /DELETE FROM|status\s*=\s*'paid'/i));
ok(() => assert.match(route, /title = \$\{title\} AND status NOT IN \('done','cancelled'\)/, "prep task not duplicated on retries"));
ok(() => assert.equal(lastTenDigits("+1 (404) 555-0100"), "4045550100"));
ok(() => assert.equal(lastTenDigits("555-0100"), ""));
ok(() => assert.match(route, /Matched by \$\{matchedBy\}/, "bookings match an existing contact by phone or a recent call before creating one"));
ok(() => assert.match(route, /rows\.length === 1\) \{ contact = /, "only an unambiguous match is used"));
console.log(`Cal.com booking regression checks passed (${n} assertions).`);
