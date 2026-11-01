// Where deals come from, and which channels actually book calls and close. Pure: no I/O.

export const CHANNELS = [
  { key: "instagram", label: "Instagram DM" },
  { key: "facebook", label: "Facebook DM" },
  { key: "cold_call", label: "Cold call" },
  { key: "website", label: "Website form" },
  { key: "booking", label: "Booked a call online" },
  { key: "referral", label: "Referral" },
  { key: "email", label: "Email" },
  { key: "upsell", label: "Upsell" },
  { key: "other", label: "Other" },
  { key: "unknown", label: "Not recorded" },
] as const;
export type Channel = typeof CHANNELS[number]["key"];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map(c => [c.key, c.label])) as Record<Channel, string>;
/** Choices for the deal form (the label is what gets stored). */
export const SOURCE_CHOICES = CHANNELS.filter(c => c.key !== "unknown" && c.key !== "upsell").map(c => c.label);

const RULES: [Channel, RegExp][] = [
  ["upsell", /\bupsell\b/i],
  ["referral", /\brefer(r?al|red)\b|word of mouth/i],
  ["booking", /cal\.com|cal\.ai|calendly|booked a call|booking/i],
  ["instagram", /\binsta(gram)?\b|\big\b/i],
  ["facebook", /\bfacebook\b|\bfb\b|\bmessenger\b|\bmeta\b/i],
  ["website", /website|web form|lead form|\/start\b|\bform\b/i],
  ["cold_call", /cold call|\bcall(ed|ing)?\b|phone|dial/i],
  ["email", /\be-?mail\b|newsletter/i],
];
const MEANINGLESS = /^(contact record|csv import|import|manual|crm|ask cinder|)$/i;

/**
 * The channel for one deal: the deal's own source when it says something, else the contact's source.
 * "contact record", "CSV import" and blanks say nothing about the channel.
 */
export function channelOf(dealSource: string | null | undefined, contactSource?: string | null): Channel {
  // A deal made from a logged call credits the contact's original channel when there is one.
  if (/^call outcome$/i.test((dealSource ?? "").trim())) {
    const fromContact = channelOf("", contactSource);
    return fromContact === "unknown" ? "cold_call" : fromContact;
  }
  for (const raw of [dealSource, contactSource]) {
    const s = (raw ?? "").trim();
    if (!s || MEANINGLESS.test(s)) continue;
    for (const [ch, re] of RULES) if (re.test(s)) return ch;
    return "other";
  }
  return "unknown";
}

export type SourceDeal = { dealSource: string; contactSource: string; stage: string; meeting: boolean; monthlyFee: number; setupFee: number };
export type ChannelRow = { channel: Channel; label: string; deals: number; meetings: number; won: number; lost: number; wonMonthly: number; wonSetup: number; meetingRate: number | null; closeRate: number | null };

const MEETING_STAGES = new Set(["meeting_booked", "meeting_held", "proposal", "won"]);

/** Per-channel funnel: deals → meetings → won. Close rate counts only decided deals (won or lost). */
export function channelReport(deals: SourceDeal[]): { rows: ChannelRow[]; best: ChannelRow | null; unknownShare: number } {
  const by = new Map<Channel, ChannelRow>();
  for (const d of deals) {
    const ch = channelOf(d.dealSource, d.contactSource);
    const r = by.get(ch) ?? { channel: ch, label: CHANNEL_LABEL[ch], deals: 0, meetings: 0, won: 0, lost: 0, wonMonthly: 0, wonSetup: 0, meetingRate: null, closeRate: null };
    r.deals++;
    if (d.meeting || MEETING_STAGES.has(d.stage)) r.meetings++;
    if (d.stage === "won") { r.won++; r.wonMonthly += d.monthlyFee; r.wonSetup += d.setupFee; }
    if (d.stage === "lost") r.lost++;
    by.set(ch, r);
  }
  const rows = [...by.values()].map(r => ({ ...r, meetingRate: r.deals ? Math.round((r.meetings / r.deals) * 100) : null, closeRate: r.won + r.lost ? Math.round((r.won / (r.won + r.lost)) * 100) : null }))
    .sort((a, b) => b.won - a.won || b.meetings - a.meetings || b.deals - a.deals);
  const known = rows.filter(r => r.channel !== "unknown");
  // "Best" needs a real sample: at least 3 deals and one meeting.
  const best = known.filter(r => r.deals >= 3 && r.meetings > 0).sort((a, b) => (b.meetingRate ?? 0) - (a.meetingRate ?? 0) || b.won - a.won)[0] ?? null;
  const unknown = by.get("unknown")?.deals ?? 0;
  return { rows, best, unknownShare: deals.length ? Math.round((unknown / deals.length) * 100) : 0 };
}
