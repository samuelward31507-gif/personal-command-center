// The Ask box, answered on the spot from the business's own records: "How many jobs did we book from Google this month?"
// gives the number and the rows behind it. Read-only. Questions it can't read return null and go to the slower answer.
export type AskCard = { id: string; name: string; source: string; stage: string; stageAt?: string | null; at: string; value: number | null; quote?: { amount: number | null } | null; invoice?: { total: number } | null; line?: string };
export type AskInvoice = { id: string; thread_id: string; customer: string; number: number; status: string; total: number; paid_amount?: number; due_on: string | null; sent_at: string | null };
export type AskPayment = { id: string; thread_id: string; customer?: string; amount: number; paid_on: string; number?: number };
export type AskConv = { id: string; name: string; source: string; created?: string | null; replySec?: number | null };
export type AskData = { board: AskCard[]; invoices: AskInvoice[]; payments: AskPayment[]; conversations: AskConv[] };
export type AskRow = { id: string; name: string; sub: string; value: number | null };
export type AskAnswer = { text: string; number: string; rows: AskRow[]; period: string };

const SRC: [RegExp, string, string][] = [[/\bgoogle\b/, "google", "Google"], [/\bangi\b|angie/, "angi", "Angi"], [/thumbtack/, "thumbtack", "Thumbtack"], [/facebook|\bfb\b/, "facebook", "Facebook"],
  [/\byelp\b/, "yelp", "Yelp"], [/nextdoor/, "nextdoor", "Nextdoor"], [/missed call/, "missed_call", "missed calls"], [/booking page|booking link/, "booking page", "the booking page"],
  [/web ?chat|website chat|\bchat\b/, "web chat", "website chat"], [/web ?form|website form|\bwebsite\b|contact form/, "web form", "the website form"], [/referr/, "referral", "referrals"], [/\btexts?\b(?! back)/, "text", "texts"]];
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const dayOf = (s: string | null | undefined) => (s ?? "").slice(0, 10);

/** The period a question means, as [from, to) dates, today's date given. This month when it doesn't say. */
export function periodOf(q: string, today: string): { from: string; to: string; label: string } {
  const t = new Date(today + "T12:00:00Z"), add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
  const tomorrow = add(t, 1), dow = t.getUTCDay(), monthStart = today.slice(0, 8) + "01";
  if (/\btoday\b/.test(q)) return { from: today, to: tomorrow, label: "today" };
  if (/yesterday/.test(q)) return { from: add(t, -1), to: today, label: "yesterday" };
  if (/last week/.test(q)) return { from: add(t, -dow - 7), to: add(t, -dow), label: "last week" };
  if (/this week|past week|7 days/.test(q)) return { from: add(t, -dow), to: tomorrow, label: "this week" };
  if (/last month/.test(q)) { const m = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)).toISOString().slice(0, 10); return { from: m, to: monthStart, label: "last month" }; }
  if (/30 days/.test(q)) return { from: add(t, -29), to: tomorrow, label: "in the last 30 days" };
  if (/this year|year to date|ytd|\bthe year\b/.test(q)) return { from: today.slice(0, 4) + "-01-01", to: tomorrow, label: "this year" };
  if (/all time|ever|so far|total/.test(q) && !/this month/.test(q)) return { from: "1970-01-01", to: tomorrow, label: "so far" };
  return { from: monthStart, to: tomorrow, label: "this month" };
}

