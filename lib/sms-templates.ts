// Voicemail + info text templates and what each call outcome schedules. Pure — no I/O, unit tested.
// Cinder only DRAFTS these. Sam reviews, edits and sends every text himself from his phone.

export type TextTemplate = "T-VM" | "T-INFO";
export const TEMPLATE_LABEL: Record<TextTemplate, string> = { "T-VM": "Voicemail text", "T-INFO": "Info request" };
export const SAM_TZ = "America/Denver";
export const DEFAULT_SLOTS = ["2pm", "4pm"] as const;

// ---- merge fields ----

/** fence / pool / detailing / "" from the company name, notes or an outreach niche. */
export function nicheFor(...hints: (string | null | undefined)[]): "fence" | "pool" | "detailing" | "" {
  const s = hints.filter(Boolean).join(" ");
  if (/\bfenc(e|es|ing)\b/i.test(s)) return "fence";
  if (/\bdetail(s|ing|ers?)?\b|\bceramic coating|\bppf\b/i.test(s)) return "detailing";
  if (/\bpools?\b|\bspas?\b|\bswim/i.test(s)) return "pool";
  return "";
}
export function demoLinkFor(niche: string): string {
  // /fence-demo and /pool-demo were retired (they redirect to /demo). Fence gets the fence cut of the video.
  if (niche === "fence") return "https://cinderrevenue.com/watch?story=fence";
  if (niche === "pool" || niche === "detailing") return "https://cinderrevenue.com/demo";
  return "https://cinderrevenue.com";
}

/** The site's general demo page, which is also the Settings default. A different link in Settings (an overview Loom)
    replaces the trade defaults everywhere; leaving the default keeps the fence cut for fence leads. */
export const DEFAULT_DEMO_LINK = "https://cinderrevenue.com/demo";
export function pickDemoLink(niche: string, settingsLink?: string | null): string {
  const s = (settingsLink ?? "").trim();
  return /^https:\/\/\S+$/.test(s) && s.replace(/\/$/, "") !== DEFAULT_DEMO_LINK ? s : demoLinkFor(niche);
}

export function isTimeZone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
/**
 * Contact's own field, then their state, then their area code. null = unknown (use Sam's time + "MT").
 * Pass timeZoneFor / timeZoneForPhone from lib/local-time.
 */
export function resolveTimeZone(
  c: { timeZone?: string | null; location?: string | null; phone?: string | null },
  byState: (location: string) => string | null,
  byPhone: (phone: string) => string | null,
): string | null {
  const own = (c.timeZone ?? "").trim();
  if (isTimeZone(own)) return own;
  return byState(c.location ?? "") ?? byPhone(c.phone ?? "");
}

function parts(at: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(at);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? "";
  return { y: +g("year"), mo: +g("month"), d: +g("day"), h: +g("hour") % 24, mi: +g("minute"), wd: g("weekday") };
}
/** "6:15" in the prospect's zone. Unknown zone: Sam's time with " MT". */
export function callTimeText(at: Date, tz: string | null): string {
  const { h, mi } = parts(at, tz ?? SAM_TZ);
  const s = `${h % 12 || 12}:${String(mi).padStart(2, "0")}`;
  return tz ? s : `${s} MT`;
}
/** Their local clock, e.g. "9:40 PM", for warnings. */
export function localClock(at: Date, tz: string | null): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz ?? SAM_TZ, hour: "numeric", minute: "2-digit" }).format(at) + (tz ? "" : " MT");
}

// ---- templates ----

