// Daily prospect queue: who to message today, and when to follow up. Pure: no I/O.
// You send every message yourself; Cinder only remembers who, when and what happened.

export type Touch = { kind: "dm_sent" | "follow_up_sent" | "replied" | "not_interested"; at: string };
export const DAILY_NEW = 20;
export const FOLLOW_UP_DAYS = [3, 4] as const; // day 3 after the first DM, then 4 more days (day 7). Then stop.

const addDays = (iso: string, n: number) => { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Where a prospect is: never messaged, waiting, follow-up due, done (replied, not interested, or out of follow-ups). */
export function touchState(touches: Touch[], today: string): { state: "new" | "waiting" | "follow_up_due" | "replied" | "closed"; due: string | null; followUps: number } {
  if (!touches.length) return { state: "new", due: null, followUps: 0 };
  const sorted = [...touches].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted[sorted.length - 1];
  const followUps = sorted.filter(t => t.kind === "follow_up_sent").length;
  if (sorted.some(t => t.kind === "replied")) return { state: "replied", due: null, followUps };
  if (last.kind === "not_interested") return { state: "closed", due: null, followUps };
  if (followUps >= FOLLOW_UP_DAYS.length) return { state: "closed", due: null, followUps };
  const due = addDays(last.at, FOLLOW_UP_DAYS[followUps]);
  return { state: due <= today ? "follow_up_due" : "waiting", due, followUps };
}

export type Candidate = { id: string; company: string; followUpAt: string | null; hasReport: boolean; hasSocial: boolean; niche: boolean; createdAt: string };

/** Today's new prospects: ones you scheduled for today first, then those with a report, then fence/pool with a DM channel. */
export function pickNew(c: Candidate[], today: string, n = DAILY_NEW): Candidate[] {
  const score = (x: Candidate) => (x.followUpAt && x.followUpAt <= today ? 100 : 0) + (x.hasReport ? 20 : 0) + (x.hasSocial ? 10 : 0) + (x.niche ? 5 : 0);
  return c.filter(x => x.hasSocial || (x.followUpAt && x.followUpAt <= today))
    .sort((a, b) => score(b) - score(a) || a.createdAt.localeCompare(b.createdAt)).slice(0, n);
}

export const KIND_LABEL: Record<Touch["kind"], string> = { dm_sent: "Sent first message", follow_up_sent: "Sent follow-up", replied: "They replied", not_interested: "Not interested" };
