// Speed test: Sam asks a prospect for a quote the way a homeowner would (their web form, a call, a text) and
// times how long they take to get back. The result is the opener for the call, the Loom and the meeting.
// Also writes the 90-second Loom for one prospect from the research card and the test.
// Pure: no I/O, no imports. Unit tested.

export type SpeedVia = "form" | "call" | "text";
export type SpeedTest = { via: SpeedVia; at: string; repliedAt: string | null };

const VIA: SpeedVia[] = ["form", "call", "text"];
const iso = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Validate a stored or submitted test. Returns null when it is not a usable test. */
export function cleanSpeedTest(raw: unknown): SpeedTest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const via = VIA.includes(r.via as SpeedVia) ? (r.via as SpeedVia) : null;
  const at = iso(r.at);
  if (!via || !at) return null;
  const repliedAt = r.repliedAt == null ? null : iso(r.repliedAt);
  if (repliedAt && Date.parse(repliedAt) < Date.parse(at)) return null;
  return { via, at, repliedAt };
}

/** "8 min", "4h 12m", "2 days". */
export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${Math.floor(h / 24)} days`;
}

export type SpeedSummary = { state: "waiting" | "replied" | "no_reply"; label: string; minutes: number | null; tone: "good" | "warn" | "bad" | "neutral" };

/** A test with no reply after 48 hours counts as "no reply". Under 5 minutes is good, under an hour is a warning. */
export function summarize(t: SpeedTest, now = Date.now()): SpeedSummary {
  const start = Date.parse(t.at);
  if (t.repliedAt) {
    const ms = Date.parse(t.repliedAt) - start;
    const minutes = Math.round(ms / 60000);
    return { state: "replied", minutes, label: `Replied in ${duration(ms)}`, tone: minutes <= 5 ? "good" : minutes <= 60 ? "warn" : "bad" };
  }
  const waited = now - start;
  if (waited >= 48 * 3600 * 1000) return { state: "no_reply", minutes: null, label: `No reply after ${duration(waited)}`, tone: "bad" };
  return { state: "waiting", minutes: null, label: `Waiting ${duration(waited)}`, tone: "neutral" };
}

const HOW: Record<SpeedVia, string> = { form: "filled out the quote form on your website", call: "called your office for a quote", text: "texted your business for a quote" };

/** The line Sam opens with. Never claims more than the test shows. */
export function speedLine(t: SpeedTest, now = Date.now(), timeZone = "America/Denver"): string | null {
  const s = summarize(t, now);
  if (s.state === "waiting") return null;
  const d = new Date(t.at);
  const when = `${d.toLocaleString("en-US", { weekday: "long", timeZone })} at ${d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}`;
  if (s.state === "replied") return s.minutes != null && s.minutes <= 5
    ? `I ${HOW[t.via]} ${when}, and you got back to me in ${duration(Date.parse(t.repliedAt!) - Date.parse(t.at))}. That's faster than almost everyone I test.`
    : `I ${HOW[t.via]} ${when}. You got back to me ${duration(Date.parse(t.repliedAt!) - Date.parse(t.at))} later. Most homeowners have booked someone by then.`;
  return `I ${HOW[t.via]} ${when}. Nobody got back to me.`;
}

// ---- The 90-second Loom: their site on screen in the first 5 seconds, one finding, what it costs, the fix, one ask. ----

export type LoomInput = {
  firstName?: string | null;
  company: string;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  noWebsite?: boolean;
  weakCapture?: boolean;
  speed?: SpeedTest | null;
  bookingLink?: string | null;
  timeZone?: string;
  now?: number;
};
export type LoomBeat = { at: string; screen: string; say: string };

/** Pick the single strongest finding. Order: a failed speed test, few reviews, no way to ask for a quote, then speed in general. */
export function loomFinding(i: LoomInput): { kind: "speed" | "reviews" | "capture" | "website" | "general"; say: string; screen: string } {
  const now = i.now ?? Date.now();
  if (i.speed) {
    const s = summarize(i.speed, now);
    const line = speedLine(i.speed, now, i.timeZone);
    if (line && s.tone !== "good") return { kind: "speed", say: line, screen: "Your test: the request you sent and the time stamp of their reply (or the empty inbox)" };
  }
  if (i.reviewCount != null && i.reviewCount < 30) return {
    kind: "reviews",
    say: `You've got ${i.reviewCount} Google reviews${i.rating ? ` at ${i.rating} stars` : ""}. Half of homeowners won't even call a company with under 20, and the shops around you have hundreds.`,
    screen: "Their Google listing next to a competitor's review count",
  };
  if (i.noWebsite) return { kind: "website", say: "When I searched for you, I only found your Google listing. A homeowner comparing three companies at 9pm has no way to ask you for a quote.", screen: "The Google search result with no website" };
  if (i.weakCapture) return { kind: "capture", say: "On your site there's no way to ask for a quote except calling. Someone browsing at night can't reach you, so they go to the next company with a form.", screen: "Their site on a phone, scrolling: no quote form" };
  return { kind: "general", say: "Most homeowners ask two or three companies for a quote and go with whoever gets back first, and after that, whoever follows up.", screen: "Their site, homepage" };
}

export function loomScript(i: LoomInput): { beats: LoomBeat[]; text: string } {
  const first = (i.firstName ?? "").trim();
  const hey = first ? `Hey ${first}` : "Hey";
  const f = loomFinding(i);
  const ask = i.bookingLink ? `If it's worth 15 minutes, grab a time at the link under this video, or just reply to my text with a day.` : `If it's worth 15 minutes, just reply to my text with a day that works.`;
  const beats: LoomBeat[] = [
    { at: "0:00", screen: i.website ? `${i.website}, homepage, scrolled to the top` : "Their Google listing", say: `${hey}, it's Sam with Cinder. I made this for ${i.company} specifically, it's about a minute and a half.` },
    { at: "0:08", screen: f.screen, say: f.say },
    { at: "0:30", screen: "Stay on the finding", say: "Every one of those is a homeowner who was ready to book and went with someone else. If even one more of them signed each month, that's a whole extra fence job." },
    { at: "0:50", screen: "The Cinder demo: a pretend quote request and the reply landing in 10 seconds", say: `Here's what we set up. Every call you miss and every form gets a text back from ${i.company} in about 10 seconds, it answers their questions and books the estimate on your calendar. Then every quote you send gets followed up until it's a yes or a no.` },
    { at: "1:15", screen: "Back on their site", say: `${ask} Talk soon.` },
  ];
  const text = beats.map(b => `${b.at}  [${b.screen}]\n${b.say}`).join("\n\n") + (i.bookingLink ? `\n\nLink under the video: ${i.bookingLink}` : "");
  return { beats, text };
}
