// The owner's own follow-ups, the pure part: what a rule may hold and when it starts counting. A rule is a trigger
// (a quote goes out, a job is won, an invoice is paid, a job is lost), a wait in days, and a text. It only applies to
// customers who hit the trigger after the rule was turned on, so turning one on never texts the whole history.

export const TRIGGERS = [
  ["quoted", "A quote goes out", "and they haven't answered yet"],
  ["won", "A job is won", ""],
  ["paid", "An invoice is paid in full", ""],
  ["lost", "A job is lost", ""],
] as const;
export type Trigger = (typeof TRIGGERS)[number][0];
export type Rule = { id: string; name: string; trigger: Trigger; days: number; message: string; on: boolean; since: string };
export const MAX_RULES = 12;

const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max);
const parse = (v: unknown): unknown[] => { if (Array.isArray(v)) return v; if (typeof v === "string") { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } } return []; };

/** The saved rules, read back (a rule that doesn't hold up is dropped). */
export function readRules(v: unknown): Rule[] {
  return parse(v).flatMap(x => { const r = cleanRule(x); return "error" in r || !/^[a-z0-9]{6,16}$/.test(String((x as { id?: unknown })?.id ?? "")) || !String((x as { since?: unknown }).since ?? "") ? [] : [{ ...r, id: String((x as { id: string }).id), since: String((x as { since: string }).since) }]; });
}

/** One rule's own fields, checked. The text must be between 10 and 480 characters (three texts at most). */
export function cleanRule(input: unknown): Omit<Rule, "id" | "since"> | { error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const trigger = TRIGGERS.find(t => t[0] === o.trigger)?.[0];
  if (!trigger) return { error: "Pick when it goes out." };
  const days = Math.round(Number(o.days));
  if (!Number.isFinite(days) || days < 0 || days > 730) return { error: "The wait is 0 to 730 days." };
  const message = ctl(o.message, 480);
  if (message.length < 10) return { error: "Write the text they'll get." };
  return { name: ctl(o.name, 60) || TRIGGERS.find(t => t[0] === trigger)![1], trigger, days, message, on: o.on !== false };
}

/**
 * The owner's new list against the saved one. A kept rule keeps its id; its start time is kept only while it stays on,
 * so a rule turned off and back on starts counting again from that moment instead of catching up on everyone it missed.
 */
export function mergeRules(input: unknown, saved: Rule[], now: string, newId: () => string): Rule[] | { error: string } {
  const out: Rule[] = [];
  for (const x of parse(input).slice(0, MAX_RULES + 1)) {
    const r = cleanRule(x);
    if ("error" in r) return r;
    const id = String((x as { id?: unknown })?.id ?? ""), prev = saved.find(s => s.id === id);
    out.push({ ...r, id: prev ? prev.id : newId(), since: prev && prev.on && r.on ? prev.since : now });
  }
  if (out.length > MAX_RULES) return { error: `Up to ${MAX_RULES} follow-ups.` };
  return out;
}

/** "3 days after a quote goes out" */
export function ruleWhen(r: Pick<Rule, "trigger" | "days">): string {
  const t = TRIGGERS.find(x => x[0] === r.trigger);
  const what = (t?.[1] ?? "").replace(/^A /, "a ").replace(/^An /, "an ");
  const wait = r.days === 0 ? "Right when" : r.days % 365 === 0 ? `${r.days / 365} ${r.days === 365 ? "year" : "years"} after` : r.days % 7 === 0 && r.days >= 14 ? `${r.days / 7} weeks after` : `${r.days} ${r.days === 1 ? "day" : "days"} after`;
  return `${wait} ${what}${t?.[2] ? `, ${t[2]}` : ""}`;
}
