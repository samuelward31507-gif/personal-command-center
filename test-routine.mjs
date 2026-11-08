// Regression tests for the calendar routine. Run with: node --experimental-strip-types --no-warnings test-routine.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routineFor, blockTime, WEEKDAY_ROUTINE } from "./lib/routine.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const mon = new Date(2026, 10, 9), sat = new Date(2026, 10, 7);
ok(() => assert.equal(routineFor(sat).length, 0, "no routine on weekends"));
ok(() => assert.equal(routineFor(mon).length, WEEKDAY_ROUTINE.length));
ok(() => assert.deepEqual(routineFor(mon, true).map(b => b.title), ["Trading", "Dial block 1", "Dial block 2"], "month view shows only the key blocks"));
ok(() => assert.equal(routineFor(mon)[1].startsAt.getHours(), 9));
ok(() => assert.equal(blockTime({ start: "09:00", end: "11:30" }), "9–11:30"));
ok(() => assert.equal(blockTime({ start: "12:15", end: "15:00" }), "12:15–3"));
const page = readFileSync("app/crm/calendar/page.tsx", "utf8");
ok(() => assert.doesNotMatch(page, /dayTasks\.map/, "individual tasks are not drawn on the calendar"));
ok(() => assert.match(page, /routineFor\(/, "the routine is drawn"));
ok(() => assert.match(page, /follow-up\{.{0,60}\} due/, "tasks collapse to one count per day"));
console.log(`Routine checks passed (${n} assertions).`);
