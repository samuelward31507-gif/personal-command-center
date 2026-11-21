"use client";

// Home: the dashboard. Four figures, what needs the owner, the pipeline by stage, today's visits, the week as a
// strip of days, what Cinder did, and the latest activity. Everything is a tap from here.
import { jobSteps } from "@/lib/crm";
import type { Report } from "@/lib/client-reports";
import { overdue } from "@/lib/billing";
import { useEffect, useRef, useState } from "react";
import { Avatar, Icon, Spinner, ago, clock, dateLabel, first, fmtPhone, secs, todayIso, usd, type Api } from "./parts";
import { Bars, Guide, Kpis, PageHead } from "./charts";
import { TodayTop } from "./evening";
import { askLocal, type AskRow } from "@/lib/ask-local";
import { line } from "./jobs";
import { suggestReply } from "./replies";
import { mailWaiting, sourceLabel, type Biz, type Data, type Go } from "./types";
import { jobPrice } from "@/lib/service";
import { jobProfit } from "@/lib/crm";
import { TasksSection } from "./records";
import { taskOrder, warrantyEndingSoon } from "@/lib/records";

type Kind = "reply" | "money" | "quote" | "install" | "invoice" | "review" | "sam" | "remind";
type Action = { key: string; kind: Kind; title: string; sub: string; go: () => void; cta: string; primary?: boolean; draft?: string; money: number; urgent?: boolean };
/** What a job is worth right now: the invoice, the value, the quote, or the top of the ballpark. */
const worth = (c: { value: number | null; quote: { amount: number | null } | null; ballpark: { high: number } | null; invoice: { total: number } | null } | undefined) => c ? c.invoice?.total || c.value || c.quote?.amount || c.ballpark?.high || 0 : 0;
const ICON: Record<Kind, [string, string]> = { reply: ["chat", "ember"], money: ["invoice", "red"], quote: ["quote", ""], install: ["cal", ""], invoice: ["invoice", ""], review: ["star", "ok"], sam: ["user", ""], remind: ["clock", "ember"] };
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
const daysPast = (d: string) => Math.max(1, Math.round((Date.now() - Date.parse(d + "T23:59:00")) / 86400000));
const iso = (d: Date) => d.toLocaleDateString("en-CA");

