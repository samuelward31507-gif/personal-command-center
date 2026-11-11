// Client operations: the 21-day guarantee clock, the setup sheet, message approval and the launch test.
// Pure: no I/O. Safe to unit test.

export const GUARANTEE_BUSINESS_DAYS = 21;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s.slice(0, 10) + "T12:00:00Z");
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Business days (Mon–Fri) after `start` up to and including `end`. Holidays are not excluded. */
export function businessDaysBetween(start: string, end: string): number {
  const a = parse(start), b = parse(end);
  if (b <= a) return 0;
  let n = 0;
  for (const d = new Date(a); d < b;) { d.setUTCDate(d.getUTCDate() + 1); if (!isWeekend(d)) n++; }
  return n;
}

/** The date `n` business days after `start`. */
export function addBusinessDays(start: string, n: number): string {
  const d = parse(start);
  let left = n;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (!isWeekend(d)) left--; }
  return ymd(d);
}

export type Clock = { state: "not_started" | "on_track" | "watch" | "at_risk" | "overdue" | "live"; day: number; of: number; deadline: string | null; label: string };

/**
 * The go-live guarantee: live within 21 business days of the kickoff info, or the setup fee is refunded.
 * Watch from day 12, at risk from day 17, overdue after day 21.
 */
export function guaranteeClock(kickoffAt: string | null, goLiveAt: string | null, today: string): Clock {
  const of = GUARANTEE_BUSINESS_DAYS;
  if (!kickoffAt) return { state: "not_started", day: 0, of, deadline: null, label: "Clock starts when the kickoff checklist is in" };
  const deadline = addBusinessDays(kickoffAt, of);
  if (goLiveAt) {
    const took = businessDaysBetween(kickoffAt, goLiveAt);
    return { state: "live", day: took, of, deadline, label: `Live in ${took} business day${took === 1 ? "" : "s"}${took > of ? " (past the guarantee)" : ""}` };
  }
  const day = businessDaysBetween(kickoffAt, today);
  const state = day > of ? "overdue" : day >= 17 ? "at_risk" : day >= 12 ? "watch" : "on_track";
  const left = of - day;
  const label = state === "overdue" ? `${day - of} business day${day - of === 1 ? "" : "s"} past the guarantee` : `Day ${day} of ${of} · ${left} business day${left === 1 ? "" : "s"} left`;
  return { state, day, of, deadline, label };
}

// ---------- Setup sheet ----------

export type SetupField = { key: string; label: string; group: string; help?: string; long?: boolean; options?: readonly string[] };
export const A2P_STATUSES = ["Not started", "Submitted", "Approved", "Rejected"] as const;

export const SETUP_FIELDS: readonly SetupField[] = [
  { group: "Business", key: "legal_name", label: "Legal business name" },
  { group: "Business", key: "display_name", label: "Name customers know", help: "Used in every message." },
  { group: "Business", key: "owner_name", label: "Owner's first name", help: "\"[name] will follow up\"." },
  { group: "Business", key: "trade", label: "Trade", options: ["Fence", "Pool", "Contractor", "Auto detailing", "Other"] },
  { group: "Business", key: "website", label: "Website" },
  { group: "Business", key: "service_area", label: "Service area", long: true },
  { group: "Business", key: "hours", label: "Business hours", help: "e.g. Mon–Fri 7am–5pm, Sat 8am–noon." },
  { group: "Leads", key: "lead_sources", label: "Where leads come in", long: true },
  { group: "Leads", key: "questions", label: "Qualifying questions", long: true },
  { group: "Leads", key: "rules", label: "Jobs they don't take", long: true },
  { group: "Leads", key: "prices", label: "Pricing guidance", long: true, help: "What the system may say about price. Usually: depends on the project." },
  { group: "Booking", key: "calendar", label: "Calendar" },
  { group: "Booking", key: "booking_link", label: "Booking link", help: "Their estimate booking page." },
  { group: "Booking", key: "availability", label: "Estimate availability", long: true },
  { group: "Alerts", key: "owner_cell", label: "Owner's cell for alerts" },
  { group: "Alerts", key: "alert_email", label: "Alert email" },
  { group: "Voice", key: "tone", label: "How they sound", long: true, help: "Paste 2–3 real messages the owner has sent customers." },
  { group: "Voice", key: "avoid", label: "Words and topics to avoid", long: true },
  { group: "Texting", key: "texting_number", label: "Texting number", help: "The client's Cinder number, +1 format. Calls and texts to it run this client's system." },
  { group: "Texting", key: "forwarding", label: "How calls reach Cinder", options: ["Their number forwards missed calls here", "Customers call the Cinder number"], help: "Forwarding: their phone already rang, so Cinder texts back right away instead of ringing them again (no loop). Cinder number: it rings the owner's cell first." },
  { group: "Reviews", key: "review_link", label: "Google review link", help: "Sent in the review request after a finished job." },
  { group: "Texting", key: "a2p_status", label: "Texting registration", options: A2P_STATUSES },
  { group: "Texting", key: "a2p_submitted", label: "Registration submitted on", help: "YYYY-MM-DD" },
  { group: "Access", key: "access_notes", label: "Access notes", long: true, help: "Who granted what. Never paste passwords here: keep them in your password manager." },
];

