// Service plans, change orders and crew hours: visit dates, recurring value, what the owner types, and labor from clocked hours.
import assert from "node:assert/strict";
import { register } from "node:module";
register("./test-alias-hooks.mjs", import.meta.url);
const { addInterval, visitDays, monthlyValue, cleanPlan, cleanChangeOrder, changeOrderLines, approvedExtra, minutesOf, laborOf, hoursText, visitReminderText, changeOrderText, ratesOf } = await import("./lib/service.ts");
const { parseTeam } = await import("./lib/crm.ts");

let n = 0; const ok = fn => { fn(); n++; };
// Visit dates: weeks add days, months keep the day and clamp at month end.
ok(() => assert.equal(addInterval("2026-11-15", 1, "week"), "2026-11-22"));
ok(() => assert.equal(addInterval("2026-12-29", 2, "week"), "2027-01-12"));
ok(() => assert.equal(addInterval("2026-01-31", 1, "month"), "2026-02-28"));
ok(() => assert.equal(addInterval("2027-11-30", 3, "month"), "2028-02-29"));
ok(() => assert.equal(addInterval("2026-03-15", 12, "month"), "2027-03-15"));
const plan = { next_on: "2026-11-20", every: 1, unit: "week", ends_on: "2026-12-10", status: "active" };
ok(() => assert.deepEqual(visitDays(plan, "2026-11-15", "2026-12-31"), ["2026-11-20", "2026-11-27", "2026-12-04"]));
ok(() => assert.deepEqual(visitDays(plan, "2026-11-25", "2026-11-30"), ["2026-11-27"]));
ok(() => assert.deepEqual(visitDays({ ...plan, status: "paused" }, "2026-11-15", "2026-12-31"), []));
// Recurring value: weekly by 52/12, every 3 months by a third.
ok(() => assert.equal(monthlyValue({ total: 120, every: 1, unit: "week", status: "active" }), 520));
ok(() => assert.equal(monthlyValue({ total: 300, every: 3, unit: "month", status: "active" }), 100));
ok(() => assert.equal(monthlyValue({ total: 300, every: 3, unit: "month", status: "paused" }), 0));
// The owner's plan: a name, a priced line, how often, a first visit.
ok(() => assert.equal(cleanPlan({ name: "", items: [{ name: "Visit", qty: 1, price: 80 }], every: 1, unit: "week", next_on: "2026-11-20" }).ok, false));
ok(() => assert.equal(cleanPlan({ name: "Pool", items: [{ name: "Visit", qty: 1, price: 0 }], every: 1, unit: "week", next_on: "2026-11-20" }).ok, false));
ok(() => assert.equal(cleanPlan({ name: "Pool", items: [{ name: "Visit", qty: 1, price: 80 }], every: 0, unit: "week", next_on: "2026-11-20" }).ok, false));
ok(() => assert.equal(cleanPlan({ name: "Pool", items: [{ name: "Visit", qty: 1, price: 80 }], every: 1, unit: "week", next_on: "2026-11-20", ends_on: "2026-11-01" }).ok, false));
ok(() => { const p = cleanPlan({ name: " Weekly pool ", items: [{ name: "Visit", qty: 1, price: 80, tier: "Good" }], tax_rate: 10, every: "2", unit: "week", next_on: "2026-11-20", time: "09:30", crew_member: "(720) 555-0188", remind: false });
  assert.equal(p.ok, true); assert.equal(p.plan.name, "Weekly pool"); assert.equal(p.plan.total, 88); assert.equal(p.plan.every, 2); assert.equal(p.plan.time, "09:30");
  assert.equal(p.plan.crew_member, "+17205550188"); assert.equal(p.plan.remind, false); assert.equal(p.plan.invoice, true); assert.equal(p.plan.items[0].tier, undefined); });
ok(() => assert.equal(cleanPlan({ name: "x", items: [{ name: "v", qty: 1, price: 5 }], every: 1, unit: "month", next_on: "2026-11-20", time: "25:00" }).plan.time, null));
ok(() => assert.equal(visitReminderText({ first: "Dana", business: "Ridgeline Fence Co.", plan: "Seasonal Fence Wash", time: "09:00" }), "Hi Dana, it's Ridgeline Fence Co. Reminder: your seasonal fence wash visit is tomorrow at 9 AM. Reply here if you need to move it."));
ok(() => assert.ok(visitReminderText({ first: "", business: "", plan: "Pool", time: "14:30" }).includes("at 2:30 PM")));
// Change orders.
ok(() => assert.equal(cleanChangeOrder({ title: "", items: [{ name: "Gate", qty: 1, price: 760 }] }).ok, false));
ok(() => assert.equal(cleanChangeOrder({ title: "Gate", items: [] }).ok, false));
ok(() => { const c = cleanChangeOrder({ title: "Second gate", items: [{ name: "Gate", qty: 1, price: 760, opt: true }, { name: "Post", qty: 1, price: 140 }], tax_rate: 0 }); assert.equal(c.total, 900); assert.equal(c.items[0].opt, undefined); });
ok(() => assert.equal(changeOrderLines({ number: 2, items: [{ name: "Gate", qty: 1, unit: "", price: 760 }] })[0].name, "Change order #2: Gate"));
ok(() => assert.equal(approvedExtra([{ status: "approved", total: 900 }, { status: "sent", total: 300 }, { status: "approved", total: 100 }]), 1000));
ok(() => assert.ok(changeOrderText({ first: "Carla", business: "Ridgeline Fence Co.", number: 1, title: "Second gate", total: 900, url: "https://x/c/t" }).startsWith("Hi Carla, it's Ridgeline Fence Co. Here's change order #1 (Second gate) for $900.")));
// Crew hours: minutes, the 16-hour cap, labor at each person's rate.
const t0 = Date.parse("2026-11-15T08:00:00Z");
ok(() => assert.equal(minutesOf({ started_at: "2026-11-15T08:00:00Z", ended_at: "2026-11-15T10:30:00Z" }), 150));
ok(() => assert.equal(minutesOf({ started_at: "2026-11-15T08:00:00Z", ended_at: null }, t0 + 45 * 60000), 45));
ok(() => assert.equal(minutesOf({ started_at: "2026-11-14T08:00:00Z", ended_at: null }, t0), 960));
ok(() => assert.equal(minutesOf({ started_at: "2026-11-15T10:00:00Z", ended_at: "2026-11-15T09:00:00Z" }), 0));
ok(() => assert.equal(hoursText(150), "2h 30m")); ok(() => assert.equal(hoursText(45), "45m")); ok(() => assert.equal(hoursText(120), "2h"));
ok(() => { const team = parseTeam([{ name: "Luis", cell: "720-555-0188", role: "crew", rate: "28" }, { name: "Ana", cell: "7205550199", rate: 900 }]);
  assert.equal(team[0].rate, 28); assert.equal(team[1].rate, undefined);
  const r = laborOf([{ member: "+17205550188", started_at: "2026-11-15T08:00:00Z", ended_at: "2026-11-15T12:00:00Z" }, { member: "", started_at: "2026-11-15T08:00:00Z", ended_at: "2026-11-15T10:00:00Z" }, { member: "+17205550199", started_at: "2026-11-15T08:00:00Z", ended_at: "2026-11-15T09:00:00Z" }], ratesOf(team), 45);
  assert.deepEqual(r, { minutes: 420, cost: 4 * 28 + 2 * 45 + 45 }); });
console.log(`service: ${n} checks passed`);
