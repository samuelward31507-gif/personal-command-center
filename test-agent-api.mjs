// Tests for the agent API's rules (auth, briefs, drafts). Run: node --experimental-strip-types --no-warnings test-agent-api.mjs
import assert from "node:assert/strict";
import { agentAuth, parseBrief, parseDraft, briefMarkdown, dateParam, openApi, isUuid, dayRange } from "./lib/agent-api.ts";


let n = 0;
const ok = fn => { fn(); n++; };
const KEY = "k".repeat(40);
const env = { DATABASE_URL: "postgres://x", AGENT_API_KEY: KEY, CINDER_OWNER_ID: "owner-1" };
const C = "f38d8a0b-c29f-4869-bb29-fe74385dc131";
const today = "2026-11-17";

// Auth
ok(() => assert.deepEqual(agentAuth(`Bearer ${KEY}`, env), { ok: true, owner: "owner-1" }));
ok(() => assert.equal(agentAuth(`Bearer ${KEY}x`, env).ok, false));
ok(() => assert.equal(agentAuth(null, env).status, 401));
ok(() => assert.equal(agentAuth(`Bearer ${KEY}`, { ...env, AGENT_API_KEY: "short" }).status, 503));
ok(() => assert.equal(agentAuth(`Bearer ${KEY}`, { ...env, CINDER_OWNER_ID: "" }).status, 503));
ok(() => assert.equal(agentAuth(`Bearer ${KEY}`, { ...env, AGENT_OWNER_ID: "owner-2" }).owner, "owner-2"));
ok(() => assert.equal(agentAuth(`Bearer ${KEY}`, { ...env, DATABASE_URL: "" }).status, 503));

// Dates and ids
ok(() => assert.equal(dateParam(null, today), today));
ok(() => assert.equal(dateParam("2026-02-30", today), null));
ok(() => assert.equal(dateParam("11/17/2026", today), null));
ok(() => assert.equal(dateParam("2026-11-18", today), "2026-11-18"));
ok(() => assert.equal(isUuid(C), true));
ok(() => assert.equal(isUuid("1; DROP"), false));

// Briefs: a fact without a source or a date becomes a guess, never verified
const brief = { contactId: C, summary: "Two-truck fence shop in Tucson.", angle: "Phone only, no form: pitch missed calls while installing.",
  facts: [
    { fact: "Site has no contact form", source: "https://example.com/contact", checkedAt: today },
    { fact: "Runs Facebook ads", source: "", checkedAt: today },
    { fact: "48 Google reviews", source: "https://maps.google.com/x", checkedAt: "2026-12-01" },
    { fact: "Bad", source: "javascript:alert(1)", checkedAt: today },
  ],
  leadChannels: ["phone_only", "made_up", "phone_only"], doNotClaim: ["Their site shows install photos"] };
