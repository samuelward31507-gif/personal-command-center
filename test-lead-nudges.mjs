import assert from "node:assert/strict";
import { nudgeStep, inTextingHours, NUDGE_TEXTS, parseDecision, fill } from "./lib/client-runtime.ts";
const H = 3600000, t0 = Date.UTC(2026, 10, 12, 15, 0);
const at = (h) => t0 + h * H;
const base = { anchor: t0, lastOut: t0 + 10000, nudgeAnchor: null, nudgesSent: 0 };
// First nudge waits about 2 hours.
assert.equal(nudgeStep({ ...base, now: at(1) }), null);
assert.equal(nudgeStep({ ...base, now: at(2.1) }), 0);
// Second the next day, third on day 3, then nothing.
assert.equal(nudgeStep({ ...base, lastOut: at(2.1), nudgeAnchor: t0, nudgesSent: 1, now: at(10) }), null);
assert.equal(nudgeStep({ ...base, lastOut: at(2.1), nudgeAnchor: t0, nudgesSent: 1, now: at(20.5) }), 1);
assert.equal(nudgeStep({ ...base, lastOut: at(20.5), nudgeAnchor: t0, nudgesSent: 2, now: at(68.5) }), 2);
assert.equal(nudgeStep({ ...base, lastOut: at(68.5), nudgeAnchor: t0, nudgesSent: 3, now: at(90) }), null);
// They replied (anchor moved past our last text): no nudge until we've answered.
assert.equal(nudgeStep({ ...base, anchor: at(3), lastOut: at(2.1), nudgeAnchor: t0, nudgesSent: 1, now: at(6) }), null);
// We answered their reply, they went quiet again: a fresh round from their reply.
assert.equal(nudgeStep({ anchor: at(3), lastOut: at(3.01), nudgeAnchor: t0, nudgesSent: 3, now: at(5.2) }), 0);
// Never right after our last text, and never on a lead older than a week.
assert.equal(nudgeStep({ ...base, lastOut: at(20), nudgeAnchor: t0, nudgesSent: 1, now: at(20.5) }), null);
assert.equal(nudgeStep({ ...base, now: at(24 * 8) }), null);
// We never answered at all: not a nudge case.
assert.equal(nudgeStep({ ...base, lastOut: null, now: at(5) }), null);
// Texting hours: 8 AM to 8 PM in the client's zone.
assert.equal(inTextingHours("America/Denver", new Date(Date.UTC(2026, 10, 12, 16))), true);   // 9 AM MST
assert.equal(inTextingHours("America/Denver", new Date(Date.UTC(2026, 10, 12, 4))), false);   // 9 PM MST
assert.equal(inTextingHours("America/New_York", new Date(Date.UTC(2026, 10, 12, 12, 30))), false); // 7:30 AM EST
// Texts fill cleanly with and without a first name.
assert.equal(fill(NUDGE_TEXTS[0], { first: "Dana", business: "Ridgeline Fence" }), "Hi Dana, Ridgeline Fence again. Just making sure you saw this. Still want a price on your project? A quick reply here works.");
assert.match(fill(NUDGE_TEXTS[1], { business: "Ridgeline Fence", owner: "Mike" }), /^Hi, Mike at Ridgeline Fence here\./);
// The reply engine can close a lead that's done.
assert.equal(parseDecision('{"reply":"No problem, thanks for letting us know.","handoff":false,"stage":"done","summary":"Went with someone else"}').stage, "done");
console.log("lead nudges ok");

// ---------- Handoffs, after hours, rescheduling ----------
import { handoffAction } from "./lib/client-runtime.ts";
import { isOpen, parseHours, existingBookingRules, EN, ES } from "./lib/client-booking.ts";
const M = 60000;
const ho = (o) => handoffAction({ handoffAt: t0, nudgedAt: null, heldAt: null, ownerHours: true, textingHours: true, ...o });
assert.equal(ho({ now: t0 + 30 * M }), null);
assert.equal(ho({ now: t0 + 50 * M }), "remind");
assert.equal(ho({ now: t0 + 50 * M, ownerHours: false }), null, "no 2 AM reminders to the owner");
assert.equal(ho({ now: t0 + 60 * M, nudgedAt: t0 + 50 * M }), null);
assert.equal(ho({ now: t0 + 3.1 * H, nudgedAt: t0 + 50 * M }), "hold");
assert.equal(ho({ now: t0 + 3.1 * H, nudgedAt: t0 + 50 * M, textingHours: false }), null, "the customer text waits for texting hours");
assert.equal(ho({ now: t0 + 4 * H, nudgedAt: t0 + 50 * M, heldAt: t0 + 3.1 * H }), null);
assert.equal(ho({ now: t0 + 4 * 86400000 }), null);
// Open hours: Mon-Fri 8-5 Denver. 2026-11-12 is a Thursday.
const h = parseHours("Mon-Fri 8-5", "America/Denver");
assert.equal(isOpen(h, new Date(Date.UTC(2026, 10, 12, 17))), true);   // 10 AM
assert.equal(isOpen(h, new Date(Date.UTC(2026, 10, 13, 2))), false);   // 7 PM
assert.equal(isOpen(h, new Date(Date.UTC(2026, 10, 14, 17))), false);  // Saturday 10 AM
assert.match(existingBookingRules("Fri, Nov 13, 10:00 AM"), /already has an estimate booked: Fri, Nov 13, 10:00 AM/);
assert.equal(parseDecision('{"reply":"No problem, canceled.","handoff":false,"stage":"canceled","summary":"Canceled"}').stage, "canceled");
assert.ok(EN.after_hours_call && ES.after_hours_call && EN.handoff_hold && ES.handoff_hold);
console.log("handoffs, after hours, rescheduling ok");

// ---------- Owner texts, repeat trades, financing, guarantee pace ----------
import { parseOwnerQuote, isRepeatTrade, SEQUENCES as SEQ, replySystem } from "./lib/client-runtime.ts";
import { behind } from "./lib/client-health.ts";
assert.deepEqual(parseOwnerQuote("QUOTE 4200"), { amount: 4200, name: "" });
assert.deepEqual(parseOwnerQuote("quote $4,200 Dana"), { amount: 4200, name: "Dana" });
assert.deepEqual(parseOwnerQuote("Quote Dana Ruiz 9.4k"), { amount: 9400, name: "Dana Ruiz" });
assert.deepEqual(parseOwnerQuote("quoted for Tom"), { amount: null, name: "Tom" });
assert.equal(parseOwnerQuote("ok got it"), null);
assert.equal(parseOwnerQuote("Quotes are slow this week"), null);
assert.ok(isRepeatTrade("Auto detailing") && isRepeatTrade("Carpet cleaning") && !isRepeatTrade("Fence"));
assert.deepEqual([...SEQ.reactivate.days], [0, 4, 9]);
assert.match(replySystem({ financing: "Hearth financing, as low as $99/month" }, []), /Hearth financing, as low as \$99\/month/);
assert.match(replySystem({}, []), /smaller option/);
assert.equal(behind({ guarantee_days: 5, guarantee_booked: 0 }), false, "too early to call");
assert.equal(behind({ guarantee_days: 15, guarantee_booked: 1 }), true);
assert.equal(behind({ guarantee_days: 15, guarantee_booked: 2 }), false);
assert.equal(behind({ guarantee_days: null, guarantee_booked: 0 }), false);
console.log("owner texts, repeat trades, financing, guarantee ok");
