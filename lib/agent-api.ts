// The agent API: a narrow, read-mostly door into the command center for an outside agent (Grok Bot today,
// possibly Claude later). The agent prepares; Sam decides and sends. Nothing here sends a message, changes a deal,
// or touches the client app. Pure helpers only (no I/O), so the rules are unit tested.
import { createHash, timingSafeEqual } from "node:crypto";

/** Who wrote a brief or draft. Kept on the row so agent work never passes for Sam's own. */
export const AGENT_AUTHOR = "grok";
/** Requests per hour, all routes together. A runaway routine hits this, not the database. */
export const AGENT_HOURLY_LIMIT = 600;
const MIN_KEY = 32;

/** Sam works in Mountain time; "today" and a date's range mean his day. */
export const AGENT_TZ = "America/Denver";
export const todayIn = (tz = AGENT_TZ, d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Start and end of a local day as ISO instants, using the zone's offset at noon that day (right across DST). */
export function dayRange(date: string, tz = AGENT_TZ): { start: string; end: string } {
  const noon = new Date(date + "T12:00:00Z");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(noon).map(p => [p.type, p.value]));
  const localNoon = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const offsetMs = localNoon - noon.getTime();
  const start = new Date(Date.parse(date + "T00:00:00Z") - offsetMs);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export type AuthResult = { ok: true; owner: string } | { ok: false; status: 401 | 503; error: string };

/** Bearer check against AGENT_API_KEY, constant time. The owner is fixed by env; a caller can never pick one. */
export function agentAuth(header: string | null, env: Record<string, string | undefined>): AuthResult {
  const key = env.AGENT_API_KEY?.trim() ?? "";
  const owner = (env.AGENT_OWNER_ID || env.HERMES_BRIDGE_OWNER_ID || env.CINDER_OWNER_ID || "").trim();
  if (!env.DATABASE_URL || key.length < MIN_KEY || !owner) return { ok: false, status: 503, error: "The agent API isn't configured." };
  const a = createHash("sha256").update(header ?? "").digest();
  const b = createHash("sha256").update(`Bearer ${key}`).digest();
  if (!timingSafeEqual(a, b)) return { ok: false, status: 401, error: "Unauthorized." };
  return { ok: true, owner };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** A YYYY-MM-DD that is a real date, or the fallback. */
export function dateParam(v: string | null, fallback: string): string | null {
  if (!v) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T12:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const httpUrl = (v: unknown) => {
  const s = str(v, 2000);
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : ""; } catch { return ""; }
};

export type Fact = { fact: string; source: string; checkedAt: string };
export type Brief = {
  contactId: string; type: "call_brief" | "meeting_brief"; title: string; summary: string;
  facts: Fact[]; guesses: string[]; leadChannels: string[]; angle: string; doNotClaim: string[];
  confidence: "low" | "medium" | "high"; calendarEventId: string | null;
};

export const LEAD_CHANNELS = ["website_form", "phone_only", "chat", "online_booking", "text_us", "facebook_ads", "google_ads", "google_lsa", "angi", "thumbtack", "homeadvisor", "facebook_page", "instagram", "none_found"] as const;

/**
 * Validates a brief. The rule that matters: a verified fact must carry a source URL and the date it was checked.
 * A "fact" without one is moved to guesses, never stored as verified. Ten facts and ten guesses at most.
 */
export function parseBrief(body: unknown, today: string): { brief: Brief; moved: number } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  if (!isUuid(b.contactId)) return { error: "contactId must be a contact's id." };
  const type = b.type === "meeting_brief" ? "meeting_brief" : b.type === undefined || b.type === "call_brief" ? "call_brief" : null;
  if (!type) return { error: "type is call_brief or meeting_brief." };
  const summary = str(b.summary, 1200);
  if (!summary) return { error: "summary is required: what matters about this business in a few sentences." };
  const angle = str(b.angle, 600);
  if (!angle) return { error: "angle is required: what to pitch on the call and why." };
  let moved = 0;
  const facts: Fact[] = [];
  const guesses: string[] = [];
  for (const f of Array.isArray(b.facts) ? b.facts.slice(0, 20) : []) {
    const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
    const fact = str(o.fact, 400);
    if (!fact) continue;
    const source = httpUrl(o.source);
    const checked = typeof o.checkedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.checkedAt) ? o.checkedAt.slice(0, 10) : "";
    if (!source || !checked || checked > today) { guesses.push(fact); moved++; continue; }
    if (facts.length < 10) facts.push({ fact, source, checkedAt: checked });
  }
  for (const g of Array.isArray(b.guesses) ? b.guesses : []) { const s = str(g, 400); if (s) guesses.push(s); }
  const channels = (Array.isArray(b.leadChannels) ? b.leadChannels : []).filter((c): c is string => (LEAD_CHANNELS as readonly string[]).includes(String(c)));
  const doNot = (Array.isArray(b.doNotClaim) ? b.doNotClaim : []).map(x => str(x, 300)).filter(Boolean).slice(0, 8);
  const confidence = b.confidence === "high" || b.confidence === "low" ? b.confidence : "medium";
  const calendarEventId = b.calendarEventId === undefined || b.calendarEventId === null ? null : isUuid(b.calendarEventId) ? b.calendarEventId : undefined;
  if (calendarEventId === undefined) return { error: "calendarEventId must be a meeting's id." };
  if (type === "meeting_brief" && !calendarEventId) return { error: "A meeting brief needs calendarEventId." };
  const title = str(b.title, 200) || (type === "meeting_brief" ? "Meeting brief" : "Scout brief");
  return { brief: { contactId: b.contactId, type, title, summary, facts, guesses: guesses.slice(0, 10), leadChannels: [...new Set(channels)], angle, doNotClaim: doNot, confidence, calendarEventId }, moved };
}