/** Kickoff answers fill the sheet's empty fields, so nothing is typed twice. */
export function prefillSetup(setup: Record<string, string>, kickoff: Record<string, string>, extra: { company?: string; website?: string; ownerName?: string } = {}): Record<string, string> {
  const out: Record<string, string> = { ...setup };
  const fill = (k: string, v: string | undefined) => { if (!out[k]?.trim() && v?.trim()) out[k] = v.trim(); };
  for (const k of ["legal_name", "website", "service_area", "lead_sources", "questions", "rules", "prices", "calendar", "availability", "owner_cell"]) fill(k, kickoff[k]);
  fill("display_name", extra.company?.replace(/,?\s+(LLC|L\.L\.C\.|Inc\.?|Corp\.?)$/i, "")); fill("website", extra.website); fill("owner_name", extra.ownerName);
  if (!out.a2p_status) out.a2p_status = "Not started";
  return out;
}

export function cleanSetup(input: unknown): Record<string, string> {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of SETUP_FIELDS) {
    const v = r[f.key];
    if (typeof v !== "string") continue;
    const t = v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, f.long ? 2000 : 300);
    if (f.options && t && !(f.options as readonly string[]).includes(t)) continue;
    if (t) out[f.key] = t;
  }
  return out;
}

/** Sheet completeness for the build: what's still missing before the build can start. */
export function setupGaps(setup: Record<string, string>): string[] {
  const need = ["display_name", "owner_name", "trade", "service_area", "hours", "questions", "booking_link", "owner_cell", "tone"];
  return need.filter(k => !setup[k]?.trim()).map(k => SETUP_FIELDS.find(f => f.key === k)!.label);
}

// ---------- Message approval ----------

export type Message = { key: string; label: string; body: string; status: "draft" | "approved" | "changes"; clientNote?: string };

const TEMPLATES: Record<"fence" | "pool", { key: string; label: string; body: string }[]> = {
  fence: [
    { key: "first_reply", label: "First reply to a new quote request", body: "Hi {first}, thanks for reaching out to {business} about your fence. A couple of quick questions so we can get you an accurate estimate: roughly how many feet, and what material are you thinking?" },
    { key: "missed_call", label: "Missed call", body: "Sorry we missed you, this is {business}. We're probably out on a job. What can we help with? You can also grab an estimate time here: {link}" },
    { key: "after_hours", label: "After hours", body: "Thanks {first}! Our team is off for the night, but {owner} will follow up first thing tomorrow. Want to grab an estimate time now? {link}" },
    { key: "booking", label: "Booking link", body: "Thanks, that helps. Here's a link to pick a time for a free on-site estimate: {link}" },
    { key: "reminder", label: "Reminder the day before", body: "Reminder: {owner} from {business} is coming out tomorrow at {time} to measure. Need to change it? {link}" },
    { key: "not_fit", label: "Not a fit", body: "Thanks for thinking of {business}, {first}. That one's outside what we take on, but we appreciate you reaching out." },
    { key: "handoff", label: "Handing off to the owner", body: "Good question. I'll have {owner} reach out to you directly about that today." },
  ],
  pool: [
    { key: "first_reply", label: "First reply to a new inquiry", body: "Hi {first}, thanks for reaching out to {business}! Excited to hear about your pool project. To point you the right way: are you thinking this season or next, and do you have a rough budget range in mind?" },
    { key: "missed_call", label: "Missed call", body: "Sorry we missed your call, this is {business}. What can we help with? If it's a new pool, you can book a design consultation here: {link}" },
    { key: "after_hours", label: "After hours", body: "Thanks {first}! We're closed for the evening, and {owner} will reach out tomorrow morning. You can also pick a consultation time here: {link}" },
    { key: "booking", label: "Booking link", body: "Great. The next step is a free backyard design consultation. Pick a time that works here: {link}" },
    { key: "reminder", label: "Reminder the day before", body: "Reminder: your design consultation with {business} is tomorrow at {time}. Need to reschedule? {link}" },
    { key: "quote_follow_up", label: "Proposal follow-up", body: "Hi {first}, just checking in on the pool proposal. Happy to walk through options or financing whenever works for you." },
    { key: "handoff", label: "Handing off to the owner", body: "Good question. I'll have {owner} reach out to you directly about that today." },
  ],
};

/** Starting messages for a client, with their business name, owner and booking link filled in. {first} and {time} stay as live placeholders. */
export function draftMessages(setup: Record<string, string>): Message[] {
  const trade = setup.trade === "Pool" ? "pool" : "fence";
  const fill = (s: string) => s.replace(/\{business\}/g, setup.display_name || "{business}").replace(/\{owner\}/g, setup.owner_name || "{owner}").replace(/\{link\}/g, setup.booking_link || "{link}");
  return TEMPLATES[trade].map(t => ({ key: t.key, label: t.label, body: fill(t.body), status: "draft" as const }));
}

