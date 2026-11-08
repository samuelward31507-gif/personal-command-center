// Run with: node --experimental-strip-types test-sms-templates.mjs
import assert from "node:assert/strict";
import {
  voicemailText, infoText, demoLinkFor, nicheFor, resolveTimeZone, callTimeText, smsHref, isStop,
  quietHoursWarning, planFor, dueAt, nextBusinessDay, zonedTime, localDate,
} from "./lib/sms-templates.ts";
import { timeZoneFor, timeZoneForPhone } from "./lib/local-time.ts";
import { meetingNudge, meetingWhen, confirmText, reminderText } from "./lib/sms-templates.ts";
let n = 0; const ok = (fn, msg) => { try { fn(); n++; } catch (e) { e.message = (msg ? msg + ": " : "") + e.message; throw e; } };
const tzOf = c => resolveTimeZone(c, timeZoneFor, timeZoneForPhone);

// Acceptance 1: fence contact in GA, called 4:15pm MT → "6:15", /fence-demo, call back tomorrow 9:30am ET
const calledAt = new Date("2026-11-05T23:15:00Z"); // Thu 4:15pm MST = 6:15pm EST
const ga = { location: "Atlanta, GA", phone: "", timeZone: "" };
const gaTz = tzOf(ga);
ok(() => assert.equal(gaTz, "America/New_York"));
ok(() => assert.equal(callTimeText(calledAt, gaTz), "6:15"), "call time in their zone");
const link = demoLinkFor(nicheFor("Peachtree Fence Co."));
ok(() => assert.equal(link, "https://cinderrevenue.com/watch?story=fence"));
const vm = voicemailText({ firstName: "Mike", callTime: callTimeText(calledAt, gaTz), demoLink: link });
ok(() => assert.match(vm, /^Hey Mike, Sam with Cinder\. Called your shop at 6:15 and got voicemail\./));
ok(() => assert.match(vm, /cinderrevenue\.com\/watch\?story=fence\n\nWorth a quick call tomorrow\?$/));
const p1 = planFor("voicemail", { now: calledAt, tz: gaTz });
ok(() => assert.equal(p1.template, "T-VM"));
ok(() => assert.equal(p1.tasks[0].title, "Call back"));
ok(() => assert.equal(p1.tasks[0].due.toISOString(), "2026-11-06T14:30:00.000Z"), "Fri 9:30am EST");
ok(() => assert.equal(p1.followUp, "2026-11-06"));

// Acceptance 2: second voicemail → no draft, "already sent" notice
const p2 = planFor("voicemail", { now: calledAt, tz: gaTz, vmSentAt: "Nov 5" });
ok(() => assert.equal(p2.template, null));
ok(() => assert.equal(p2.notice, "Voicemail text already sent Nov 5. Call instead."));
ok(() => assert.equal(p2.tasks[0].title, "Call back"), "the call-back task is still created");

// Acceptance 3: no first name → "Hey there"
ok(() => assert.match(voicemailText({ firstName: "", callTime: "6:15", demoLink: link }), /^Hey there, Sam with Cinder\./));
ok(() => assert.match(voicemailText({ callTime: "6:15", demoLink: link }), /^Hey there,/));

// Acceptance 4: do not contact → no drafts for any outcome
for (const o of ["voicemail", "send_info", "no_answer", "callback_requested", "interested", "not_a_fit"]) {
  ok(() => assert.equal(planFor(o, { now: calledAt, tz: gaTz, suppressed: "marked do not contact" }).template, null), o);
}
ok(() => assert.equal(planFor("send_info", { now: calledAt, tz: gaTz, suppressed: "they replied STOP" }).notice, "No texts: they replied STOP."));

// Acceptance 5: no answer → no draft, redials day 3 and day 7, then close
const na1 = planFor("no_answer", { now: calledAt, tz: gaTz, consecutiveNoAnswers: 1 });
ok(() => assert.equal(na1.template, null));
ok(() => assert.deepEqual(na1.tasks.map(t => t.title), ["Redial (day 3)", "Redial (day 7)"]));
ok(() => assert.equal(na1.tasks[0].due.toISOString(), "2026-11-09T14:30:00.000Z"), "day 3 is Sunday → Monday 9:30am ET");
ok(() => assert.equal(na1.tasks[1].due.toISOString(), "2026-11-12T14:30:00.000Z"), "day 7 Thursday 9:30am ET");
const na2 = planFor("no_answer", { now: calledAt, tz: gaTz, consecutiveNoAnswers: 2, hasOpenRedials: true });
ok(() => assert.equal(na2.tasks.length, 0)); ok(() => assert.equal(na2.completeRedials, 1)); ok(() => assert.equal(na2.close, false));
const na3 = planFor("no_answer", { now: calledAt, tz: gaTz, consecutiveNoAnswers: 3, hasOpenRedials: true });
ok(() => assert.equal(na3.close, true)); ok(() => assert.equal(na3.followUp, null));

// Acceptance 6: Open in Messages link has the number and body
const href = smsHref("(404) 555-0100", "Hey Mike, test & more");
ok(() => assert.equal(href, "sms:+14045550100?&body=Hey%20Mike%2C%20test%20%26%20more"));
ok(() => assert.equal(smsHref("+1 404 555 0100", "x"), "sms:+14045550100?&body=x"));

