// Speed tab: health rules and figures (lib/speed.ts).
import assert from "node:assert/strict";
import { assess, summary, median, percentile, fmtSec } from "./lib/speed.ts";

const now = Date.parse("2026-11-24T18:00:00Z");
const at = (minAgo, sec) => ({ at: new Date(now - minAgo * 60000).toISOString(), firstOut: sec == null ? null : new Date(now - minAgo * 60000 + sec * 1000).toISOString(), source: "web form", name: "x" });
const base = { id: "a", name: "Ridgeline", live: true, textingNumber: "+13035550100", calendar: true, failed24h: 0, unanswered: 0, lastLeadAt: new Date(now - 30 * 60000).toISOString() };

assert.equal(median([1, 2, 3, 4]), 2.5);
assert.equal(median([]), null);
assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
assert.equal(fmtSec(7), "7s"); assert.equal(fmtSec(6.5), "6.5s"); assert.equal(fmtSec(14.2), "14s"); assert.equal(fmtSec(null), "–");

// Healthy: every lead answered fast
const h = assess({ ...base, leads: [at(30, 6), at(120, 8), at(60 * 30, 7)] }, now);
assert.equal(h.status, "healthy"); assert.equal(h.leads24h, 2); assert.equal(h.leads30d, 3); assert.equal(h.medianSec, 7); assert.equal(h.answered30d, 3);

// Broken: a lead 40 minutes ago never got a reply
const b = assess({ ...base, leads: [at(40, null), at(120, 8)] }, now);
assert.equal(b.status, "broken"); assert.equal(b.missed24h, 1);
// Not missed yet: 5 minutes old, no reply
assert.equal(assess({ ...base, leads: [at(5, null)] }, now).missed24h, 0);
// Failed texts break it
assert.equal(assess({ ...base, failed24h: 2, leads: [at(30, 6)] }, now).status, "broken");
// Watch: slow median, no calendar, quiet
assert.equal(assess({ ...base, leads: [at(30, 25), at(60, 30)] }, now).status, "watch");
assert.equal(assess({ ...base, calendar: false, leads: [at(30, 6)] }, now).status, "watch");
assert.equal(assess({ ...base, lastLeadAt: new Date(now - 9 * 86400000).toISOString(), leads: [] }, now).status, "watch");
// Not live clients never alert
const nl = assess({ ...base, live: false, failed24h: 3, leads: [at(40, null)] }, now);
assert.equal(nl.status, "not_live"); assert.equal(nl.problems.length, 0);

// Summary counts only live clients and adds up
const s = summary([h, b, nl]);
assert.equal(s.live, 2); assert.equal(s.broken, 1); assert.equal(s.healthy, 1); assert.equal(s.leads24h, h.leads24h + b.leads24h);
// Sources add up to leads
assert.equal(h.sources.reduce((n, x) => n + x.count, 0), h.leads30d);
console.log("speed ok");
