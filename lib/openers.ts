// What to say on a cold call, by trade. Pure: no I/O. Short on purpose: an opener, one question to dig, the pitch.

export type Opener = { open: string; dig: string; pitch: string };

const TRADES: Opener = {
  open: "Hey, is this the owner? Sam with Cinder. Quick one: when someone calls you after hours or on a Saturday and nobody picks up, what happens to that job?",
  dig: "And the quotes you send out, how many never hear back?",
  pitch: "We text every missed caller back in seconds and book them, chase your open quotes until it's a yes or no, and bring past customers back. 5 booked appointments in 30 days or your next month's free.",
};
const DETAILING: Opener = {
  open: "Hey, is this the owner? Sam with Cinder. Quick one: when's the last time you reached out to your past customers?",
  dig: "Your ceramic and maintenance customers should be back every few months. How many actually rebook without you asking?",
  pitch: "We text your past customers when they're due and book them back in, text back anyone who calls while you're mid-detail, and ask every happy customer for a review. 5 booked appointments in 30 days or your next month's free.",
};

/** Detailers get the repeat-customer opener; everyone else the missed-calls-and-quotes one. */
export function openerFor(...hints: (string | null | undefined)[]): Opener & { trade: "detailing" | "trades" } {
  const s = hints.filter(Boolean).join(" ");
  return /\bdetail(s|ing|ers?)?\b|\bceramic coating|\bppf\b/i.test(s) ? { ...DETAILING, trade: "detailing" } : { ...TRADES, trade: "trades" };
}
