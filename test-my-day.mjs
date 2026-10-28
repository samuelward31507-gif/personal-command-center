// Regression tests for the My Day queue ranking rules.
// Run with: node --experimental-strip-types test-my-day.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQueue, pickProspects, prospectScore, DAILY_NEW_PROSPECTS } from "./lib/my-day.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const today = "2026-10-28";
const contact = (id, extra = {}) => ({ id, name: "Name " + id, company: "Co " + id, phone: "555", lastOutcome: null, lastAt: null, verdict: null, ...extra });
const base = () => ({ today, now: "2026-10-28T15:00:00Z", outreach: [], activeOutreachContactIds: [], followUps: [], meetings: [], deals: [], delivery: [], receivables: [], tasks: [] });

// Dedupe: a contact in an active sequence never gets a second generic follow-up.
ok(() => {
  const q = buildQueue({ ...base(), outreach: [{ id: "o1", step: 2, nextActionAt: "2026-10-27T15:00:00Z", contact: contact("a") }], activeOutreachContactIds: ["a"], followUps: [{ followUpAt: "2026-10-27", contact: contact("a") }] });
  assert.equal(q.length, 1); assert.equal(q[0].id, "outreach:o1");
});
ok(() => {
  const q = buildQueue({ ...base(), activeOutreachContactIds: ["b"], followUps: [{ followUpAt: "2026-10-27", contact: contact("b") }] });
  assert.equal(q.length, 0, "active sequence not yet due still suppresses the generic follow-up");
});
// Future follow-ups and outreach stay out.
ok(() => assert.equal(buildQueue({ ...base(), followUps: [{ followUpAt: "2026-10-29", contact: contact("c") }] }).length, 0));
ok(() => assert.equal(buildQueue({ ...base(), outreach: [{ id: "o2", step: 1, nextActionAt: "2026-10-30T15:00:00Z", contact: contact("d") }] }).length, 0));

// Status labels
ok(() => {
  const q = buildQueue({ ...base(), followUps: [{ followUpAt: "2026-10-25", contact: contact("e") }, { followUpAt: today, contact: contact("f") }] });
  assert.equal(q.find(i => i.id === "followup:e").status, "overdue");
  assert.match(q.find(i => i.id === "followup:e").why, /3 days overdue/);
  assert.equal(q.find(i => i.id === "followup:f").status, "today");
});

// Revenue first, regardless of how urgent other groups are.
ok(() => {
  const q = buildQueue({ ...base(),
    tasks: [{ id: "t1", title: "Urgent admin", status: "todo", priority: "urgent", dueAt: "2026-10-20T00:00:00Z", contactName: null, dealTitle: null }],
    delivery: [{ id: "p1", kind: "project", title: "Build", project: "Build", status: "blocked", due: null }],
    followUps: [{ followUpAt: today, contact: contact("g") }] });
  assert.deepEqual(q.map(i => i.group), ["revenue", "delivery", "admin"]);
});
// Hot leads (interested / callback / connected) rank above cold ones with the same status.
ok(() => {
  const q = buildQueue({ ...base(), followUps: [
    { followUpAt: today, contact: contact("cold") },
    { followUpAt: today, contact: contact("hot", { lastOutcome: "interested", lastAt: "2026-10-26T15:00:00Z" }) }] });
  assert.equal(q[0].id, "followup:hot");
  assert.match(q[0].why, /Last call: interested/);
  assert.equal(q[0].lastActivity, "interested · 2026-10-26");
});
// Audit verdict is carried as the reason.
ok(() => {
  const q = buildQueue({ ...base(), followUps: [{ followUpAt: today, contact: contact("h", { verdict: "Audit: Conditional fit" }) }] });
  assert.match(q[0].why, /Audit: Conditional fit/);
});
// Callable only with a phone number.
ok(() => assert.equal(buildQueue({ ...base(), followUps: [{ followUpAt: today, contact: contact("i", { phone: "" }) }] })[0].callable, false));

// Meetings: unprepared first, prep link goes to the audit.
ok(() => {
  const q = buildQueue({ ...base(), meetings: [
    { id: "m1", title: "Prepped", startsAt: "2026-10-28T20:00:00Z", type: "meeting", hasPrep: true, contact: contact("j"), dealTitle: null },
    { id: "m2", title: "Unprepped", startsAt: "2026-10-28T21:00:00Z", type: "meeting", hasPrep: false, contact: contact("k"), dealTitle: null }] });
  assert.equal(q[0].id, "meeting:m2"); assert.equal(q[0].href, "/crm/audit"); assert.match(q[0].why, /No prep brief/);
});

// Deals: only past close date or 7+ quiet days.
ok(() => {
  const q = buildQueue({ ...base(), deals: [
    { id: "d1", title: "Fresh", stage: "qualified", closeDate: "2026-11-15", lastActivityAt: "2026-10-27T15:00:00Z", contact: contact("l") },
    { id: "d2", title: "Quiet", stage: "discovery", closeDate: null, lastActivityAt: "2026-10-18T15:00:00Z", contact: contact("m") },
    { id: "d3", title: "Late", stage: "proposal", closeDate: "2026-10-20", lastActivityAt: "2026-10-27T15:00:00Z", contact: contact("n") }] });
  assert.deepEqual(q.map(i => i.id), ["deal:d3", "deal:d2"]);
  assert.match(q[1].why, /no activity in 10 days/);
});

