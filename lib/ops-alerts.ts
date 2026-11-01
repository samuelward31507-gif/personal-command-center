// Business alerts for Today: the operations things that need you, ranked. Pure: no I/O.

export type OpsAlert = { level: "urgent" | "soon" | "info"; kind: string; text: string; href: string };
export type AlertInput = {
  today: string;
  reportOpens: { contactId: string; company: string; views: number; lastViewedAt: string; touchedSince: boolean }[];
  clocks: { projectId: string; client: string; state: string; label: string }[];
  compliance: { title: string; state: string; dueDate: string | null }[];
  reportsDue: { projectId: string; client: string; period: string }[];
  approvals: { projectId: string; client: string; changes: number; allApproved: boolean; sentAt: string | null }[];
  upsells: { projectId: string; client: string; daysLive: number; minTermEndsInDays: number | null }[];
  unbilled: { projectId: string; client: string }[];
};

const daysAgo = (today: string, iso: string) => Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(iso.slice(0, 10) + "T12:00:00Z")) / 86_400_000);

export function buildOpsAlerts(i: AlertInput): OpsAlert[] {
  const out: OpsAlert[] = [];
  for (const c of i.clocks) {
    if (c.state === "overdue") out.push({ level: "urgent", kind: "guarantee", text: `${c.client}: ${c.label}. The setup-fee refund is at stake.`, href: `/crm/client-success/${c.projectId}` });
    else if (c.state === "at_risk") out.push({ level: "urgent", kind: "guarantee", text: `${c.client}: go-live guarantee at risk (${c.label}).`, href: `/crm/client-success/${c.projectId}` });
    else if (c.state === "watch") out.push({ level: "soon", kind: "guarantee", text: `${c.client}: ${c.label} on the go-live guarantee.`, href: `/crm/client-success/${c.projectId}` });
  }
  for (const a of i.approvals) {
    if (a.changes > 0) out.push({ level: "urgent", kind: "approval", text: `${a.client} asked for ${a.changes} message change${a.changes === 1 ? "" : "s"}.`, href: `/crm/client-success/${a.projectId}` });
    else if (!a.allApproved && a.sentAt && daysAgo(i.today, a.sentAt) >= 2) out.push({ level: "soon", kind: "approval", text: `${a.client} hasn't approved their messages (sent ${daysAgo(i.today, a.sentAt)} days ago). Nudge them.`, href: `/crm/client-success/${a.projectId}` });
  }
  for (const c of i.compliance) {
    if (c.state === "overdue") out.push({ level: "urgent", kind: "compliance", text: `Overdue: ${c.title}.`, href: "/crm/operations" });
    else if (c.state === "due_soon") out.push({ level: "soon", kind: "compliance", text: `${c.title} due ${c.dueDate}.`, href: "/crm/operations" });
  }
  for (const u of i.unbilled) out.push({ level: "soon", kind: "billing", text: `${u.client}'s retainer isn't billed this month.`, href: "/crm/finance" });
  for (const r of i.reportsDue) out.push({ level: "soon", kind: "report", text: `Send ${r.client} their ${r.period} report.`, href: `/crm/reports?project=${r.projectId}` });
  for (const o of i.reportOpens) {
    if (o.touchedSince) continue;
    const d = daysAgo(i.today, o.lastViewedAt);
    if (d <= 7) out.push({ level: d <= 1 ? "urgent" : "soon", kind: "report_open", text: `${o.company} opened your report${o.views > 1 ? ` ${o.views} times` : ""}${d === 0 ? " today" : d === 1 ? " yesterday" : ` ${d} days ago`}. Follow up while it's fresh.`, href: `/crm?contact=${o.contactId}` });
  }
  for (const u of i.upsells) {
    if (u.minTermEndsInDays !== null && u.minTermEndsInDays >= 0 && u.minTermEndsInDays <= 21) out.push({ level: "soon", kind: "renewal", text: `${u.client}'s 3-month minimum ends in ${u.minTermEndsInDays} days. Show them the results.`, href: `/crm/client-success/${u.projectId}` });
    else if (u.daysLive >= 45 && u.daysLive <= 75) out.push({ level: "info", kind: "upsell", text: `${u.client} has been live ${u.daysLive} days: good time to offer the next add-on.`, href: `/crm/client-success/${u.projectId}` });
  }
  const order = { urgent: 0, soon: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