export function cleanMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 30).flatMap((m): Message[] => {
    if (!m || typeof m !== "object") return [];
    const r = m as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key.replace(/[^a-z0-9_]/gi, "").slice(0, 40) : "";
    const body = typeof r.body === "string" ? r.body.trim().slice(0, 640) : "";
    if (!key || !body) return [];
    const status = r.status === "approved" || r.status === "changes" ? r.status : "draft";
    return [{ key, label: typeof r.label === "string" ? r.label.slice(0, 120) : key, body, status, ...(typeof r.clientNote === "string" && r.clientNote.trim() ? { clientNote: r.clientNote.trim().slice(0, 1000) } : {}) }];
  });
}

/** Applies the client's answers from the approval page: approve as-is, or ask for a change with a note. */
export function applyApproval(messages: Message[], answers: unknown): Message[] | { error: string } {
  const a = (answers && typeof answers === "object" ? answers : {}) as Record<string, { decision?: unknown; note?: unknown }>;
  const out = messages.map(m => {
    const ans = a[m.key];
    if (!ans) return m;
    if (ans.decision === "approve") return { ...m, status: "approved" as const, clientNote: undefined };
    if (ans.decision === "change") {
      const note = typeof ans.note === "string" ? ans.note.trim().slice(0, 1000) : "";
      return { ...m, status: "changes" as const, clientNote: note };
    }
    return m;
  });
  const missingNote = out.find(m => m.status === "changes" && !m.clientNote);
  if (missingNote) return { error: `Tell us what to change in "${missingNote.label}".` };
  return out;
}

export const allApproved = (m: Message[]) => m.length > 0 && m.every(x => x.status === "approved");

// ---------- Launch test ----------

export const LAUNCH_STEPS: readonly { key: string; label: string; timed?: boolean }[] = [
  { key: "form_hours", label: "Website form during business hours: reply arrives with their name and project", timed: true },
  { key: "form_after", label: "Website form after hours: after-hours wording is used", timed: true },
  { key: "fb_lead", label: "Facebook lead ad test lead (if they run ads)", timed: true },
  { key: "missed_call", label: "Missed call: text-back arrives", timed: true },
  { key: "good_lead", label: "Good lead answers questions and books: calendar event, buffer and owner alert are right" },
  { key: "bad_lead", label: "Out-of-area lead: polite not-a-fit, nothing booked" },
  { key: "price_question", label: "\"How much?\" stops the automation and alerts the owner" },
  { key: "stop", label: "STOP: nothing else is sent from any sequence" },
  { key: "followups", label: "Tier 2: quote follow-ups queue, and stop when marked won" },
  { key: "cleanup", label: "Test leads and calendar events deleted from the client's systems" },
];
export type LaunchStep = { pass?: boolean; seconds?: number | null; note?: string; at?: string };
export type Launch = { steps: Record<string, LaunchStep>; ownerOk?: string; ownerOkAt?: string };

export function cleanLaunch(input: unknown): Launch {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const steps: Record<string, LaunchStep> = {};
  const src = (r.steps && typeof r.steps === "object" ? r.steps : {}) as Record<string, Record<string, unknown>>;
  for (const s of LAUNCH_STEPS) {
    const v = src[s.key];
    if (!v || typeof v !== "object") continue;
    const sec = Number(v.seconds);
    steps[s.key] = {
      pass: v.pass === true ? true : v.pass === false ? false : undefined,
      seconds: s.timed && Number.isFinite(sec) && sec >= 0 && sec < 86400 ? Math.round(sec) : null,
      note: typeof v.note === "string" ? v.note.slice(0, 500) : "",
      at: typeof v.at === "string" ? v.at.slice(0, 30) : undefined,
    };
  }
  return { steps, ownerOk: typeof r.ownerOk === "string" ? r.ownerOk.slice(0, 300) : undefined, ownerOkAt: typeof r.ownerOkAt === "string" ? r.ownerOkAt.slice(0, 30) : undefined };
}

/** A step fails if marked failed or if a timed reply took longer than 60 seconds. Launch is ready when every step passes and the owner signed off. */
export function launchState(l: Launch, tier2: boolean): { passed: number; total: number; failed: string[]; ready: boolean } {
  const steps = LAUNCH_STEPS.filter(s => tier2 || s.key !== "followups");
  const failed: string[] = []; let passed = 0;
  for (const s of steps) {
    const v = l.steps[s.key];
    const slow = s.timed && v?.seconds != null && v.seconds > 60;
    if (v?.pass === true && !slow) passed++;
    else if (v?.pass === false || slow) failed.push(s.label);
  }
  return { passed, total: steps.length, failed, ready: passed === steps.length && !!l.ownerOk };
}
