// Monthly client report: the one-page results report the agreement promises. Pure: safe to unit test.
// Numbers come from Samuel (read off the live system); nothing is estimated or invented. Blank figures are left out.

export type ReportFigures = {
  inquiries?: number; firstReply?: string; estimates?: number; estimatesPrev?: number;
  followedUp?: number; jobsWon?: number; jobsValue?: number; highlight?: string; nextMonth?: string;
};

export const REPORT_FIELDS: readonly { key: keyof ReportFigures; label: string; kind: "int" | "money" | "text" | "long"; help?: string }[] = [
  { key: "inquiries", label: "Inquiries answered", kind: "int" },
  { key: "firstReply", label: "Average first reply", kind: "text", help: "e.g. 38 seconds" },
  { key: "estimates", label: "Estimates booked", kind: "int" },
  { key: "estimatesPrev", label: "Estimates booked last month", kind: "int", help: "Leave blank for the first report" },
  { key: "followedUp", label: "Quotes followed up", kind: "int" },
  { key: "jobsWon", label: "Jobs won from follow-up", kind: "int" },
  { key: "jobsValue", label: "Value of those jobs ($)", kind: "money" },
  { key: "highlight", label: "What went well", kind: "long" },
  { key: "nextMonth", label: "What we'll improve next month", kind: "long" },
];

export const isPeriod = (p: unknown): p is string => typeof p === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The month before `today` as YYYY-MM (reports cover the month that just ended). */
export function lastMonth(today: Date): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Clean what was typed: whole non-negative numbers, short text. Returns an error in plain words. */
export function cleanFigures(input: unknown): { error: string } | { ok: ReportFigures } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: ReportFigures = {};
  for (const f of REPORT_FIELDS) {
    const v = raw[f.key];
    if (v === undefined || v === null || v === "") continue;
    if (f.kind === "int" || f.kind === "money") {
      const n = Number(String(v).replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0 || (f.kind === "int" && !Number.isInteger(n)) || n > 10_000_000) return { error: `"${f.label}" needs a whole number.` };
      (out as Record<string, number>)[f.key] = f.kind === "money" ? Math.round(n) : n;
    } else {
      const s = String(v).replace(/\r/g, "").trim().slice(0, f.kind === "long" ? 1200 : 80);
      if (s) (out as Record<string, string>)[f.key] = s;
    }
  }
  return { ok: out };
}

const num = (n: number) => n.toLocaleString("en-US");

export function renderReport(client: string, period: string, f: ReportFigures, sender = "Samuel"): { subject: string; body: string } {
  const label = periodLabel(period);
  const rows: string[] = [];
  if (f.inquiries !== undefined) rows.push(`Inquiries answered: ${num(f.inquiries)}${f.firstReply ? ` (average first reply ${f.firstReply})` : ""}`);
  else if (f.firstReply) rows.push(`Average first reply: ${f.firstReply}`);
  if (f.estimates !== undefined) {
    const prev = f.estimatesPrev;
    const delta = prev === undefined ? "" : f.estimates > prev ? ` (up from ${num(prev)})` : f.estimates < prev ? ` (down from ${num(prev)})` : ` (same as last month)`;
    rows.push(`Estimates booked: ${num(f.estimates)}${delta}`);
  }
  if (f.followedUp !== undefined) rows.push(`Quotes followed up: ${num(f.followedUp)}`);
  if (f.jobsWon !== undefined) rows.push(`Jobs won from follow-up: ${num(f.jobsWon)}${f.jobsValue !== undefined ? ` ($${num(f.jobsValue)})` : ""}`);
  else if (f.jobsValue !== undefined) rows.push(`Value of jobs won from follow-up: $${num(f.jobsValue)}`);
  const body = [
    `Hi,`,
    ``,
    `Here's what your system did in ${label}.`,
    ``,
    ...(rows.length ? rows : ["(No figures entered yet.)"]),
    ...(f.highlight ? ["", "What went well", f.highlight] : []),
    ...(f.nextMonth ? ["", "Next month", f.nextMonth] : []),
    ``,
    `Questions about any of this? Just reply.`,
    ``,
    sender,
    `Cinder Revenue Company`,
  ].join("\n");
  return { subject: `${client}: your ${label} results`, body };
}
