"use client";

// Home: the dashboard. Four figures, what needs the owner, the pipeline by stage, today's visits, the week as a
// strip of days, what Cinder did, and the latest activity. Everything is a tap from here.
import { jobSteps, STAGE_LABEL, STAGES, type Stage } from "@/lib/crm";
import { overdue } from "@/lib/billing";
import { useEffect, useState } from "react";
import { Avatar, Icon, Spinner, ago, clock, dateLabel, first, fmtPhone, secs, short, todayIso, usd, type Api } from "./parts";
import { line } from "./jobs";
import { suggestReply } from "./replies";
import { sourceLabel, type Biz, type Data, type Go } from "./types";

type Kind = "reply" | "money" | "quote" | "install" | "invoice" | "review" | "sam" | "remind";
type Action = { key: string; kind: Kind; title: string; sub: string; go: () => void; cta: string; primary?: boolean; draft?: string; money: number };
/** What a job is worth right now: the invoice, the value, the quote, or the top of the ballpark. */
const worth = (c: { value: number | null; quote: { amount: number | null } | null; ballpark: { high: number } | null; invoice: { total: number } | null } | undefined) => c ? c.invoice?.total || c.value || c.quote?.amount || c.ballpark?.high || 0 : 0;
const ICON: Record<Kind, [string, string]> = { reply: ["chat", "ember"], money: ["invoice", "red"], quote: ["quote", ""], install: ["cal", ""], invoice: ["invoice", ""], review: ["star", "ok"], sam: ["user", ""], remind: ["clock", "ember"] };
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
const daysPast = (d: string) => Math.max(1, Math.round((Date.now() - Date.parse(d + "T23:59:00")) / 86400000));
const iso = (d: Date) => d.toLocaleDateString("en-CA");

