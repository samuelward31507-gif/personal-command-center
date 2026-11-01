// Compliance and admin deadlines: filings, renewals, taxes and per-client texting registration. Pure: no I/O.

export const KINDS = ["filing", "tax", "insurance", "renewal", "texting", "backup", "other"] as const;
export type Kind = typeof KINDS[number];

/** Common items you can add with one tap. Dates you know go in; the rest you fill once. */
export const COMMON_ITEMS: readonly { title: string; kind: Kind; repeatMonths: number | null; note: string; due?: (year: number) => string }[] = [
  { title: "Colorado LLC periodic report", kind: "filing", repeatMonths: 12, note: "Filed with the Colorado Secretary of State each year to stay in good standing." },
  { title: "Estimated tax payment (Q1)", kind: "tax", repeatMonths: 12, note: "IRS Form 1040-ES. Confirm amounts with your CPA.", due: y => `${y}-04-15` },
  { title: "Estimated tax payment (Q2)", kind: "tax", repeatMonths: 12, note: "IRS Form 1040-ES.", due: y => `${y}-06-15` },
  { title: "Estimated tax payment (Q3)", kind: "tax", repeatMonths: 12, note: "IRS Form 1040-ES.", due: y => `${y}-09-15` },
  { title: "Estimated tax payment (Q4)", kind: "tax", repeatMonths: 12, note: "IRS Form 1040-ES, due in January for the prior year.", due: y => `${y + 1}-01-15` },
  { title: "Business insurance renewal", kind: "insurance", repeatMonths: 12, note: "General liability, professional liability and cyber." },
  { title: "Domain renewal", kind: "renewal", repeatMonths: 12, note: "Turn on auto-renew so the website and email never lapse." },
  { title: "Database backup check", kind: "backup", repeatMonths: 1, note: "Confirm a recent restore point exists for the Cinder database." },
  { title: "Review software subscriptions", kind: "renewal", repeatMonths: 3, note: "Cancel anything unused. Log the rest as expenses." },
];

export function addMonthsTo(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** The first future date for a common item in a given year (rolls to next year if already past). */
export function commonDue(item: (typeof COMMON_ITEMS)[number], today: string): string | null {
  if (!item.due) return null;
  const y = Number(today.slice(0, 4));
  const d = item.due(y);
  return d >= today ? d : item.due(y + 1);
}

export type DueState = "overdue" | "due_soon" | "upcoming" | "no_date" | "done";
export function dueState(due: string | null, status: string, today: string): DueState {
  if (status === "done") return "done";
  if (!due) return "no_date";
  if (due < today) return "overdue";
  const days = Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
  return days <= 14 ? "due_soon" : "upcoming";
}

export function cleanItem(input: unknown): { error: string } | { ok: { title: string; kind: Kind; dueDate: string | null; repeatMonths: number | null; note: string } } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim().slice(0, 160) : "";
  if (!title) return { error: "Give it a name." };
  const kind = (KINDS as readonly string[]).includes(String(r.kind)) ? (r.kind as Kind) : "other";
  const due = typeof r.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate) ? r.dueDate : null;
  const rep = Number(r.repeatMonths);
  const repeatMonths = Number.isInteger(rep) && rep >= 1 && rep <= 60 ? rep : null;
  return { ok: { title, kind, dueDate: due, repeatMonths, note: typeof r.note === "string" ? r.note.trim().slice(0, 600) : "" } };
}
