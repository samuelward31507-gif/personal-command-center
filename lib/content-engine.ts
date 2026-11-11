// Content engine, pure: plans a week of posts across platforms, writes the prompt, checks what comes back,
// and learns which topics bring leads. No I/O. Rules match the rest of Cinder: lead with more jobs, not "AI";
// stats only with their source; never a made-up result, testimonial or client; never a prospect's name.

export type Platform = "feed" | "video" | "linkedin" | "group";
export type Format = "post" | "carousel" | "video";
export type Card =
  | { type: "hook"; text: string; sub?: string }
  | { type: "stat"; figure: string; line: string; source: string }
  | { type: "thread"; title: string; messages: { from: "in" | "out"; text: string }[] }
  | { type: "list"; title: string; items: string[] };
export type Slot = { day: number; platform: Platform; pillar: string; n?: number; angle?: string };
export type Draft = Slot & { format: Format; hook: string; body: string; card: Card; slides: Card[]; shoot: string };
export type Posted = { pillar: string; platform: string; views: number | null; comments: number | null; leads: number | null };
export type Context = {
  dials: number; conversations: number; meetings: number; emailsSent: number; streakDays: number;
  clientsLive: number; leadsAnswered: number; estimatesBooked: number;
  heard: string[];      // short lines from this week's call notes (no names)
  recent: string[];     // hooks already used in the last 8 weeks, to avoid repeats
  trades: string[];     // who we sell to
  offer: string;        // the current offer in one line
};

/** Per day: 5 Facebook + Instagram posts and 5 reels (Instagram, Facebook, TikTok), LinkedIn on weekdays, groups twice a week. */
export const PLATFORMS: { id: Platform; name: string; where: string; days: number[]; perDay: number }[] = [
  { id: "feed", name: "Facebook + Instagram", where: "Facebook page and Instagram feed, same post and image", days: [0, 1, 2, 3, 4, 5, 6], perDay: 5 },
  { id: "video", name: "Reels: Instagram, Facebook, TikTok", where: "Vertical video, 12–20 seconds, text on screen", days: [0, 1, 2, 3, 4, 5, 6], perDay: 5 },
  { id: "linkedin", name: "LinkedIn", where: "Sam's personal LinkedIn", days: [0, 1, 2, 3, 4], perDay: 1 },
  { id: "group", name: "Facebook groups", where: "Contractor and detailer groups: help only, no pitch, no link", days: [1, 3], perDay: 1 },
];
export const POSTS_PER_WEEK = PLATFORMS.reduce((t, p) => t + p.days.length * p.perDay, 0);

/** The shape of each post, rotated so five posts a day on one topic pool never read the same. */
export const ANGLES = [
  "a short true story from a job site or a call", "a how-to with exact steps", "a myth and the truth", "a question that starts comments",
  "one number and what it means", "before and after", "the most common mistake", "a checklist", "point of view: the homeowner's side",
  "a hot take owners will argue with", "what I'd do if I ran a fence company", "a tiny script they can copy",
];

export const PILLARS: Record<string, { name: string; brief: string; weight: number; platforms: Platform[] }> = {
  missed: { name: "Missed calls", brief: "What happens to calls a contractor can't pick up on a job, and the fix: a text back in seconds that books the estimate.", weight: 3, platforms: ["feed", "video", "linkedin"] },
  quotes: { name: "Quote follow-up", brief: "Quotes that go quiet aren't no's. Follow-up on day 2, 5, 10 and 21 until it's a yes or a no.", weight: 3, platforms: ["feed", "video", "linkedin"] },
  build: { name: "Building in public", brief: "Sam's real week running Cinder: the numbers from this week, what worked, what didn't. Use only the numbers given.", weight: 3, platforms: ["feed", "video", "linkedin"] },
  heard: { name: "What owners told me", brief: "One thing contractors said on cold calls this week, and what it means for their business. Never name anyone.", weight: 3, platforms: ["feed", "video", "linkedin", "group"] },
  tip: { name: "Free tip", brief: "One practical thing a trade business owner can do this week without buying anything: a follow-up text to copy, how to ask for a review, a better voicemail greeting, Google profile basics.", weight: 3, platforms: ["feed", "video", "linkedin", "group"] },
  example: { name: "See it work", brief: "Walk through one example conversation: a missed call turned into a booked estimate, or a quote follow-up that won the job. Always labeled as an example.", weight: 2, platforms: ["feed", "video"] },
  objection: { name: "Straight answers", brief: "Answer one doubt owners have: 'I answer my own phone', 'my customers don't text', 'sounds like a robot', 'I tried an answering service'. Honest, no hype.", weight: 2, platforms: ["feed", "video", "linkedin"] },
  offer: { name: "The offer", brief: "The current offer, plainly, with who it's for and how to book a 15-minute call.", weight: 1, platforms: ["feed", "linkedin"] },
  detail: { name: "Detailers", brief: "For auto detailers: past customers due for maintenance, slow weeks, rebooking with one text.", weight: 1, platforms: ["feed", "video"] },
};

