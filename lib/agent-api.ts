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

/** The key from either header, forgiving about case, extra spaces and a missing "Bearer". */
export function extractKey(authorization: string | null, apiKeyHeader: string | null): string {
  const a = (authorization ?? "").trim();
  const m = /^bearer\s+(.+)$/i.exec(a);
  const k = (m ? m[1] : a || (apiKeyHeader ?? "")).trim();
  return k.replace(/^["']|["']$/g, "");
}

export const hashKey = (key: string) => createHash("sha256").update("cinder-agent:" + key).digest("hex");
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** A key made in Settings: "cnd_" and 48 hex characters. */
export const isKeyShape = (k: string) => /^cnd_[0-9a-f]{48}$/.test(k);

/**
 * The env key check, constant time. The owner is fixed by env; a caller can never pick one. Keys made in Settings
 * are checked against the database by the route (agentGuard), which calls this first.
 */
export function agentAuth(authorization: string | null, env: Record<string, string | undefined>, apiKeyHeader: string | null = null): AuthResult {
  const key = env.AGENT_API_KEY?.trim() ?? "";
  const owner = (env.AGENT_OWNER_ID || env.HERMES_BRIDGE_OWNER_ID || env.CINDER_OWNER_ID || "").trim();
  if (!env.DATABASE_URL || !owner) return { ok: false, status: 503, error: "The agent API isn't configured." };
  const supplied = extractKey(authorization, apiKeyHeader);
  if (!supplied) return { ok: false, status: 401, error: "Unauthorized. Send the key as Authorization: Bearer <key>." };
  if (key.length >= MIN_KEY && same(supplied, key)) return { ok: true, owner };
  return { ok: false, status: 401, error: "Unauthorized. The key doesn't match. Make a new one in Settings, Automations, Grok Bot." };
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

export const REPLY_CHANNELS = ["instagram", "facebook", "facebook_group", "linkedin", "email", "tiktok", "other"] as const;
export type Reply = { contactId: string | null; channel: (typeof REPLY_CHANNELS)[number]; from: string; text: string; url: string };

/** A prospect replied somewhere the command center can't see (a DM, a group comment). Logged on the contact and alerted. */
export function parseReply(body: unknown): { reply: Reply } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const contactId = b.contactId === undefined || b.contactId === null || b.contactId === "" ? null : isUuid(b.contactId) ? b.contactId : undefined;
  if (contactId === undefined) return { error: "contactId must be a contact's id, or left out for someone new." };
  const channel = (REPLY_CHANNELS as readonly string[]).includes(String(b.channel)) ? (b.channel as Reply["channel"]) : null;
  if (!channel) return { error: `channel is one of ${REPLY_CHANNELS.join(", ")}.` };
  const text = str(b.text, 2000);
  if (!text) return { error: "text is required: what they said." };
  const from = str(b.from, 160);
  if (!contactId && !from) return { error: "from is required when there's no contactId: their name or handle." };
  return { reply: { contactId, channel, from, text, url: httpUrl(b.url) } };
}

// Same mapping as nicheOf in lib/lead-finder.ts (kept here so this file stays import-free for the node tests).
type Niche = "Fence" | "Standby generators" | "";
const nicheOf = (t: string): Niche => /fenc/i.test(t) ? "Fence" : /generat|generac|kohler|standby/i.test(t) ? "Standby generators" : "";
export type NewProspect = { business: string; phone: string; website: string; location: string; owner: string; source: string; notes: string; niche: Niche };
/** The grade Lister wrote first in the notes ("Lead grade: A"), if any. */
export const gradeOf = (notes: string): "A" | "B" | "C" | "" => (/Lead grade:\s*([ABC])\b/i.exec(notes)?.[1]?.toUpperCase() ?? "") as "A" | "B" | "C" | "";
export const MAX_PROSPECTS_PER_CALL = 50;

/** Prospects found on public pages. A US phone is required (the call list needs one); duplicates in the batch are dropped. */
/**
 * A company hiring a receptionist or CSR gets more calls than it can answer and has budgeted a salary to fix it:
 * the strongest sign it needs a voice receptionist. It makes the prospect grade A ("Lead grade: A · Hiring: …").
 */
export function withHiring(notes: string, hiring: unknown): string {
  const h = (hiring && typeof hiring === "object" ? hiring : {}) as Record<string, unknown>;
  const role = str(h.role, 80);
  if (!role) return notes;
  const posted = /^\d{4}-\d{2}-\d{2}$/.test(str(h.posted, 10)) ? str(h.posted, 10) : "";
  const url = httpUrl(h.url);
  const rest = notes.replace(/Lead grade:\s*[ABC]\b\s*[·:-]?\s*/i, "").trim();
  return [`Lead grade: A · Hiring: ${role}${posted ? ` (posted ${posted})` : ""}${url ? ` ${url}` : ""}`, rest].filter(Boolean).join("\n").slice(0, 700);
}

export function parseProspects(body: unknown): { prospects: NewProspect[]; rejected: number } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const list = Array.isArray(b.prospects) ? b.prospects : null;
  if (!list || !list.length) return { error: "prospects is a list of { business, phone, website, location, owner, source }." };
  if (list.length > MAX_PROSPECTS_PER_CALL) return { error: `At most ${MAX_PROSPECTS_PER_CALL} prospects per call.` };
  const seen = new Set<string>(); const out: NewProspect[] = []; let rejected = 0;
  for (const raw of list) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const business = str(o.business, 200);
    const digits = str(o.phone, 40).replace(/\D/g, "");
    const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (!business || ten.length !== 10 || seen.has(ten)) { rejected++; continue; }
    seen.add(ten);
    const site = str(o.website, 300);
    out.push({ business, phone: `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`, website: site && !/^https?:\/\//i.test(site) ? "https://" + site : site,
      location: str(o.location, 120), owner: str(o.owner, 80), source: httpUrl(o.source), notes: withHiring(str(o.notes, 500), o.hiring), niche: nicheOf(str(o.niche, 60)) });
  }
  return { prospects: out, rejected };
}

