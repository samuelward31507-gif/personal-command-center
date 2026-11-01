// Small pure helpers for CRM ease-of-use features (command bar, one-tap Today actions). Safe to unit test.

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, " ");

/** Command bar search: every typed word must appear somewhere in the label, hint or keywords. */
export function matches(item: { label: string; hint: string; keywords?: string }, q: string): boolean {
  const hay = norm(`${item.label} ${item.hint} ${item.keywords ?? ""}`);
  return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

/** One-tap actions on Today: which queue items can be marked done or pushed to tomorrow. */
export function quickActions(id: string): { done: boolean; snooze: boolean } {
  const kind = id.split(":")[0];
  return { done: kind === "task" || kind === "milestone", snooze: kind === "task" || kind === "milestone" || kind === "deal" };
}