const CHANNEL_LABEL: Record<string, string> = {
  website_form: "Website form", phone_only: "Phone only", chat: "Website chat", online_booking: "Online booking", text_us: "Text us",
  facebook_ads: "Running Facebook ads", google_ads: "Running Google ads", google_lsa: "Google Local Services", angi: "Angi", thumbtack: "Thumbtack",
  homeadvisor: "HomeAdvisor", facebook_page: "Facebook page", instagram: "Instagram", none_found: "No lead channel found",
};

/** The brief as the markdown the command center already renders, sections in call order. */
export function briefMarkdown(b: Brief): string {
  const out = [`## Summary\n${b.summary}`, `## Angle\n${b.angle}`];
  if (b.leadChannels.length) out.push(`## How leads reach them\n${b.leadChannels.map(c => `- ${CHANNEL_LABEL[c] ?? c}`).join("\n")}`);
  if (b.doNotClaim.length) out.push(`## Don't claim\n${b.doNotClaim.map(s => `- ${s}`).join("\n")}`);
  if (b.facts.length) out.push(`## Verified\n${b.facts.map(f => `- ${f.fact} ([source](${f.source}), checked ${f.checkedAt})`).join("\n")}`);
  if (b.guesses.length) out.push(`## Not verified\n${b.guesses.map(s => `- ${s}`).join("\n")}`);
  return out.join("\n\n");
}

export type Run = { agent: string; task: string; status: "succeeded" | "failed"; summary: string; counts: Record<string, number> };

/** A routine's record of one run: who, what, how it went, and its counts, so a quiet night with zero done stands out. */
export function parseRun(body: unknown): { run: Run } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const agent = str(b.agent, 60);
  if (!agent) return { error: "agent is required, e.g. Scout." };
  const task = str(b.task, 200) || "Routine run";
  const status = b.status === "failed" ? "failed" : b.status === undefined || b.status === "succeeded" ? "succeeded" : null;
  if (!status) return { error: "status is succeeded or failed." };
  const counts: Record<string, number> = {};
  const c = (b.counts && typeof b.counts === "object" && !Array.isArray(b.counts) ? b.counts : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(c).slice(0, 12)) {
    const n = Number(v);
    if (/^[a-z_]{1,30}$/i.test(k) && Number.isFinite(n) && n >= 0) counts[k] = Math.floor(n);
  }
  return { run: { agent, task, status, summary: str(b.summary, 1000), counts } };
}