export function askLocal(question: string, d: AskData, today = new Date().toLocaleDateString("en-CA")): AskAnswer | null {
  const q = question.toLowerCase().replace(/[?!.]/g, " ");
  const p = periodOf(q, today), inP = (s: string | null | undefined) => { const x = dayOf(s); return !!x && x >= p.from && x < p.to; };
  const src = SRC.find(([re]) => re.test(q)), srcLabel = src ? ` from ${src[2]}` : "";
  const bySrc = <T extends { source: string }>(list: T[]) => src ? list.filter(x => x.source === src[1]) : list;
  const worth = (c: AskCard) => c.invoice?.total || c.value || c.quote?.amount || 0;
  const cardRow = (c: AskCard, sub: string): AskRow => ({ id: c.id, name: c.name || "Unnamed", sub, value: worth(c) || null });
  if (/(owe|owed|unpaid|outstanding|overdue|balance)/.test(q)) {
    const late = /overdue|late|past due/.test(q);
    const list = d.invoices.filter(i => i.status === "sent" && i.total - (i.paid_amount ?? 0) > 0.005 && (!late || (!!i.due_on && i.due_on < today)));
    const sum = list.reduce((a, i) => a + i.total - (i.paid_amount ?? 0), 0);
    return { number: usd(sum), period: "", text: `${usd(sum)} is ${late ? "past due" : "owed to you"}, on ${list.length} ${list.length === 1 ? "invoice" : "invoices"}.`,
      rows: list.sort((a, b) => (b.total - (b.paid_amount ?? 0)) - (a.total - (a.paid_amount ?? 0))).map(i => ({ id: i.thread_id, name: i.customer || "Unnamed", sub: `#${i.number}${i.due_on ? `, due ${i.due_on}` : ""}`, value: Math.round((i.total - (i.paid_amount ?? 0)) * 100) / 100 })) };
  }
  if (/(paid|collected|came in|revenue|money in|made)/.test(q) && !/book/.test(q)) {
    const list = d.payments.filter(x => inP(x.paid_on)), sum = list.reduce((a, x) => a + x.amount, 0);
    return { number: usd(sum), period: p.label, text: `${usd(sum)} came in ${p.label}, ${list.length} ${list.length === 1 ? "payment" : "payments"}.`, rows: list.map(x => ({ id: x.thread_id, name: x.customer || "Unnamed", sub: `${x.paid_on}${x.number ? `, invoice #${x.number}` : ""}`, value: x.amount })) };
  }
  if (/(won|sold|closed|signed)/.test(q)) {
    const list = bySrc(d.board).filter(c => c.stage === "won" && inP(c.stageAt ?? c.at)), sum = list.reduce((a, c) => a + worth(c), 0);
    return { number: String(list.length), period: p.label, text: `${list.length} ${list.length === 1 ? "job" : "jobs"} won${srcLabel} ${p.label}${sum ? `, ${usd(sum)}` : ""}.`, rows: list.map(c => cardRow(c, `Won ${dayOf(c.stageAt ?? c.at)}`)) };
  }
  if (/(book|estimate|appointment|scheduled)/.test(q)) {
    const list = bySrc(d.board).filter(c => ["booked", "quoted", "won"].includes(c.stage) && inP(c.stageAt ?? c.at));
    return { number: String(list.length), period: p.label, text: `${list.length} ${list.length === 1 ? "job" : "jobs"} booked${srcLabel} ${p.label}.`, rows: list.map(c => cardRow(c, `${c.stage === "won" ? "Won" : c.stage === "quoted" ? "Quoted" : "Estimate booked"}, ${dayOf(c.stageAt ?? c.at)}`)) };
  }
  if (/(quote)/.test(q)) {
    const quiet = /(answer|respond|quiet|hasn|haven|waiting|open)/.test(q);
    const list = bySrc(d.board).filter(c => c.stage === "quoted" && (quiet || inP(c.stageAt ?? c.at))), sum = list.reduce((a, c) => a + worth(c), 0);
    return { number: String(list.length), period: quiet ? "" : p.label, text: quiet ? `${list.length} ${list.length === 1 ? "quote is" : "quotes are"} waiting on an answer${sum ? `, ${usd(sum)}` : ""}.` : `${list.length} ${list.length === 1 ? "quote" : "quotes"} out${srcLabel} ${p.label}${sum ? `, ${usd(sum)}` : ""}.`,
      rows: list.map(c => cardRow(c, `Quoted ${dayOf(c.stageAt ?? c.at)}`)) };
  }
  if (/(lead|came in|new customer|inquir|how many people|calls?)/.test(q)) {
    const list = bySrc(d.conversations).filter(x => inP(x.created));
    const fast = list.map(x => x.replySec).filter((s): s is number => s != null).sort((a, b) => a - b), med = fast.length ? fast[Math.floor(fast.length / 2)] : null;
    return { number: String(list.length), period: p.label, text: `${list.length} ${list.length === 1 ? "lead" : "leads"}${srcLabel} ${p.label}${med != null ? `, first reply in ${med < 60 ? med + "s" : Math.round(med / 60) + "m"}` : ""}.`,
      rows: list.map(x => ({ id: x.id, name: x.name, sub: `${dayOf(x.created)}${x.replySec != null ? `, replied in ${x.replySec}s` : ""}`, value: null })) };
  }
  return null;
}
