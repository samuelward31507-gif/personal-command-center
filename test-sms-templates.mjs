// Run with: node --experimental-strip-types test-sms-templates.mjs
import assert from "node:assert/strict";
import {
  voicemailText, infoText, demoLinkFor, nicheFor, resolveTimeZone, callTimeText, smsHref, isStop,
  quietHoursWarning, planFor, dueAt, nextBusinessDay, zonedTime, localDate,
} from "./lib/sms-templates.ts";
import { timeZoneFor, timeZoneForPhone } from "./lib/local-time.ts";
import { meetingNudge, meetingWhen, confirmText, reminderText, bookedText, prepLink, prepText, lateText, joinLink, infoFollowUpText, infoText as infoT, loomText, referralText, loomPoints, pickDemoLink } from "./lib/sms-templates.ts";
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
ok(() => assert.match(vm, /^Hey Mike, Sam with Cinder\. Tried you at 6:15, probably caught you on a job\./));
ok(() => assert.match(vm, /cinderrevenue\.com\/watch\?story=fence\n\nWorth a quick call tomorrow, morning or afternoon\?$/));
ok(() => assert.doesNotMatch(vm, /\d+%/, "no unsourced stats in texts"));
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
ok(() => assert.match(info, /^Hey Mike, Sam with Cinder, good talking with you\. Here's 30 seconds of what your customers get/));
ok(() => assert.match(info, /your next month is free\.\n\nEasiest is I show you live in 15 min\. Does tomorrow morning or afternoon work\? Or grab a time here: https:\/\/cinderrevenue\.com\/book$/));
ok(() => assert.match(infoText({ firstName: "Mike", demoLink: link, slot1: "9am", slot2: "1pm" }), /Does 9am or 1pm tomorrow work\? Or grab a time here: https:\/\/cinderrevenue\.com\/book$/));
ok(() => assert.equal((info.match(/https:\/\//g) || []).length, 2, "two links max: demo + booking"));
const ip = planFor("send_info", { now: calledAt, tz: gaTz });
ok(() => assert.equal(ip.template, "T-INFO"));
ok(() => assert.equal(planFor("interested", { now: calledAt, tz: gaTz }).template, "T-INFO", "interested gets the same info text"));
ok(() => assert.deepEqual(ip.tasks.map(t => t.title), ["Follow up on info (day 1)", "Follow up on info (day 2)", "Follow up on info (day 3)", "Follow up on info (day 7)"]));

// Merge field details
ok(() => assert.equal(demoLinkFor(nicheFor("Blue Haven Pools")), "https://cinderrevenue.com/demo"));
ok(() => assert.equal(demoLinkFor(nicheFor("Summit Roofing")), "https://cinderrevenue.com"));
ok(() => assert.equal(demoLinkFor(""), "https://cinderrevenue.com"));
ok(() => assert.equal(nicheFor("Pikes Peak Generac Dealer"), "generator"));
ok(() => assert.equal(demoLinkFor(nicheFor("Front Range Standby Generators")), "https://cinderrevenue.com/watch?story=generator"));
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
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T15:00:00Z"), nowM, null), "showed?", "an hour past, no outcome: ask if they showed"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T15:00:00Z"), nowM, null, { outcome: "showed" }), null, "outcome logged: nothing"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-07T15:00:00Z"), nowM, null), null, "2+ days past: drop it"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T15:55:00Z"), nowM, null), "late", "5 min late: late text"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T15:55:00Z"), nowM, null, { done: k => k === "late" }), null, "late text sent: wait for the show check"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-10T17:00:00Z"), nowM, null, { createdAt: new Date("2026-11-09T15:00:00Z") }), "welcome", "just booked: welcome first"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-10T17:00:00Z"), nowM, null, { createdAt: new Date("2026-11-09T15:00:00Z"), done: k => k === "welcome" }), "confirm", "welcomed: confirm next"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-09T18:00:00Z"), nowM, null, { createdAt: new Date("2026-11-09T15:30:00Z") }), "remind", "booked for today: skip welcome, remind"));
ok(() => assert.equal(meetingNudge(new Date("2026-11-10T17:00:00Z"), nowM, null, { done: k => k === "confirm" }), null, "confirmed: nothing until the reminder"));
ok(() => assert.equal(joinLink("Notes\nJoin: https://app.cal.com/video/abc"), "https://app.cal.com/video/abc"));
ok(() => assert.equal(joinLink("no link"), ""));
ok(() => assert.match(reminderText({ firstName: "Mark", when: "today at 1:00 PM", link: "https://app.cal.com/video/abc" }), /nothing to prep, just open this from your phone or computer: https:\/\/app\.cal\.com\/video\/abc$/));
ok(() => assert.match(bookedText({ firstName: "Mark", when: "tomorrow at 10:00 AM", business: "Cinder", company: "Ridge Fence", link: "https://x.co/v" }), /^Hey Mark, Sam with Cinder\. You're booked for tomorrow at 10:00 AM\. .*Ridge Fence customers[\s\S]*Join here: https:\/\/x\.co\/v\n\nIf anything/));
ok(() => assert.match(bookedText({ firstName: "Mark", when: "tomorrow at 10:00 AM", company: "Ridge Fence", prep: prepLink({ firstName: "Mark", company: "Ridge Fence" }) }), /what to expect on the call, so you know exactly what we're doing: https:\/\/cinderrevenue\.com\/meet\?n=Mark&b=Ridge\+Fence\n/));
ok(() => assert.equal(prepLink({}), "https://cinderrevenue.com/meet"));
ok(() => assert.doesNotMatch(bookedText({ when: "tomorrow at 10:00 AM" }), /video/, "no prep page: no video line"));
ok(() => assert.match(lateText({ link: "https://x.co/v" }), /^Hey, Sam here\. I'm on the call now, here's the link: https:\/\/x\.co\/v\n\nIf today got busy, no problem, grab another time here: https:\/\/cinderrevenue\.com\/book$/));
ok(() => assert.equal(meetingWhen(new Date("2026-11-10T17:00:00Z"), nowM, "America/Denver"), "tomorrow at 10:00 AM"));
ok(() => assert.equal(meetingWhen(new Date("2026-11-09T18:00:00Z"), nowM, "America/New_York"), "today at 1:00 PM", "prospect's own time zone"));
ok(() => assert.match(confirmText({ firstName: "Mark", when: "tomorrow at 10:00 AM", business: "Cinder" }), /^Hey Mark, Sam with Cinder\. Confirming our call tomorrow at 10:00 AM\. Still good\?/));
ok(() => assert.match(reminderText({ when: "today at 1:00 PM" }), /^Hey, Sam here\./, "no name: no dangling space"));

ok(() => assert.match(infoT({ firstName: "", demoLink: "https://x" }), /^Hey, Sam with Cinder,/, "no name: no 'Hey , Sam'"));
ok(() => assert.match(infoT({ firstName: "Mark", demoLink: "https://x" }), /^Hey Mark, Sam/));
for (const d of [1, 2, 3, 7]) ok(() => assert.ok(infoFollowUpText({ firstName: "", company: "Pinnacle Fence", day: d }).length < 240 && !/Hey ,/.test(infoFollowUpText({ day: d })), "day " + d));
ok(() => assert.match(infoFollowUpText({ firstName: "Mark", company: "Pinnacle Fence", day: 2 }), /Pinnacle Fence\?.*Or grab a time here: https:\/\/cinderrevenue\.com\/book$/));
ok(() => assert.match(loomText({ firstName: "", company: "Pinnacle Fence", loomUrl: " https://www.loom.com/share/abc " }), /^Hey, Sam with Cinder\. .*Pinnacle Fence.*https:\/\/www\.loom\.com\/share\/abc\n/));
ok(() => assert.match(referralText({ firstName: "Dave" }), /Quick favor:/, "the marker the follow-up list uses to know it was sent"));
ok(() => assert.equal(loomPoints({ company: "Elite Fence", callNote: "says they answer every call" })[1], "Their problem, in their words: says they answer every call"));
ok(() => assert.equal(loomPoints({ company: "M", callNote: "Asked for info by text. Their problem: missed call / voicemail" })[1], "Their problem, in their words: missed call / voicemail"));
ok(() => assert.equal(pickDemoLink("fence", "https://cinderrevenue.com/demo"), "https://cinderrevenue.com/watch?story=fence", "Settings default keeps the fence cut"));
ok(() => assert.equal(pickDemoLink("fence", "https://www.loom.com/share/abc"), "https://www.loom.com/share/abc", "an overview Loom wins everywhere"));
ok(() => assert.equal(pickDemoLink("detailing", ""), "https://cinderrevenue.com/demo"));
ok(() => assert.equal(pickDemoLink("fence", "not a link"), "https://cinderrevenue.com/watch?story=fence"));
{ const { demoText } = await import("./lib/sms-templates.ts");
  const d = demoText({ firstName: "Mark", company: "JC Fence", niche: "fence" });
  assert.match(d.link, /^https:\/\/cinderrevenue\.com\/watch\?story=fence&n=Mark&b=JC\+Fence$/);
  assert.match(d.body, /^Hey Mark, Sam with Cinder\. Here's the quick clip/);
  assert.equal(demoText({ niche: "detailing" }).link, "https://cinderrevenue.com/demo");
  assert.equal(demoText({ niche: "", settingsLink: "https://loom.com/share/abc" }).link, "https://loom.com/share/abc"); }
console.log(`Text template checks passed (${n} assertions).`);

{
  const now = new Date("2026-11-09T15:00:00Z"), far = new Date("2026-11-12T17:00:00Z");
  assert.equal(meetingNudge(far, now, null, { createdAt: new Date("2026-11-08T20:00:00Z"), done: k => k === "welcome" }), "prep", "booked yesterday, call 3 days out: prep question");
  assert.equal(meetingNudge(far, now, null, { createdAt: new Date("2026-11-09T10:00:00Z"), done: k => k === "welcome" }), null, "booked this morning: wait until tomorrow");
  assert.equal(meetingNudge(far, now, null, { createdAt: new Date("2026-11-08T20:00:00Z"), done: k => k === "welcome" || k === "prep" }), null, "prep sent: wait for confirm");
  assert.match(prepText({ firstName: "Mark", company: "Ridge Fence" }), /^Hey Mark, Sam again\. Quick one so I can set up the demo as Ridge Fence: .*working your way\.$/);
  console.log("prep step ok");
}