/** Webhook to wake a Grok routine: https only, with its key, or nothing. */
export function webhookTarget(url: string | undefined, key: string | undefined): { url: string; key: string } | null {
  const u = (url ?? "").trim(); const k = (key ?? "").trim();
  if (!u || !k) return null;
  try { return new URL(u).protocol === "https:" ? { url: u, key: k } : null; } catch { return null; }
}

export type Draft = { contactId: string; channel: "text" | "email"; subject: string; body: string; reason: string };

/** A draft for Sam to send himself. Texts stay short; emails need a subject. No links except Sam's own domains. */
export function parseDraft(body: unknown): { draft: Draft } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  if (!isUuid(b.contactId)) return { error: "contactId must be a contact's id." };
  const channel = b.channel === "email" ? "email" : b.channel === undefined || b.channel === "text" ? "text" : null;
  if (!channel) return { error: "channel is text or email." };
  const text = str(b.body, channel === "text" ? 480 : 4000);
  if (!text) return { error: "body is required." };
  const subject = str(b.subject, 160);
  if (channel === "email" && !subject) return { error: "An email draft needs a subject." };
  const links = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  const foreign = links.find(l => { try { return !/(^|\.)(cinderrevenue\.com|cal\.com)$/i.test(new URL(l).hostname); } catch { return true; } });
  if (foreign) return { error: `Drafts can only link to cinderrevenue.com or cal.com, not ${foreign.slice(0, 80)}.` };
  const reason = str(b.reason, 140) || (channel === "email" ? "Email drafted by Grok" : "Text drafted by Grok");
  return { draft: { contactId: b.contactId, channel, subject: channel === "email" ? subject : "", body: text, reason } };
}

/** The OpenAPI description the agent reads to discover what it can do. */
export function openApi(baseUrl: string) {
  const id = { type: "string", format: "uuid" };
  const date = { name: "date", in: "query", required: false, schema: { type: "string", format: "date" }, description: "YYYY-MM-DD in Mountain time. Defaults to today." };
  const ok = (description: string) => ({ "200": { description }, "401": { description: "Bad or missing key" }, "429": { description: "Over the hourly limit" } });
  return {
    openapi: "3.1.0",
    info: {
      title: "Cinder command center: agent API", version: "1.0.0",
      description: "Read Sam's call list, prospects and meetings; write research briefs and message drafts for Sam to review. Nothing here sends a message or changes a deal. Auth: Authorization: Bearer <AGENT_API_KEY>.",
    },
    servers: [{ url: baseUrl }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    security: [{ bearer: [] }],
    paths: {
      "/api/agent/call-list": { get: { summary: "Prospects to call on a date, ranked as Sam's call mode ranks them", parameters: [date], responses: ok("{ date, prospects: [{ id, business, phone, website, location, why, hasAudit, hasScoutBrief }] }") } },
      "/api/agent/prospect": { get: { summary: "One prospect: details, the last 25 activities, existing research", parameters: [{ name: "id", in: "query", required: true, schema: id }], responses: ok("{ prospect, activities, research }") } },
      "/api/agent/meetings": { get: { summary: "Booked meetings on a date, with the prospect", parameters: [date], responses: ok("{ date, meetings: [{ id, title, startsAt, endsAt, prospectId, business, phone, website, hasBrief }] }") } },
      "/api/agent/brief": { post: {
        summary: "Save a research brief on a prospect (call_brief) or for a meeting (meeting_brief). One per prospect per type per day; a second call the same day replaces it.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["contactId", "summary", "angle"], properties: {
          contactId: id, type: { enum: ["call_brief", "meeting_brief"] }, calendarEventId: id, title: { type: "string" },
          summary: { type: "string", description: "What matters about this business, 2 to 4 sentences" },
          angle: { type: "string", description: "What to pitch on the call and why, tied to evidence" },
          leadChannels: { type: "array", items: { enum: [...LEAD_CHANNELS] } },
          facts: { type: "array", items: { type: "object", required: ["fact", "source", "checkedAt"], properties: { fact: { type: "string" }, source: { type: "string", format: "uri" }, checkedAt: { type: "string", format: "date" } } }, description: "Only what you saw on a page. Facts without a source and date are stored as guesses." },
          guesses: { type: "array", items: { type: "string" } },
          doNotClaim: { type: "array", items: { type: "string" }, description: "Things Sam must not say, e.g. 'Their site does show install photos'" },
          confidence: { enum: ["low", "medium", "high"] },
        } } } } },
        responses: ok("{ id, replaced, movedToGuesses }"),
      } },
      "/api/agent/my-texts": { get: { summary: "Sam's last texts to prospects, newest first, for his style profile", parameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 5, maximum: 100 } }], responses: ok("{ texts: [{ text, at }] }") } },
      "/api/agent/runs": { post: { summary: "Record one routine run (agent, task, status, summary, counts). Failed runs show on Sam's Today.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["agent"], properties: { agent: { type: "string" }, task: { type: "string" }, status: { enum: ["succeeded", "failed"] }, summary: { type: "string" }, counts: { type: "object" } } } } } }, responses: ok("{ id }") } },
      "/api/agent/drafts": { post: {
        summary: "Save a text or email draft for Sam to review and send himself. One open agent draft per prospect; a new one replaces it.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["contactId", "body"], properties: {
          contactId: id, channel: { enum: ["text", "email"] }, subject: { type: "string" }, body: { type: "string", description: "Texts up to 480 characters. Links only to cinderrevenue.com or cal.com." },
          reason: { type: "string", description: "One line shown above the draft, e.g. 'Meeting reminder for 4pm'" },
        } } } } },
        responses: ok("{ id }"),
      } },
    },
  };
}

