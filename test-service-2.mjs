// The price list, the job sign-off, the team (up to ten, with an office role) and what goes to QuickBooks.
import assert from "node:assert/strict";
import { register } from "node:module";
register("./test-alias-hooks.mjs", import.meta.url);
process.env.CINDER_TOKEN_KEY = "k".repeat(40);
const { cleanCatalog, searchCatalog, cleanSignoff } = await import("./lib/service.ts");
const { parseTeam, TEAM_MAX } = await import("./lib/crm.ts");
const { displayName, customerBody, invoiceBody, paymentBody, qboQuote, qboState, readQboState } = await import("./lib/qbo-core.ts");

let n = 0; const ok = fn => { fn(); n++; };
// Price list: names required, duplicates dropped, prices clean, costs optional, JSON strings accepted.
ok(() => assert.deepEqual(cleanCatalog([{ name: " Walk gate ", unit: "", price: "$550", cost: "240" }, { name: "walk gate", price: 1 }, { name: "", price: 3 }, { name: "Bad", price: -1 }, { name: "Post", unit: "each", price: 140 }]),
  [{ name: "Walk gate", unit: "", price: 550, cost: 240 }, { name: "Post", unit: "each", price: 140 }]));
ok(() => assert.equal(cleanCatalog('[{"name":"Stain","unit":"ft","price":5.25}]')[0].price, 5.25));
ok(() => assert.deepEqual(cleanCatalog("not json"), []));
ok(() => assert.equal(cleanCatalog(Array.from({ length: 400 }, (_, i) => ({ name: "L" + i, price: 1 }))).length, 300));
const list = cleanCatalog([{ name: "6 ft cedar privacy", price: 43 }, { name: "Cedar gate", price: 550 }, { name: "Chain link", price: 22 }]);
ok(() => assert.deepEqual(searchCatalog(list, "ced").map(x => x.name), ["Cedar gate", "6 ft cedar privacy"]));
ok(() => assert.equal(searchCatalog(list, "").length, 3));
ok(() => assert.equal(searchCatalog(list, "vinyl").length, 0));
// Sign-off: a name, a real PNG signature, a short checklist.
const png = "data:image/png;base64,iVBORw0KGgo=";
ok(() => assert.equal(cleanSignoff({ signedBy: "D", signature: png }).ok, false));
ok(() => assert.equal(cleanSignoff({ signedBy: "Dana Ruiz", signature: "data:image/jpeg;base64,abc" }).ok, false));
ok(() => assert.equal(cleanSignoff({ signedBy: "Dana Ruiz", signature: png + "x".repeat(130000) }).ok, false));
ok(() => { const s = cleanSignoff({ signedBy: " Dana Ruiz ", signature: png, note: "ok", checklist: [{ label: "Clean", done: true }, { label: "", done: true }, "junk"] }); assert.equal(s.ok, true); assert.equal(s.signedBy, "Dana Ruiz"); assert.deepEqual(s.checklist, [{ label: "Clean", done: true }]); });
// Team: up to ten, office kept as office.
ok(() => assert.equal(TEAM_MAX, 10));
ok(() => assert.equal(parseTeam(Array.from({ length: 14 }, (_, i) => ({ name: "P" + i, cell: "72055501" + String(i).padStart(2, "0") }))).length, 10));
ok(() => assert.deepEqual(parseTeam([{ name: "Jess", cell: "7205550166", role: "office" }, { name: "Mo", cell: "7205550167", role: "boss" }]).map(m => m.role), ["office", "crew"]));
// QuickBooks: unique display names, safe queries, the invoice and payment shapes.
ok(() => assert.equal(displayName("Dana Ruiz", "+17205550148"), "Dana Ruiz (720) 555-0148"));
ok(() => assert.equal(displayName("", "+17205550148"), "(720) 555-0148"));
ok(() => assert.equal(displayName("A:B", ""), "A B"));
ok(() => assert.equal(qboQuote("O'Brien"), "'O\\'Brien'"));
ok(() => { const c = customerBody({ name: "Dana Ruiz", phone: "+17205550148", email: "d@x.co", address: "77 Aspen Ct" }); assert.equal(c.GivenName, "Dana"); assert.equal(c.FamilyName, "Ruiz"); assert.deepEqual(c.BillAddr, { Line1: "77 Aspen Ct" }); });
ok(() => { const b = invoiceBody({ number: 1044, items: [{ name: "Fence", qty: 150, price: 43 }, { name: "Gate", qty: 1, price: 550 }], tax_rate: 8, due_on: "2026-11-22", note: "" }, "55", "9");
  assert.equal(b.DocNumber, "1044"); assert.equal(b.Line.length, 3); assert.equal(b.Line[0].Amount, 6450); assert.equal(b.Line[2].Amount, 560); assert.equal(b.Line[2].Description, "Sales tax (8%)");
  assert.deepEqual(b.CustomerRef, { value: "55" }); assert.equal(b.Line[1].SalesItemLineDetail.ItemRef.value, "9"); assert.equal(b.DueDate, "2026-11-22"); });
ok(() => { const b = invoiceBody({ number: 1, items: [{ name: "x", qty: 1, price: 10 }], tax_rate: 0, due_on: null, note: "" }, "1", "2"); assert.equal(b.Line.length, 1); assert.equal(b.DueDate, undefined); });
ok(() => { const p = paymentBody({ amount: 1500, paid_on: "2026-11-15", method: "check", note: "check 1182" }, "55", "201"); assert.equal(p.TotalAmt, 1500); assert.deepEqual(p.Line[0].LinkedTxn, [{ TxnId: "201", TxnType: "Invoice" }]); assert.equal(p.PrivateNote, "Check, check 1182"); });
ok(() => { const id = "0b9a5c7e-1111-4222-8333-444455556666", s = qboState(id); assert.equal(readQboState(s), id); assert.equal(readQboState(s.slice(0, -2) + "xx"), null); assert.equal(readQboState(qboState(id, Date.now() - 8 * 86400000)), null); });
// Clock taps sent later from an offline phone: the time it was tapped, never the future, never more than a day back.
{ const now = Date.parse("2026-11-16T15:00:00Z"); const S2 = await import("./lib/service.ts");
  ok(() => assert.equal(S2.tappedAt("2026-11-16T13:30:00Z", now), "2026-11-16T13:30:00.000Z"));
  ok(() => assert.equal(S2.tappedAt("2026-11-17T09:00:00Z", now), "2026-11-16T15:00:00.000Z", "a phone clock ahead can't add hours"));
  ok(() => assert.equal(S2.tappedAt("2026-11-10T09:00:00Z", now), "2026-11-15T15:00:00.000Z", "at most a day back"));
  ok(() => assert.equal(S2.tappedAt(undefined, now), "2026-11-16T15:00:00.000Z")); }
console.log(`service 2: ${n} checks passed`);
