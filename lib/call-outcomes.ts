// Pure rules for what one logged call outcome does across Cinder. No I/O — unit tested.

export const CALL_OUTCOMES = [
  "no_answer", "voicemail", "gatekeeper", "wrong_number",
  "meeting_booked", "send_info", "callback_requested", "interested", "connected", "not_interested", "not_a_fit",
  "wrong_contact", "do_not_contact",
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
  gatekeeper: "Gatekeeper",
  wrong_number: "Wrong number",
  send_info: "Send info",
  not_interested: "Not interested",
};

/** Call mode button rows. Connected and Wrong contact stay valid for older screens but aren't offered here. */
export const CALL_MODE_GROUPS: { label: string; outcomes: CallOutcome[] }[] = [
  { label: "Didn't reach the owner", outcomes: ["no_answer", "voicemail", "gatekeeper", "wrong_number"] },
  { label: "Talked to the owner", outcomes: ["meeting_booked", "send_info", "callback_requested", "interested", "not_interested", "not_a_fit"] },
  { label: "Remove", outcomes: ["do_not_contact"] },
];

/** Outcomes where nobody decision-making was reached; five in a row parks the lead for a month. */
export const NO_CONTACT: readonly CallOutcome[] = ["no_answer", "voicemail", "gatekeeper"];
export const ATTEMPT_LIMIT = 5;
export const PARK_DAYS = 30;
/** Outcomes that count as a real conversation with the owner. */
export const CONVERSATIONS: readonly string[] = ["connected", "callback_requested", "interested", "meeting_booked", "send_info", "not_interested", "not_a_fit"];

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
  gatekeeper: 1, send_info: 1, not_interested: 180, wrong_number: null,
};

/**
 * attempts = no-contact tries in a row including this one. At ATTEMPT_LIMIT the lead is parked for PARK_DAYS
 * instead of coming back in two days.
 */
export function followUpDate(outcome: CallOutcome, from: Date, override?: string | null, attempts = 0): string | null {
  if (FOLLOW_UP_DAYS[outcome] === null) return null;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  const days = NO_CONTACT.includes(outcome) && attempts >= ATTEMPT_LIMIT ? PARK_DAYS : FOLLOW_UP_DAYS[outcome] as number;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Outcomes that stop an active outreach sequence, and the status it moves to. */
export function sequenceStatusFor(outcome: CallOutcome): string | null {
  switch (outcome) {
    case "meeting_booked": return "meeting_booked";
    case "interested": return "interested";
    case "send_info": return "interested";
    case "not_a_fit": return "completed";
    case "not_interested": return "completed";
    case "wrong_contact": return "parked";
    case "wrong_number": return "parked";
    case "do_not_contact": return "do_not_contact";
    default: return null; // no_answer, voicemail, connected, callback: the cadence continues
  }
}

const STAGE_RANK: Record<string, number> = { new: 0, nurture: 0, qualified: 1, contacted: 2, interested: 3, meeting_booked: 4, meeting_held: 5, proposal: 6, negotiation: 7 };

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
  if (outcome === "not_interested") return { stage: "lost", lostReason: "Not interested" };
  const target = outcome === "interested" || outcome === "send_info" ? "interested" : outcome === "meeting_booked" ? "meeting_booked" : null;
  if (!target || STAGE_RANK[target] <= STAGE_RANK[currentStage]) return null;
  return { stage: target };
}
