// Invoices, who owes what, and monthly retainer billing. Pure: no I/O.
// Money only counts as paid when the owner marks it paid. Nothing here sends anything.

export type OwedEntry = {
  id: string; title: string; client: string; email: string; amount: number;
  status: string; dueDate: string | null; invoiceNumber: number | null; invoiceSentAt: string | null; remindedAt: string | null;
};
export type Bucket = "overdue_30" | "overdue" | "due_week" | "later" | "no_date";

export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue_30: "30+ days overdue", overdue: "Overdue", due_week: "Due in the next 7 days", later: "Due later", no_date: "No due date",
};

const dayMs = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / dayMs);

export function bucketOf(e: { status: string; dueDate: string | null }, today: string): Bucket {
  if (!e.dueDate) return e.status === "overdue" ? "overdue" : "no_date";
  const late = daysBetween(e.dueDate, today);
  if (late >= 30) return "overdue_30";
  if (late > 0 || e.status === "overdue") return "overdue";
  return -late <= 7 ? "due_week" : "later";
}

/** Open money (expected or overdue), grouped and ordered most urgent first, with totals. */
export function owedSummary(entries: OwedEntry[], today: string) {
  const open = entries.filter(e => e.status === "expected" || e.status === "overdue");
  const order: Bucket[] = ["overdue_30", "overdue", "due_week", "later", "no_date"];
  const groups = order.map(b => {
    const items = open.filter(e => bucketOf(e, today) === b).sort((a, z) => (a.dueDate ?? "9999").localeCompare(z.dueDate ?? "9999"));
    return { bucket: b, label: BUCKET_LABELS[b], total: items.reduce((s, e) => s + e.amount, 0), items };
  }).filter(g => g.items.length);
  const overdue = open.filter(e => ["overdue_30", "overdue"].includes(bucketOf(e, today)));
  return {
    groups,
    totalOpen: open.reduce((s, e) => s + e.amount, 0),
    totalOverdue: overdue.reduce((s, e) => s + e.amount, 0),
    notInvoiced: open.filter(e => !e.invoiceSentAt).length,
  };
}

export const invoiceLabel = (n: number | null) => (n ? `INV-${n}` : "Draft");
export const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const longDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Next action for one open invoice, in plain words. */
export function nextMove(e: OwedEntry, today: string): string {
  if (!e.invoiceSentAt) return "Send the invoice";
  const late = e.dueDate ? daysBetween(e.dueDate, today) : 0;
  if (late <= 0) return "Sent. Wait for the due date";
  const sinceChase = e.remindedAt ? daysBetween(e.remindedAt.slice(0, 10), today) : null;
  if (sinceChase !== null && sinceChase < 3) return `Reminded ${sinceChase === 0 ? "today" : sinceChase === 1 ? "yesterday" : sinceChase + " days ago"}`;
  return late >= 14 ? "Call them today" : "Send a reminder";
}

/** A reminder email the owner opens in their own mail app. Never sent by Cinder. */
export function reminderEmail(e: OwedEntry, today: string, w: { ownerFirstName: string; businessName: string }, url: string) {
  const late = e.dueDate ? daysBetween(e.dueDate, today) : 0;
  const first = e.client.split(/\s+/)[0] || "there";
  const what = `${invoiceLabel(e.invoiceNumber)} for ${usd(e.amount)}`;
  const subject = late > 0 ? `${what} is past due` : `${what}${e.dueDate ? `, due ${longDate(e.dueDate)}` : ""}`;
  const opener = late <= 0
    ? `Here's ${what}${e.dueDate ? `, due ${longDate(e.dueDate)}` : ""}.`
    : late < 14
      ? `Quick reminder that ${what} was due ${longDate(e.dueDate!)}.`
      : `${what} is now ${late} days past due. Can you take care of it this week, or let me know if something's holding it up?`;
  const body = [`Hi ${first},`, "", opener, "", `You can view and pay it here: ${url}`, "", "Thanks,", w.ownerFirstName, w.businessName].join("\n");
  return { subject, body };
}

export type RetainerDeal = { id: string; contactId: string | null; projectId: string | null; client: string; monthlyFee: number; effectiveAt: string | null; endedAt: string | null; agreementStatus: string };

export const retainerKey = (dealId: string, month: string) => `retainer:${dealId}:${month}`;

/**
 * This month's retainer invoices for active agreements. One per deal per month (the key makes it safe to run twice).
 * Skips: not active, not live yet (go-live after the 1st of next month), ended, already billed, no fee.
 * The first month is billed by the won-deal handoff, so the go-live month itself is skipped.
 */
export function retainerPlan(deals: RetainerDeal[], month: string, existingKeys: Set<string>, dueDay = 1) {
  const monthStart = `${month}-01`;
  const due = `${month}-${String(Math.min(28, Math.max(1, dueDay))).padStart(2, "0")}`;
  const out: { dealId: string; contactId: string | null; projectId: string | null; title: string; amount: number; dueDate: string; sourceKey: string }[] = [];
  const skipped: { client: string; reason: string }[] = [];
  for (const d of deals) {
    const key = retainerKey(d.id, month);
    if (d.agreementStatus !== "active") { skipped.push({ client: d.client, reason: "agreement not active" }); continue; }
    if (!(d.monthlyFee > 0)) { skipped.push({ client: d.client, reason: "no monthly fee" }); continue; }
    if (!d.effectiveAt || d.effectiveAt.slice(0, 7) >= month) { skipped.push({ client: d.client, reason: "not live before this month" }); continue; }
    if (d.endedAt && d.endedAt <= monthStart) { skipped.push({ client: d.client, reason: "agreement ended" }); continue; }
    if (existingKeys.has(key)) { skipped.push({ client: d.client, reason: "already billed" }); continue; }
    out.push({ dealId: d.id, contactId: d.contactId, projectId: d.projectId, title: `${d.client} — monthly retainer (${monthName(month)})`, amount: d.monthlyFee, dueDate: due, sourceKey: key });
  }
  return { create: out, skipped };
}

export function monthName(month: string): string {
  return new Date(month + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
