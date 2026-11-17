// Report periods: rolling and calendar ranges, the period each is compared with, in the business's time zone.
import assert from "node:assert/strict";
const P = await import("./lib/periods.ts");
let n = 0; const ok = f => { f(); n++; };
const now = new Date("2026-11-16T18:00:00Z"), tz = "America/Denver";
ok(() => assert.equal(P.startOf("2026-11-01", tz).toISOString(), "2026-11-01T06:00:00.000Z", "midnight in Denver (MDT ended Nov 1, so -6)"));
ok(() => assert.equal(P.startOf("2026-07-01", tz).toISOString(), "2026-07-01T06:00:00.000Z"));
ok(() => assert.equal(P.startOf("2026-01-01", tz).toISOString(), "2026-01-01T07:00:00.000Z"));
ok(() => { const r = P.periodRange("30", now, tz); assert.equal((r.to - r.from) / 86400000 > 29.9, true); assert.equal(r.prevTo.getTime(), r.from.getTime()); assert.equal(r.unit, "week"); assert.equal(r.phrase, "the last 30 days"); });
ok(() => assert.equal(P.periodRange("365", now, tz).unit, "month"));
ok(() => { const r = P.periodRange("month", now, tz); assert.equal(r.from.toISOString(), "2026-11-01T06:00:00.000Z"); assert.equal(r.prevFrom.toISOString(), "2026-10-01T06:00:00.000Z");
  assert.equal(r.prevTo - r.prevFrom, now - r.from, "compared with the same days of last month"); assert.equal(r.phrase, "November so far"); assert.match(r.vs, /October/); });
ok(() => { const r = P.periodRange("lastmonth", now, tz); assert.equal(r.from.toISOString(), "2026-10-01T06:00:00.000Z"); assert.equal(r.to.toISOString(), "2026-11-01T06:00:00.000Z");
  assert.equal(r.prevFrom.toISOString(), "2026-09-01T06:00:00.000Z"); assert.equal(r.phrase, "October"); assert.equal(r.vs, "September"); assert.equal(r.current, false); });
ok(() => { const r = P.periodRange("lastmonth", new Date("2026-01-10T18:00:00Z"), tz); assert.equal(r.phrase, "December"); assert.equal(r.from.toISOString(), "2025-12-01T07:00:00.000Z"); assert.equal(r.vs, "November"); });
ok(() => { const r = P.periodRange("year", now, tz); assert.equal(r.from.toISOString(), "2026-01-01T07:00:00.000Z"); assert.equal(r.unit, "month"); assert.equal(r.phrase, "2026 so far"); });
ok(() => { const r = P.periodRange("lastyear", now, tz); assert.equal(r.from.toISOString(), "2025-01-01T07:00:00.000Z"); assert.equal(r.to.toISOString(), "2026-01-01T07:00:00.000Z"); assert.equal(r.vs, "2024"); });
ok(() => { assert.ok(P.isPeriodKey("lastmonth")); assert.ok(!P.isPeriodKey("7")); });
ok(() => { const m = P.taxByMonth([{ month: "2026-10", items: [{ qty: 2, price: 100 }], taxRate: 8 }, { month: "2026-10", items: [{ qty: 1, price: 50.5 }], taxRate: 8 },
    { month: "2026-11", items: [{ qty: 1, price: 1000 }], taxRate: 7.25 }, { month: "2026-11", items: [{ qty: 1, price: 999 }], taxRate: 0 }]);
  assert.deepEqual(m, [{ month: "2026-11", taxable: 1000, tax: 72.5, n: 1 }, { month: "2026-10", taxable: 250.5, tax: 20.04, n: 2 }]); });
console.log(`periods: ${n} checks passed`);
