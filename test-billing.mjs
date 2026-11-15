// Billing checks: quote lines, totals, the draft from the owner's prices, pay links, invoice texts and reminders.
import assert from "node:assert/strict";
import { draftItems } from "./lib/crm.ts";
import { cleanItems, cleanTax, totals, cleanPayLink, invoiceText, reminderDue, fillInvoice, REMINDER_TEXTS, INVOICE_TOKEN, overdue } from "./lib/billing.ts";

let n = 0; const ok = fn => { fn(); n++; };
ok(() => assert.deepEqual(cleanItems([{ name: " Cedar fence ", qty: "150", unit: "ft", price: "$43" }, { name: "", qty: 1, price: 5 }, { name: "x", qty: 0, price: 5 }, { name: "y", qty: 1, price: -2 }, "junk"]),
  [{ name: "Cedar fence", qty: 150, unit: "ft", price: 43 }]));
ok(() => assert.equal(cleanItems("nope").length, 0));
ok(() => assert.equal(cleanTax("8.25"), 8.25));
ok(() => assert.equal(cleanTax(40), 0));
ok(() => assert.deepEqual(totals([{ name: "a", qty: 150, unit: "ft", price: 43 }, { name: "Gate", qty: 2, unit: "", price: 550 }], 8.25), { subtotal: 7550, tax: 622.88, total: 8172.88 }));
ok(() => assert.deepEqual(totals([], 5), { subtotal: 0, tax: 0, total: 0 }));
const book = JSON.stringify({ unit: "ft", rates: [{ name: "Wood privacy (cedar)", low: 38, high: 48 }, { name: "Vinyl", low: 40, high: 55 }], gate: [450, 650] });
ok(() => assert.deepEqual(draftItems("Fence", { length_ft: 150, material: "cedar", height: "6 ft", gates: 2 }, book),
  [{ name: "6 ft Wood privacy (cedar) fence, installed", qty: 150, unit: "ft", price: 43 }, { name: "Walk gate", qty: 2, unit: "", price: 550 }]));
ok(() => assert.deepEqual(draftItems("Fence", {}, ""), [{ name: "Fence, installed", qty: 1, unit: "", price: 0 }]));
ok(() => assert.deepEqual(draftItems("Auto detailing", { service: "full" }, JSON.stringify({ unit: "job", rates: [{ name: "Full detail", low: 180, high: 260 }] })), [{ name: "Full detail", qty: 1, unit: "", price: 220 }]));
ok(() => assert.equal(cleanPayLink("square.link/u/abc"), "https://square.link/u/abc"));
ok(() => assert.equal(cleanPayLink("http://pay.example.com"), ""));
ok(() => assert.equal(cleanPayLink("https://user:pw@pay.example.com"), ""));
ok(() => assert.equal(cleanPayLink("localhost"), ""));
ok(() => assert.equal(invoiceText({ first: "Dana", business: "Ridgeline Fence Co.", number: 1042, total: 4200, due: "Nov 30", url: "https://x/i/t" }),
  "Hi Dana, here's invoice #1042 from Ridgeline Fence Co for $4,200, due Nov 30. You can see it and pay here: https://x/i/t"));
ok(() => assert.equal(reminderDue({ status: "sent", dueOn: "2026-11-10", reminders: 0, paused: false }, "2026-11-10"), null, "not on the due date"));
ok(() => assert.equal(reminderDue({ status: "sent", dueOn: "2026-11-10", reminders: 0, paused: false }, "2026-11-11"), 0));
ok(() => assert.equal(reminderDue({ status: "sent", dueOn: "2026-11-10", reminders: 1, paused: false }, "2026-11-12"), null));
ok(() => assert.equal(reminderDue({ status: "sent", dueOn: "2026-11-10", reminders: 1, paused: false }, "2026-11-17"), 1));
ok(() => assert.equal(reminderDue({ status: "sent", dueOn: "2026-11-10", reminders: 3, paused: false }, "2026-12-30"), null, "three at most"));
ok(() => assert.equal(reminderDue({ status: "paid", dueOn: "2026-11-10", reminders: 0, paused: false }, "2026-11-20"), null));
ok(() => assert.equal(reminderDue({ status: "sent", dueOn: "2026-11-10", reminders: 0, paused: true }, "2026-11-20"), null));
ok(() => assert.equal(fillInvoice(REMINDER_TEXTS[0], { first: "", business: "Acme.", owner: "Mike", number: 7, total: 99.5, url: "u" }), "Hi, a friendly reminder from Acme: invoice #7 for $99.50 was due yesterday. You can pay here: u"));
ok(() => assert.ok(INVOICE_TOKEN.test("abcdefghijklmnopqrstuvwx")));
ok(() => assert.equal(overdue("sent", "2026-11-01", "2026-11-14"), true));
ok(() => assert.equal(overdue("paid", "2026-11-01", "2026-11-14"), false));
console.log(`Billing checks passed (${n} assertions).`);
