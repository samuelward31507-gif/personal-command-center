// Regression tests for the calendar routine. Run with: node --experimental-strip-types --no-warnings test-routine.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routineFor, blockTime, WEEKDAY_ROUTINE } from "./lib/routine.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const mon = new Date(2026, 10, 9), sat = new Date(2026, 10, 7);
ok(() => assert.equal(routineFor(sat).length, 0, "no routine on weekends"));
ok(() => assert.equal(routineFor(mon).length, WEEKDAY_ROUTINE.length));
ok(() => assert.deepEqual(routineFor(mon, true).map(b => b.title), ["Trading", "Dial block", "Dial block"], "month view shows only the key blocks"));
ok(() => assert.equal(routineFor(mon)[1].startsAt.getHours(), 9));
ok(() => assert.equal(blockTime({ start: "09:00", end: "11:30" }), "9–11:30"));
ok(() => assert.equal(blockTime({ start: "12:15", end: "15:00" }), "12:15–3"));
const page = readFileSync("app/crm/calendar/page.tsx", "utf8"), views = readFileSync("app/crm/calendar/views.tsx", "utf8");
ok(() => assert.doesNotMatch(page + views, /dayTasks\.map|tasks\.map\(t ?=>/, "individual tasks are not drawn on the calendar"));
ok(() => assert.match(views, /routineFor\(/, "the routine is drawn"));
ok(() => assert.match(page, /followUpsOn=\{d=>tasksOn\(d\)\.length\}/, "tasks collapse to one count per day"));
ok(() => assert.match(views, /follow-up\{fu === 1 \? "" : "s"\}/, "the count reads 'N follow-ups'"));
ok(() => assert.doesNotMatch(readFileSync("app/crm/calendar/calendar.css", "utf8"), /!important[\s\S]*!important[\s\S]*!important/, "the calendar stylesheet is not a pile of overrides"));
console.log(`Routine checks passed (${n} assertions).`);
