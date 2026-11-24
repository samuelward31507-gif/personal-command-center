import assert from "node:assert/strict";
import { lastWeek, weeklyText } from "./lib/weekly-report.ts";
const w = lastWeek(new Date("2026-11-23T15:00:00Z"));
assert.equal(w.from, "2026-11-16T00:00:00.000Z"); assert.equal(w.to, "2026-11-23T00:00:00.000Z"); assert.equal(w.label, "Nov 16 to Nov 22");
console.log("ok - last week is the 7 days ending yesterday");
const t = weeklyText("Example Fence Co", w.label, { estimates: 4, jobsLogged: 0, replyText: "Reply speed: 9 new leads." });
assert.match(t, /Estimates booked on your calendar: 4\./); assert.ok(!t.includes("Bookings logged")); assert.ok(!t.includes("!")); assert.ok(!/\bAI\b/.test(t));
console.log("ok - weekly text has the figures, no exclamation marks, no AI");
