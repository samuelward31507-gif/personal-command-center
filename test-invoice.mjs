// Billing logic: urgency buckets, next moves, reminder drafts, and safe monthly retainer billing.
import assert from "node:assert/strict";
import { bucketOf, owedSummary, nextMove, reminderEmail, retainerPlan, retainerKey, invoiceLabel, monthName, daysBetween } from "./lib/invoice.ts";
let n = 0; const ok = f => { f(); n++; };
const T = "2026-11-15";
const e = (o) => ({ id: "x", title: "Ridgeline — setup fee", client: "Mike Torres", email: "mike@r.co", amount: 1500, status: "expected", dueDate: T, invoiceNumber: null, invoiceSentAt: null, remindedAt: null, ...o });

ok(() => assert.equal(daysBetween("2026-11-01", "2026-11-15"), 14));
ok(() => assert.equal(bucketOf(e({ dueDate: "2026-10-01" }), T), "overdue_30"));
ok(() => assert.equal(bucketOf(e({ dueDate: "2026-11-10" }), T), "overdue"));
ok(() => assert.equal(bucketOf(e({ dueDate: T }), T), "due_week", "due today is not overdue"));
ok(() => assert.equal(bucketOf(e({ dueDate: "2026-11-22" }), T), "due_week"));
ok(() => assert.equal(bucketOf(e({ dueDate: "2026-12-20" }), T), "later"));
ok(() => assert.equal(bucketOf(e({ dueDate: null }), T), "no_date"));
ok(() => assert.equal(bucketOf(e({ dueDate: null, status: "overdue" }), T), "overdue"));

const s = owedSummary([
  e({ id: "a", dueDate: "2026-10-01", amount: 997, invoiceSentAt: "2026-10-01T00:00:00Z" }),
  e({ id: "b", dueDate: "2026-11-20", amount: 1500 }),
  e({ id: "c", status: "paid", amount: 5000 }),
  e({ id: "d", status: "cancelled", amount: 5000 }),
  e({ id: "f", dueDate: "2026-11-12", amount: 3000 }),
], T);
ok(() => assert.equal(s.totalOpen, 997 + 1500 + 3000, "paid and cancelled never count as owed"));
ok(() => assert.equal(s.totalOverdue, 997 + 3000));
ok(() => assert.equal(s.notInvoiced, 2));
ok(() => assert.deepEqual(s.groups.map(g => g.bucket), ["overdue_30", "overdue", "due_week"], "most urgent first"));

ok(() => assert.equal(nextMove(e({}), T), "Send the invoice"));
ok(() => assert.equal(nextMove(e({ invoiceSentAt: "2026-11-10T00:00:00Z", dueDate: "2026-11-20" }), T), "Sent. Wait for the due date"));
ok(() => assert.equal(nextMove(e({ invoiceSentAt: "x", dueDate: "2026-11-10" }), T), "Send a reminder"));
ok(() => assert.equal(nextMove(e({ invoiceSentAt: "x", dueDate: "2026-10-20" }), T), "Call them today"));
ok(() => assert.equal(nextMove(e({ invoiceSentAt: "x", dueDate: "2026-11-01", remindedAt: "2026-11-14T10:00:00Z" }), T), "Reminded yesterday"));

const w = { ownerFirstName: "Samuel", businessName: "Cinder Revenue Company" };
const fresh = reminderEmail(e({ invoiceNumber: 1001, dueDate: "2026-11-20" }), T, w, "https://x/invoice/t");
ok(() => assert.equal(fresh.subject, "INV-1001 for $1,500, due November 20, 2026"));
ok(() => assert.match(fresh.body, /^Hi Mike,/));
ok(() => assert.match(fresh.body, /https:\/\/x\/invoice\/t/));
ok(() => assert.match(fresh.body, /Samuel\nCinder Revenue Company$/));
const late = reminderEmail(e({ invoiceNumber: 1001, dueDate: "2026-10-20" }), T, w, "u");
ok(() => assert.equal(late.subject, "INV-1001 for $1,500 is past due"));
ok(() => assert.match(late.body, /26 days past due/));
ok(() => assert.match(reminderEmail(e({ invoiceNumber: 1, dueDate: "2026-11-10" }), T, w, "u").body, /Quick reminder/));
ok(() => assert.match(reminderEmail(e({ client: "" }), T, w, "u").body, /^Hi there,/));
ok(() => assert.equal(invoiceLabel(null), "Draft"));
ok(() => assert.equal(monthName("2026-11"), "November 2026"));

const deal = (o) => ({ id: "d1", contactId: "c1", projectId: "p1", client: "Ridgeline Fence", monthlyFee: 997, effectiveAt: "2026-09-10", endedAt: null, agreementStatus: "active", ...o });
const plan = retainerPlan([
  deal({}),
  deal({ id: "d2", effectiveAt: "2026-11-03" }),
  deal({ id: "d3", agreementStatus: "paused" }),
  deal({ id: "d4", endedAt: "2026-10-31" }),
  deal({ id: "d5", monthlyFee: 0 }),
  deal({ id: "d6" }),
  deal({ id: "d7", effectiveAt: null }),
  deal({ id: "d8", endedAt: "2026-12-15" }),
], "2026-11", new Set([retainerKey("d6", "2026-11")]));
ok(() => assert.deepEqual(plan.create.map(c => c.dealId), ["d1", "d8"]));
ok(() => assert.equal(plan.create[0].sourceKey, "retainer:d1:2026-11"));
ok(() => assert.equal(plan.create[0].dueDate, "2026-11-01"));
ok(() => assert.equal(plan.create[0].title, "Ridgeline Fence — monthly retainer (November 2026)"));
ok(() => assert.equal(plan.create[0].amount, 997));
ok(() => assert.deepEqual(plan.skipped.map(x => x.reason), ["not live before this month", "agreement not active", "agreement ended", "no monthly fee", "already billed", "not live before this month"]));
ok(() => assert.equal(retainerPlan([deal({})], "2026-11", new Set(), 15).create[0].dueDate, "2026-11-15"));

console.log(`invoice: ${n} checks passed`);