export function voicemailText(i: { firstName?: string; callTime: string; demoLink: string; niche?: string }): string {
  const name = (i.firstName ?? "").trim() || "there";
  if (i.niche === "detailing") return `Hey${name ? " " + name : ""}, Sam with Cinder. Called at ${i.callTime} and got voicemail, probably mid-detail. Quick one: how many past customers haven't rebooked in 3+ months? We text them when they're due and book them back in. Here's how: ${i.demoLink}\n\nWorth a quick call tomorrow?`;
  return `Hey${name ? " " + name : ""}, Sam with Cinder. Called your shop at ${i.callTime} and got voicemail. Fewer than 3% of callers leave one, so most just call the next company. Here's what they'd get instead: ${i.demoLink}\n\nWorth a quick call tomorrow?`;
}
export function infoText(i: { firstName?: string; demoLink: string; slot1?: string; slot2?: string; niche?: string }): string {
  const name = (i.firstName ?? "").trim();
  if (i.niche === "detailing") return `Hey${name ? " " + name : ""}, Sam with Cinder. Good talking with you. Here's how it works: ${i.demoLink}\n\nWe text your past customers when they're due for their next detail and book them back in, text back anyone who calls while you're mid-job, and ask happy customers for reviews. You don't touch the tech. More about us: https://cinderrevenue.com\n\nEasiest is I show you in 15 min. ${(i.slot1 || DEFAULT_SLOTS[0]).trim()} or ${(i.slot2 || DEFAULT_SLOTS[1]).trim()} tomorrow?`;
  return `Hey${name ? " " + name : ""}, Sam with Cinder. Good talking with you. Here's the 25-second demo of what your customers would get when you can't pick up: ${i.demoLink}\n\nWe build it, run it and book the estimates on your calendar. You don't touch the tech. More about us: https://cinderrevenue.com\n\nEasiest is I show you in 15 min. ${(i.slot1 || DEFAULT_SLOTS[0]).trim()} or ${(i.slot2 || DEFAULT_SLOTS[1]).trim()} tomorrow?`;
}

// ---- sending helpers ----

/** Opens the phone's Messages app with the number and body filled in (works on iOS and Android). */
export function smsHref(phone: string, body: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  const num = digits.startsWith("+") ? digits : digits.length === 10 ? "+1" + digits : digits.length === 11 && digits.startsWith("1") ? "+" + digits : digits;
  return `sms:${num}?&body=${encodeURIComponent(body)}`;
}
export const isStop = (text: string) => /\b(stop|stopall|unsubscribe)\b/i.test(text || "");
/** Outside 8am–8pm their time → a warning to hold it until tomorrow. */
export function quietHoursWarning(now: Date, tz: string | null): string | null {
  const { h } = parts(now, tz ?? SAM_TZ);
  return h < 8 || h >= 20 ? `It's ${localClock(now, tz)} for them, send tomorrow?` : null;
}

// ---- scheduling (tasks are due at 9:30am the prospect's time) ----

/** The UTC instant for a wall-clock time in a zone. */
export function zonedTime(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  let t = Date.UTC(y, mo - 1, d, h, mi);
  for (let k = 0; k < 2; k++) {
    const p = parts(new Date(t), tz);
    const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    t += Date.UTC(y, mo - 1, d, h, mi) - asUtc;
  }
  return new Date(t);
}
/** `days` calendar days after `from` (their date), at hh:mm their time, moved off weekends to Monday. */
export function dueAt(from: Date, tz: string | null, days: number, h = 9, mi = 30): Date {
  const zone = tz ?? SAM_TZ;
  const p = parts(from, zone);
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d + days));
  const dow = base.getUTCDay();
  if (dow === 6) base.setUTCDate(base.getUTCDate() + 2);
  if (dow === 0) base.setUTCDate(base.getUTCDate() + 1);
  return zonedTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, mi, zone);
}
/** Next business day at hh:mm their time. */
export function nextBusinessDay(from: Date, tz: string | null, h = 9, mi = 30): Date {
  return dueAt(from, tz, 1, h, mi);
}
export const localDate = (at: Date, tz: string | null) => { const p = parts(at, tz ?? SAM_TZ); return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };

export const INFO_FOLLOW_UP_DAYS = [1, 2, 3, 7] as const;
export const REDIAL_DAYS = [3, 7] as const;