/** Stats posts may use. Anything else with a number must come from the week's own figures. */
export const FACTS = [
  { figure: "2%", line: "of callers who don't get through leave a voicemail", source: "Invoca, 2021" },
  { figure: "66%", line: "of calls actually answered, when owners guessed 97%", source: "Service Direct, 2019" },
  { figure: "~½", line: "of calls to home-service businesses reach a person", source: "Invoca, 2026" },
  { figure: "79%", line: "of people say they'd switch to a business that replies faster", source: "Invoca, 2026" },
];

export const TAGS: Record<Platform, string> = {
  feed: "#contractor #smallbusiness #homeservices #fencecompany #roofing #hvac",
  video: "#contractor #contractorlife #smallbusiness #homeimprovement",
  linkedin: "",
  group: "",
};
const DETAIL_TAGS = "#autodetailing #ceramiccoating #detailingbusiness #smallbusiness";

/** Monday of the week that holds this date, as YYYY-MM-DD (dates in the given time zone's calendar). */
export function weekStart(ymd: string): string {
  const d = new Date(ymd + "T12:00:00Z");
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
export function dayDate(week: string, day: number): string {
  const d = new Date(week + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + day); return d.toISOString().slice(0, 10);
}

/** How well each topic has done: leads count most, then comments, then views. Unknown topics start even. */
export function pillarScores(posted: Posted[]): Record<string, number> {
  const sum: Record<string, { s: number; n: number }> = {};
  for (const p of posted) {
    const v = (p.leads ?? 0) * 10 + (p.comments ?? 0) * 2 + (p.views ?? 0) / 200;
    (sum[p.pillar] ??= { s: 0, n: 0 }).s += v; sum[p.pillar].n++;
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(PILLARS)) out[k] = sum[k] && sum[k].n ? sum[k].s / sum[k].n : 0;
  return out;
}

/**
 * The week's slots. Each platform cycles through the topics it suits, heaviest first; topics that have
 * brought leads or comments get more slots. No topic twice on the same day, no same topic on a platform two days running.
 */
export function planWeek(posted: Posted[] = []): Slot[] {
  const score = pillarScores(posted);
  const top = Math.max(1, ...Object.values(score));
  const slots: Slot[] = [];
  let angle = 0;
  // Fewest topics first (groups), so the platforms with the most choice fit around them.
  const order = [...PLATFORMS].sort((a, b) => Object.values(PILLARS).filter(v => v.platforms.includes(a.id)).length - Object.values(PILLARS).filter(v => v.platforms.includes(b.id)).length);
  for (const pl of order) {
    const pool = Object.entries(PILLARS).filter(([, v]) => v.platforms.includes(pl.id))
      .map(([k, v]) => ({ k, w: v.weight * (1 + score[k] / top) }));
    const used: Record<string, number> = {};
    let prevDay = new Set<string>();
    for (const day of pl.days) {
      const today = new Set<string>();
      for (let n = 0; n < pl.perDay; n++) {
        const others = new Set(slots.filter(s => s.day === day && s.platform !== pl.id).map(s => s.pillar));
        const rank = [...pool].sort((a, b) => (b.w / (1 + (used[b.k] ?? 0) * 1.6)) - (a.w / (1 + (used[a.k] ?? 0) * 1.6)) || a.k.localeCompare(b.k));
        const ok = (c: { k: string }) => !today.has(c.k) && !(pl.id === "group" && c.k === "offer");
        // Prefer a topic not used on this platform yesterday and, for one-a-day platforms, not used elsewhere today.
        const pick = rank.find(c => ok(c) && !prevDay.has(c.k) && (pl.perDay > 1 || !others.has(c.k))) ?? rank.find(ok) ?? pool[0];
        used[pick.k] = (used[pick.k] ?? 0) + 1; today.add(pick.k);
        slots.push({ day, platform: pl.id, pillar: pick.k, n, angle: ANGLES[angle++ % ANGLES.length] });
      }
      prevDay = today;
    }
  }
  // A plain call to action at least once a day in the feed: the last feed post of the day.
  for (let day = 0; day < 7; day++) {
    const feed = slots.filter(s => s.platform === "feed" && s.day === day);
    if (feed.length && !feed.some(s => s.pillar === "offer")) feed[feed.length - 1].pillar = "offer";
  }
  return slots.sort((a, b) => a.day - b.day || PLATFORMS.findIndex(p => p.id === a.platform) - PLATFORMS.findIndex(p => p.id === b.platform) || (a.n ?? 0) - (b.n ?? 0));
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function contentSystem(): string {
  return `You write social posts for Cinder Revenue Company, run by Sam Ward (19, Colorado). Cinder answers every missed call, web form and Facebook lead for contractors and auto detailers by text in about 10 seconds, books the estimate on their calendar, and follows up every quote until it's a yes or a no. Done for you, no contract, they keep their number and software.

Voice: a young founder who cold calls contractors every day and talks like them. Plain words, short sentences, specific details from job sites (ladders, trenches, tear-outs, driveways, quotes on the kitchen table). Confident, never salesy. No emojis except at most one in a video caption. No hashtags in the text (they're added later). No exclamation marks.

Hard rules:
- Lead with more jobs and less chasing. Never open with or center on "AI". You may say "automated" or "a system".
- The only outside statistics you may use are these, always with the source in parentheses: ${FACTS.map(f => `${f.figure} ${f.line} (${f.source})`).join("; ")}.
- Any other number must come from "This week" below. Never invent results, clients, testimonials, revenue or quotes from customers.
- Never name a person or business from the call notes. Paraphrase what was said.
- Examples of conversations must be clearly labeled as an example.
- Facebook group posts give real help and ask a question. No pitch, no link, no mention of Cinder.
- LinkedIn posts: first line is the hook on its own, then short paragraphs, 80–180 words, end with a question or a plain next step.
- Feed posts: 40–120 words. Reels are text-on-screen videos, 12–20 seconds: the hook is the first scene, then one idea per scene, the last scene is the takeaway or the next step.
- Every post is different from the others this week and from the hooks already used.

Return only a JSON array, nothing else.`;
}

export function contentUser(ctx: Context, slots: Slot[], week: string): string {
  const facts = [
    `Dials: ${ctx.dials}`, `Conversations: ${ctx.conversations}`, `Meetings booked: ${ctx.meetings}`, `Emails sent: ${ctx.emailsSent}`,
    ctx.streakDays ? `Calling streak: ${ctx.streakDays} days` : "",
    ctx.clientsLive ? `Clients live: ${ctx.clientsLive}` : "Clients live: 0 (still signing the first founding clients; never imply otherwise)",
    ctx.leadsAnswered ? `Leads answered for clients this week: ${ctx.leadsAnswered}` : "", ctx.estimatesBooked ? `Estimates booked for clients this week: ${ctx.estimatesBooked}` : "",
  ].filter(Boolean).join("\n");
  return `Week of ${week}. Sells to: ${ctx.trades.join(", ")}. Current offer: ${ctx.offer}

This week (real numbers from Sam's CRM):
${facts}

What owners said on calls this week (paraphrase, never name anyone):
${ctx.heard.length ? ctx.heard.map(h => "- " + h).join("\n") : "- (nothing logged; for the 'What owners told me' topic, use the most common things contractors say: they're busy on jobs, they lose calls, quotes go quiet)"}

Hooks already used, don't repeat them:
${ctx.recent.length ? ctx.recent.slice(0, 40).map(h => "- " + h).join("\n") : "- (none yet)"}

Write one post for each slot, in this order:
${slots.map((s, i) => `${i + 1}. ${DAYS[s.day]} · ${PLATFORMS.find(p => p.id === s.platform)!.name} · ${PILLARS[s.pillar].name}: ${PILLARS[s.pillar].brief}${s.angle ? ` Shape: ${s.angle}.` : ""}`).join("\n")}

Each item: {"slot": n, "format": "post" | "carousel" | "video", "hook": "the first line, under 12 words", "body": "the full post text (for video: the caption)", "card": CARD, "slides": [CARD, ...] (carousel only, 4–7 slides, first slide is the hook, last slide is the takeaway), "scenes": ["video only: 4–7 lines of on-screen text, each under 12 words, one per scene"], "shoot": "video only: optional, if Sam wants to film it himself instead, what to film in 2–4 short lines"}.
CARD is the image for the post, one of:
{"type":"hook","text":"the line on the image, under 14 words","sub":"optional short second line"}
{"type":"stat","figure":"2%","line":"what it means, under 14 words","source":"Invoca, 2021"} (only the allowed stats or this week's numbers with source "Cinder, this week")
{"type":"thread","title":"Example: missed call, booked","messages":[{"from":"in"|"out","text":"..."}]} (3–6 short texts; "out" is the business)
{"type":"list","title":"...","items":["...", "..."]} (3–5 items, only for real steps or a checklist)
Use a carousel for about one in three feed posts. Group posts use a hook card.`;
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+\n/g, "\n").trim().slice(0, n);
const allowedStat = (c: { figure: string; source: string }, ctx?: Context) =>
  FACTS.some(f => f.figure === c.figure && c.source.includes(f.source.split(",")[0])) ||
  (/cinder/i.test(c.source) && !!ctx && [ctx.dials, ctx.conversations, ctx.meetings, ctx.emailsSent, ctx.leadsAnswered, ctx.estimatesBooked].map(String).includes(c.figure.replace(/[^0-9]/g, "")));

/** One card, cleaned. Bad stats become a plain hook card so nothing unsourced ships. */
export function cleanCard(raw: unknown, fallback: string, ctx?: Context): Card {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (c.type === "stat") {
    const s = { type: "stat" as const, figure: clip(c.figure, 8), line: clip(c.line, 110), source: clip(c.source, 40) };
    if (s.figure && s.line && allowedStat(s, ctx)) return s;
  }
  if (c.type === "thread" && Array.isArray(c.messages)) {
    const messages = c.messages.slice(0, 6).map(m => ({ from: (m as { from?: string })?.from === "in" ? "in" as const : "out" as const, text: clip((m as { text?: string })?.text, 160) })).filter(m => m.text);
    if (messages.length >= 2) return { type: "thread", title: clip(c.title, 50) || "Example", messages };
  }
  if (c.type === "list" && Array.isArray(c.items)) {
    const items = c.items.slice(0, 5).map(i => clip(i, 70)).filter(Boolean);
    if (items.length >= 2) return { type: "list", title: clip(c.title, 70) || fallback, items };
  }
  return { type: "hook", text: clip(c.type === "hook" ? c.text : "", 110) || clip(fallback, 110), ...(c.type === "hook" && c.sub ? { sub: clip(c.sub, 80) } : {}) };
}

/** Pull the JSON array out of the reply and line it up with the slots. Missing or broken items are dropped. */
export function parseDrafts(text: string, slots: Slot[], ctx?: Context): Draft[] {
  const a = text.indexOf("["), b = text.lastIndexOf("]");
  if (a < 0 || b <= a) return [];
  let arr: unknown[];
  try { arr = JSON.parse(text.slice(a, b + 1)); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: Draft[] = [];
  arr.forEach((raw, i) => {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const n = Number(r.slot);
    const slot = slots[Number.isInteger(n) && n >= 1 && n <= slots.length ? n - 1 : i];
    if (!slot || out.some(d => d.day === slot.day && d.platform === slot.platform && (d.n ?? 0) === (slot.n ?? 0))) return;
    const hook = clip(r.hook, 140), body = clip(r.body, 2200);
    if (!hook || !body) return;
    const format: Format = slot.platform === "video" ? "video" : r.format === "carousel" && slot.platform === "feed" ? "carousel" : "post";
    const slides = format === "carousel" && Array.isArray(r.slides) ? r.slides.slice(0, 7).map(s => cleanCard(s, hook, ctx))
      : format === "video" && Array.isArray(r.scenes) ? r.scenes.slice(0, 7).map(t => clip(t, 110)).filter(Boolean).map(text => ({ type: "hook" as const, text })) : [];
    out.push({ ...slot, format: format === "carousel" && slides.length < 3 ? "post" : format, hook, body, card: cleanCard(r.card, hook, ctx), slides: slides.length >= 3 ? slides : [], shoot: slot.platform === "video" ? clip(r.shoot, 900) : "" });
  });
  return out;
}

/** Problems worth flagging before posting (shown on the draft). */
export function lint(d: Pick<Draft, "hook" | "body" | "platform">): string[] {
  const issues: string[] = [];
  if (/^\W*(ai|a\.i\.)\b/i.test(d.hook) || /\bAI\b/.test(d.hook)) issues.push("Hook leads with AI. Lead with the jobs instead.");
  if (/!/.test(d.body)) issues.push("Has an exclamation mark.");
  if (d.platform === "group" && /cinder|link in bio|book a call|dm me/i.test(d.body)) issues.push("Group post pitches. Groups ban that; keep it help-only.");
  const pct = d.body.match(/\b\d{1,3}%/g) ?? [];
  for (const p of pct) if (!FACTS.some(f => f.figure === p) && !/\(.*\d{4}\)/.test(d.body)) { issues.push(`${p} has no source.`); break; }
  return issues;
}

/** What to paste: the text plus the platform's tags. */
export function captionFor(d: Pick<Draft, "body" | "platform" | "pillar">): string {
  const tags = d.pillar === "detail" && (d.platform === "feed" || d.platform === "video") ? DETAIL_TAGS : TAGS[d.platform];
  return tags ? `${d.body}\n\n${tags}` : d.body;
}

/** Break text into lines that fit a width, given a measuring function (canvas measureText in the browser). */
export function wrap(text: string, max: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? line + " " + word : word;
      if (measure(next) <= max || !line) line = next; else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}