// Delivery and money
ok(() => {
  const q = buildQueue({ ...base(), delivery: [
    { id: "x1", kind: "milestone", title: "QA", project: "Acme", status: "todo", due: "2026-11-02T00:00:00Z" },
    { id: "x2", kind: "milestone", title: "Launch", project: "Acme", status: "todo", due: "2026-10-26T00:00:00Z" }] });
  assert.deepEqual(q.map(i => i.id), ["milestone:x2"], "future milestones stay out");
});
ok(() => {
  const q = buildQueue({ ...base(), receivables: [
    { id: "r1", title: "Setup fee", amount: 1500, status: "expected", due: "2026-10-27", client: "Acme" },
    { id: "r2", title: "Retainer", amount: 997, status: "expected", due: "2026-11-01", client: "Acme" },
    { id: "r3", title: "Paid", amount: 500, status: "paid", due: "2026-10-01", client: "Acme" }] });
  assert.deepEqual(q.map(i => i.id), ["receivable:r1"]);
  assert.match(q[0].title, /\$1,500/);
  assert.match(q[0].why, /not payment-verified/, "never implies money was verified");
});
ok(() => {
  const q = buildQueue({ ...base(), tasks: [
    { id: "t2", title: "Done", status: "done", priority: "urgent", dueAt: null, contactName: null, dealTitle: null },
    { id: "t3", title: "Later", status: "todo", priority: "low", dueAt: "2026-11-10T00:00:00Z", contactName: null, dealTitle: null },
    { id: "t4", title: "Blocked", status: "blocked", priority: "low", dueAt: null, contactName: null, dealTitle: null }] });
  assert.deepEqual(q.map(i => i.id), ["task:t4"]);
});

// --- Daily prospect queue ---
const pr = (id, company, extra = {}, website = "") => ({ contact: contact(id, { company, ...extra }), location: "Phoenix AZ", website, createdAt: "2026-10-27T00:00:00Z" });
ok(() => assert.equal(DAILY_NEW_PROSPECTS, 15));
ok(() => assert.equal(prospectScore(pr("x", "Acme Fence", { verdict: "Audit: No fit — rural" })), null, "no-fit audits never appear"));
ok(() => {
  const picked = pickProspects({ ...base(), prospects: [
    pr("plain", "Bob's Roofing"), pr("pool", "Blue Pools LLC"), pr("cond", "Desert Fence", { verdict: "Audit: Conditional fit — Tier 1" }),
    pr("fit", "Big Pools", { verdict: "Audit: Fit — Tier 2" }), pr("nofit", "Tiny Fence", { verdict: "Audit: No fit" }), pr("nophone", "Peak Fence", { phone: "" }) ] });
  assert.deepEqual(picked.map(p => p.contact.id), ["fit", "cond", "pool", "plain"], "fit > conditional > niche > others; no-fit and no-phone excluded");
});
ok(() => {
  const many = Array.from({ length: 30 }, (_, i) => pr("p" + i, "Fence Co " + i));
  assert.equal(pickProspects({ ...base(), prospects: many }).length, 15, "capped at the daily number");
  assert.equal(pickProspects({ ...base(), prospects: many, firstTouchesToday: 6 }).length, 9, "first calls made today count against the cap");
  assert.equal(pickProspects({ ...base(), prospects: many, firstTouchesToday: 20 }).length, 0);
  assert.equal(pickProspects({ ...base(), prospects: many, dailyNewProspects: 5 }).length, 5);
});
ok(() => {
  const q = buildQueue({ ...base(), prospects: [pr("n1", "Mesa Pools")], followUps: [{ followUpAt: today, contact: contact("f1") }],
    tasks: [{ id: "t9", title: "x", status: "blocked", priority: "low", dueAt: null, contactName: null, dealTitle: null }] });
  assert.deepEqual(q.map(i => i.group), ["revenue", "prospects", "admin"], "follow-ups before new prospects, prospects before admin");
  const p = q.find(i => i.group === "prospects");
  assert.equal(p.callable, true); assert.match(p.why, /Pool · Phoenix AZ · No audit yet/); assert.equal(p.href, "/crm/audit");
});
ok(() => {
  const q = buildQueue({ ...base(), prospects: [pr("dup", "Fence")], followUps: [{ followUpAt: today, contact: contact("dup") }] });
  assert.equal(q.filter(i => i.contact?.id === "dup").length, 1, "a contact appears once");
});
ok(() => {
  const r = readFileSync("app/api/my-day/route.ts", "utf8");
  assert.match(r, /a\.outcome <> 'initiated'\)[\s\S]*contact_outreach o[\s\S]*contact_suppressions s/, "prospects exclude contacted, sequenced and suppressed contacts");
});

// Route guards
const route = readFileSync("app/api/my-day/route.ts", "utf8");
ok(() => assert.match(route, /if \(!user\) return fail\("Unauthorized", 401\)/));
ok(() => assert.equal((route.match(/owner_id = \$\{owner\}/g) || []).length >= 10, true, "every query is owner-scoped"));
ok(() => assert.match(route, /NOT EXISTS \(SELECT 1 FROM public\.contact_suppressions/, "suppressed contacts never appear as follow-ups"));
ok(() => assert.doesNotMatch(route, /provider_event_id|provider\b,/, "no dependency on Cal.ai columns missing in production"));
const ui = readFileSync("app/my-day-queue.tsx", "utf8");
ok(() => assert.match(ui, /\/api\/contacts\/outcome/, "outcomes logged from the queue"));
ok(() => assert.match(ui, /confirm\(`Mark \$\{item\.contact\.name\} do not contact\?/, "do-not-contact confirmed"));
ok(() => assert.doesNotMatch(ui, /sms|text message/i, "queue never drafts or sends texts"));

console.log(`My Day queue regression checks passed (${n} assertions).`);
