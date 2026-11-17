// Expenses and mileage: what an entry may hold, the mileage rate, and the sums job costing and the Money screen use.
import assert from "node:assert/strict";
const E = await import("./lib/expenses.ts");

let n = 0; const ok = fn => { fn(); n++; };
const today = "2026-11-16";

ok(() => { const e = E.cleanExpense({ kind: "expense", amount: "$1,284.37", vendor: " Home Depot ", category: "materials", spent_on: "2026-11-15", note: "posts", thread: "3f2b9c1e-7a44-4d0b-9e21-55c0a1b2c3d4" }, 0.7, today);
  assert.deepEqual(e, { kind: "expense", vendor: "Home Depot", category: "materials", amount: 1284.37, miles: null, spent_on: "2026-11-15", note: "posts", thread: "3f2b9c1e-7a44-4d0b-9e21-55c0a1b2c3d4" }); });
ok(() => { const e = E.cleanExpense({ kind: "mileage", miles: "24", spent_on: today }, 0.7, today); assert.equal(e.amount, 16.8); assert.equal(e.miles, 24); assert.equal(e.category, "vehicle"); });
ok(() => assert.equal(E.cleanExpense({ kind: "mileage", miles: "10" }, 0.655, today).amount, 6.55));
ok(() => assert.equal(E.cleanExpense({ amount: "0" }, 0.7, today).error, "Add the amount spent."));
ok(() => assert.match(E.cleanExpense({ kind: "mileage", miles: "5000" }, 0.7, today).error, /2,000/));
ok(() => assert.match(E.cleanExpense({ amount: "10", spent_on: "2026-12-01" }, 0.7, today).error, /not in the future/));
ok(() => assert.match(E.cleanExpense({ amount: "10", spent_on: "2023-01-01" }, 0.7, today).error, /two years/));
ok(() => { const e = E.cleanExpense({ amount: "10", category: "bribes", thread: "not-a-job" }, 0.7, today); assert.equal(e.category, "other"); assert.equal(e.thread, null); assert.equal(e.spent_on, today); });
ok(() => { assert.equal(E.mileageRate(""), 0.7); assert.equal(E.mileageRate("0.67"), 0.67); assert.equal(E.mileageRate("99"), 0.7); assert.equal(E.catLabel("dump"), "Dump and disposal"); assert.equal(E.catLabel("x"), "Other"); });
ok(() => {
  const list = [{ thread_id: "a", amount: 100.1, miles: null, category: "materials", spent_on: "2026-11-02" }, { thread_id: "a", amount: 50.2, miles: null, category: "fuel", spent_on: "2026-11-03" },
    { thread_id: null, amount: 16.8, miles: 24, category: "vehicle", spent_on: "2026-11-04" }, { thread_id: "b", amount: 30, miles: null, category: "materials", spent_on: "2026-10-30" }];
  assert.equal(E.byJob(list).get("a"), 150.3); assert.equal(E.byJob(list).get("b"), 30); assert.equal(E.byJob(list).has("null"), false);
  const s = E.monthSummary(list, "2026-11"); assert.equal(s.spent, 167.1); assert.equal(s.miles, 24); assert.deepEqual(s.cats[0], { cat: "materials", amount: 100.1 });
});

console.log(`expenses: ${n} checks passed`);