ok(() => {
  const r = parseBrief(brief, today);
  assert.ok("brief" in r);
  assert.equal(r.brief.facts.length, 1);
  assert.equal(r.moved, 3);
  assert.deepEqual(r.brief.guesses, ["Runs Facebook ads", "48 Google reviews", "Bad"]);
  assert.deepEqual(r.brief.leadChannels, ["phone_only"]);
  assert.equal(r.brief.type, "call_brief");
  assert.equal(r.brief.calendarEventId, null);
});
ok(() => assert.ok("error" in parseBrief({ ...brief, contactId: "nope" }, today)));
ok(() => assert.ok("error" in parseBrief({ ...brief, summary: "" }, today)));
ok(() => assert.ok("error" in parseBrief({ ...brief, angle: " " }, today)));
ok(() => assert.ok("error" in parseBrief({ ...brief, type: "meeting_brief" }, today)));
ok(() => assert.ok("error" in parseBrief({ ...brief, type: "proposal" }, today)));
ok(() => assert.ok("error" in parseBrief({ ...brief, calendarEventId: "x" }, today)));
ok(() => assert.equal(parseBrief({ ...brief, type: "meeting_brief", calendarEventId: C }, today).brief.type, "meeting_brief"));
ok(() => {
  const md = briefMarkdown(parseBrief(brief, today).brief);
  assert.match(md, /^## Summary\n/);
  assert.match(md, /## How leads reach them\n- Phone only/);
  assert.match(md, /## Don't claim\n- Their site shows install photos/);
  assert.match(md, /- Site has no contact form \(\[source\]\(https:\/\/example\.com\/contact\), checked 2026-11-17\)/);
  assert.match(md, /## Not verified\n- Runs Facebook ads/);
});

// Drafts
ok(() => assert.deepEqual(parseDraft({ contactId: C, body: "Still good for 4pm? Link: https://app.cal.com/video/abc" }).draft.channel, "text"));
ok(() => assert.ok("error" in parseDraft({ contactId: C, body: "See https://bit.ly/x" })));
ok(() => assert.ok("error" in parseDraft({ contactId: C, channel: "email", body: "Hi" })));
ok(() => assert.equal(parseDraft({ contactId: C, channel: "email", subject: "Tuesday", body: "Hi" }).draft.subject, "Tuesday"));
ok(() => assert.equal(parseDraft({ contactId: C, body: "x".repeat(900) }).draft.body.length, 480));
ok(() => assert.ok("error" in parseDraft({ contactId: C, channel: "dm", body: "Hi" })));
ok(() => assert.equal(parseDraft({ contactId: C, body: "See cinderrevenue.com/try?b=X https://cinderrevenue.com/try" }).draft.reason, "Text drafted by Grok"));

// Day range in Mountain time, across DST
ok(() => assert.deepEqual(dayRange("2026-11-17"), { start: "2026-11-17T07:00:00.000Z", end: "2026-11-18T07:00:00.000Z" }));
ok(() => assert.deepEqual(dayRange("2026-07-04"), { start: "2026-07-04T06:00:00.000Z", end: "2026-07-05T06:00:00.000Z" }));

// The OpenAPI lists every route
ok(() => assert.deepEqual(Object.keys(openApi("https://x").paths).sort(), ["/api/agent/brief", "/api/agent/call-list", "/api/agent/drafts", "/api/agent/meetings", "/api/agent/my-texts", "/api/agent/prospect", "/api/agent/runs"]));

console.log(`agent api: ${n} checks passed`);

// MCP: protocol answers and tool mapping
const { handleRpc, toolCall, TOOLS } = await import("./lib/agent-api.ts");
let m = 0; const mk = fn => { fn(); m++; };
mk(() => assert.equal(handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }).reply.result.protocolVersion, "2025-03-26"));
mk(() => assert.equal(handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999" } }).reply.result.protocolVersion, "2025-06-18"));
mk(() => assert.deepEqual(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }), { notify: true }));
mk(() => assert.deepEqual(handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }).reply.result.tools.map(t => t.name), ["get_call_list", "get_prospect", "get_meetings", "save_brief", "save_draft", "get_my_texts", "log_run"]));
mk(() => assert.equal(handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "drop_tables", arguments: {} } }).reply.error.code, -32602));
mk(() => assert.deepEqual(handleRpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_prospect", arguments: { id: C } } }).call, { id: 4, name: "get_prospect", args: { id: C } }));
mk(() => assert.equal(handleRpc({ jsonrpc: "2.0", id: 5, method: "resources/list" }).reply.error.code, -32601));
mk(() => assert.equal(handleRpc({ id: 6, method: "ping" }).reply.error.code, -32600));
mk(() => assert.deepEqual(toolCall("get_call_list", { date: "2026-11-18", limit: 20 }), { method: "GET", path: "/api/agent/call-list", query: { date: "2026-11-18", limit: "20" } }));
mk(() => assert.equal(toolCall("save_draft", { contactId: C }).path, "/api/agent/drafts"));
mk(() => assert.ok(TOOLS.every(t => t.inputSchema.type === "object" && t.description.length > 40)));
console.log(`agent mcp: ${m} checks passed`);

// Runs and webhooks
const { parseRun, webhookTarget } = await import("./lib/agent-api.ts");
let w = 0; const wk = fn => { fn(); w++; };
wk(() => assert.deepEqual(parseRun({ agent: "Scout", counts: { researched: 12, skipped: 3, "bad key!": 4, failed: -1 } }).run, { agent: "Scout", task: "Routine run", status: "succeeded", summary: "", counts: { researched: 12, skipped: 3 } }));
wk(() => assert.ok("error" in parseRun({ status: "failed" })));
wk(() => assert.ok("error" in parseRun({ agent: "Scout", status: "maybe" })));
wk(() => assert.equal(parseRun({ agent: "Prep", status: "failed", summary: "Gmail signed out" }).run.status, "failed"));
wk(() => assert.equal(webhookTarget("http://x.com/hook", "k"), null));
wk(() => assert.equal(webhookTarget("https://x.com/hook", ""), null));
wk(() => assert.deepEqual(webhookTarget(" https://x.com/hook ", "k"), { url: "https://x.com/hook", key: "k" }));
wk(() => assert.deepEqual(toolCall("get_my_texts", {}), { method: "GET", path: "/api/agent/my-texts", query: {} }));
wk(() => assert.equal(toolCall("log_run", { agent: "Scout" }).path, "/api/agent/runs"));
wk(() => assert.equal(handleRpc({ jsonrpc: "2.0", id: 9, method: "tools/list" }).reply.result.tools.length, 7));
console.log(`agent runs and webhooks: ${w} checks passed`);
