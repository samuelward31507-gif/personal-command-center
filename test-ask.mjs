// Regression tests for Ask Cinder (the Home AI search bar).
// Run with: node --experimental-strip-types test-ask.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAction, resolveLink, buildSystemPrompt, ASK_TOOLS, ASK_STAGES, ASK_TIERS, ACTION_KINDS } from "./lib/ask.ts";
import { DEAL_STAGES, OFFERS } from "./lib/offers.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const id = "3baafaf6-d182-463a-98c9-5272c063cb73";

// Stays in sync with the shared catalog
ok(() => assert.deepEqual([...ASK_STAGES], [...DEAL_STAGES]));
ok(() => assert.deepEqual(ASK_TIERS.tier1, OFFERS.tier1));
ok(() => assert.deepEqual(ASK_TIERS.tier2, OFFERS.tier2));

// Action validation
ok(() => assert.equal(typeof validateAction({ kind: "delete_contact", params: {} }), "string", "no delete action exists"));
ok(() => assert.ok(!ACTION_KINDS.some(k => /delete|send|sms|text|call|pay/i.test(k)), "no destructive, messaging or payment actions"));
ok(() => assert.equal(typeof validateAction({ kind: "set_follow_up", params: { contactId: "nope", date: "2026-11-02" } }), "string"));
ok(() => assert.equal(typeof validateAction({ kind: "set_follow_up", params: { contactId: id, date: "2026-02-30" } }), "string", "impossible dates rejected"));
ok(() => assert.deepEqual(validateAction({ kind: "set_follow_up", label: "Friday", params: { contactId: id, date: "2026-10-30" } }).params, { contactId: id, date: "2026-10-30" }));
ok(() => {
  const a = validateAction({ kind: "create_deal", params: { title: "Able Pool — Tier 2", contactId: id, tier: "tier2" } });
  assert.equal(a.params.setupFee, 3000); assert.equal(a.params.monthlyFee, 1500); assert.equal(a.params.serviceType, "tier2_revenue_system"); assert.equal(a.params.stage, "new");
});
ok(() => assert.equal(typeof validateAction({ kind: "create_deal", params: { title: "x", stage: "won" } }), "string", "deals can't be created already won"));
ok(() => assert.equal(typeof validateAction({ kind: "create_deal", params: { title: "x", setupFee: -5 } }), "string"));
ok(() => assert.equal(typeof validateAction({ kind: "move_deal", params: { dealId: id, stage: "lost" } }), "string", "lost needs a reason"));
ok(() => assert.equal(validateAction({ kind: "move_deal", params: { dealId: id, stage: "won" } }).params.stage, "won"));
ok(() => assert.equal(typeof validateAction({ kind: "create_contact", params: {} }), "string"));
ok(() => assert.equal(validateAction({ kind: "create_contact", params: { company: "Blue Fence" } }).params.status, "lead"));
ok(() => assert.equal(typeof validateAction({ kind: "schedule_event", params: { title: "Call", startsAt: "tomorrow" } }), "string"));
ok(() => assert.equal(validateAction({ kind: "schedule_event", params: { title: "Call", startsAt: "2026-10-30T10:00:00-06:00" } }).params.startsAt, "2026-10-30T16:00:00.000Z"));
ok(() => assert.equal(validateAction({ kind: "create_task", params: { title: "x".repeat(500) } }).params.title.length, 240));

// Links
ok(() => assert.equal(resolveLink(`cinder://contact/${id}`), "/crm?contact=" + id));
ok(() => assert.equal(resolveLink("javascript:alert(1)"), null));
ok(() => assert.equal(resolveLink("//evil.com"), null));
ok(() => assert.equal(resolveLink("/crm/pipeline"), "/crm/pipeline"));

// Prompt guardrails
const prompt = buildSystemPrompt({ today: "2026-10-29", now: "Thursday 9:00 AM", timeZone: "America/Denver", weekday: "Thursday" });
ok(() => assert.match(prompt, /never send emails\/texts, place calls/i));
ok(() => assert.match(prompt, /Do not write SMS/i));
ok(() => assert.match(prompt, /Never mark money as paid/i));
ok(() => assert.match(prompt, /Never delete/i));
ok(() => assert.ok(ASK_TOOLS.some(t => t.name === "propose_action")));

// Server code guards
const data = readFileSync("lib/ask-data.ts", "utf8");
const exec = readFileSync("app/api/ask/execute/route.ts", "utf8");
const route = readFileSync("app/api/ask/route.ts", "utf8");
ok(() => assert.doesNotMatch(data, /\b(INSERT|UPDATE|DELETE)\b/, "read tools never write"));
ok(() => assert.doesNotMatch(exec, /\bDELETE\b/, "execute never deletes"));
ok(() => assert.doesNotMatch(exec, /status\s*=\s*'paid'|'paid'/, "execute never marks money paid"));
ok(() => assert.match(exec, /validateAction\(/, "execute re-validates"));
ok(() => assert.ok((exec.match(/owner_id = \$\{owner\}|\(\$\{owner\},/g) || []).length >= 9, "execute is owner-scoped"));
ok(() => assert.match(route, /if \(!user\) return fail\("Unauthorized", 401\)/));
ok(() => assert.match(exec, /if \(!user\) return fail\("Unauthorized", 401\)/));
ok(() => assert.doesNotMatch(route + exec + data, /twilio|n8n|sendSms|resend/i));

ok(() => assert.match(route, /thinking_delta/) && assert.match(route, /signature_delta/), "streamed thinking blocks are rebuilt for tool-result replays");
console.log(`Ask Cinder regression checks passed (${n} assertions).`);