export type OutcomePlan = {
  template: TextTemplate | null;
  /** Why no draft: shown in place of the panel. */
  notice: string | null;
  tasks: { title: string; due: Date }[];
  /** No answer, 2nd or later in a row: mark this many open Redial tasks done. */
  completeRedials: number;
  /** No answer after both redials: stop chasing. */
  close: boolean;
  /** The contact's next follow-up date (their local date), or null to clear it. undefined = leave the default rule. */
  followUp?: string | null;
};

/**
 * What one logged outcome drafts and schedules.
 * - voicemail → T-VM (once per contact, ever) + "Call back" next business day 9:30am their time
 * - send_info → T-INFO + follow-ups day 1/2/3/7
 * - no_answer → no text; Redial day 3 and day 7; a 3rd no-answer in a row closes it out
 * - do-not-contact / STOP → no drafts for anything
 */
export function planFor(outcome: string, ctx: {
  now: Date; tz: string | null; suppressed?: string | null; vmSentAt?: string | null; consecutiveNoAnswers?: number; hasOpenRedials?: boolean;
}): OutcomePlan {
  const plan: OutcomePlan = { template: null, notice: null, tasks: [], completeRedials: 0, close: false };
  const blocked = ctx.suppressed ? `No texts: ${ctx.suppressed}.` : null;
  if (outcome === "voicemail") {
    const due = nextBusinessDay(ctx.now, ctx.tz);
    plan.tasks.push({ title: "Call back", due });
    plan.followUp = localDate(due, ctx.tz);
    if (blocked) plan.notice = blocked;
    else if (ctx.vmSentAt) plan.notice = `Voicemail text already sent ${ctx.vmSentAt}. Call instead.`;
    else plan.template = "T-VM";
  } else if (outcome === "send_info" || outcome === "interested") {
    // Interested and Send info get the same info text and follow-up calls.
    for (const d of INFO_FOLLOW_UP_DAYS) plan.tasks.push({ title: `Follow up on info (day ${d})`, due: dueAt(ctx.now, ctx.tz, d) });
    plan.followUp = localDate(plan.tasks[0].due, ctx.tz);
    if (blocked) plan.notice = blocked; else plan.template = "T-INFO";
  } else if (outcome === "no_answer") {
    const n = Math.max(1, ctx.consecutiveNoAnswers ?? 1);
    if (n === 1 || !ctx.hasOpenRedials && n < 3) {
      for (const d of REDIAL_DAYS) plan.tasks.push({ title: `Redial (day ${d})`, due: dueAt(ctx.now, ctx.tz, d) });
      plan.followUp = localDate(plan.tasks[0].due, ctx.tz);
    } else if (n === 2) {
      plan.completeRedials = 1;
      plan.followUp = localDate(dueAt(ctx.now, ctx.tz, REDIAL_DAYS[1] - REDIAL_DAYS[0]), ctx.tz);
    } else {
      plan.completeRedials = 99; plan.close = true; plan.followUp = null;
    }
    if (blocked) plan.notice = blocked;
  } else if (blocked) {
    plan.notice = blocked;
  }
  return plan;
}

// ---- no-show protection: texts for booked meetings ----

/** "tomorrow at 10:00 AM" / "today at 2:30 PM", in the prospect's time zone when known. */
export function meetingWhen(startsAt: Date, now: Date, tz: string | null): string {
  const zone = tz && isTimeZone(tz) ? tz : undefined;
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(startsAt);
  const diff = Math.round((Date.parse(day(startsAt)) - Date.parse(day(now))) / 86400000);
  const label = diff === 0 ? "today" : diff === 1 ? "tomorrow" : new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(startsAt);
  return `${label} at ${time}`;
}
/** Day-before confirmation. Asking for a reply is what cuts no-shows: people show up for what they said yes to. */
export function confirmText(i: { firstName?: string; when: string; business?: string }): string {
  const name = (i.firstName ?? "").trim();
  return `Hey${name ? " " + name : ""}, Sam with ${i.business || "Cinder"}. Confirming our call ${i.when}. Still good? Just reply yes, or tell me a better time.`;
}
/** Same-day reminder, about an hour before. */
export function reminderText(i: { firstName?: string; when: string }): string {
  const name = (i.firstName ?? "").trim();
  return `Hey${name ? " " + name : ""}, Sam here. Quick reminder we're talking ${i.when}. I'll call you at this number. Talk soon.`;
}
/** Which no-show text a meeting needs right now: confirm when it's within ~a day and a half, remind in the last 3 hours. */
export function meetingNudge(startsAt: Date, now: Date, tz: string | null): "confirm" | "remind" | null {
  const ms = startsAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  if (ms <= 3 * 3600000) return "remind";
  return ms <= 36 * 3600000 ? "confirm" : null;
}

