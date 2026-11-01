// Client hub: lifecycle stage and the "needs you" list.
import assert from "node:assert/strict";
import { stageOf, hubSummary, addMonths } from "./lib/client-hub.ts";
let n = 0; const ok = f => { f(); n++; };
const GO = "Go live (monthly billing starts)";
const base = (o = {}) => ({
  today: "2026-11-15", goLiveTitle: GO,
  deal: { contractStatus: "signed", signedAt: "2026-10-01T00:00:00Z", effectiveAt: "2026-10-01", endedAt: null, agreementStatus: "active" },
  kickoff: { status: "submitted", submittedAt: "2026-10-03T00:00:00Z" },
  milestones: [{ title: "Kickoff call", status: "done", dueAt: "2026-10-05T00:00:00Z", completedAt: "2026-10-05T00:00:00Z" }, { title: GO, status: "todo", dueAt: "2026-11-20T00:00:00Z", completedAt: null }],
  money: [], reports: [], success: null, ...o,
});

ok(() => assert.equal(addMonths("2026-11-30", 3), "2027-02-28", "month-end clamps"));
ok(() => assert.equal(addMonths("2026-10-01", 3), "2027-01-01"));
ok(() => assert.equal(stageOf(base()).key, "building"));
ok(() => assert.equal(stageOf(base({ kickoff: null })).key, "kickoff"));
ok(() => assert.equal(stageOf(base({ kickoff: { status: "open", submittedAt: null } })).key, "kickoff"));
ok(() => assert.equal(stageOf(base({ deal: { ...base().deal, contractStatus: "sent", signedAt: null } })).key, "signing"));
ok(() => assert.equal(stageOf(base({ milestones: [{ title: GO, status: "done", dueAt: null, completedAt: "2026-11-01" }] })).key, "live"));
ok(() => assert.equal(stageOf(base({ deal: { ...base().deal, agreementStatus: "ended" } })).key, "ended"));

const late = hubSummary(base({ milestones: [...base().milestones, { title: "Build flows", status: "in_progress", dueAt: "2026-11-01T00:00:00Z", completedAt: null }, { title: "Dropped", status: "cancelled", dueAt: "2026-10-01T00:00:00Z", completedAt: null }] }));
ok(() => assert.equal(late.delivery.total, 3, "cancelled steps don't count"));
ok(() => assert.equal(late.delivery.late, 1));
ok(() => assert.match(late.attention[0].text, /1 delivery step late: Build flows/));

const money = hubSummary(base({ money: [
  { status: "paid", amount: 1500, dueDate: "2026-10-01", paidAt: "2026-10-02", invoiceSentAt: "x" },
  { status: "expected", amount: 997, dueDate: "2026-11-01", paidAt: null, invoiceSentAt: "x" },
  { status: "expected", amount: 997, dueDate: "2026-12-01", paidAt: null, invoiceSentAt: null },
] }));
ok(() => assert.deepEqual(money.money, { paid: 1500, owed: 1994, overdue: 997 }));
ok(() => assert.match(money.attention[0].text, /\$997 overdue/));
ok(() => assert.ok(money.attention.some(a => /1 invoice not sent/.test(a.text))));

const live = base({ milestones: [{ title: GO, status: "done", dueAt: null, completedAt: "2026-10-01" }] });
ok(() => assert.ok(hubSummary(live).attention.some(a => a.text === "Send the October report."), "live before last month → report due"));
ok(() => assert.ok(!hubSummary({ ...live, reports: [{ period: "2026-10", status: "sent" }] }).attention.some(a => /report/.test(a.text))));
ok(() => assert.ok(!hubSummary({ ...live, deal: { ...live.deal, effectiveAt: "2026-11-02" } }).attention.some(a => /report/.test(a.text)), "went live this month → no report yet"));
ok(() => assert.equal(hubSummary(live).minTermEnds, "2027-01-01"));
ok(() => assert.ok(hubSummary({ ...live, today: "2026-12-20" }).attention.some(a => /Minimum term ends in 12 days/.test(a.text))));
ok(() => assert.ok(hubSummary(base({ success: { health: 2, renewalDate: "2026-12-01", nextReview: null, status: "at_risk" } })).attention.some(a => /Health is 2\/5/.test(a.text))));
ok(() => assert.ok(hubSummary(base({ success: { health: 4, renewalDate: "2026-12-01", nextReview: null, status: "active" } })).attention.some(a => /Renewal in 16 days/.test(a.text))));
ok(() => assert.ok(hubSummary(base({ kickoff: null })).attention.some(a => /Kickoff checklist not in/.test(a.text))));
const order = hubSummary(base({ kickoff: null, success: { health: 4, renewalDate: "2026-12-01", nextReview: null, status: "active" } })).attention.map(a => a.level);
ok(() => assert.deepEqual(order, [...order].sort((a, b) => ["urgent", "soon", "info"].indexOf(a) - ["urgent", "soon", "info"].indexOf(b)), "urgent first"));

console.log(`client hub: ${n} checks passed`);