// Other outcomes: answered / meeting booked / not interested → no voicemail text
for (const o of ["meeting_booked", "not_interested", "callback_requested"]) ok(() => assert.equal(planFor(o, { now: calledAt, tz: gaTz }).template, null), o);

// T-INFO
const info = infoText({ firstName: "Mike", demoLink: link });
ok(() => assert.match(info, /^Hey Mike, Sam with Cinder\. Good talking with you\. Here's the 25-second demo/));
ok(() => assert.match(info, /More about us: https:\/\/cinderrevenue\.com\n\nEasiest is I show you in 15 min\. 2pm or 4pm tomorrow\?$/));
ok(() => assert.match(infoText({ firstName: "Mike", demoLink: link, slot1: "10am", slot2: "1pm" }), /10am or 1pm tomorrow\?$/));
const ip = planFor("send_info", { now: calledAt, tz: gaTz });
ok(() => assert.equal(ip.template, "T-INFO"));
ok(() => assert.equal(planFor("interested", { now: calledAt, tz: gaTz }).template, "T-INFO", "interested gets the same info text"));
ok(() => assert.deepEqual(ip.tasks.map(t => t.title), ["Follow up on info (day 1)", "Follow up on info (day 2)", "Follow up on info (day 3)", "Follow up on info (day 7)"]));

// Merge field details
ok(() => assert.equal(demoLinkFor(nicheFor("Blue Haven Pools")), "https://cinderrevenue.com/demo"));
ok(() => assert.equal(demoLinkFor(nicheFor("Summit Roofing")), "https://cinderrevenue.com"));
ok(() => assert.equal(demoLinkFor(""), "https://cinderrevenue.com"));
ok(() => assert.equal(tzOf({ timeZone: "America/Chicago", location: "Atlanta, GA" }), "America/Chicago"), "contact field wins");
ok(() => assert.equal(tzOf({ timeZone: "Not/AZone", location: "Atlanta, GA" }), "America/New_York"), "bad field falls back to state");
ok(() => assert.equal(tzOf({ location: "", phone: "(214) 555-0100" }), "America/Chicago"), "then area code");
ok(() => assert.equal(tzOf({ location: "", phone: "" }), null));
ok(() => assert.equal(callTimeText(calledAt, null), "4:15 MT"), "unknown zone → Sam's time + MT");

// STOP
for (const t of ["STOP", "stop", "Stop texting me", "unsubscribe", "please UNSUBSCRIBE"]) ok(() => assert.equal(isStop(t), true), t);
ok(() => assert.equal(isStop("sounds good, call me"), false));
ok(() => assert.equal(isStop("Unstoppable crew"), false));

// Quiet hours (8am–8pm their time)
ok(() => assert.equal(quietHoursWarning(new Date("2026-11-06T01:30:00Z"), "America/New_York"), "It's 8:30 PM for them, send tomorrow?"));
ok(() => assert.equal(quietHoursWarning(new Date("2026-11-05T17:00:00Z"), "America/New_York"), null));
ok(() => assert.match(quietHoursWarning(new Date("2026-11-05T12:30:00Z"), "America/Los_Angeles"), /4:30 AM/));

// Time math across DST
ok(() => assert.equal(zonedTime(2026, 7, 1, 9, 30, "America/New_York").toISOString(), "2026-07-01T13:30:00.000Z"));
ok(() => assert.equal(nextBusinessDay(new Date("2026-11-06T20:00:00Z"), "America/New_York").toISOString(), "2026-11-09T14:30:00.000Z"), "Friday → Monday");
ok(() => assert.equal(localDate(new Date("2026-11-06T03:00:00Z"), "America/Los_Angeles"), "2026-11-05"));
ok(() => assert.equal(dueAt(calledAt, "America/Phoenix", 1).toISOString(), "2026-11-06T16:30:00.000Z"));


// no-show texts
const nowM = new Date("2026-11-09T16:00:00Z"); // Mon 9:00 AM Denver
ok(() => assert.equal(meetingNudge(new Date("2026-11-10T17:00:00Z"), nowM, null), "confirm", "tomorrow: confirm"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T18:00:00Z"), nowM, null), "remind", "2h out: remind"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-12T17:00:00Z"), nowM, null), null, "3 days out: nothing yet"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T15:00:00Z"), nowM, null), null, "past: nothing"));
ok(() => assert.equal(meetingWhen(new Date("2026-11-10T17:00:00Z"), nowM, "America/Denver"), "tomorrow at 10:00 AM"));
ok(() => assert.equal(meetingWhen(new Date("2026-11-09T18:00:00Z"), nowM, "America/New_York"), "today at 1:00 PM", "prospect's own time zone"));
ok(() => assert.match(confirmText({ firstName: "Mark", when: "tomorrow at 10:00 AM", business: "Cinder" }), /^Hey Mark, Sam with Cinder\. Confirming our call tomorrow at 10:00 AM\. Still good\?/));
ok(() => assert.match(reminderText({ when: "today at 1:00 PM" }), /^Hey, Sam here\./, "no name: no dangling space"));

console.log(`Text template checks passed (${n} assertions).`);
