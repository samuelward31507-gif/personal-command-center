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

export const isStop = (t: string) => /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]?\s*$/i.test(t || "");
export const isStart = (t: string) => /^\s*(start|unstop|yes)\s*$/i.test(t || "");

/** Instructions for the reply engine, built only from what the client approved in setup. */
export function replySystem(setup: Record<string, string>, messages: Approved): string {
  const biz = setup.display_name || "the business", owner = setup.owner_name || "the owner";
  const approved = messages.filter(m => m.status === "approved").map(m => `- ${m.key}: ${m.body}`).join("\n");
  return `You text customers on behalf of ${biz}, a ${setup.trade || "home service"} company. You write as the business ("we"), never as an AI. If someone asks whether you're a person, say you're ${owner}'s assistant and offer to have ${owner} call.

Goal: answer their question, ask the qualifying questions one at a time, give the price range only as the pricing guidance allows, then offer the booking link to pick an estimate time.

Rules:
- One short text, under 300 characters. Plain words. One question at a time. No emoji, no exclamation spam.
- Price: say only what the pricing guidance allows. Never quote an exact price, discount, or date the guidance doesn't give.
- Booking: when you know the job, the location is in the service area and they want an estimate, send the booking link: ${setup.booking_link || "(none: ask for a good time and say the owner will confirm)"}.
- Hand off to ${owner} (handoff true) for: complaints, negotiating price, insurance or legal questions, anything unusual, anything you're unsure about, or when they ask for a person.
- Jobs they don't take: ${setup.rules || "none listed"}. If it's one of those, say so kindly (stage "not_fit").
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

Reply with JSON only: {"reply": "the text to send", "handoff": false, "stage": "qualifying" | "booking_offered" | "booked" | "not_fit", "summary": "one line for the owner: name, job, where it stands"}.
Use "booked" only when they confirm they picked a time.`;
}

/** The conversation so far, oldest first, as the reply engine reads it. */
export function replyUser(history: { direction: string; body: string }[], customerName: string): string {
  const lines = history.slice(-20).map(h => `${h.direction === "in" ? "Customer" : "Business"}: ${h.body}`);
  return `Customer name: ${customerName || "unknown"}\n\nConversation:\n${lines.join("\n")}\n\nWrite the next text from the business.`;
}

export type Decision = { reply: string; handoff: boolean; stage: "qualifying" | "booking_offered" | "booked" | "not_fit"; summary: string; book?: string | null };
/** Reads the engine's JSON. Anything malformed hands off to the owner instead of guessing. */
export function parseDecision(text: string): Decision | null {
  const m = (text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const reply = typeof j.reply === "string" ? j.reply.trim().slice(0, 480) : "";
    const stage = ["qualifying", "booking_offered", "booked", "not_fit"].includes(j.stage) ? j.stage : "qualifying";
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
export const SEQUENCES = { quote: { days: QUOTE_DAYS, texts: QUOTE_TEXTS }, rehash: { days: REHASH_DAYS, texts: REHASH_TEXTS } } as const;

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

export const REVIEW_TEXT = "Hi {first}, thanks again for choosing {business}. If you were happy with the work, would you leave us a quick Google review? It really helps a small business: {review_link}";

/** What the owner gets on their phone. */
export function ownerAlert(kind: "new" | "handoff" | "booked" | "missed", who: string, detail: string): string {
  const head = { new: "New lead", handoff: "Needs you", booked: "Estimate booked", missed: "Missed call, texted back" }[kind];
  return `Cinder · ${head}: ${who}${detail ? `. ${detail}` : ""}`.slice(0, 320);
}
