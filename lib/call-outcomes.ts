// Pure rules for what one logged call outcome does across Cinder. No I/O — unit tested.

export const CALL_OUTCOMES = [
  "no_answer", "voicemail", "connected", "callback_requested",
  "interested", "meeting_booked", "not_a_fit", "wrong_contact", "do_not_contact",
] as const;
export type CallOutcome = typeof CALL_OUTCOMES[number];

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: "No answer",
  voicemail: "Left voicemail",
  connected: "Connected",
  callback_requested: "Call back",
  interested: "Interested",
  meeting_booked: "Meeting booked",
  not_a_fit: "Not a fit",
  wrong_contact: "Wrong contact",
  do_not_contact: "Do not contact",
};

export function isCallOutcome(value: unknown): value is CallOutcome {
  return typeof value === "string" && (CALL_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Days until the next follow-up. null = clear the follow-up (the outcome ends or
 * hands off the chase: a booked meeting, a closed-out prospect, or a bad record).
 */
const FOLLOW_UP_DAYS: Record<CallOutcome, number | null> = {
  no_answer: 2, voicemail: 2, connected: 3, callback_requested: 1, interested: 2,
  meeting_booked: null, not_a_fit: null, wrong_contact: null, do_not_contact: null,
};

export function followUpDate(outcome: CallOutcome, from: Date, override?: string | null): string | null {
  if (FOLLOW_UP_DAYS[outcome] === null) return null;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + (FOLLOW_UP_DAYS[outcome] as number));
  return d.toISOString().slice(0, 10);
}

/** Outcomes that stop an active outreach sequence, and the status it moves to. */
export function sequenceStatusFor(outcome: CallOutcome): string | null {
  switch (outcome) {
    case "meeting_booked": return "meeting_booked";
    case "interested": return "interested";
    case "not_a_fit": return "completed";
    case "wrong_contact": return "parked";
    case "do_not_contact": return "do_not_contact";
    default: return null; // no_answer, voicemail, connected, callback: the cadence continues
  }
}

const STAGE_RANK: Record<string, number> = { new: 0, nurture: 0, contacted: 1, meeting_booked: 2, meeting_held: 3, proposal: 4 };

/**
 * Agreed mapping (2026-10-28, updated for the new pipeline stages):
 * interested → contacted, meeting booked → meeting_booked,
 * not a fit / do not contact → lost with reason; everything else leaves the deal alone.
 * Deals only move forward, and won/lost deals are never touched.
 */
export function dealChangeFor(outcome: CallOutcome, currentStage: string): { stage: string; lostReason?: string } | null {
  if (currentStage === "won" || currentStage === "lost" || !(currentStage in STAGE_RANK)) return null;
  if (outcome === "not_a_fit") return { stage: "lost", lostReason: "Not a fit" };
  if (outcome === "do_not_contact") return { stage: "lost", lostReason: "Do not contact" };
  const target = outcome === "interested" ? "contacted" : outcome === "meeting_booked" ? "meeting_booked" : null;
  if (!target || STAGE_RANK[target] <= STAGE_RANK[currentStage]) return null;
  return { stage: target };
}
