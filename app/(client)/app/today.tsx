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

export function TodayScreen({ d, biz, go, wide, api, project, ask, toast }: { d: Data; biz: Biz; go: Go; wide: boolean; api: Api; project: string; ask?: { q: string; n: number }; toast?: (t: string, bad?: boolean) => void }) {
  const today = todayIso(), L = d.live, cards = d.board ?? [], invoices = d.invoices ?? [];
  const byThread = new Map(cards.map(c => [c.id, c]));
  const asks = L.conversations.filter(c => c.status === "paused");

  const actions: Action[] = [];
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
    { title: "Google review link", text: "One text the morning after each install asks for the review.", done: biz.reviewLink, action: <button type="button" className="btn sm" onClick={() => go.tab("sam")}>Ask Sam</button> },
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

  return <>
    <PageHead kicker={<><i className="live" />Answering every lead. {L.answered} of {L.leads} leads replied to in 30 days{L.replySec != null ? `, first reply in ${secs(L.replySec)}` : ""}.</>}
      title={`Good ${part}${ownerFirst ? `, ${ownerFirst}` : ""}.`}
      sub={actions.length ? `${actions.length} ${actions.length === 1 ? "thing needs" : "things need"} you, ${usd(atStake)} riding on them.` : "Nothing needs you right now."}
      actions={<><button type="button" className="find" onClick={go.find}><Icon name="search" size={14} />Find anyone or do anything<kbd>⌘K</kbd></button><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead</button></>} />
    <div className="dash">
      <TodayTop d={d} api={api} project={project} toast={toast ?? (() => {})} owner={!biz.crew && d.role !== "office"} />
      {!biz.crew && (d.customers ?? []).length < 5 && <section className="panel sw-cta"><div className="panel-b"><span><b>Bring your customers over.</b> It takes about 10 minutes.</span><button type="button" className="btn ink" onClick={() => go.tab("switch")}>Move them in</button></div></section>}
      {setupLeft > 0 && !hideSetup && <Guide title="Finish setting up" sub={`${setupLeft} ${setupLeft === 1 ? "thing" : "things"} left before your front office runs on its own. Each one takes a minute.`} compact count={{ done: setup.length - setupLeft, total: setup.length }} steps={setup.filter(x => !x.done)}
        side={<div className="setup-side"><b>{Math.round(((setup.length - setupLeft) / setup.length) * 100)}%</b><small>set up</small><button type="button" className="link" onClick={() => { setHideSetup(true); try { localStorage.setItem("cinder-setup-hide", "1"); } catch { /* private mode */ } }}>Hide for now</button></div>} />}
      <Kpis items={[
        { label: "Won, last 30 days", value: usd(rep?.now.wonValue ?? L.wonValue), sub: rep ? `${rep.now.won} ${rep.now.won === 1 ? "job" : "jobs"} from answered leads` : `${L.won} jobs`, tone: rep && rep.now.wonValue > rep.before.wonValue ? "up" : "", onClick: () => go.tab("numbers") },
        { label: "Quotes out", value: usd(L.chasingValue), sub: L.chasing ? `${L.chasing} waiting, follow-ups going out` : "Nothing waiting", onClick: () => go.tab("quotes") },
        { label: "Owed to you", value: usd(owed), sub: late.length ? `${late.length} past due` : sent.length ? `${sent.length} awaiting payment` : "Nothing out", tone: late.length ? "down" : "", onClick: () => go.tab("invoices") },
        { label: "Book rate", value: rep ? pct(rep.now.booked, rep.now.leads) : pct(L.booked, L.leads), sub: rep ? `${rep.now.booked} of ${rep.now.leads} leads booked` : "", spark: bookSpark, onClick: () => go.tab("numbers") },
        { label: "First reply", value: secs(rep?.now.replySec ?? L.replySec), sub: "median, day or night", spark: weeks.map(w => w.leads), sparkTone: "good" },
      ]} />
      <div className="grid12">
        <div className="stack s8">
          <section className="panel">
            <div className="panel-h"><h2>Your move</h2><small>{actions.length ? `${actions.length} ${actions.length === 1 ? "thing" : "things"}, most money first` : "all clear"}</small><div className="r"><button type="button" className="link" onClick={() => go.tab("jobs")}>All jobs</button></div></div>
            <div className="panel-b todo">
              {actions.length ? <>{shown.map((a, k) => <div key={a.key} className={"trow" + (a.kind === "reply" || a.kind === "money" ? " hot" : "")}>
                <span className={"ti " + ICON[a.kind][1]}><Icon name={ICON[a.kind][0]} size={15} /></span>
                <span className="tt"><b>{a.title}</b><small>{a.sub}</small>{a.draft && <q className="nudge">{a.draft}</q>}</span>
                <span className="tm">{a.money ? usd(a.money) : ""}</span>
                <button type="button" className={"btn sm" + (k === 0 ? " ink" : "")} onClick={a.go}>{a.cta}</button>
              </div>)}
                {actions.length > 7 && <button type="button" className="link more" onClick={() => setAll(x => !x)}>{all ? "Show fewer" : `Show all ${actions.length}`}</button>}</>
              : <div className="empty-art"><span><Icon name="check" size={18} /></span><b>You&rsquo;re clear.</b><small>New leads, quotes to write and late invoices land here.</small></div>}
            </div>
            <div className="panel-f ask-f"><AskBox api={api} project={project} ask={ask} d={d} go={go} /></div>
          </section>
          <section className="panel">
            <div className="panel-h"><h2>Leads and estimates booked</h2><small>each week, last {weeks.length} weeks</small><div className="r"><button type="button" className="link" onClick={() => go.tab("numbers")}>Reports</button></div></div>
            <div className="panel-b" style={{ paddingTop: 18 }}>{weeks.length > 1 ? <Bars data={weeks.map((w, i) => ({ label: i === weeks.length - 1 ? "This week" : /^d{4}-d{2}-d{2}$/.test(w.week) ? new Date(w.week + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `${weeks.length - 1 - i} wk ago`, a: w.leads, b: w.booked }))} a="Leads" b="Booked" />
              : <p className="fine" style={{ padding: "24px 0" }}>The chart starts after your second week.</p>}</div>
          </section>
        </div>
        <div className="stack s4">
          <section className="panel">
            <div className="panel-h"><h2>Today</h2><small>{todayList.length ? `${todayList.length} ${todayList.length === 1 ? "visit" : "visits"}` : dateLine.split(",")[0]}</small><div className="r"><button type="button" className="link" onClick={() => go.tab("calendar")}>Calendar</button></div></div>
            <div className="panel-b">
              {todayList.length ? todayList.map(v => <div key={v.key} className="vrow"><button type="button" className="vmain" onClick={v.go}><time>{v.time}</time><span style={{ minWidth: 0 }}><b>{v.who}</b><small>{v.what === "estimate" ? "Estimate" : "Install"}{v.sub ? `, ${v.sub}` : ""}</small></span></button>
                <span className="vacts">{v.addr && <a className="btn ghost sm ic" href={"https://maps.google.com/?daddr=" + encodeURIComponent(v.addr)} target="_blank" rel="noreferrer" title="Directions" aria-label={"Directions to " + v.who}><Icon name="pin" size={13} /></a>}
                  {v.phone && <a className="btn ghost sm ic" href={"tel:" + v.phone} title="Call" aria-label={"Call " + v.who}><Icon name="phone" size={13} /></a>}</span></div>)
                : <p className="empty-line">{nextVisit ? `Nothing today. Next: ${nextVisit.who}, ${nextVisit.what}, ${dateLabel(nextVisit.day)} at ${nextVisit.time}.` : "Nothing booked yet. Estimates get booked where your calendar is free."}</p>}
              <div className="week" style={{ marginTop: 12 }}>{days.map((dd, k) => <button key={dd.key} type="button" className={"wd" + (k === 0 ? " today" : "")} onClick={() => go.tab("calendar")}>
                <span className="wd-h"><small>{dd.dow}</small><b>{dd.num}</b></span>
                {dd.items.slice(0, 3).map(v => <span key={v.key} className={"wd-i " + v.what} title={`${v.time} ${v.who}`}><em>{v.time === "All day" ? "" : v.time.replace(":00", "").replace(" ", "")}</em>{first(v.who)}</span>)}
                {dd.items.length > 3 && <span className="wd-more">+{dd.items.length - 3}</span>}
              </button>)}</div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><h2>Pipeline</h2><small>{usd(pipe.reduce((a, p) => a + p.v, 0))} open</small><div className="r"><button type="button" className="link" onClick={() => go.tab("jobs")}>Jobs</button></div></div>
            <div className="panel-b pipe2">{pipe.map(p => <button key={p.st} type="button" className="pr" onClick={() => go.tab("jobs")}>
              <span className="pl">{PIPE_L[p.st]}</span><span className="pn">{p.n}</span><b>{usd(p.v)}</b>
              <i className={"pbar " + p.st}><span style={{ width: `${(p.v / pipeMax) * 100}%` }} /></i></button>)}</div>
          </section>
        </div>
        <section className="panel s12">
          <div className="panel-h"><h2>Live</h2><small>every conversation, newest first</small><div className="r"><button type="button" className="link" onClick={() => go.tab("inbox")}>Inbox</button></div></div>
          <div className="panel-b flush">{live.length ? live.map(c => { const [t, tone] = sayFor(c); return <button key={c.id} type="button" className="lv" onClick={() => go.thread(c.id)}>
            <Avatar name={c.name} size="lg" /><span className="lv-n"><b>{c.name}</b><small>{sourceLabel(c.source)}</small></span>
            <span className="lv-m">{c.last}</span><span className={"say " + tone}>{t}</span><time>{ago(c.at)}</time></button>; })
            : <p className="empty-line" style={{ margin: "0 18px" }}>Conversations show here the moment a lead texts, calls or fills a form.</p>}</div>
        </section>
      </div>
    </div>
  </>;
}
