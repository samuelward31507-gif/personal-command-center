// Client runtime, pure parts: who a number belongs to, filling approved wording, the reply engine's
// instructions and output, quote follow-up timing, and review requests. No I/O: safe to unit test.

/** Last 10 digits, so "+1 (720) 555-0148" and "7205550148" match. */
export const digits10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);
export const sameNumber = (a: string, b: string) => digits10(a).length === 10 && digits10(a) === digits10(b);

export type Vars = { first?: string; business?: string; owner?: string; link?: string; time?: string; review_link?: string };

/** Fills {first} {business} {owner} {link} {time} {review_link}. A missing first name drops cleanly: "Hi {first}," → "Hi,". */
export function fill(body: string, v: Vars): string {
  let s = body.replace(/\s*\{first\}(?=[,!.?])/g, v.first?.trim() ? " " + v.first.trim() : "").replace(/\{first\}/g, v.first?.trim() || "there");
  for (const k of ["business", "owner", "link", "time", "review_link"] as const) s = s.split(`{${k}}`).join((v[k] || "").trim());
  return s.replace(/[ \t]+([,.!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

export type Approved = { key: string; body: string; status: string }[];
/** The client's approved wording for a message, else the fallback. Unapproved drafts are never sent. */
export function wording(messages: Approved, key: string, fallback: string): string {
  return messages.find(m => m.key === key && m.status === "approved")?.body || fallback;
}

export const FALLBACK = {
  missed_call: "Sorry we missed your call, this is {business}. We're probably out on a job. What can we help with?",
  handoff: "Good question. I'll have {owner} reach out to you directly about that today.",
  busy: "Thanks! {owner} will get back to you shortly.",
} as const;

/** The carrier keywords, sent alone. Twilio confirms these itself. */
export const isStopKeyword = (t: string) => /^\s*(stop|stopall|unsubscribe|cancel|end|quit|optout|opt out|revoke|parar|para|alto|basta|cancelar|baja)\s*[.!]?\s*$/i.test(t || "");
/** Opt-outs in plain words: "stop texting me", "take me off your list", "wrong number". We must honor these too. */
export function isPlainOptOut(t: string): boolean {
  const s = (t || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  if (!s || s.length > 200) return false;
  if (/\b(don'?t|do not|never) stop\b/.test(s)) return false;
  if (/\b(stop (texting|messaging|contacting|sending)|(don'?t|do not|please don'?t) (text|message|contact|call) me|remove me|take me off|unsubscribe|opt(-| )?out|no more (texts|messages)|leave me alone|wrong number|lose (this|my) number|not interested,? stop)\b/.test(s)) return true;
  // Spanish: "no me escribas", "ya no me mandes mensajes", "número equivocado", "déjame en paz".
  return /(no me (escribas|escriban|mandes|manden|env[ií]es|contactes|llames)|ya no (me )?(escribas|mandes|env[ií]es)|no quiero (m[aá]s )?mensajes|n[uú]mero equivocado|d[eé]jame en paz|b[oó]rrame|s[aá]quenme de la lista)/.test(s);
}
export const isStop = (t: string) => isStopKeyword(t) || isPlainOptOut(t);
export const isStart = (t: string) => /^\s*(start|unstop|yes)\s*$/i.test(t || "");
export const isHelp = (t: string) => /^\s*(help|info)\s*[.?!]?\s*$/i.test(t || "");
/** The opt-out line. Every conversation's first text carries it (carriers check), and any campaign's first text after a quiet month. */
export const OPTOUT_LINE = { en: "Reply STOP to opt out.", es: "Responde STOP para no recibir más mensajes." } as const;
export function withOptOut(body: string, lang: "en" | "es" = "en"): string {
  const b = (body || "").trim();
  if (/\b(STOP|START)\b/.test(b)) return b; // already says it, or it is the opt-out confirmation
  return `${b}${/[.!?]$/.test(b) ? "" : "."} ${OPTOUT_LINE[lang]}`;
}

/**
 * Automated texts (nudges, follow-ups, reminders, campaigns) per number: at most 3 in any 24 hours unless the
 * customer texted in that time (then it's a conversation they're in). Matches Florida's limit, the strictest.
 */
export const AUTO_PER_DAY = 3;
export const automatedRoom = (o: { outLast24h: number; inLast24h: number }) => o.inLast24h > 0 || o.outLast24h < AUTO_PER_DAY;

/** Public link shorteners get texts filtered by carriers. Use the business's own domain or a branded link. */
export const isShortener = (url: string) => /^(https?:\/\/)?(www\.)?(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|tiny\.cc|rb\.gy)\//i.test((url || "").trim());

export const OPTOUT_TEXT = "You won't get any more texts from {business}. Reply START if you change your mind.";
export const HELP_TEXT = "{business}: texts about your estimate and quote. Reply STOP to opt out. Msg & data rates may apply.";

/** Instructions for the reply engine, built only from what the client approved in setup. */
export function replySystem(setup: Record<string, string>, messages: Approved): string {
  const biz = setup.display_name || "the business", owner = setup.owner_name || "the owner";
  const approved = messages.filter(m => m.status === "approved").map(m => `- ${m.key}: ${m.body}`).join("\n");
  return `You text customers on behalf of ${biz}, a ${setup.trade || "home service"} company. You write as the business ("we"). If someone asks whether they're talking to a person or a bot, say honestly that you're ${biz}'s automated text assistant and offer to have ${owner} call them.

Goal: answer their question, ask the qualifying questions one at a time, give the price range only as the pricing guidance allows, then offer the booking link to pick an estimate time.

Rules:
- One short text, under 300 characters. Plain words. One question at a time. No emoji, no exclamation spam.
- Price: say only what the pricing guidance allows. Never quote an exact price, discount, or date the guidance doesn't give.
- Booking: when you know the job, the location is in the service area and they want an estimate, send the booking link: ${setup.booking_link || "(none: ask for a good time and say the owner will confirm)"}.
- "Too expensive" or price worries: once, offer ${setup.financing ? `this: ${setup.financing}` : "to walk through the quote or look at a smaller option"}. If they still want a lower price or want to negotiate, hand off.
- Hand off to ${owner} (handoff true) for: complaints, negotiating price, insurance or legal questions, anything unusual, anything you're unsure about, or when they ask for a person.
- Jobs they don't take: ${setup.rules || "none listed"}. If it's one of those, say so kindly (stage "not_fit").
- If they say they don't need it anymore, went with someone else, or aren't interested: thank them kindly, don't push (stage "done").
- Never invent facts about the business.
- Write in the customer's language: if they write in Spanish, reply in Spanish.

Business facts:
- Service area: ${setup.service_area || "not given"}
- Hours: ${setup.hours || "not given"}
- Qualifying questions: ${setup.questions || "what the job is, size, timeline, address"}
- Pricing guidance: ${setup.prices || "it depends on the project; the estimate is free"}
- How the owner sounds: ${setup.tone || "friendly and direct"}
- Avoid: ${setup.avoid || "nothing listed"}

Approved wording to match in tone:
${approved || "(none yet)"}

Reply with JSON only: {"reply": "the text to send", "handoff": false, "stage": "qualifying" | "booking_offered" | "booked" | "not_fit" | "done" | "canceled", "summary": "one line for the owner: name, job, where it stands"}.
Use "booked" only when they confirm they picked a time.`;
}

/** The conversation so far, oldest first, as the reply engine reads it. */
export function replyUser(history: { direction: string; body: string }[], customerName: string): string {
  const lines = history.slice(-20).map(h => `${h.direction === "in" ? "Customer" : "Business"}: ${h.body}`);
  return `Customer name: ${customerName || "unknown"}\n\nConversation:\n${lines.join("\n")}\n\nWrite the next text from the business.`;
}

export type Decision = { reply: string; handoff: boolean; stage: "qualifying" | "booking_offered" | "booked" | "not_fit" | "done" | "canceled"; summary: string; book?: string | null };
/** Reads the engine's JSON. Anything malformed hands off to the owner instead of guessing. */
export function parseDecision(text: string): Decision | null {
  const m = (text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const reply = typeof j.reply === "string" ? j.reply.trim().slice(0, 480) : "";
    const stage = ["qualifying", "booking_offered", "booked", "not_fit", "done", "canceled"].includes(j.stage) ? j.stage : "qualifying";
    if (!reply && !j.handoff) return null;
    return { reply, handoff: j.handoff === true, stage, summary: typeof j.summary === "string" ? j.summary.slice(0, 200) : "", book: typeof j.book === "string" ? j.book : null };
  } catch { return null; }
}

/** Quote follow-ups: days after the quote was sent. */
export const QUOTE_DAYS = [2, 5, 10, 21] as const;
export const QUOTE_TEXTS = [
  "Hi {first}, it's {owner} with {business}. Just making sure the quote came through. Any questions I can answer?",
  "Hi {first}, {owner} here. Happy to walk through the quote, or look at a smaller option if that would help.",
  "Hi {first}, still thinking it over? I can hold a spot on the schedule for you while you decide.",
  "Hi {first}, I'll close out your quote for now so I'm not bugging you. If you want to move forward later, just reply here.",
] as const;

/** Reviving old leads (people who contacted the business before and never booked): 3 texts over 5 days. */
export const REHASH_DAYS = [0, 2, 5] as const;
export const REHASH_TEXTS = [
  "Hi {first}, it's {owner} with {business}. You reached out a while back about a project. Is that still on your list? Reply STOP to opt out.",
  "Hi {first}, {owner} again. We have free estimate openings in the next couple of weeks if you'd like one. Want me to send a few times?",
  "Last one from me, {first}. If the project's still happening, just reply and I'll get you on the schedule.",
] as const;
/** Repeat-service trades (detailing, carpet, exterior cleaning): past customers, not old leads. 3 texts over about 10 days. */
export const REACTIVATE_DAYS = [0, 4, 9] as const;
export const REACTIVATE_TEXTS = [
  "Hi {first}, it's {owner} with {business}. It's been a while since your last visit. Want me to get you back on the schedule? I have openings this week. Reply STOP to opt out.",
  "Hi {first}, {owner} again. I can fit you in this week or next. Want me to send a couple of times?",
  "Last one from me, {first}. If you'd like to get back on the schedule, just reply and I'll set it up.",
] as const;
export const isRepeatTrade = (trade = "") => /detail|carpet|exterior|clean|wash/i.test(trade);
export const SEQUENCES = { quote: { days: QUOTE_DAYS, texts: QUOTE_TEXTS }, rehash: { days: REHASH_DAYS, texts: REHASH_TEXTS }, reactivate: { days: REACTIVATE_DAYS, texts: REACTIVATE_TEXTS } } as const;

const dayNum = (ymd: string) => Math.floor(Date.parse(ymd.slice(0, 10) + "T12:00:00Z") / 86400000);
/** Which follow-up is due today, or null. One step per run at most, and never a step out of order. */
export function quoteStepDue(sentOn: string, stepsSent: number, today: string, days: readonly number[] = QUOTE_DAYS): number | null {
  if (stepsSent >= days.length) return null;
  return dayNum(today) - dayNum(sentOn) >= days[stepsSent] ? stepsSent : null;
}

/** "Dana Ruiz, 720-555-0148" per line (comma, tab or space before the number) → contacts; bad lines are skipped. */
export function parseLeadList(text: string): { name: string; phone: string }[] {
  const seen = new Set<string>(), out: { name: string; phone: string }[] = [];
  for (const line of (text || "").split(/\r?\n/)) {
    const m = line.match(/^(.*?)[,\t ]*((?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})\s*$/);
    if (!m) continue;
    const phone = digits10(m[2]);
    if (phone.length !== 10 || seen.has(phone)) continue;
    seen.add(phone); out.push({ name: m[1].replace(/[,\t]+$/, "").trim().slice(0, 80), phone: "+1" + phone });
  }
  return out.slice(0, 500);
}

export const REVIEW_TEXT = "Hi {first}, thanks again for choosing {business}. Would you leave us a quick Google review? It really helps a small business: {review_link}";

/** What the owner gets on their phone. */
export function ownerAlert(kind: "new" | "handoff" | "booked" | "missed" | "waiting" | "moved" | "canceled", who: string, detail: string): string {
  const head = { new: "New lead", handoff: "Needs you", booked: "Estimate booked", missed: "Missed call, texted back", waiting: "Still waiting on you", moved: "Estimate moved", canceled: "Estimate canceled" }[kind];
  return `Cinder · ${head}: ${who}${detail ? `. ${detail}` : ""}`.slice(0, 320);
}

// ---------- Lead follow-up (no reply yet) ----------
// A new lead got our first text but went quiet, or stopped replying mid-conversation. Three friendly nudges:
// about 2 hours later, the next day, and day 3. Any reply, a booking, a handoff or an opt-out stops them.
export const NUDGE_HOURS = [2, 20, 68] as const;
export const NUDGE_TEXTS = [
  "Hi {first}, {business} again. Just making sure you saw this. Still want a price on your project? A quick reply here works.",
  "Hi {first}, {owner} at {business} here. Happy to get you a price range or set up a free estimate. Reply with a good day and we'll hold a time.",
  "Last check-in from {business}: should we keep you on the list for an estimate? Reply anytime, no pressure.",
] as const;

/**
 * Which nudge is due now (0, 1 or 2), or null. `anchor` is when the lead last did something: came in, or their
 * latest text. Nudges are counted per anchor, so a reply that goes quiet again starts a fresh, shorter-lived round.
 */
export function nudgeStep(o: { anchor: number | null; lastOut: number | null; nudgeAnchor: number | null; nudgesSent: number; now: number }): number | null {
  const { anchor, lastOut, now } = o;
  if (!anchor || !lastOut || lastOut < anchor) return null;          // we never answered this lead: a different problem
  const sent = o.nudgeAnchor === anchor ? o.nudgesSent : 0;
  if (sent >= NUDGE_HOURS.length) return null;
  if (now - anchor > 7 * 86400000) return null;                       // a week old: let it go
  if (now - anchor < NUDGE_HOURS[sent] * 3600000) return null;
  if (now - lastOut < 90 * 60000) return null;                        // never two texts close together
  return sent;
}

/** Texting hours for nudges in the client's time zone: 8 AM to 8 PM. */
export function inTextingHours(tz: string, now = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/Denver", hour: "numeric", hourCycle: "h23" }).format(now));
  return h >= 8 && h < 20;
}

// ---------- Handoffs the owner hasn't answered ----------
/**
 * What to do about a customer handed to the owner who hasn't replied yet: remind the owner after 45 minutes
 * (owner hours, 7 AM to 9 PM), and after 3 hours tell the customer they haven't been forgotten (texting hours).
 */
export function handoffAction(o: { handoffAt: number; nudgedAt: number | null; heldAt: number | null; now: number; ownerHours: boolean; textingHours: boolean }): "remind" | "hold" | null {
  const waited = o.now - o.handoffAt;
  if (waited > 3 * 86400000) return null;
  if (!o.heldAt && waited >= 3 * 3600000 && o.textingHours) return "hold";
  if (!o.nudgedAt && waited >= 45 * 60000 && o.ownerHours) return "remind";
  return null;
}

// ---------- The owner texting their own Cinder number ----------
/**
 * "QUOTE 4200", "quote $4,200 Dana", "Quote Dana 9.4k": start quote follow-up. Returns null for anything else
 * (the owner then gets a short note pointing to the app, never a reply meant for a customer).
 */
export function parseOwnerQuote(text: string): { amount: number | null; name: string } | null {
  const t = (text || "").trim();
  const m = t.match(/^\s*quote(?:d)?\b[:\s-]*(.*)$/i);
  if (!m) return null;
  let rest = m[1].trim(), amount: number | null = null;
  const num = rest.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i);
  if (num) {
    const v = Number(num[1].replace(/,/g, "")) * (num[2] ? 1000 : 1);
    if (Number.isFinite(v) && v > 0 && v < 10_000_000) amount = Math.round(v);
    rest = (rest.slice(0, num.index) + " " + rest.slice((num.index ?? 0) + num[0].length)).trim();
  }
  const name = rest.replace(/^(for|to)\s+/i, "").replace(/[^\p{L}\p{N}' .-]/gu, "").trim().slice(0, 60);
  return { amount, name };
}
export const OWNER_HELP = "This is your Cinder number. To answer a customer, open the Cinder app: {app}. To start quote follow-up for the customer we last texted you about, reply QUOTE and the amount, like QUOTE 4200.";

// ---------- Repeat Revenue: past customers who are due again ----------
/** Two texts per due date: on the day, then 4 days later if they haven't answered. */
export const DUE_TEXTS = [
  "Hi {first}, it's {owner} with {business}. You're about due for your next {service}. Want me to get you on the schedule?{slots}",
  "Hi {first}, {owner} again. Still want to get your {service} on the calendar? Reply with a day that works and I'll set it up.",
] as const;
export const DUE_GAP_DAYS = 4;

/** Accepts 2026-08-14, 8/14/2026, 8/14/26, 08-14-2026. Returns YYYY-MM-DD or null. */
export function parseDay(v: string): string | null {
  const t = (v || "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) { mo = +m[1]; d = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/** One per line: name, cell, last service date, optional service ("Full detail"). Commas or tabs. */
export function parseCustomerList(text: string): { name: string; phone: string; last: string | null; service: string }[] {
  const seen = new Set<string>(), out: { name: string; phone: string; last: string | null; service: string }[] = [];
  for (const line of (text || "").split(/\r?\n/)) {
    const parts = line.split(/\t|,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
    const pi = parts.findIndex(p => digits10(p).length === 10 && /\d{3}[^\d]*\d{3}[^\d]*\d{4}/.test(p));
    if (pi < 0) continue;
    const phone = digits10(parts[pi]);
    if (seen.has(phone)) continue;
    seen.add(phone);
    const rest = parts.filter((_, i) => i !== pi);
    const di = rest.findIndex(p => parseDay(p));
    const last = di >= 0 ? parseDay(rest[di]) : null;
    const others = rest.filter((_, i) => i !== di);
    out.push({ name: (others[0] || "").slice(0, 80), phone: "+1" + phone, last, service: (others[1] || "").slice(0, 60) });
  }
  return out.slice(0, 1000);
}

/** When a customer is next due: last service + interval, never in the past (overdue customers are due today). */
export function nextDue(last: string | null, intervalDays: number, today: string): string {
  if (!last) return today;
  const d = addDays(last, intervalDays);
  return d < today ? today : d;
}
