// Client Today figures reconcile with the build brief's example business (example-data.json, Nov 22, 2026).
import assert from "node:assert/strict";
import { todayFigures } from "./lib/today-figures.ts";

const won = (day, price) => ({ stage: "won", stageAt: day + "T18:00:00Z", price });
const cards = [won("2026-11-19", 6900), won("2026-10-27", 8600), won("2026-10-25", 11200), won("2026-11-14", 4300), won("2026-11-17", 6500),
  { stage: "won", stageAt: "2026-10-01T18:00:00Z", price: 29800 }, // prior 30 days
  { stage: "quoted", stageAt: "2026-11-18T18:00:00Z", price: 7800 }, { stage: "lost", stageAt: "2026-11-16T18:00:00Z", price: 5900 }];
const payments = [["2026-10-25", 5000], ["2026-10-27", 2500], ["2026-11-12", 6200], ["2026-11-14", 1000], ["2026-11-17", 1500], ["2026-11-19", 2300]].map(([paid_on, amount]) => ({ paid_on, amount }));
const invoices = [{ status: "paid", total: 11200, paid_amount: 11200, due_on: "2026-11-17" }, { status: "sent", total: 8600, paid_amount: 2500, due_on: "2026-11-18" }, { status: "sent", total: 6900, paid_amount: 2300, due_on: "2026-11-28" }];
const f = todayFigures({ today: "2026-11-22", cards, payments, invoices });

assert.equal(f.days[0], "2026-10-24"); assert.equal(f.days[29], "2026-11-22");
assert.equal(f.wonValue, 37500); assert.equal(f.wonCount, 5); assert.equal(f.average, 7500);
assert.equal(f.collected, 18500); assert.equal(f.owed, 10700); assert.equal(f.late, 6100); assert.equal(f.notDue, 4600);
assert.equal(f.delta, 26, "+26% vs $29,800 the 30 days before");
// The chart ends on the cards: the running totals end at the headline figures and never go down.
assert.equal(f.wonRun.at(-1), f.wonValue); assert.equal(f.colRun.at(-1), f.collected);
for (let i = 1; i < 30; i++) { assert.ok(f.wonRun[i] >= f.wonRun[i - 1]); assert.ok(f.colRun[i] >= f.colRun[i - 1]); }
assert.equal(f.wonRun[f.days.indexOf("2026-11-19")], 37500 - 0, "Carla's approval on Thu Nov 19 brings Won to $37,500");
assert.equal(f.colRun[f.days.indexOf("2026-11-19")], 18500);
// Nothing outside the window leaks in
assert.equal(todayFigures({ today: "2026-11-22", cards: [won("2026-10-23", 999)], payments: [{ paid_on: "2026-10-23", amount: 5 }], invoices: [] }).wonValue, 0);
console.log("today figures ok");
