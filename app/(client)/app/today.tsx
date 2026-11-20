"use client";

// Home: the dashboard. Four figures, what needs the owner, the pipeline by stage, today's visits, the week as a
// strip of days, what Cinder did, and the latest activity. Everything is a tap from here.
import { jobSteps } from "@/lib/crm";
import type { Report } from "@/lib/client-reports";
import { overdue } from "@/lib/billing";
import { useEffect, useState } from "react";
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
function GoalBox({ d, cards, api, project, toast, reload }: { d: Data; cards: NonNullable<Data["board"]>; api: Api; project: string; toast?: (t: string, bad?: boolean) => void; reload?: () => Promise<void> }) {
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

  return <>
    <PageHead title={dateLine} sub={actions.length ? `${actions.length} ${actions.length === 1 ? "thing needs" : "things need"} you${atStake ? `, ${usd(atStake)} on them` : ""}.` : "Nothing needs you right now."}
      actions={<><button type="button" className="find" onClick={go.find}><Icon name="search" size={14} />Find anyone or do anything<kbd>⌘K</kbd></button><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead</button></>} />
    <div className="t5">
      <div className="t5-main">
        {evText && <p className="t5-over">{evText}{isOwner && <button type="button" className="link" onClick={() => void toggleEv()}>{evSms ? "Stop the 6 PM text" : "Text me this at 6 PM"}</button>}</p>}
        {/* On a phone the numbers sit right under the summary, folded, instead of three screens down. */}
        <details className="t5-nums">
          <summary><b>Numbers</b><span>{usd(pipeTotal)} open{nums[0] ? `, ${nums[0].label.toLowerCase()} ${nums[0].value}` : ""}</span><Icon name="down" size={14} /></summary>
          <div className="t5-nums-b">
            {nums.map(n => <button key={n.label} type="button" className="t5-num" onClick={n.go} disabled={!n.go}><span>{n.label}<small>{n.sub}</small></span><b className={n.tone || ""}>{n.value}</b></button>)}
            {pipe.map(p => <button key={p.st} type="button" className="t5-num" onClick={() => go.tab("jobs")}><span><i className={"sw " + p.st} />{PIPE_L[p.st]}<small>{p.n}</small></span><b>{usd(p.v)}</b></button>)}
          </div>
        </details>
        <section className="t5-sec">
          <header><h2>Your move</h2><small>{actions.length ? `${actions.length}, newest leads first, then the most money` : "all clear"}</small><button type="button" className="link" onClick={() => go.tab("jobs")}>All jobs</button></header>
          {actions.length ? <div className="t5-list">{shown.map((a, k) => <div key={a.key} className={"t5-row" + (a.kind === "reply" || a.urgent ? " turn" : "")}>
              <i className="td" aria-hidden="true" />
              <button type="button" className="tt" onClick={a.go}><b>{a.title}</b><small>{a.sub}</small>{a.draft && <q className="nudge">{a.draft}</q>}</button>
              <span className="tm">{a.money ? usd(a.money) : ""}</span>
              <button type="button" className={"btn sm" + (k === 0 ? " ink" : "")} onClick={a.go}>{a.cta}</button>
            </div>)}
            {actions.length > 7 && <button type="button" className="link more" onClick={() => setAll(x => !x)}>{all ? "Show fewer" : `Show all ${actions.length}`}</button>}</div>
          : <p className="t5-empty">You&rsquo;re clear. New leads, quotes to write and late invoices land here.</p>}
        </section>
        {isOwner && <TasksSection ctx={{ d, project, api, toast: toast ?? (() => {}), reload: reload ?? (async () => {}) }} go={go} />}
        <section className="t5-sec">
          <header><h2>Today</h2><small>{todayList.length ? `${todayList.length} ${todayList.length === 1 ? "visit" : "visits"}` : "nothing booked"}</small><button type="button" className="link" onClick={() => go.tab("calendar")}>Calendar</button></header>
          {todayList.length ? <div className="t5-list">{todayList.map(v => <div key={v.key} className="t5-row visit">
              <time>{v.time}</time>
              <button type="button" className="tt" onClick={v.go}><b>{v.who}</b><small>{v.what === "estimate" ? "Estimate" : "Install"}{v.sub ? `, ${v.sub}` : ""}</small></button>
              <span className="vacts">{v.addr && <a className="btn ghost sm" href={"https://maps.google.com/?daddr=" + encodeURIComponent(v.addr)} target="_blank" rel="noreferrer" aria-label={"Directions to " + v.who}><Icon name="pin" size={13} />Route</a>}
                {v.phone && <a className="btn ghost sm ic" href={"tel:" + v.phone} title="Call" aria-label={"Call " + v.who}><Icon name="phone" size={13} /></a>}</span>
            </div>)}</div>
          : <p className="t5-empty">{nextVisit ? `Nothing today. Next: ${nextVisit.who}, ${nextVisit.what}, ${dateLabel(nextVisit.day)} at ${nextVisit.time}.` : "Nothing booked yet. Estimates get booked where your calendar is free."}</p>}
          <div className="t5-week">{days.map((dd, k) => <button key={dd.key} type="button" className={"wk" + (k === 0 ? " today" : "")} onClick={() => go.tab("calendar")} title={dd.items.map(v => `${v.time} ${v.who}`).join("\n") || "Nothing booked"}>
            <small>{dd.dow}</small><b>{dd.num}</b><span>{dd.items.length ? dd.items.length : ""}</span></button>)}</div>
        </section>
      </div>
      <aside className="t5-rail">
        {isOwner && <GoalBox d={d} cards={cards} api={api} project={project} toast={toast} reload={reload} />}
        <section className="t5-dup"><h3>Last 30 days</h3>
          {nums.map(n => <button key={n.label} type="button" className="t5-num" onClick={n.go} disabled={!n.go}><span>{n.label}<small>{n.sub}</small></span><b className={n.tone || ""}>{n.value}</b></button>)}
        </section>
        <section className="t5-dup"><h3>Pipeline<small>{usd(pipeTotal)} open</small></h3>
          <div className={"t5-pipe" + (pipeTotal ? "" : " none")} aria-hidden="true">{pipeTotal > 0 && pipe.map(p => <i key={p.st} className={p.st} style={{ flexGrow: Math.max(p.v, pipeTotal ? pipeTotal * 0.04 : 1) }} />)}</div>
          {pipe.map(p => <button key={p.st} type="button" className="t5-num" onClick={() => go.tab("jobs")}><span><i className={"sw " + p.st} />{PIPE_L[p.st]}<small>{p.n}</small></span><b>{usd(p.v)}</b></button>)}
        </section>
        {isOwner && (setupLeft > 0 || (d.customers ?? []).length < 5) && <section><h3>Setting up</h3>
          {nextSetup && <div className="t5-setup"><span><b>{nextSetup.title}</b><small>{setupLeft} {setupLeft === 1 ? "step" : "steps"} left. {nextSetup.text}</small></span>{nextSetup.action}</div>}
          {(d.customers ?? []).length < 5 && <div className="t5-setup"><span><b>Bring your customers over</b><small>From Jobber, QuickBooks or a spreadsheet. About 10 minutes.</small></span><button type="button" className="btn sm" onClick={() => go.tab("switch")}>Move them in</button></div>}
        </section>}
        <section><h3>Ask</h3><AskBox api={api} project={project} ask={ask} d={d} go={go} /></section>
      </aside>
    </div>
  </>;
}
