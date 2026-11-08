// The founder's fixed weekday routine, drawn on the calendar as blocks (not stored events).
// Pure: no I/O. Times are the founder's local clock (America/Denver). Matches the Cinder Outreach Plan.

export type RoutineKind = "trading" | "dial" | "outreach" | "followup" | "build" | "personal";
export type RoutineBlock = { start: string; end: string; title: string; kind: RoutineKind; key: boolean };

/** Monday–Friday. `key` blocks also show in the month view; the rest only in week and day views. */
export const WEEKDAY_ROUTINE: RoutineBlock[] = [
  { start: "07:30", end: "09:00", title: "Trading", kind: "trading", key: true },
  { start: "09:00", end: "11:30", title: "Dial block 1", kind: "dial", key: true },
  { start: "11:30", end: "12:15", title: "Lunch + send 25 emails", kind: "outreach", key: false },
  { start: "12:15", end: "15:00", title: "Dial block 2", kind: "dial", key: true },
  { start: "15:00", end: "16:00", title: "Follow-ups: texts, replies, book meetings", kind: "followup", key: false },
  { start: "16:00", end: "16:45", title: "LinkedIn + Facebook groups", kind: "outreach", key: false },
  { start: "19:00", end: "21:00", title: "Build the client system", kind: "build", key: false },
  { start: "22:30", end: "22:45", title: "Affirmation page, then bed", kind: "personal", key: false },
];

/** Routine blocks for a calendar day (weekdays only), each with local start/end Dates. */
export function routineFor(day: Date, month = false): (RoutineBlock & { startsAt: Date; endsAt: Date })[] {
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return [];
  const at = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m); return d; };
  return WEEKDAY_ROUTINE.filter(b => !month || b.key).map(b => ({ ...b, startsAt: at(b.start), endsAt: at(b.end) }));
}

/** "9:00–11:30" in 12-hour time without am/pm noise. */
export function blockTime(b: { start: string; end: string }): string {
  const f = (s: string) => { const [h, m] = s.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}`; };
  return `${f(b.start)}–${f(b.end)}`;
}

/** Calendar color class for a routine kind (reuses the event palette). */
export const ROUTINE_CLASS: Record<RoutineKind, string> = {
  trading: "event-personal", dial: "event-call", outreach: "event-other", followup: "event-meeting", build: "event-focus", personal: "event-other",
};
