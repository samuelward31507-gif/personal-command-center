// Material orders: the pure rules in lib/orders.ts.
import assert from "node:assert/strict";
const O = await import("./lib/orders.ts");
let n = 0; const ok = f => { f(); n++; };
ok(() => { const r = O.cleanOrder({ supplier: " ABC Supply ", supplier_email: "Orders@ABC.com", needed_on: "2026-12-01", items: [{ name: "Cedar 6ft picket", qty: "140", unit: "ea", cost: "3.25" }, { name: "", qty: 1 }, { name: "Post", qty: 0 }] });
  assert.equal(r.supplier, "ABC Supply"); assert.equal(r.supplier_email, "orders@abc.com"); assert.equal(r.items.length, 1); assert.equal(r.items[0].qty, 140); assert.equal(r.needed_on, "2026-12-01"); });
ok(() => assert.match(O.cleanOrder({ items: [] }).error, /at least one line/));
ok(() => assert.match(O.cleanOrder({ supplier_email: "nope", items: [{ name: "x" }] }).error, /email/));
ok(() => assert.equal(O.cleanOrder({ needed_on: "soon", items: [{ name: "x" }] }).needed_on, null));
ok(() => assert.equal(O.cleanOrderLines(Array.from({ length: 80 }, () => ({ name: "x" }))).length, 60));
ok(() => assert.equal(O.cleanOrderLines([{ name: "x", cost: -5 }]).length, 0, "no negative costs"));
ok(() => assert.equal(O.orderTotal([{ name: "a", qty: 140, unit: "", cost: 3.25 }, { name: "b", qty: 2, unit: "", cost: 0 }]), 455));
ok(() => { const l = O.linesFromQuote([{ name: "Cedar privacy", qty: 140, unit: "ft", price: 62.5 }, { name: "Walk gate", qty: 1, unit: "", price: 550, opt: true }, { name: "Good", qty: 1, unit: "", price: 9000, tier: "Good" }, { name: "Better", qty: 1, unit: "", price: 9800, tier: "Better" }],
    [{ name: "cedar privacy", cost: 28 }]);
  assert.deepEqual(l, [{ name: "Cedar privacy", qty: 140, unit: "ft", cost: 28 }, { name: "Good", qty: 1, unit: "", cost: 0 }], "options out; the first tier when nothing was picked"); });
ok(() => assert.equal(O.linesFromQuote([{ name: "Better", qty: 1, unit: "", price: 1, tier: "Better" }], [], "Better").length, 1, "the picked tier comes in"));
ok(() => { const t = O.orderText({ supplier: "ABC", needed_on: "2026-12-01", note: "Call on arrival", items: [{ name: "Picket", qty: 140, unit: "ea", cost: 3.25 }] }, { business: "Ward Fence", owner: "Sam", phone: "+13035550100", address: "12 Elm St" });
  assert.match(t, /^Hi ABC,/); assert.match(t, /Ward Fence, job at 12 Elm St\. Needed by Tue, Dec 1\./); assert.match(t, /- 140 ea Picket/); assert.ok(!t.includes("3.25"), "costs stay out"); assert.match(t, /Call on arrival/); });
ok(() => { assert.ok(O.isOrderStatus("received")); assert.ok(!O.isOrderStatus("lost")); });
console.log(`orders: ${n} checks passed`);