// ---- follow-ups after the info text ----

/** The follow-up text for each info follow-up day (1, 2, 3, 7). Short, one question, easy to answer. */
export function infoFollowUpText(i: { firstName?: string; company?: string; day: number; slot1?: string; slot2?: string; niche?: string }): string {
  const hi = `Hey${(i.firstName ?? "").trim() ? " " + i.firstName!.trim() : ""}`;
  const s1 = (i.slot1 || DEFAULT_SLOTS[0]).trim(), s2 = (i.slot2 || DEFAULT_SLOTS[1]).trim();
  if (i.day <= 1) return `${hi}, Sam with Cinder. Did you get a chance to watch the demo I sent yesterday?`;
  if (i.day === 2) return `${hi}, Sam again. Easiest way to see if it fits ${i.company || "you"} is a quick 15 min call. ${s1} or ${s2}?`;
  if (i.day === 3) return i.niche === "detailing"
    ? `${hi}, quick one: how many past customers haven't rebooked in the last 3 months? That's usually where the first month's bookings come from. Want me to show you?`
    : `${hi}, quick one: how many calls go to voicemail on a busy week? That's usually where the first month's jobs come from. Want me to show you?`;
  return `${hi}, last one from me. If it ever makes sense to look at this, just text back "demo" and I'll set it up.`;
}

/** Text that carries a Loom you recorded for one prospect. */
export function loomText(i: { firstName?: string; company?: string; loomUrl: string }): string {
  const hi = `Hey${(i.firstName ?? "").trim() ? " " + i.firstName!.trim() : ""}`;
  return `${hi}, Sam with Cinder. I recorded a quick 2-minute video for ${i.company || "you"} showing exactly how this would work for your shop: ${i.loomUrl.trim()}\n\nWorth 15 minutes this week to set it up?`;
}
/** Referral ask, 14+ days after a client goes live. "Quick favor:" marks it as sent (don't reword that part). */
export function referralText(i: { firstName?: string }): string {
  const hi = `Hey${(i.firstName ?? "").trim() ? " " + i.firstName!.trim() : ""}`;
  return `${hi}, Sam here. Quick favor: know any other owners who'd want more booked jobs the same way? If you send them my way and they sign, your next month's on me.`;
}
/** Talking points for a Loom: who, their problem in their words, what to show, the ask. */
export function loomPoints(i: { company: string; city?: string; niche?: string; callNote?: string }): string[] {
  const detail = i.niche === "detailing";
  return [
    `Open on their website or Google listing: "Hey, this is for ${i.company || "you"}${i.city ? ` in ${i.city}` : ""}."`,
    i.callNote ? `Their problem, in their words: ${i.callNote.replace(/^[\s\S]*?their problem:\s*/i, "").replace(/^asked for info by text\.\s*/i, "")}` : detail ? "Their problem: past customers not rebooking, calls missed mid-detail." : "Their problem: calls after hours and on weekends, quotes that go quiet.",
    detail ? "Show it: a past customer gets a 'due for your next detail' text and books from it." : "Show it: call their number after hours, the text-back lands in seconds, the caller books.",
    "The guarantee: 5 booked appointments in 30 days or the next month is free.",
    "The ask: \"Reply with a time this week and I'll set it up with you.\" Keep it under 2 minutes.",
  ];
}
