"use client";

// Home: the dashboard. Four figures, what needs the owner, the pipeline by stage, today's visits, the week as a
// strip of days, what Cinder did, and the latest activity. Everything is a tap from here.
import { jobSteps } from "@/lib/crm";
import type { Report } from "@/lib/client-reports";
import { overdue } from "@/lib/billing";
import { useEffect, useState } from "react";
import { Icon, Spinner, ago, clock, dateLabel, first, fmtPhone, secs, todayIso, usd, type Api } from "./parts";
import { line } from "./jobs";
import { suggestReply } from "./replies";
import type { Biz, Data, Go } from "./types";

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

  const sent = invoices.filter(i => i.status === "sent"), owed = sent.reduce((a, i) => a + i.total - (i.paid_amount ?? 0), 0), late = sent.filter(i => overdue(i.status, i.due_on, today));
  const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const [all, setAll] = useState(false);
  // The last 30 days, with the rates that matter: from the same report as the Reports tab.
  const [rep, setRep] = useState<Report | null>(null);
  useEffect(() => { let on = true; api<{ report: Report }>(`/api/app/data?p=${project}&report=30`).then(r => { if (on) setRep(r.report); }).catch(() => {}); return () => { on = false; }; }, [api, project]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const shown = all ? actions : actions.slice(0, 7);

  return <>
    <header className="tb"><h1 className="h1">Home</h1><span className="sub">{dateLine}{actions.length ? `, ${actions.length} ${actions.length === 1 ? "thing" : "things"} waiting on you` : ""}</span>
      <div className="acts"><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead{wide && <kbd>c</kbd>}</button></div></header>
    <div className="pad home2">
      <div className="col">
        <section className="todo">
          <p className="sec">Your move<small>{actions.length ? `${usd(atStake)} riding on these` : ""}</small></p>
          {actions.length ? <>{shown.map((a, k) => <div key={a.key} className={"trow" + (a.kind === "reply" || a.kind === "money" ? " hot" : "")}>
            <Icon name={ICON[a.kind][0]} size={15} />
            <span className="tt"><b>{a.title}</b><small>{a.sub}</small>{a.draft && <q className="nudge">{a.draft}</q>}</span>
            <span className="tm">{a.money ? usd(a.money) : ""}</span>
            <button type="button" className={"btn sm" + (k === 0 ? " ink" : "")} onClick={a.go}>{a.cta}</button>
          </div>)}
            {actions.length > 7 && <button type="button" className="link more" onClick={() => setAll(x => !x)}>{all ? "Show fewer" : `Show all ${actions.length}`}</button>}</>
          : <p className="empty-line">You&rsquo;re clear. New leads, quotes to write and late invoices land here.</p>}
        </section>
        <AskBox api={api} project={project} ask={ask} />
      </div>

      <div className="col side">
        <section>
          <p className="sec">Today<small>{todayList.length ? `${todayList.length} ${todayList.length === 1 ? "visit" : "visits"}` : ""}</small><button type="button" className="link" onClick={() => go.tab("calendar")}>Calendar</button></p>
          {todayList.length ? todayList.map(v => <div key={v.key} className="vrow"><button type="button" className="vmain" onClick={v.go}><time>{v.time}</time><span style={{ minWidth: 0 }}><b>{v.who}</b><small>{v.what === "estimate" ? "Estimate" : "Install"}{v.sub ? `, ${v.sub}` : ""}</small></span></button>
            <span className="vacts">{v.addr && <a className="btn ghost sm ic" href={"https://maps.google.com/?daddr=" + encodeURIComponent(v.addr)} target="_blank" rel="noreferrer" title="Directions" aria-label={"Directions to " + v.who}><Icon name="pin" size={13} /></a>}
              {v.phone && <a className="btn ghost sm ic" href={"tel:" + v.phone} title="Call" aria-label={"Call " + v.who}><Icon name="phone" size={13} /></a>}</span></div>)
            : <p className="empty-line">{nextVisit ? `Nothing today. Next: ${nextVisit.who}, ${nextVisit.what}, ${dateLabel(nextVisit.day)} at ${nextVisit.time}.` : "Nothing booked. Cinder books estimates where your calendar is free."}</p>}
        </section>

        <section>
          <p className="sec">This week<small>{visits.filter(v => v.what === "estimate").length} estimates, {new Set(visits.filter(v => v.what === "install").map(v => v.who)).size} installs</small></p>
          <div className="week">{days.map((dd, k) => <button key={dd.key} type="button" className={"wd" + (k === 0 ? " today" : "")} onClick={() => go.tab("calendar")}>
            <span className="wd-h"><small>{dd.dow}</small><b>{dd.num}</b></span>
            {dd.items.slice(0, 3).map(v => <span key={v.key} className={"wd-i " + v.what} title={`${v.time} ${v.who}`}><em>{v.time === "All day" ? "" : v.time.replace(":00", "").replace(" ", "")}</em>{first(v.who)}</span>)}
            {dd.items.length > 3 && <span className="wd-more">+{dd.items.length - 3}</span>}
          </button>)}</div>
        </section>

        <section>
          <p className="sec">Last 30 days<button type="button" className="link" onClick={() => go.tab("numbers")}>Reports</button></p>
          <dl className="kv30">
            <div><dt>Won</dt><dd>{usd(rep?.now.wonValue ?? L.wonValue)}<small>{rep ? `${rep.now.won} ${rep.now.won === 1 ? "job" : "jobs"}` : ""}</small></dd></div>
            <div><dt>Book rate</dt><dd>{rep ? pct(rep.now.booked, rep.now.leads) : pct(L.booked, L.leads)}<small>{rep ? `${rep.now.booked} of ${rep.now.leads} leads` : ""}</small></dd></div>
            <div><dt>Close rate</dt><dd>{rep ? pct(rep.now.won, rep.now.quoted) : "–"}<small>{rep ? `${rep.now.won} of ${rep.now.quoted} quoted` : ""}</small></dd></div>
            <div><dt>First reply</dt><dd>{secs(rep?.now.replySec ?? L.replySec)}<small>median, day or night</small></dd></div>
            <div><dt>Owed to you</dt><dd className={late.length ? "bad-t" : ""}>{usd(owed)}<small>{late.length ? `${late.length} past due` : sent.length ? `${sent.length} out` : "nothing out"}</small></dd></div>
          </dl>
        </section>
      </div>
    </div>
  </>;
}
