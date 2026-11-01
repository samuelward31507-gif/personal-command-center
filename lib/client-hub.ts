// Client hub: everything about one client on one page, and what needs doing. Pure: no I/O.

export type HubInput = {
  today: string;
  deal: { contractStatus: string; signedAt: string | null; effectiveAt: string | null; endedAt: string | null; agreementStatus: string } | null;
  kickoff: { status: string; submittedAt: string | null } | null;
  milestones: { title: string; status: string; dueAt: string | null; completedAt: string | null }[];
  money: { status: string; amount: number; dueDate: string | null; paidAt: string | null; invoiceSentAt: string | null }[];
  reports: { period: string; status: string }[];
  success: { health: number; renewalDate: string | null; nextReview: string | null; status: string } | null;
  goLiveTitle: string;
};

export type Attention = { level: "urgent" | "soon" | "info"; text: string; href?: string };

const day = (s: string | null) => (s ? s.slice(0, 10) : null);
const diff = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
export const addMonths = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(dd, last)).padStart(2, "0")}`;
};
const lastMonthOf = (today: string) => addMonths(today.slice(0, 7) + "-01", -1).slice(0, 7);

/** Where the client is in the lifecycle: signed → kickoff → building → live → (ended). */
export function stageOf(h: HubInput): { key: "signing" | "kickoff" | "building" | "live" | "ended"; label: string } {
  if (h.deal?.agreementStatus === "ended" || (h.deal?.endedAt && h.deal.endedAt <= h.today)) return { key: "ended", label: "Ended" };
  if (h.deal?.contractStatus !== "signed" && !h.deal?.signedAt) return { key: "signing", label: "Waiting on signature" };
  const goLive = h.milestones.find(m => m.title === h.goLiveTitle);
  if (goLive?.status === "done" || (h.deal?.effectiveAt && h.deal.effectiveAt <= h.today && h.milestones.length === 0)) return { key: "live", label: "Live" };
  if (!h.kickoff || h.kickoff.status !== "submitted") return { key: "kickoff", label: "Waiting on kickoff checklist" };
  return { key: "building", label: "Building" };
}

export function hubSummary(h: HubInput) {
  const stage = stageOf(h);
  const ms = h.milestones.filter(m => m.status !== "cancelled");
  const done = ms.filter(m => m.status === "done").length;
  const open = ms.filter(m => m.status !== "done");
  const late = open.filter(m => m.dueAt && day(m.dueAt)! < h.today);
  const next = open.slice().sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))[0] ?? null;

  const paid = h.money.filter(m => m.status === "paid").reduce((s, m) => s + m.amount, 0);
  const openMoney = h.money.filter(m => m.status === "expected" || m.status === "overdue");
  const overdue = openMoney.filter(m => m.status === "overdue" || (m.dueDate && m.dueDate < h.today));
  const owed = openMoney.reduce((s, m) => s + m.amount, 0);
  const overdueAmt = overdue.reduce((s, m) => s + m.amount, 0);

  const goLiveDate = h.deal?.effectiveAt ?? null;
  const minTermEnds = stage.key === "live" && goLiveDate ? addMonths(goLiveDate, 3) : null;

  const attention: Attention[] = [];
  if (overdueAmt > 0) attention.push({ level: "urgent", text: `$${overdueAmt.toLocaleString("en-US")} overdue. Chase it from Money.`, href: "/crm/finance" });
  const unsent = openMoney.filter(m => !m.invoiceSentAt).length;
  if (unsent) attention.push({ level: "soon", text: `${unsent} invoice${unsent === 1 ? "" : "s"} not sent yet.`, href: "/crm/finance" });
  if (stage.key === "kickoff") attention.push({ level: "urgent", text: "Kickoff checklist not in yet. The go-live clock hasn't started. Send them the link." });
  if (late.length) attention.push({ level: "urgent", text: `${late.length} delivery step${late.length === 1 ? "" : "s"} late: ${late[0].title}${late.length > 1 ? " and more" : ""}.`, href: "/crm/projects" });
  if (stage.key === "live") {
    const want = lastMonthOf(h.today);
    const sent = h.reports.find(r => r.period === want && r.status === "sent");
    const liveBefore = goLiveDate && goLiveDate.slice(0, 7) <= want;
    if (liveBefore && !sent) attention.push({ level: "soon", text: `Send the ${monthLabel(want)} report.`, href: "/crm/reports" });
  }
  if (h.success?.renewalDate) {
    const d = diff(h.today, h.success.renewalDate);
    if (d >= 0 && d <= 30) attention.push({ level: "soon", text: `Renewal in ${d} day${d === 1 ? "" : "s"}. Book the review call.` });
  }
  if (h.success && h.success.health <= 2) attention.push({ level: "urgent", text: `Health is ${h.success.health}/5. Call them this week.` });
  if (minTermEnds) {
    const d = diff(h.today, minTermEnds);
    if (d >= 0 && d <= 21) attention.push({ level: "info", text: `Minimum term ends in ${d} day${d === 1 ? "" : "s"}. Show them the results before then.` });
  }
  const order = { urgent: 0, soon: 1, info: 2 };
  attention.sort((a, b) => order[a.level] - order[b.level]);

  return {
    stage, attention,
    delivery: { done, total: ms.length, late: late.length, next: next ? { title: next.title, dueAt: day(next.dueAt) } : null },
    money: { paid, owed, overdue: overdueAmt },
    goLiveDate, minTermEnds,
    lastReport: h.reports.filter(r => r.status === "sent").map(r => r.period).sort().pop() ?? null,
  };
}

export function monthLabel(period: string) {
  return new Date(period + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}
