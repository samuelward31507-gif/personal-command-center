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