/** One question about the business, answered from its own data. Nothing is saved. */
function AskBox({ api, project, ask, d, go }: { api: Api; project: string; ask?: { q: string; n: number }; d: Data; go: Go }) {
  const [q, setQ] = useState(ask?.q ?? ""), [a, setA] = useState<{ q: string; text: string; number?: string; rows?: AskRow[] } | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const run = async (text: string) => {
    const question = text.trim(); if (!question || busy) return;
    // Counts, sums and lists come straight from the records on the screen: the number, and the rows behind it.
    const local = askLocal(question, { board: d.board ?? [], invoices: d.invoices ?? [], payments: d.payments ?? [], conversations: d.live.conversations });
    if (local) { setErr(""); setA({ q: question, text: local.text, number: local.number, rows: local.rows }); return; }
    setBusy(true); setErr(""); setA(null);
    try { const r = await api<{ answer: string }>("/api/app/act", { p: project, action: "ask", question }); setA({ q: question, text: r.answer }); }
    catch (e) { setErr(e instanceof Error ? e.message : "No answer just now."); } finally { setBusy(false); }
  };
  useEffect(() => { if (ask?.q) { setQ(ask.q); void run(ask.q); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ask?.n]);
  const tries = ["How many jobs did we book from Google this month?", "Who hasn't answered their quote?", "Who owes me money?", "What came in last month?"];
  return <section className="ask">
    <form className="ask-q" onSubmit={e => { e.preventDefault(); void run(q); }}>
      <Icon name="bolt" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about your jobs, money or week" aria-label="Ask about your business" />
      <button type="submit" className="btn ink sm" disabled={busy || !q.trim()}>{busy ? <Spinner /> : "Ask"}</button>
    </form>
    {a ? <div className="ask-a">{a.number && <b className="ask-n">{a.number}</b>}<p>{a.text}</p><button type="button" className="link" onClick={() => { setA(null); setQ(""); }}>Clear</button>
      {a.rows && a.rows.length > 0 && <ul className="ask-rows">{a.rows.slice(0, 25).map((r, i) => <li key={r.id + i}><button type="button" className="link" onClick={() => go.record(r.id)}>{r.name}</button><small>{r.sub}</small>{r.value != null && <b>{"$" + Math.round(r.value).toLocaleString("en-US")}</b>}</li>)}
        {a.rows.length > 25 && <li className="mut">And {a.rows.length - 25} more.</li>}</ul>}</div>
      : err ? <p className="fine" style={{ color: "var(--bad)" }}>{err}</p>
      : <div className="chips">{tries.map(t => <button key={t} type="button" onClick={() => { setQ(t); void run(t); }}>{t}</button>)}</div>}
  </section>;
}

/** The month's goal: won so far against what the owner aims for. Set it once; it stays. */
export function GoalBox({ d, cards, api, project, toast, reload }: { d: Data; cards: NonNullable<Data["board"]>; api: Api; project: string; toast?: (t: string, bad?: boolean) => void; reload?: () => Promise<void> }) {
  const goal = Number(d.setup?.monthly_goal) || 0, month = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const won = cards.filter(c => c.stage === "won" && !c.pastCustomer && (c.stageAt ?? "").slice(0, 7) === month).reduce((a, c) => a + (jobPrice(c) ?? 0), 0);
  const setGoal = async () => { const v = prompt("Your goal for won work each month, in dollars", goal ? String(goal) : "50000"); if (v === null) return;
    try { await api("/api/app/act", { p: project, action: "setup", setup: { monthly_goal: v.replace(/[^\d]/g, "") || "0" } }); await reload?.(); } catch (e) { toast?.(e instanceof Error ? e.message : "Didn't save.", true); } };
  const day = new Date().getDate(), daysIn = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(), pace = goal ? Math.round(goal * day / daysIn) : 0;
  return <section><h3>This month<small><button type="button" className="link" onClick={() => void setGoal()}>{goal ? "Change goal" : "Set a goal"}</button></small></h3>
    {goal ? <><div className="goal-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(won / goal * 100))}%` }} /><b style={{ left: `${Math.min(100, Math.round(day / daysIn * 100))}%` }} /></div>
      <p className="fine" style={{ margin: "6px 0 0" }}><b style={{ color: "var(--ink)" }}>{usd(won)}</b> won of {usd(goal)}. {won >= goal ? "Goal reached." : won >= pace ? "Ahead of pace." : `${usd(pace - won)} behind pace.`}</p></>
      : <p className="fine" style={{ margin: 0 }}>{usd(won)} won so far this month.</p>}
  </section>;
}

export function TodayScreen({ d, biz, go, wide, api, project, ask, toast, reload }: { d: Data; biz: Biz; go: Go; wide: boolean; api: Api; project: string; ask?: { q: string; n: number }; toast?: (t: string, bad?: boolean) => void; reload?: () => Promise<void> }) {
  const today = todayIso(), L = d.live, cards = d.board ?? [], invoices = d.invoices ?? [];
  const byThread = new Map(cards.map(c => [c.id, c]));
  const asks = L.conversations.filter(c => c.status === "paused");

  const actions: Action[] = [];
  for (const t of taskOrder(d.tasks ?? [], today).filter(t => t.due_on && t.due_on <= today)) actions.push({ key: "k" + t.id, kind: "remind", title: t.title, sub: t.due_on! < today ? `To-do, was due ${dateLabel(t.due_on!)}` : "To-do, due today", go: () => { if (t.thread) go.record(t.thread); }, cta: t.thread ? "Open" : "See below", money: 0 });
  for (const e of warrantyEndingSoon(d.equipment ?? [], today, 30)) actions.push({ key: "w" + e.id, kind: "remind", title: `${e.customer ?? "A customer"}'s ${(e.kind || "equipment").toLowerCase()} warranty ends ${dateLabel(e.warranty_until!)}`, sub: "A good time to offer a service visit or a plan", go: () => go.record(e.thread_id), cta: "Open", money: 0 });
  // Jobs whose logged costs leave a thin margin (under 15%): worth a look before the next one is priced the same way.
  for (const c of cards) if (c.stage === "won" && !c.pastCustomer && (c.costs.materials + c.costs.labor + c.costs.other) > 0) {
    const pf = jobProfit(jobPrice(c), c.costs);
    if (pf && pf.margin < 15) actions.push({ key: "pm" + c.id, kind: "money", title: `${c.name}'s job is at a ${pf.margin}% margin`, sub: `${usd(pf.cost)} in costs on ${usd(jobPrice(c) ?? 0)}${pf.profit < 0 ? ", a loss" : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Look", money: 0 });
  }
  for (const m of mailWaiting(d)) actions.push({ key: "m" + m.id, kind: "reply", title: `${m.name || m.email || sourceLabel(m.source)} emailed, no phone`, sub: `${sourceLabel(m.source || "email")} by email${m.message ? `: ${m.message.slice(0, 90)}` : ""}`, go: () => go.tab("inbox"), cta: "Add phone", money: 0, urgent: true });
  for (const a of asks) actions.push({ key: "r" + a.id, kind: "reply", title: `Reply to ${a.name}`, sub: a.ask || a.last, go: () => go.thread(a.id), cta: "Reply", primary: true, money: worth(byThread.get(a.id)) });
  for (const c of cards) if (c.stage === "quoted" && c.quote?.status === "replied") actions.push({ key: "qr" + c.id, kind: "reply", title: `${c.name} answered the quote`, sub: c.quote.amount ? `${usd(c.quote.amount)} quote` : "", go: () => go.thread(c.id), cta: "Read", money: c.quote.amount ?? 0 });
  for (const i of invoices) {
    if (i.status === "sent" && i.paid_claimed_at) actions.push({ key: "pc" + i.id, kind: "money", title: `${i.customer} says they paid`, sub: `${usd(i.total)}, invoice #${i.number}`, go: () => go.invoice(i.id), cta: "Check", money: i.total });
    else if (overdue(i.status, i.due_on, today)) actions.push({ key: "od" + i.id, kind: "money", title: `${i.customer}, invoice ${daysPast(i.due_on!)} ${daysPast(i.due_on!) === 1 ? "day" : "days"} late`, sub: `${usd(i.total)}, #${i.number}${i.reminders ? `, ${i.reminders} reminder${i.reminders === 1 ? "" : "s"} sent` : ""}`, go: () => go.invoice(i.id), cta: "Open", money: i.total });
    else if (i.status === "draft") actions.push({ key: "dr" + i.id, kind: "invoice", title: `Send ${first(i.customer)}'s invoice`, sub: `${usd(i.total)}, #${i.number}, draft`, go: () => go.invoice(i.id), cta: "Send", money: i.total });
  }
  const due = d.appointments.filter(a => Date.parse(a.starts_at) < Date.now() - 3600000);
  const quoted = new Set<string>();
  for (const a of due) {
    const c = byThread.get(a.thread_id);
    if (c && (c.stage === "quoted" || c.stage === "won" || c.stage === "lost")) continue;
    quoted.add(a.thread_id);
    actions.push({ key: "q" + a.id, kind: "quote", title: `Quote ${a.customer_name}`, sub: `Estimate ${new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${c?.line ? `, ${line(c)}` : ""}`, go: () => c ? go.record(c.id, { ask: "quoted" }) : go.tab("calendar"), cta: "Write quote", money: worth(c) });
  }
  for (const c of cards) if (!quoted.has(c.id) && c.stage === "quoted" && c.quote && !c.quote.linked && c.quote.amount) actions.push({ key: "qs" + c.id, kind: "quote", title: `Send ${c.name} the quote`, sub: `${usd(c.quote.amount)}, not sent yet`, go: () => go.record(c.id), cta: "Send", money: c.quote.amount });
  // Quotes they keep opening without saying yes: a nudge in the owner's words, written and waiting.
  for (const c of cards) if (c.stage === "quoted" && c.quote?.linked && c.quote.status !== "replied" && ((c.quote.views ?? 0) >= 2 || c.quote.steps >= (d.quoteSteps || 3))) {
    const draft = suggestReply(c.name, null, { stage: "quoted", owner: d.owner, quoteAmount: c.quote.amount });
    actions.push({ key: "nq" + c.id, kind: "quote", title: (c.quote.views ?? 0) >= 2 ? c.name + " keeps looking" : c.name + " went quiet", sub: (c.quote.amount ? usd(c.quote.amount) + " quote, " : "") + ((c.quote.views ?? 0) >= 2 ? `viewed ${c.quote.views} times, not approved` : "no answer yet"), draft, go: () => go.record(c.id, { view: "activity", draft }), cta: "Nudge", money: c.quote.amount ?? 0 });
  }
  for (const c of cards) {
    if (c.stage !== "won" || c.pastCustomer) continue;
    if (!c.install && !c.invoice) actions.push({ key: "in" + c.id, kind: "install", title: `Schedule ${first(c.name)}'s install`, sub: `${c.value ? usd(c.value) + " job" : "Won"}${c.line ? `, ${line(c)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Schedule", money: worth(c) });
    else if (c.install && c.install >= today) {
      const days = Math.round((Date.parse(c.install + "T12:00:00") - Date.parse(today + "T12:00:00")) / 86400000);
      const step = jobSteps(biz.trade, c.details).find(s => !c.job[s.key]);
      if (days <= 7 && step && step.key !== "installed" && step.key !== "walk") actions.push({ key: "js" + c.id, kind: "install", title: `${c.name}, ${step.label.toLowerCase()}?`, sub: `Install ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}${c.line ? `, ${line(c)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Open job", money: worth(c) });
    }
    else if (c.install && c.install < today && !c.invoice) actions.push({ key: "iv" + c.id, kind: "invoice", title: `Invoice ${c.name}`, sub: `Installed ${dateLabel(c.install)}${c.value ? `, ${usd(c.value)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Invoice", money: worth(c) });
    else if (c.install && c.install < today && c.invoice?.status === "paid" && !c.reviewSent && biz.reviewLink) actions.push({ key: "rv" + c.id, kind: "review", title: `${c.name}, ask for the review`, sub: `Installed ${dateLabel(c.install)}, paid in full`, go: () => go.record(c.id, { view: "job" }), cta: "Open", money: worth(c) });
  }
  for (const c of cards) if (c.remind && Date.parse(c.remind.at) <= Date.now() + 3600000) actions.push({ key: "rm" + c.id, kind: "remind", title: c.remind.note ? `${first(c.name)}: ${c.remind.note}` : `Check in with ${c.name}`, sub: `Reminder${Date.parse(c.remind.at) < Date.now() - 3600000 ? ` from ${ago(c.remind.at)}` : ""}${c.line ? `, ${line(c)}` : ""}`, go: () => go.record(c.id), cta: "Open", primary: true, money: worth(c) });
  if (d.unreadFromSam) actions.push({ key: "sam", kind: "sam", title: "Message from Sam", sub: "Your account rep", go: () => go.tab("sam"), cta: "Open", money: 0 });
  // Most money at stake first. A waiting reply with nothing priced yet still beats a zero.
  // A brand-new lead nobody has answered yet goes first: speed wins the job. Then the most money.
  actions.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || (b.money || (b.kind === "reply" ? 1 : 0)) - (a.money || (a.kind === "reply" ? 1 : 0)));
  const atStake = actions.reduce((a, x) => a + x.money, 0);

  // Visits: estimates Cinder booked and installs the owner set, for today and the week strip.
  type Visit = { key: string; at: number; day: string; time: string; who: string; what: "estimate" | "install"; sub: string; go: () => void; phone?: string; addr?: string; id?: string };
  const visits: Visit[] = [
    ...d.appointments.filter(a => Date.parse(a.starts_at) > Date.now() - 12 * 3600000).map(a => { const c = byThread.get(a.thread_id); return { key: "a" + a.id, at: Date.parse(a.starts_at), day: iso(new Date(a.starts_at)), time: clock(a.starts_at), who: a.customer_name || fmtPhone(a.customer_phone), what: "estimate" as const, sub: [c ? line(c) : "", String(c?.details.address ?? "")].filter(Boolean).join(", ") || "Booked automatically", go: () => c ? go.record(c.id) : go.thread(a.thread_id), phone: a.customer_phone || c?.phone || "", addr: String(c?.details.address ?? ""), id: c?.id ?? a.thread_id }; }),
    ...cards.filter(c => c.stage === "won" && c.install && c.install >= today).flatMap(c => Array.from({ length: c.installDays || 1 }, (_, k) => { const dd = new Date(Date.parse(c.install! + "T12:00:00") + k * 86400000); return { key: `i${c.id}${k}`, at: Date.parse(`${iso(dd)}T${c.installTime || "07:00"}`), day: iso(dd), time: c.installTime ? hhmm(c.installTime) : "All day", who: c.name, what: "install" as const, sub: [line(c), String(c.details.address ?? "")].filter(Boolean).join(", ") || (c.installDays > 1 ? `Day ${k + 1} of ${c.installDays}` : ""), go: () => go.record(c.id, { view: "job" }), phone: c.phone, addr: String(c.details.address ?? ""), id: c.id }; })),
  ].sort((a, b) => a.at - b.at);
  const todayList = visits.filter(v => v.day === today);
  const days = Array.from({ length: 7 }, (_, k) => { const dd = new Date(Date.parse(today + "T12:00:00") + k * 86400000); const key = iso(dd); return { key, dow: dd.toLocaleDateString("en-US", { weekday: "short" }), num: dd.getDate(), items: visits.filter(v => v.day === key) }; });
  const nextVisit = visits.find(v => v.day > today);

  const sent = invoices.filter(i => i.status === "sent"), owed = sent.reduce((a, i) => a + i.total - (i.paid_amount ?? 0), 0), late = sent.filter(i => overdue(i.status, i.due_on, today));
  const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const [all, setAll] = useState(false);
  const [hideSetup, setHideSetup] = useState(true);
  useEffect(() => { try { setHideSetup(localStorage.getItem("cinder-setup-hide") === "1"); } catch { setHideSetup(false); } }, []);
  const s0 = d.setup ?? {};
  const setup = [
    { title: "Texting number", text: "Calls and texts get answered in seconds, and every reply comes from your business.", done: !!d.number, action: <button type="button" className="btn sm" onClick={() => go.tab("system")}>Connections</button> },
    { title: "Your cell for alerts", text: "So the jobs that need you reach you by text.", done: s0.has_cell === "yes", action: <button type="button" className="btn sm" onClick={() => go.tab("sam")}>Ask Sam</button> },
    { title: "Google Calendar", text: "Estimates get booked only where you're free.", done: biz.calendar, action: d.calendar?.connectUrl ? <a className="btn sm" href={d.calendar.connectUrl} target="_blank" rel="noreferrer">Connect</a> : undefined },
    { title: "Your prices", text: "Ballparks by text and quotes that draft themselves.", done: !!biz.priceBook, action: <button type="button" className="btn sm" onClick={go.setup}>Add prices</button> },
    { title: "Your pay link", text: "The Pay button on every invoice opens it.", done: biz.payLink, action: <button type="button" className="btn sm" onClick={go.billing}>Add pay link</button> },
    { title: "Google review link", text: "One text the morning after each install asks for the review.", done: biz.reviewLink, action: <button type="button" className="btn sm" onClick={() => go.tab("system")}>Add it</button> },
    { title: "Past customers", text: "Import from Jobber or a spreadsheet so they're all in one place.", done: (d.customers ?? []).some(c => c.source === "import"), action: <button type="button" className="btn sm" onClick={go.importCustomers}>Import</button> },
  ];
  const setupLeft = setup.filter(x => !x.done).length;
  // The last 30 days, with the rates that matter: from the same report as the Reports tab.
  const [rep, setRep] = useState<Report | null>(null);
  useEffect(() => { let on = true; api<{ report: Report }>(`/api/app/data?p=${project}&report=30`).then(r => { if (on) setRep(r.report); }).catch(() => {}); return () => { on = false; }; }, [api, project]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const shown = all ? actions : actions.slice(0, 7);

  const hour = new Date().getHours(), part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const ownerFirst = (d.owner || "").split(" ")[0];
  const weeks = L.weeks.slice(-8);
  const bookSpark = weeks.map(w => w.leads ? w.booked / w.leads : 0);
  const pipe = (["new", "booked", "quoted", "won"] as const).map(st => { const list = cards.filter(c => !c.pastCustomer && c.stage === st && (st !== "won" || c.invoice?.status !== "paid")); return { st, n: list.length, v: list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? c.ballpark?.high ?? 0), 0) }; });
  const pipeMax = Math.max(1, ...pipe.map(p => p.v));
  const PIPE_L = { new: "New leads", booked: "Estimate booked", quoted: "Quoted", won: "Won, not paid" } as const;
  const live = L.conversations.slice(0, 7);
  const sayFor = (c: (typeof live)[number]) => c.status === "paused" ? ["Your turn", "ember"] : c.status === "booked" ? ["Booked", "blue"] : c.status === "opted_out" ? ["Opted out", ""] : c.status === "closed" ? ["Closed", ""] : ["Replying for you", "good"];

  // One sentence for the night, not four boxes.
  const ev = d.evening, evHour = new Date().getHours();
  const evLabel = evHour >= 17 ? "While you worked" : evHour < 11 ? "Overnight" : "In the last 24 hours";
  const evParts = ev ? [
    ev.leads ? `${ev.afterHours || ev.leads} ${(ev.afterHours || ev.leads) === 1 ? "lead" : "leads"} answered${ev.afterHours ? " after hours" : ""}` : "",
    ev.booked ? `${ev.booked} ${ev.booked === 1 ? "estimate" : "estimates"} booked` : "",
    ev.quotesBackValue ? `${usd(ev.quotesBackValue)} in quotes came back` : "",
    ev.paid ? `${usd(ev.paid)} paid to you` : "",
  ].filter(Boolean) : [];
  const evText = evParts.length ? `${evLabel}: ${evParts.length > 1 ? evParts.slice(0, -1).join(", ") + " and " + evParts.at(-1) : evParts[0]}.` : "";
  const isOwner = !biz.crew && d.role !== "office";
  const [evSms, setEvSms] = useState(d.setup?.evening_text === "yes");
  const toggleEv = async () => { try { await api("/api/app/act", { p: project, action: "setup", setup: { evening_text: evSms ? "no" : "yes" } }); setEvSms(!evSms); toast?.(evSms ? "No evening text." : "You'll get this as a text at 6 PM."); } catch (e) { toast?.(e instanceof Error ? e.message : "Didn't save.", true); } };
  const nextSetup = setup.find(x => !x.done);
  const won30 = rep?.now.wonValue ?? L.wonValue, sec = rep?.now.replySec ?? L.replySec;
  const nums: { label: string; value: string; sub: string; tone?: "bad" | ""; go?: () => void }[] = [
    { label: "Won", value: usd(won30), sub: rep ? `${rep.now.won} ${rep.now.won === 1 ? "job" : "jobs"}` : `${L.won} jobs`, go: () => go.tab("numbers") },
    { label: "Quotes out", value: usd(L.chasingValue), sub: L.chasing ? `${L.chasing} waiting` : "none waiting", go: () => go.tab("quotes") },
    { label: "Owed to you", value: usd(owed), sub: late.length ? `${late.length} past due` : sent.length ? `${sent.length} sent` : "nothing out", tone: late.length ? "bad" : "", go: () => go.tab("invoices") },
    { label: "Book rate", value: rep ? pct(rep.now.booked, rep.now.leads) : pct(L.booked, L.leads), sub: rep ? `${rep.now.booked} of ${rep.now.leads} leads` : "", go: () => go.tab("numbers") },
    { label: "First reply", value: secs(sec), sub: "median, day or night" },
  ];
  const pipeTotal = pipe.reduce((a, p) => a + p.v, 0);

  // The four numbers across the top, like the window on the website: today's leads, how many got a reply,
  // what got booked this week, and how fast the first reply goes out.
  const isToday = (at?: string | null) => !!at && iso(new Date(at)) === today;
  const todays = L.conversations.filter(c => isToday(c.created));
  const answeredToday = todays.filter(c => c.replySec != null).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const bookedWeek = cards.filter(c => !c.pastCustomer && (c.stage === "booked" || c.stage === "won") && c.stageAt && Date.parse(c.stageAt) > weekAgo);
  const bookedWeekValue = bookedWeek.reduce((a, c) => a + (jobPrice(c) ?? c.value ?? 0), 0);
  const figs = [
    { k: "Leads today", v: String(L.leadsToday || todays.length), go: () => go.tab("inbox") },
    { k: "Answered", v: (L.leadsToday || todays.length) ? `${answeredToday} of ${L.leadsToday || todays.length}` : "–", go: () => go.tab("inbox") },
    { k: "Booked this week", v: bookedWeekValue ? usd(bookedWeekValue) : String(bookedWeek.length), go: () => go.tab("jobs") },
    { k: "First reply", v: secs(L.replySecWeek ?? sec), go: () => go.tab("numbers") },
  ];
  // The live list: what just happened, one line each, the outcome on the right in green when it went well.
  const feed = L.conversations.slice(0, 6).map(c => {
    const card = byThread.get(c.id);
    const outcome = c.status === "paused" ? { t: "Your turn", tone: "wait" } : c.status === "booked" ? { t: card?.stage === "won" ? "Won" : "Booked", tone: "done" }
      : c.status === "opted_out" ? { t: "Opted out", tone: "" } : c.replySec != null ? { t: `Texted in ${secs(c.replySec)}`, tone: "done" } : { t: c.at ? ago(c.at) : "", tone: "" };
    const when = c.created ? (isToday(c.created) ? clock(c.created) : dateLabel(iso(new Date(c.created)))) : "";
    return { id: c.id, name: c.name || "New lead", what: [sourceLabel(c.source), when].filter(Boolean).join(" · "), ...outcome };
  });

  // Today, the same shape as the owner's command center: the title and what needs them, a live line, the four numbers
  // that run a fence or generator shop, Your move (J and K to walk it), the quotes out, then Next up and to-dos.
  const upNext = todayList.find(v => v.at > Date.now() - 30 * 60000) ?? nextVisit;
  const openTasks = (d.tasks ?? []).filter(t => !t.done_at).length;
  const [showTasks, setShowTasks] = useState(false);
  const rows = all ? actions : actions.slice(0, 6);
  const [sel, setSel] = useState(-1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || !rows.length || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) || document.querySelector(".sheet, [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "arrowdown") { e.preventDefault(); setSel(i => Math.min(rows.length - 1, i + 1)); }
      else if (k === "k" || k === "arrowup") { if (sel < 0) return; e.preventDefault(); setSel(i => Math.max(0, i - 1)); }
      else if (k === "escape") setSel(-1);
      else if (sel >= 0 && (k === "enter" || k === rows[sel]?.cta.charAt(0).toLowerCase())) { e.preventDefault(); rows[sel]?.go(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [rows, sel]);
  useEffect(() => { if (sel >= rows.length) setSel(rows.length - 1); }, [rows.length, sel]);

  // The live line: the last few leads Cinder answered, one at a time.
  const liveList = L.conversations.filter(c => c.replySec != null && c.created).slice(0, 3);
  const [li, setLi] = useState(0);
  useEffect(() => { if (liveList.length < 2) return; const t = setInterval(() => setLi(i => i + 1), 5000); return () => clearInterval(t); }, [liveList.length]);
  const lv = liveList.length ? liveList[li % liveList.length] : null;

  // The four numbers: what sold, how fast every lead hears back, how many quotes turn into jobs, and where the quotes are.
  const now = rep?.now, before = rep?.before;
  const sold = now?.wonValue ?? L.wonValue, soldBefore = before?.wonValue ?? 0, jobs = now?.won ?? L.won;
  const closeRate = now && now.quoted ? Math.round((now.won / now.quoted) * 100) : null;
  const closeBefore = before && before.quoted ? Math.round((before.won / before.quoted) * 100) : null;
  const leads30 = L.leads, answered30 = L.answered;
  const qCards = cards.filter(c => c.stage === "quoted" && c.quote && !c.pastCustomer);
  const qv = (c: (typeof qCards)[number]) => c.quote?.amount ?? c.value ?? 0;
  const notSent = qCards.filter(c => !c.quote!.linked), viewed = qCards.filter(c => c.quote!.linked && c.quote!.viewed), sentOnly = qCards.filter(c => c.quote!.linked && !c.quote!.viewed);
  const qTotal = qCards.reduce((a, c) => a + qv(c), 0), share = (l: typeof qCards) => qTotal ? (l.reduce((a, c) => a + qv(c), 0) / qTotal) * 100 : 0;
  const soldN = useCountUp(sold), secN = useCountUp(sec ?? 0), closeN = useCountUp(closeRate ?? 0), quotesN = useCountUp(qTotal);
  const series = (rep?.series ?? []).map(p => p.wonValue);

  // Quotes out, the next step for each first.
  const qRows = qCards.map(c => { const q = c.quote!, views = q.views ?? (q.viewed ? 1 : 0);
    const st = !q.linked ? ["Not sent", "urgent"] : q.status === "replied" ? ["Answered", "urgent"] : views >= 2 ? [`Viewed ${views} times`, "urgent"] : q.viewed ? ["Viewed", ""] : ["Sent", ""];
    const next = !q.linked ? "Send the quote" : q.status === "replied" ? "Read their answer" : views >= 2 ? "Call today" : q.nextChase ? `Auto follow-up ${dateLabel(q.nextChase)}` : "Waiting on them";
    return { c, st, next, rank: st[1] ? 0 : 1, v: qv(c) }; }).sort((a, b) => a.rank - b.rank || b.v - a.v);

  return <div className="t8">
    <header className="t8-head">
      <div className="t8-title">
        <p className="t8-date">{dateLine}</p>
        <h1>Today</h1>
        <p className="t8-sub">{actions.length ? <><span className="t8-hot">{actions.length} {actions.length === 1 ? "thing" : "things"}</span> {actions.length === 1 ? "needs" : "need"} you.{atStake > 0 && <> <b>{usd(atStake)}</b> on {actions.length === 1 ? "it" : "them"}.</>}</> : "Nothing needs you. Cinder is handling it."}</p>
        {lv && <p className="t8-live" aria-live="polite"><i aria-hidden="true" /><span className="g">Live</span><span key={lv.id + li} className="t8-live-t"><b>{lv.name}</b> got a text back in {secs(lv.replySec ?? null)} <em>· {ago(lv.created!)}</em></span></p>}
      </div>
      <div className="t8-acts"><button type="button" className="btn" onClick={() => go.tab("calendar")}>Calendar</button><button type="button" className="btn ink" onClick={go.addLead}>New lead</button></div>
    </header>
    {ask && ask.q && <section className="t7-ask"><AskBox api={api} project={project} ask={ask} d={d} go={go} /></section>}

    <section className="t8-figs" aria-label="Last 30 days">
      <button type="button" className="t8-fig" onClick={() => go.tab("numbers")}>
        <span className="k">Sold, last 30 days</span>
        <span className="v">{usd(soldN)}{sold > soldBefore && soldBefore > 0 ? <small className="up">+{usd(sold - soldBefore)}</small> : null}</span>
        {series.length > 1 && <Spark values={series} />}
        <span className="c">{jobs} {jobs === 1 ? "job" : "jobs"}{jobs ? <> · <b>{usd(Math.round(sold / jobs))}</b> average job</> : null}</span>
      </button>
      <button type="button" className="t8-fig" onClick={() => go.tab("inbox")}>
        <span className="k">Speed to lead</span>
        <span className="v">{sec != null ? secs(secN) : "–"}{leads30 > 0 && answered30 >= leads30 ? <small className="up">every lead</small> : null}</span>
        <span className="c t8-gap"><b>{answered30} of {leads30}</b> leads answered</span>
        <span className="c">Most shops take <b>40+ minutes</b></span>
      </button>
      <button type="button" className="t8-fig" onClick={() => go.tab("numbers")}>
        <span className="k">Close rate</span>
        <span className="v">{closeRate != null ? `${closeN}%` : "–"}{closeRate != null && closeBefore != null && closeRate > closeBefore ? <small className="up">+{closeRate - closeBefore} pts</small> : null}</span>
        <span className="t8-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, closeRate ?? 0)}%` }} /></span>
        <span className="c">{now ? <><b>{now.won}</b> won of <b>{now.quoted}</b> quotes · typical is 15–30%</> : "Won quotes out of quotes sent"}</span>
      </button>
      <button type="button" className="t8-fig" onClick={() => go.tab("quotes")}>
        <span className="k">Quotes out</span>
        <span className="v">{usd(quotesN)}<small>{qCards.length} open</small></span>
        <span className="t8-split" aria-hidden="true">{notSent.length > 0 && <i className="ns" style={{ width: `${share(notSent)}%` }} />}{viewed.length > 0 && <i className="vw" style={{ width: `${share(viewed)}%` }} />}{sentOnly.length > 0 && <i className="st" style={{ width: `${share(sentOnly)}%` }} />}</span>
        <span className="c t8-legend">{notSent.length > 0 && <span><i className="ns" />Not sent</span>}<span><i className="vw" />Viewed</span><span><i className="st" />Sent</span></span>
      </button>
    </section>

    {actions.length > 0 && <section className="t8-sec">
      <header><h2>Your move <span>{actions.length}</span></h2><span className="t8-hint wide-only"><kbd>J</kbd><kbd>K</kbd> to move <kbd>↵</kbd> open</span></header>
      <ul className="t8-rows">{rows.map((a, i) => { const st = STATUS_OF(a);
        return <li key={a.key}><button type="button" className={"t8-row" + (i === sel ? " sel" : "") + (st.isNew ? " new" : "")} onClick={a.go} onMouseEnter={() => sel >= 0 && setSel(i)}>
          <span className="t"><b>{a.title}</b><small>{a.sub}</small></span>
          <em className={"st " + st.tone}>{st.text}</em>
          <span className="amt">{a.money ? usd(a.money) : ""}</span>
          <span className="go">{i === sel && <><kbd>↵</kbd><kbd>{a.cta.charAt(0).toUpperCase()}</kbd></>}<b>{a.cta} →</b></span>
        </button></li>; })}</ul>
      {actions.length > 6 && <button type="button" className="t8-more" onClick={() => setAll(x => !x)}>{all ? "Show fewer" : `Show all ${actions.length}`}</button>}
    </section>}

    {qRows.length > 0 && <section className="t8-sec">
      <header><h2>Quotes <span>{qRows.length} open · {usd(qTotal)}</span></h2><span className="t8-hint">Sorted by next step</span></header>
      <div className="t8-tablewrap"><table className="t8-table"><thead><tr><th>Customer</th><th>Status</th><th>Next</th><th className="num">Value</th></tr></thead>
        <tbody>{qRows.slice(0, 8).map(({ c, st, next, v }) => <tr key={c.id} tabIndex={0} onClick={() => go.quote(c.id)} onKeyDown={e => { if (e.key === "Enter") go.quote(c.id); }}>
          <td><span className="who"><span className="ini" aria-hidden="true">{(c.name || "?").charAt(0).toUpperCase()}</span>{c.name || fmtPhone(c.phone)}</span></td>
          <td className={"st " + st[1]}>{st[0]}</td><td>{next}</td><td className="num">{v ? usd(v) : "–"}</td></tr>)}</tbody></table></div>
    </section>}

    <section className="t8-next">
      <button type="button" className="t7-line" onClick={() => go.tab("calendar")}><span className="t7-k">Next up</span>
        <span className="t7-v">{upNext ? `${upNext.day === today ? "" : dateLabel(upNext.day) + ", "}${upNext.time} · ${upNext.what === "estimate" ? "Estimate" : "Install"} · ${upNext.who}${upNext.addr ? " · " + upNext.addr : ""}` : "Nothing booked yet"}</span><span className="t7-arr" aria-hidden="true">→</span></button>
      {isOwner && <button type="button" className="t7-line" aria-expanded={showTasks} onClick={() => setShowTasks(x => !x)}><span className="t7-k">To-dos</span>
        <span className="t7-v">{openTasks ? `${openTasks} open` : "None open"}</span><span className="t7-arr" aria-hidden="true">{showTasks ? "↑" : "→"}</span></button>}
      {isOwner && showTasks && <div className="t7-tasks"><TasksSection ctx={{ d, project, api, toast: toast ?? (() => {}), reload: reload ?? (async () => {}) }} go={go} /></div>}
      {isOwner && nextSetup && <button type="button" className="t7-line" onClick={() => go.tab("system")}><span className="t7-k">Setup</span><span className="t7-v">{setupLeft} {setupLeft === 1 ? "step" : "steps"} left · {nextSetup.title}</span><span className="t7-arr" aria-hidden="true">→</span></button>}
    </section>
  </div>;
}

/** Each row's status, as a word: orange when it's on the owner now, green when it went well. New leads get a dot. */
function STATUS_OF(a: Action): { text: string; tone: "urgent" | "good" | ""; isNew?: boolean } {
  const p = ["sam", "qr", "qs", "nq", "pc", "pm", "od", "dr", "in", "js", "iv", "rv", "rm", "r", "m", "q", "k", "w"].find(x => a.key.startsWith(x)) ?? "";
  const map: Record<string, [string, "urgent" | "good" | ""]> = { r: ["Needs a reply", "urgent"], m: ["No phone yet", "urgent"], qr: ["Answered", "urgent"], pc: ["Says they paid", "good"], od: ["Late", "urgent"], dr: ["Draft", ""],
    q: ["Estimate done", "urgent"], qs: ["Not sent", "urgent"], nq: ["Follow up today", "urgent"], in: ["Not scheduled", ""], js: ["Install soon", ""], iv: ["Not invoiced", "urgent"], rv: ["Paid", "good"], rm: ["Reminder", ""], k: ["To-do", ""], w: ["Warranty", ""], pm: ["Thin margin", "urgent"], sam: ["New", ""] };
  const [text, tone] = map[p] ?? ["", ""];
  return { text, tone, isNew: p === "r" || p === "m" };
}

/** A small trend line, ink, with a dot on the latest point. */
function Spark({ values }: { values: number[] }) {
  const w = 120, h = 28, mx = Math.max(...values), mn = Math.min(...values), span = mx - mn || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - mn) / span) * (h - 6)] as const);
  const [lx, ly] = pts[pts.length - 1];
  return <svg className="t8-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path d={"M" + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")} /><circle cx={lx} cy={ly} r={2.5} /></svg>;
}

/** Counts up to a number once, over 700ms; straight to it when the owner asked for less motion. */
function useCountUp(target: number) {
  const [v, setV] = useState(target);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !target) { setV(target); return; }
    done.current = true;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    const t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 700); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
