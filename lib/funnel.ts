// The sales funnel, step by step, with the rate from each step to the next. Pure: tested.
export type FunnelCounts = { dials: number; conversations: number; booked: number; held: number; showed: number; noShow: number; won: number; cash: number };
export type FunnelStep = { key: string; label: string; n: number; rate: number | null; rateLabel: string };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export function funnelSteps(c: FunnelCounts): FunnelStep[] {
  return [
    { key: "dials", label: "Dials", n: c.dials, rate: null, rateLabel: "" },
    { key: "conversations", label: "Conversations", n: c.conversations, rate: pct(c.conversations, c.dials), rateLabel: "of dials" },
    { key: "booked", label: "Meetings booked", n: c.booked, rate: pct(c.booked, c.conversations), rateLabel: "of conversations" },
    { key: "showed", label: "Showed", n: c.showed, rate: pct(c.showed, c.held), rateLabel: "show rate" },
    { key: "won", label: "Clients won", n: c.won, rate: pct(c.won, c.showed), rateLabel: "of meetings held" },
  ];
}

/** The weakest step against simple targets, so the page can say where to work. */
export function leak(c: FunnelCounts): string {
  const conv = pct(c.conversations, c.dials), book = pct(c.booked, c.conversations), show = pct(c.showed, c.held), close = pct(c.won, c.showed);
  if (c.dials < 50) return "Not enough dials yet to read the funnel. Get to 150 a day.";
  if (book !== null && book < 10) return `Booking is the leak: ${book}% of conversations turn into a meeting. Aim for 15–25%. Ask "morning or afternoon?" on every call.`;
  if (show !== null && c.held >= 3 && show < 70) return `Show rate is the leak: ${show}%. Aim for 70%+. Text the invite on the call and send the reminder the morning of.`;
  if (close !== null && c.showed >= 5 && close < 20) return `Closing is the leak: ${close}% of meetings close. Book call two before call one ends.`;
  if (conv !== null && conv < 20) return `Reaching owners is the leak: ${conv}% of dials become conversations. Call earlier and get the owner's name from the gatekeeper.`;
  return "No obvious leak. More dials means more of everything.";
}
