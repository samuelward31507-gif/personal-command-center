// Fence job paperwork, the pure part: the utility locate (811) ticket, the permit, HOA approval, the property line or
// survey pins, and the customer's sign-off on the line. What each holds, what it says on the job ("Locate clears
// Thursday"), and what stands between the job and digging. No database here; tested in test-paperwork.mjs.

export type Paperwork = {
  locate: { ticket: string; requested: string | null; clears: string | null };
  permit: { needed: "yes" | "no" | ""; number: string; approved: string | null };
  hoa: { needed: "yes" | "no" | ""; approved: string | null };
  pins: { confirmed: string | null; note: string };
  signoff: { on: string | null; by: string };
};
export const EMPTY_PAPERWORK: Paperwork = { locate: { ticket: "", requested: null, clears: null }, permit: { needed: "", number: "", approved: null },
  hoa: { needed: "", approved: null }, pins: { confirmed: null, note: "" }, signoff: { on: null, by: "" } };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown) => (typeof v === "string" && YMD.test(v) && !isNaN(Date.parse(v + "T12:00:00Z")) ? v : null);
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const yn = (v: unknown): "yes" | "no" | "" => (v === "yes" || v === "no" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

/** A paperwork form from the screen (or the database), checked. Unknown fields are dropped; dates are YYYY-MM-DD. */
export function cleanPaperwork(input: unknown): Paperwork {
  const o = obj(input), l = obj(o.locate), p = obj(o.permit), h = obj(o.hoa), pn = obj(o.pins), s = obj(o.signoff);
  const permitNeeded = yn(p.needed), hoaNeeded = yn(h.needed);
  return {
    locate: { ticket: txt(l.ticket, 40), requested: day(l.requested), clears: day(l.clears) },
    permit: { needed: permitNeeded, number: permitNeeded === "no" ? "" : txt(p.number, 40), approved: permitNeeded === "no" ? null : day(p.approved) },
    hoa: { needed: hoaNeeded, approved: hoaNeeded === "no" ? null : day(h.approved) },
    pins: { confirmed: day(pn.confirmed), note: txt(pn.note, 200) },
    signoff: { on: day(s.on), by: txt(s.by, 80) },
  };
}

/** `n` business days after a date (weekends skipped; holidays aren't known, so the owner can always change it). */
export function addBusinessDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  let left = n;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  return d.toISOString().slice(0, 10);
}

const dayName = (ymd: string, today: string) => {
  const diff = Math.round((Date.parse(ymd + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  const d = new Date(ymd + "T12:00:00Z");
  return diff > 1 && diff < 7 ? d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

/** The locate in one line for the job: "No 811 ticket yet", "Locate clears Thursday", "Locate cleared Nov 18". */
export function locateLine(p: Paperwork, today: string): { text: string; clear: boolean } {
  const l = p.locate;
  if (!l.ticket && !l.requested) return { text: "No 811 ticket yet", clear: false };
  if (!l.clears) return { text: `811 ticket ${l.ticket || "requested"}, clear date not set`, clear: false };
  if (l.clears <= today) return { text: `Locate cleared ${dayName(l.clears, today) === "today" ? "today" : dayName(l.clears, today)}`, clear: true };
  return { text: `Locate clears ${dayName(l.clears, today)}`, clear: false };
}

/** Each paperwork item, done or not, in the order a job goes through them. */
export function paperworkItems(p: Paperwork, today: string): { key: keyof Paperwork; label: string; done: boolean; text: string }[] {
  const loc = locateLine(p, today);
  return [
    { key: "locate", label: "Utility locate (811)", done: loc.clear, text: loc.text },
    { key: "permit", label: "Permit", done: p.permit.needed === "no" || !!p.permit.approved,
      text: p.permit.needed === "no" ? "Not needed" : p.permit.approved ? `Approved${p.permit.number ? `, #${p.permit.number}` : ""}` : p.permit.needed === "yes" ? `Waiting${p.permit.number ? ` on #${p.permit.number}` : ""}` : "Not checked yet" },
    { key: "hoa", label: "HOA approval", done: p.hoa.needed === "no" || !!p.hoa.approved,
      text: p.hoa.needed === "no" ? "No HOA" : p.hoa.approved ? "Approved" : p.hoa.needed === "yes" ? "Waiting on the HOA" : "Not checked yet" },
    { key: "pins", label: "Property line or survey pins", done: !!p.pins.confirmed, text: p.pins.confirmed ? `Confirmed${p.pins.note ? `: ${p.pins.note}` : ""}` : "Not confirmed" },
    { key: "signoff", label: "Customer signed off on the line", done: !!p.signoff.on, text: p.signoff.on ? `Signed off${p.signoff.by ? ` by ${p.signoff.by}` : ""}` : "Not yet" },
  ];
}

/**
 * What stands between an install date and digging: no locate ticket, a locate that won't have cleared by that day,
 * a permit or HOA approval that's needed and not in. Empty means clear to dig that day.
 */
export function digBlockers(p: Paperwork, installOn: string | null): string[] {
  if (!installOn) return [];
  const out: string[] = [];
  if (!p.locate.ticket && !p.locate.requested) out.push("There's no 811 locate ticket yet.");
  else if (!p.locate.clears) out.push("The 811 locate has no clear date yet.");
  else if (p.locate.clears > installOn) out.push(`The 811 locate doesn't clear until ${new Date(p.locate.clears + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}.`);
  if (p.permit.needed === "yes" && !p.permit.approved) out.push("The permit isn't approved yet.");
  if (p.hoa.needed === "yes" && !p.hoa.approved) out.push("The HOA hasn't approved it yet.");
  return out;
}

/** The job steps the paperwork settles, with the day each was settled: kept in step with the existing checklist. */
export function stepsFrom(p: Paperwork): Record<string, string> {
  const s: Record<string, string> = {};
  if (p.locate.requested) s.locate = p.locate.requested;
  if (p.permit.approved) s.permit = p.permit.approved;
  if (p.hoa.approved) s.hoa = p.hoa.approved;
  return s;
}
/** Steps settled by "not needed": ticked with today's date. */
export const stepsNotNeeded = (p: Paperwork) => [...(p.permit.needed === "no" ? ["permit"] : []), ...(p.hoa.needed === "no" ? ["hoa"] : [])];