// ---------- MCP ----------
// The same API as a remote MCP server (Streamable HTTP, JSON responses, stateless). Grok Bot discovers these tools
// when given the URL and the bearer header. The route maps each tool call to the matching REST handler.

export const MCP_PROTOCOL = "2025-06-18";
const SUPPORTED = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);

const uuid = { type: "string", description: "A uuid from this API" };
const date = { type: "string", description: "YYYY-MM-DD, Mountain time. Defaults to today." };

export type ToolCall = { method: "GET" | "POST"; path: string; query?: Record<string, string>; body?: unknown };

export const TOOLS = [
  {
    name: "get_call_list", title: "Sam's call list",
    description: "Prospects Sam's call mode will put in front of him on a date, in order, with whether each already has research. Use the night before to pick who to research.",
    inputSchema: { type: "object", properties: { date, limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 30" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_prospect", title: "One prospect",
    description: "A prospect's details, the last 25 calls, texts and notes, and research already on file. Read this before researching so you don't repeat what's known.",
    inputSchema: { type: "object", required: ["id"], properties: { id: uuid } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_meetings", title: "Sam's meetings",
    description: "Booked meetings and calls on a date, with the prospect's id, phone and website, and whether a brief exists.",
    inputSchema: { type: "object", properties: { date } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "save_brief", title: "Save a research brief",
    description: "Save research on a prospect (call_brief) or for a meeting (meeting_brief, needs calendarEventId). Sam reviews it; it never goes to the prospect. Only put something in facts if you saw it on a page: give that page's URL and today's date. Anything else goes in guesses. A second brief the same day replaces the first.",
    inputSchema: { type: "object", required: ["contactId", "summary", "angle"], properties: {
      contactId: uuid, type: { type: "string", enum: ["call_brief", "meeting_brief"] }, calendarEventId: uuid, title: { type: "string" },
      summary: { type: "string", description: "What matters about this business, 2 to 4 sentences" },
      angle: { type: "string", description: "What Sam should pitch and why, tied to what you found" },
      leadChannels: { type: "array", items: { type: "string", enum: [...LEAD_CHANNELS] } },
      facts: { type: "array", items: { type: "object", required: ["fact", "source", "checkedAt"], properties: { fact: { type: "string" }, source: { type: "string", description: "https URL of the page that shows it" }, checkedAt: { type: "string", description: "YYYY-MM-DD" } } } },
      guesses: { type: "array", items: { type: "string" } },
      doNotClaim: { type: "array", items: { type: "string" }, description: "Things Sam must not say because they're false or unproven" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "save_draft", title: "Save a message draft",
    description: "Save a text or email for Sam to review and send himself. Nothing is sent. Texts up to 480 characters; links only to cinderrevenue.com or cal.com. One open draft per prospect; a new one replaces it.",
    inputSchema: { type: "object", required: ["contactId", "body"], properties: {
      contactId: uuid, channel: { type: "string", enum: ["text", "email"] }, subject: { type: "string", description: "Required for email" },
      body: { type: "string" }, reason: { type: "string", description: "One line Sam sees above the draft" },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "get_my_texts", title: "Sam's recent texts",
    description: "The last texts Sam sent prospects (newest first), to learn how he writes: length, greeting, sign-off, tone. Use these to build or refresh his style profile; never copy a text to someone else.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 5, maximum: 100, description: "Default 50" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "log_run", title: "Record a routine run",
    description: "Call once at the end of every routine run: which Bot, what it did, succeeded or failed, a one-line summary and counts (e.g. researched, skipped, failed). A failed run shows up on Sam's Today. Always log, even when there was nothing to do.",
    inputSchema: { type: "object", required: ["agent"], properties: {
      agent: { type: "string", description: "Scout, Prep, Closer or Coach" }, task: { type: "string" }, status: { type: "string", enum: ["succeeded", "failed"] },
      summary: { type: "string" }, counts: { type: "object", additionalProperties: { type: "integer" } },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
] as const;

const s = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

/** Which REST call a tool maps to. Null for an unknown tool. */
export function toolCall(name: string, args: Record<string, unknown>): ToolCall | null {
  switch (name) {
    case "get_call_list": return { method: "GET", path: "/api/agent/call-list", query: { ...(args.date ? { date: s(args.date) } : {}), ...(args.limit ? { limit: s(args.limit) } : {}) } };
    case "get_prospect": return { method: "GET", path: "/api/agent/prospect", query: { id: s(args.id) } };
    case "get_meetings": return { method: "GET", path: "/api/agent/meetings", query: args.date ? { date: s(args.date) } : {} };
    case "save_brief": return { method: "POST", path: "/api/agent/brief", body: args };
    case "save_draft": return { method: "POST", path: "/api/agent/drafts", body: args };
    case "get_my_texts": return { method: "GET", path: "/api/agent/my-texts", query: args.limit ? { limit: s(args.limit) } : {} };
    case "log_run": return { method: "POST", path: "/api/agent/runs", body: args };
    default: return null;
  }
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
export const rpcError = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export const INSTRUCTIONS = "Cinder's command center. You prepare, Sam decides and sends: read his call list, prospects and meetings, and save research briefs and message drafts for him to review. Nothing here contacts anyone. In briefs, keep what you saw on a page (with its URL and date) apart from what you infer.";

/** Answers the protocol methods that need no I/O. Returns "call" when the route has to run a tool. */
export function handleRpc(msg: Rpc): { reply: unknown } | { notify: true } | { call: { id: Rpc["id"]; name: string; args: Record<string, unknown> } } {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return { reply: rpcError(msg?.id, -32600, "Invalid request") };
  if (msg.id === undefined) return { notify: true };
  switch (msg.method) {
    case "initialize": {
      const asked = s(msg.params?.protocolVersion);
      return { reply: { jsonrpc: "2.0", id: msg.id, result: {
        protocolVersion: SUPPORTED.has(asked) ? asked : MCP_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "cinder-command-center", title: "Cinder command center", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      } } };
    }
    case "ping": return { reply: { jsonrpc: "2.0", id: msg.id, result: {} } };
    case "tools/list": return { reply: { jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } } };
    case "tools/call": {
      const name = s(msg.params?.name);
      const args = (msg.params?.arguments && typeof msg.params.arguments === "object" ? msg.params.arguments : {}) as Record<string, unknown>;
      if (!toolCall(name, args)) return { reply: rpcError(msg.id, -32602, `Unknown tool: ${name.slice(0, 60)}`) };
      return { call: { id: msg.id, name, args } };
    }
    default: return { reply: rpcError(msg.id, -32601, `Method not found: ${msg.method.slice(0, 60)}`) };
  }
}