/** The content plan's date math: drafts are stored by the Monday of their week plus a day number (0 = Monday). */
export function weekAndDay(date: string): { week: string; day: number } {
  const d = new Date(date + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - day * 86_400_000);
  return { week: monday.toISOString().slice(0, 10), day };
}

export type ContentUpdate = { id: string; status: "posted" | "skipped" | null; url: string; views: number | null; comments: number | null; leads: number | null };
export function parseContentUpdate(body: unknown): { update: ContentUpdate } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  if (!isUuid(b.id)) return { error: "id must be a content draft's id." };
  const status = b.status === "posted" || b.status === "skipped" ? b.status : b.status === undefined ? null : undefined;
  if (status === undefined) return { error: "status is posted or skipped." };
  const n = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : NaN);
  const views = n(b.views), comments = n(b.comments), leads = n(b.leads);
  if ([views, comments, leads].some(x => Number.isNaN(x))) return { error: "views, comments and leads are whole numbers." };
  const url = httpUrl(b.url);
  if (status === "posted" && !url) return { error: "A posted item needs the post's url." };
  return { update: { id: b.id, status, url, views, comments, leads } };
}

export type ContactInfo = { contactId: string; email: string; owner: string; facebook: string; instagram: string; source: string };

/** Contact details Grok found for a prospect (owner's name, email, socials). Only fills what's empty; never overwrites Sam's data. */
export function parseContactInfo(body: unknown): { info: ContactInfo } | { error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  if (!isUuid(b.contactId)) return { error: "contactId must be a contact's id." };
  const email = str(b.email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return { error: "email doesn't look like an email address." };
  const info = { contactId: b.contactId, email, owner: str(b.owner, 80), facebook: httpUrl(b.facebook), instagram: httpUrl(b.instagram), source: httpUrl(b.source) };
  if (!info.email && !info.owner && !info.facebook && !info.instagram) return { error: "Give at least one of email, owner, facebook or instagram." };
  if (!info.source) return { error: "source is required: the page where you found it." };
  return { info };
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
      "/api/agent/contact-info": { post: { summary: "Fill a prospect's empty email, owner name, Facebook or Instagram, with the source page", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["contactId", "source"], properties: { contactId: id, email: { type: "string" }, owner: { type: "string" }, facebook: { type: "string" }, instagram: { type: "string" }, source: { type: "string" } } } } } }, responses: ok("{ filled: [field names] }") } },
      "/api/agent/replies": { post: { summary: "Log a prospect's reply from a DM, group comment, LinkedIn or TikTok; emails Sam an alert", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["channel", "text"], properties: { contactId: id, channel: { enum: [...REPLY_CHANNELS] }, from: { type: "string" }, text: { type: "string" }, url: { type: "string" } } } } } }, responses: ok("{ logged, alerted }") } },
      "/api/agent/prospects": { post: { summary: "Add up to 50 prospects to the call list (business and US phone required; duplicates and do-not-contact skipped)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["prospects"], properties: { prospects: { type: "array", maxItems: 50, items: { type: "object", required: ["business", "phone"] } } } } } } }, responses: ok("{ added, duplicates, rejected }") } },
      "/api/agent/content": {
        get: { summary: "Planned posts for a date", parameters: [date], responses: ok("{ date, posts: [{ id, platform, format, hook, body, slides, status, url }] }") },
        post: { summary: "Mark a planned post posted or skipped, or record its views, comments and leads", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id, status: { enum: ["posted", "skipped"] }, url: { type: "string" }, views: { type: "integer" }, comments: { type: "integer" }, leads: { type: "integer" } } } } } }, responses: ok("{ ok }") },
      },
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
  {
    name: "log_reply", title: "Log a prospect's reply",
    description: "A prospect or lead replied somewhere Sam's command center can't see: an Instagram or Facebook DM, a Facebook group comment, LinkedIn, TikTok. Logs it on their record and emails Sam an alert. Leave contactId out for someone not in the CRM yet and give their name or handle in from.",
    inputSchema: { type: "object", required: ["channel", "text"], properties: {
      contactId: uuid, channel: { type: "string", enum: [...REPLY_CHANNELS] }, from: { type: "string", description: "Their name or handle" },
      text: { type: "string", description: "What they said, word for word" }, url: { type: "string", description: "Link to the conversation or comment" },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "add_prospects", title: "Add prospects to the call list",
    description: "Add up to 50 businesses you found on public pages (Google Maps, their websites) to Sam's call list. Each needs a business name and a US phone number. Duplicates of anyone already in the CRM or on the do-not-contact list are skipped automatically, except a prospect whose notes start with \"Lead grade: A\": that upgrades the existing lead to A (the Google Maps finder adds leads as B). Only real businesses you saw a listing for; never guess a phone number.",
    inputSchema: { type: "object", required: ["prospects"], properties: { prospects: { type: "array", maxItems: 50, items: { type: "object", required: ["business", "phone"], properties: {
      business: { type: "string" }, phone: { type: "string" }, website: { type: "string" }, location: { type: "string", description: "City, ST" },
      owner: { type: "string", description: "Owner's name if the listing shows it" }, source: { type: "string", description: "URL of the listing you found it on" },
      notes: { type: "string", description: "Start with \"Lead grade: A\" (or B or C), then why, then rating and review count" },
      niche: { type: "string", enum: ["fence", "generators", "other"], description: "fence = residential fence installer; generators = standby generator dealer/installer; other = any other home-service trade" },
      hiring: { type: "object", description: "Set when the company has an open job post for a receptionist, CSR, call-taker, dispatcher or office manager who answers phones. Makes it grade A.", properties: {
        role: { type: "string", description: "Job title as posted" }, url: { type: "string", description: "URL of the job post" }, posted: { type: "string", description: "Date posted, YYYY-MM-DD" } } },
    } } } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "get_content_queue", title: "Today's planned posts",
    description: "Sam's content plan for a date: each planned post with its platform (feed, video, linkedin, group, x, gbp), hook, body, slide text and status. Post only what's planned, after Sam approves, then call update_content.",
    inputSchema: { type: "object", properties: { date } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "update_content", title: "Mark a post posted, or record its numbers",
    description: "After Sam approves and it's published: status posted with the post's url. Later, record views, comments and leads (people who messaged about it). Use status skipped for a planned post Sam chose not to use.",
    inputSchema: { type: "object", required: ["id"], properties: {
      id: uuid, status: { type: "string", enum: ["posted", "skipped"] }, url: { type: "string" },
      views: { type: "integer" }, comments: { type: "integer" }, leads: { type: "integer" },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "save_contact_info", title: "Fill in a prospect's contact details",
    description: "Save the owner's name, a business email, or Facebook and Instagram pages you found for a prospect, with the page you found them on. Only fills fields that are empty; never overwrites what Sam has.",
    inputSchema: { type: "object", required: ["contactId", "source"], properties: {
      contactId: uuid, email: { type: "string" }, owner: { type: "string", description: "Owner's full name" },
      facebook: { type: "string" }, instagram: { type: "string" }, source: { type: "string", description: "URL where you found it" },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
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
    case "save_contact_info": return { method: "POST", path: "/api/agent/contact-info", body: args };
    case "log_reply": return { method: "POST", path: "/api/agent/replies", body: args };
    case "add_prospects": return { method: "POST", path: "/api/agent/prospects", body: args };
    case "get_content_queue": return { method: "GET", path: "/api/agent/content", query: args.date ? { date: s(args.date) } : {} };
    case "update_content": return { method: "POST", path: "/api/agent/content", body: args };
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
