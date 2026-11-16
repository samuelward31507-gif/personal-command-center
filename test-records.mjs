// Equipment, documents and to-dos: what each may hold, warranties ending soon, the order to do things in.
import assert from "node:assert/strict";
const R = await import("./lib/records.ts");
let n = 0; const ok = fn => { fn(); n++; };
const today = "2026-11-16";

ok(() => assert.deepEqual(R.cleanEquipment({ kind: " Furnace ", make: "Carrier", model: "59SC5", serial: "ab123 ", installed_on: "2014-10-02", warranty_until: "2024-10-02", location: "Basement" }),
  { kind: "Furnace", make: "Carrier", model: "59SC5", serial: "AB123", location: "Basement", installed_on: "2014-10-02", warranty_until: "2024-10-02", notes: "" }));
ok(() => assert.match(R.cleanEquipment({ serial: "X1" }).error, /what it is/));
ok(() => assert.match(R.cleanEquipment({ kind: "Furnace", installed_on: "2020-01-01", warranty_until: "2019-01-01" }).error, /warranty/));
ok(() => assert.equal(R.cleanEquipment({ kind: "Furnace", installed_on: "not a date" }).installed_on, null));
ok(() => { const list = [{ id: "a", warranty_until: "2026-12-01" }, { id: "b", warranty_until: "2026-11-01" }, { id: "c", warranty_until: "2027-06-01" }, { id: "d", warranty_until: null }, { id: "e", warranty_until: "2026-11-20" }];
  assert.deepEqual(R.warrantyEndingSoon(list, today, 30).map(x => x.id), ["e", "a"]); });
ok(() => { assert.equal(R.ageYears("2014-10-02", today), 12); assert.equal(R.ageYears(null, today), null); });
ok(() => { const f = R.cleanFile({ name: "permit<1>.pdf", data: "data:application/pdf;base64,JVBERi0xLjQK" }); assert.equal(f.name, "permit-1-.pdf"); assert.equal(f.mime, "application/pdf"); });
ok(() => assert.match(R.cleanFile({ name: "x.exe", data: "data:application/x-msdownload;base64,TVo=" }).error, /PDF or a photo/));
ok(() => assert.match(R.cleanFile({ name: "big.pdf", data: "data:application/pdf;base64," + "A".repeat(4_100_000) }).error, /3 MB/));
ok(() => { const t = R.cleanTask({ title: "  Call the city ", due_on: "2026-11-17", assignee: "+1 (720) 555-0188", thread: "nope" }); assert.deepEqual(t, { title: "Call the city", due_on: "2026-11-17", assignee: "+17205550188", thread: null }); });
ok(() => assert.match(R.cleanTask({ title: " " }).error, /needs doing/));
ok(() => { const list = [
  { id: "later", due_on: "2026-11-30", done_at: null, created_at: "1" }, { id: "none", due_on: null, done_at: null, created_at: "0" }, { id: "late", due_on: "2026-11-10", done_at: null, created_at: "3" },
  { id: "today", due_on: today, done_at: null, created_at: "2" }, { id: "done", due_on: "2026-11-01", done_at: "x", created_at: "0" }];
  assert.deepEqual(R.taskOrder(list, today).map(t => t.id), ["late", "today", "later", "none"]); });
ok(() => assert.deepEqual(R.cleanTags([" Commercial ", "HOA", "hoa", "2025 Storm!!", ""]), ["commercial", "hoa", "2025 storm"]));
ok(() => assert.deepEqual(R.cleanTags("vip, repeat ,vip"), ["vip", "repeat"]));
ok(() => assert.equal(R.cleanTags(Array.from({ length: 20 }, (_, i) => "t" + i)).length, 12));
ok(() => assert.deepEqual(R.cleanFieldLabels(["Gate code", "gate code", " HOA ", "", "PO number"]), ["Gate code", "HOA", "PO number"]));
ok(() => assert.equal(R.cleanFieldLabels(Array.from({ length: 15 }, (_, i) => "F" + i)).length, 10));
ok(() => assert.deepEqual(R.cleanFieldValues({ "Gate code": " 4418 ", "Not a field": "x", HOA: "" }, ["Gate code", "HOA"]), { "Gate code": "4418" }));
ok(() => { assert.equal(R.activityDetail("stage", { stage: "won" }), "won"); assert.equal(R.activityDetail("setup", { setup: { pay_link: "x", tax_rate: "8", owner_cell: "1", late_fee: "5%" } }), "tax_rate, late_fee", "no links or numbers in the log");
  assert.equal(R.activityDetail("reply", { body: "secret text" }), "", "never the message"); assert.ok(R.LOGGED.paymentdelete); assert.equal(R.LOGGED.checktick, undefined); });
console.log(`records: ${n} checks passed`);