/** One question about the business, answered from its own data. Nothing is saved. */
function AskBox({ api, project, ask }: { api: Api; project: string; ask?: { q: string; n: number } }) {
  const [q, setQ] = useState(ask?.q ?? ""), [a, setA] = useState<{ q: string; text: string } | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const run = async (text: string) => {
    const question = text.trim(); if (!question || busy) return;
    setBusy(true); setErr(""); setA(null);
    try { const r = await api<{ answer: string }>("/api/app/act", { p: project, action: "ask", question }); setA({ q: question, text: r.answer }); }
    catch (e) { setErr(e instanceof Error ? e.message : "No answer just now."); } finally { setBusy(false); }
  };
  useEffect(() => { if (ask?.q) { setQ(ask.q); void run(ask.q); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ask?.n]);
  const tries = ["Who hasn't answered their quote?", "What's booked this week?", "Who owes me money?"];
  return <section className="card ask">
    <form className="ask-q" onSubmit={e => { e.preventDefault(); void run(q); }}>
      <Icon name="bolt" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask Cinder about your jobs, money or week" aria-label="Ask Cinder" />
      <button type="submit" className="btn ink sm" disabled={busy || !q.trim()}>{busy ? <Spinner /> : "Ask"}</button>
    </form>
    {a ? <div className="ask-a"><p>{a.text}</p><button type="button" className="link" onClick={() => { setA(null); setQ(""); }}>Clear</button></div>
      : err ? <p className="fine" style={{ color: "var(--bad)" }}>{err}</p>
      : <div className="chips">{tries.map(t => <button key={t} type="button" onClick={() => { setQ(t); void run(t); }}>{t}</button>)}</div>}
  </section>;
}

export function TodayScreen({ d, biz, go, wide, api, project, ask }: { d: Data; biz: Biz; go: Go; wide: boolean; api: Api; project: string; ask?: { q: string; n: number } }) {
  const today = todayIso(), L = d.live, cards = d.board ?? [], invoices = d.invoices ?? [];
  const byThread = new Map(cards.map(c => [c.id, c]));
  const asks = L.conversations.filter(c => c.status === "paused");

  const actions: Action[] = [];
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
  // Quotes that went quiet after every follow-up: a nudge in the owner's words, written and waiting.
  for (const c of cards) if (c.stage === "quoted" && c.quote?.linked && c.quote.status !== "replied" && c.quote.steps >= (d.quoteSteps || 4)) {
    const draft = suggestReply(c.name, null, { stage: "quoted", owner: d.owner, quoteAmount: c.quote.amount });
    actions.push({ key: "nq" + c.id, kind: "quote", title: c.name + " went quiet", sub: (c.quote.amount ? usd(c.quote.amount) + " quote, " : "") + "every follow-up sent, no answer", draft, go: () => go.record(c.id, { view: "activity", draft }), cta: "Nudge", money: c.quote.amount ?? 0 });
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
  if (d.unreadFromSam) actions.push({ key: "sam", kind: "sam", title: "Message from Sam", sub: "Your Cinder rep", go: () => go.tab("sam"), cta: "Open", money: 0 });
  // Most money at stake first. A waiting reply with nothing priced yet still beats a zero.
  actions.sort((a, b) => (b.money || (b.kind === "reply" ? 1 : 0)) - (a.money || (a.kind === "reply" ? 1 : 0)));
  const atStake = actions.reduce((a, x) => a + x.money, 0);

  // Visits: estimates Cinder booked and installs the owner set, for today and the week strip.
  type Visit = { key: string; at: number; day: string; time: string; who: string; what: "estimate" | "install"; sub: string; go: () => void; phone?: string; addr?: string; id?: string };
  const visits: Visit[] = [
    ...d.appointments.filter(a => Date.parse(a.starts_at) > Date.now() - 12 * 3600000).map(a => { const c = byThread.get(a.thread_id); return { key: "a" + a.id, at: Date.parse(a.starts_at), day: iso(new Date(a.starts_at)), time: clock(a.starts_at), who: a.customer_name || fmtPhone(a.customer_phone), what: "estimate" as const, sub: [c ? line(c) : "", String(c?.details.address ?? "")].filter(Boolean).join(", ") || "Booked by Cinder", go: () => c ? go.record(c.id) : go.thread(a.thread_id), phone: a.customer_phone || c?.phone || "", addr: String(c?.details.address ?? ""), id: c?.id ?? a.thread_id }; }),
    ...cards.filter(c => c.stage === "won" && c.install && c.install >= today).flatMap(c => Array.from({ length: c.installDays || 1 }, (_, k) => { const dd = new Date(Date.parse(c.install! + "T12:00:00") + k * 86400000); return { key: `i${c.id}${k}`, at: Date.parse(`${iso(dd)}T${c.installTime || "07:00"}`), day: iso(dd), time: c.installTime ? hhmm(c.installTime) : "All day", who: c.name, what: "install" as const, sub: [line(c), String(c.details.address ?? "")].filter(Boolean).join(", ") || (c.installDays > 1 ? `Day ${k + 1} of ${c.installDays}` : ""), go: () => go.record(c.id, { view: "job" }), phone: c.phone, addr: String(c.details.address ?? ""), id: c.id }; })),
  ].sort((a, b) => a.at - b.at);
  const todayList = visits.filter(v => v.day === today);
  const days = Array.from({ length: 7 }, (_, k) => { const dd = new Date(Date.parse(today + "T12:00:00") + k * 86400000); const key = iso(dd); return { key, dow: dd.toLocaleDateString("en-US", { weekday: "short" }), num: dd.getDate(), items: visits.filter(v => v.day === key) }; });
  const nextVisit = visits.find(v => v.day > today);

  // Pipeline by stage, from the board.
  const open = cards.filter(c => !c.pastCustomer);
  const pipe = STAGES.filter(s => s !== "lost").map(s => { const list = open.filter(c => c.stage === s); return { s, n: list.length, v: list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? c.ballpark?.high ?? 0), 0) }; });
  const pipeTotal = Math.max(1, pipe.reduce((a, p) => a + p.n, 0));
  const PIPE_FILL: Record<Stage, string> = { new: "var(--g3)", booked: "var(--g1)", quoted: "var(--ink)", won: "var(--good)", lost: "var(--g3)" };

  const sent = invoices.filter(i => i.status === "sent"), owed = sent.reduce((a, i) => a + i.total, 0), late = sent.filter(i => overdue(i.status, i.due_on, today));
  const lastWeek = L.weeks.at(-1);
  const recent = L.conversations.slice(0, 8);
  const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return <>
    <header className="tb"><h1 className="h1">Home</h1><span className="sub">{dateLine}</span>
      <div className="acts"><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead{wide && <kbd>c</kbd>}</button></div></header>
    <div className="pad home">
      <div className="stats" style={{ gridColumn: "1 / -1" }}>
        <button type="button" className="stat" onClick={() => go.tab("numbers")}><span>Won, last 30 days</span><b>{usd(L.wonValue)}</b><small className={L.won ? "up" : ""}>{L.won ? `${L.won} ${L.won === 1 ? "job" : "jobs"} from Cinder leads` : "No wins yet"}</small></button>
        <button type="button" className="stat" onClick={() => go.tab("invoices")}><span>Owed to you</span><b>{usd(owed)}</b><small className={late.length ? "down" : ""}>{late.length ? `${late.length} ${late.length === 1 ? "invoice" : "invoices"} past due` : sent.length ? `${sent.length} ${sent.length === 1 ? "invoice" : "invoices"} out` : "All paid up"}</small></button>
        <button type="button" className="stat" onClick={() => go.tab("invoices")}><span>Quotes out</span><b>{usd(L.chasingValue)}</b><small>{L.chasing ? `${L.chasing} waiting, Cinder following up` : "Nothing waiting"}</small></button>
        <button type="button" className="stat" onClick={() => go.tab("numbers")}><span>Leads answered</span><b>{L.answered}<small> of {L.leads}</small></b><small>{L.replySec != null ? `First reply in ${secs(L.replySec)}, day or night` : "Last 30 days"}</small></button>
      </div>

      <div className="col">
        <AskBox api={api} project={project} ask={ask} />
        <section className="card">
          <div className="hd"><h2>Needs you</h2><small>{actions.length ? `${actions.length} ${actions.length === 1 ? "thing" : "things"}${atStake ? `, ${usd(atStake)} at stake` : ""}` : "Clear"}</small><button type="button" className="link" onClick={() => go.tab("jobs")}>All jobs</button></div>
          {actions.length ? actions.slice(0, 8).map(a => <div key={a.key} className="row tall needs">
            <span className={"ic " + ICON[a.kind][1]}><Icon name={ICON[a.kind][0]} size={14} /></span>
            <span style={{ minWidth: 0 }}><b>{a.title}</b><small>{a.sub}</small>{a.draft && <q className="nudge">{a.draft}</q>}</span>
            <b className={"num" + (a.money ? "" : " faint")} style={{ fontWeight: 500 }}>{a.money ? usd(a.money) : ""}</b>
            <button type="button" className={"btn sm" + (a.primary ? " ink" : "")} onClick={a.go}>{a.cta}</button>
          </div>) : <p className="fine" style={{ padding: "6px 0" }}>Nothing waiting on you. New leads, late invoices and quotes to write land here.</p>}
        </section>

        <section className="card">
          <div className="hd"><h2>Pipeline</h2><small>{open.length} {open.length === 1 ? "job" : "jobs"} on the board</small><button type="button" className="link" onClick={() => go.tab("jobs")}>Jobs</button></div>
          <div className="pipe" aria-hidden="true">{pipe.map(p => p.n > 0 && <i key={p.s} style={{ flex: p.n, background: PIPE_FILL[p.s] }} />)}</div>
          <div className="pipe-legend">{pipe.map(p => <button key={p.s} type="button" onClick={() => go.tab("jobs")}><i style={{ background: PIPE_FILL[p.s] }} /><span>{STAGE_LABEL[p.s]}</span><b>{p.n}</b><small>{p.v ? short(p.v) : ""}</small></button>)}</div>
          <span className="sr">{Math.round((pipe[3].n / pipeTotal) * 100)} percent won</span>
        </section>

        <section className="card">
          <div className="hd"><h2>Recent activity</h2><button type="button" className="link" onClick={() => go.tab("inbox")}>Inbox</button></div>
          {recent.map(c => <button key={c.id} type="button" className="row tall feed" onClick={() => go.thread(c.id)}>
            <Avatar name={c.name} />
            <span style={{ minWidth: 0 }}><b>{c.name}<span className="faint" style={{ fontWeight: 400 }}>, {sourceLabel(c.source).toLowerCase()}</span></b><small>{c.last}</small></span>
            <span className="feed-r">{c.status === "paused" ? <span className="dot ember">Your turn</span> : c.status === "booked" ? <span className="dot ink">Booked</span> : <span className="faint">{ago(c.at)}</span>}</span>
          </button>)}
        </section>
      </div>

      <div className="col">
        <section className="card">
          <div className="hd"><h2>Today</h2><small>{todayList.length ? `${todayList.length} ${todayList.length === 1 ? "visit" : "visits"}` : "Nothing booked"}</small><button type="button" className="link" onClick={() => go.tab("calendar")}>Calendar</button></div>
          {todayList.length ? todayList.map(v => <div key={v.key} className="t wk"><button type="button" className="wk-main" onClick={v.go}><time>{v.time}</time><span style={{ minWidth: 0 }}><b>{v.who}</b><small>{v.what === "estimate" ? "Estimate" : "Install"}{v.sub ? ", " + v.sub : ""}</small></span></button>
            <span className="wk-acts">{v.addr && <a className="btn ghost sm ic" href={"https://maps.google.com/?daddr=" + encodeURIComponent(v.addr)} target="_blank" rel="noreferrer" title="Directions" aria-label={"Directions to " + v.who}><Icon name="pin" size={13} /></a>}
              {v.phone && <a className="btn ghost sm ic" href={"tel:" + v.phone} title="Call" aria-label={"Call " + v.who}><Icon name="phone" size={13} /></a>}
              {v.id && <button type="button" className="btn ghost sm ic" title="Text" aria-label={"Text " + v.who} onClick={() => go.thread(v.id!)}><Icon name="chat" size={13} /></button>}</span></div>)
            : <p className="fine" style={{ padding: "4px 0 6px" }}>{nextVisit ? `Nothing today. Next up: ${nextVisit.who}, ${nextVisit.what}, ${dateLabel(nextVisit.day)} at ${nextVisit.time}.` : "Nothing today. Cinder books estimates where you're free as leads come in."}</p>}
        </section>

        <section className="card">
          <div className="hd"><h2>This week</h2><small>{visits.filter(v => v.what === "estimate").length} estimates, {new Set(visits.filter(v => v.what === "install").map(v => v.who)).size} installs</small></div>
          <div className="week">{days.map((dd, k) => <button key={dd.key} type="button" className={"wd" + (k === 0 ? " today" : "")} onClick={() => go.tab("calendar")}>
            <span className="wd-h"><small>{dd.dow}</small><b>{dd.num}</b></span>
            {dd.items.slice(0, 3).map(v => <span key={v.key} className={"wd-i " + v.what} title={`${v.time} ${v.who}`}><em>{v.time === "All day" ? "" : v.time.replace(":00", "").replace(" ", "")}</em>{first(v.who)}</span>)}
            {dd.items.length > 3 && <span className="wd-more">+{dd.items.length - 3}</span>}
          </button>)}</div>
        </section>

        <section className="card">
          <div className="hd"><h2>Cinder this week</h2><button type="button" className="link" onClick={() => go.tab("system")}>Settings</button></div>
          <div className="row tall"><span className="ic"><Icon name="bolt" size={14} /></span><span><b>{lastWeek ? `${lastWeek.leads} ${lastWeek.leads === 1 ? "lead" : "leads"} answered, ${lastWeek.booked} ${lastWeek.booked === 1 ? "estimate" : "estimates"} booked` : "Waiting for the first lead"}</b><small>{L.replySec != null ? `Typical first reply in ${secs(L.replySec)}` : "Day or night"}</small></span></div>
          <div className="row tall"><span className="ic"><Icon name="clock" size={14} /></span><span><b>{L.chasing ? `${L.chasing} ${L.chasing === 1 ? "quote" : "quotes"} being followed up` : "No quotes waiting"}</b><small>{L.chasing ? `${usd(L.chasingValue)} open, stops the moment they reply` : "Quoted jobs get four follow-ups"}</small></span></div>
          <div className="row tall"><span className="ic"><Icon name="user" size={14} /></span><span><b>{d.unreadFromSam ? "Sam wrote to you" : "Sam Ward, your rep"}</b><small>{d.unreadFromSam ? `${d.unreadFromSam} new` : "Hours, prices, wording changes"}</small></span><button type="button" className="btn sm" onClick={() => go.tab("sam")}>Open</button></div>
        </section>
      </div>
    </div>
  </>;
}
