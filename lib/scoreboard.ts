// Sales scoreboard math. Pure: no I/O. Numbers come only from logged activity and recorded money.

/** The founder's stated goal: $50k by the end of 2026. Cash recorded as paid is what counts toward it. */
export const REVENUE_GOAL = { amount: 50_000, by: "2026-12-31", label: "$50k by year-end" } as const;
/** Default daily dial target — a working assumption, not a rule. */
export const DAILY_CALL_TARGET = 20;

/** Outcomes where a human actually spoke to someone. */
export const CONNECT_OUTCOMES = ["connected", "callback_requested", "interested", "meeting_booked", "not_a_fit"] as const;

export const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

export function daysLeft(today: string, by: string = REVENUE_GOAL.by): number {
  const a = Date.parse(today + "T00:00:00Z"), b = Date.parse(by + "T00:00:00Z");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0;
}

/** Whole months of retainer still billable between a go-live date and the goal date (inclusive of the go-live month). */
export function monthsUntil(from: string, by: string = REVENUE_GOAL.by): number {
  const [fy, fm] = from.split("-").map(Number), [by_, bm] = by.split("-").map(Number);
  if (!fy || !fm || !by_ || !bm) return 0;
  return Math.max(0, (by_ - fy) * 12 + (bm - fm) + 1);
}

export type GoalInput = { today: string; collected: number; expectedByGoal: number; offers: { label: string; setupFee: number; monthlyFee: number }[] };

/**
 * How far along the goal is and what it would take. "Expected" is money already booked as expected
 * receivables due before the goal date — not counted as collected.
 */
export function goalMath(g: GoalInput) {
  const remaining = Math.max(0, REVENUE_GOAL.amount - g.collected);
  const gapAfterExpected = Math.max(0, remaining - g.expectedByGoal);
  const left = daysLeft(g.today);
  // A deal signed today pays setup now and a retainer from roughly a month out (go-live), through the goal date.
  const goLive = new Date(Date.parse(g.today + "T00:00:00Z") + 30 * 86_400_000).toISOString().slice(0, 10);
  const months = left > 30 ? monthsUntil(goLive) : 0;
  const perDeal = g.offers.map(o => {
    const value = o.setupFee + o.monthlyFee * months;
    return { label: o.label, valueByGoal: value, dealsNeeded: value > 0 ? Math.ceil(gapAfterExpected / value) : null };
  });
  return {
    goal: REVENUE_GOAL.amount, collected: g.collected, expected: g.expectedByGoal, remaining, gapAfterExpected, daysLeft: left,
    progressPct: Math.min(100, Math.round((g.collected / REVENUE_GOAL.amount) * 100)),
    withExpectedPct: Math.min(100, Math.round(((g.collected + g.expectedByGoal) / REVENUE_GOAL.amount) * 100)),
    perDeal,
  };
}

export type Funnel = { calls: number; connects: number; meetingsBooked: number; meetingsHeld: number; proposalsSent: number; won: number; lost: number };

export function funnelRates(f: Funnel) {
  return {
    connectRate: pct(f.connects, f.calls),
    meetingRate: pct(f.meetingsBooked, f.connects),
    showRate: pct(f.meetingsHeld, f.meetingsBooked),
    closeRate: pct(f.won, f.won + f.lost),
  };
}
