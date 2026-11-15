"use client";

// Home: what needs the owner, today and the week ahead, what Cinder did. Figures sit in the toolbar.
import { jobSteps, sourceReport } from "@/lib/crm";
import { overdue } from "@/lib/billing";
import { Icon, clock, dateLabel, first, fmtPhone, secs, todayIso, usd } from "./parts";
import { line } from "./jobs";
import type { Biz, Data, Go } from "./types";

type Kind = "reply" | "money" | "quote" | "install" | "invoice" | "review" | "sam";
type Action = { key: string; kind: Kind; title: string; sub: string; go: () => void; cta: string; primary?: boolean };
const ICON: Record<Kind, [string, string]> = { reply: ["chat", "ember"], money: ["invoice", "red"], quote: ["quote", ""], install: ["cal", ""], invoice: ["invoice", ""], review: ["star", "ok"], sam: ["user", ""] };
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
const daysPast = (d: string) => Math.max(1, Math.round((Date.now() - Date.parse(d + "T23:59:00")) / 86400000));

export function TodayScreen({ d, biz, go, wide }: { d: Data; biz: Biz; go: Go; wide: boolean }) {
  const today = todayIso(), L = d.live, cards = d.board ?? [], invoices = d.invoices ?? [];
  const byThread = new Map(cards.map(c => [c.id, c]));
  const asks = L.conversations.filter(c => c.status === "paused");

  const actions: Action[] = [];
  for (const a of asks) actions.push({ key: "r" + a.id, kind: "reply", title: `Reply to ${a.name}`, sub: a.ask || a.last, go: () => go.thread(a.id), cta: "Reply", primary: true });
  for (const c of cards) if (c.stage === "quoted" && c.quote?.status === "replied") actions.push({ key: "qr" + c.id, kind: "reply", title: `${c.name} answered the quote`, sub: c.quote.amount ? `${usd(c.quote.amount)} quote` : "", go: () => go.thread(c.id), cta: "Read" });
  for (const i of invoices) {
    if (i.status === "sent" && i.paid_claimed_at) actions.push({ key: "pc" + i.id, kind: "money", title: `${i.customer} says they paid`, sub: `${usd(i.total)}, invoice #${i.number}`, go: () => go.invoice(i.id), cta: "Check" });
    else if (overdue(i.status, i.due_on, today)) actions.push({ key: "od" + i.id, kind: "money", title: `${i.customer}, invoice ${daysPast(i.due_on!)} ${daysPast(i.due_on!) === 1 ? "day" : "days"} late`, sub: `${usd(i.total)}, #${i.number}${i.reminders ? `, ${i.reminders} reminder${i.reminders === 1 ? "" : "s"} sent` : ""}`, go: () => go.invoice(i.id), cta: "Open" });
    else if (i.status === "draft") actions.push({ key: "dr" + i.id, kind: "invoice", title: `Send ${first(i.customer)}'s invoice`, sub: `${usd(i.total)}, #${i.number}, draft`, go: () => go.invoice(i.id), cta: "Send" });
  }
  const due = d.appointments.filter(a => Date.parse(a.starts_at) < Date.now() - 3600000);
  const quoted = new Set<string>();
  for (const a of due) {
    const c = byThread.get(a.thread_id);
    if (c && (c.stage === "quoted" || c.stage === "won" || c.stage === "lost")) continue;
    quoted.add(a.thread_id);
    actions.push({ key: "q" + a.id, kind: "quote", title: `Quote ${a.customer_name}`, sub: `Estimate ${new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${c?.line ? `, ${line(c)}` : ""}`, go: () => c ? go.record(c.id, { ask: "quoted" }) : go.tab("calendar"), cta: "Write quote" });
  }
  for (const c of cards) if (!quoted.has(c.id) && c.stage === "quoted" && c.quote && !c.quote.linked && c.quote.amount) actions.push({ key: "qs" + c.id, kind: "quote", title: `Send ${c.name} the quote`, sub: `${usd(c.quote.amount)}, not sent yet`, go: () => go.record(c.id), cta: "Send" });
  for (const c of cards) {
    if (c.stage !== "won" || c.pastCustomer) continue;
    if (!c.install && !c.invoice) actions.push({ key: "in" + c.id, kind: "install", title: `Schedule ${first(c.name)}'s install`, sub: `${c.value ? usd(c.value) + " job" : "Won"}${c.line ? `, ${line(c)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Schedule" });
    else if (c.install && c.install >= today) {
      const days = Math.round((Date.parse(c.install + "T12:00:00") - Date.parse(today + "T12:00:00")) / 86400000);
      const step = jobSteps(biz.trade, c.details).find(s => !c.job[s.key]);
      if (days <= 7 && step && step.key !== "installed" && step.key !== "walk") actions.push({ key: "js" + c.id, kind: "install", title: `${c.name}, ${step.label.toLowerCase()}?`, sub: `Install ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}${c.line ? `, ${line(c)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Open job" });
    }
    else if (c.install && c.install < today && !c.invoice) actions.push({ key: "iv" + c.id, kind: "invoice", title: `Invoice ${c.name}`, sub: `Installed ${dateLabel(c.install)}${c.value ? `, ${usd(c.value)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Invoice" });
    else if (c.install && c.install < today && c.invoice?.status === "paid" && !c.reviewSent && biz.reviewLink) actions.push({ key: "rv" + c.id, kind: "review", title: `${c.name}, ask for the review`, sub: `Installed ${dateLabel(c.install)}, paid in full`, go: () => go.record(c.id, { view: "job" }), cta: "Open" });
  }
  if (d.unreadFromSam) actions.push({ key: "sam", kind: "sam", title: "Message from Sam", sub: "Your Cinder rep", go: () => go.tab("sam"), cta: "Open" });

  // Today and the week: estimates Cinder booked and installs the owner set.
  const end = Date.now() + 7 * 86400000;
  const dayOf = (iso: string) => { const dd = iso.slice(0, 10); return dd === today ? "Today" : new Date(dd + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", day: "numeric" }); };
  const sched = [
    ...d.appointments.filter(a => { const t = Date.parse(a.starts_at); return t > Date.now() - 3600000 && t < end; })
      .map(a => { const c = byThread.get(a.thread_id); return { key: "a" + a.id, at: Date.parse(a.starts_at), day: dayOf(new Date(a.starts_at).toLocaleDateString("en-CA")), time: clock(a.starts_at), who: a.customer_name || fmtPhone(a.customer_phone), what: "estimate", sub: [c ? line(c) : "", String(c?.details.address ?? "")].filter(Boolean).join(", ") || "Booked by Cinder", go: () => c ? go.record(c.id) : go.thread(a.thread_id) }; }),
    ...cards.filter(c => c.stage === "won" && c.install && c.install >= today && Date.parse(c.install + "T12:00:00") < end)
      .map(c => ({ key: "i" + c.id, at: Date.parse(`${c.install}T${c.installTime || "07:00"}`), day: dayOf(c.install!), time: c.installTime ? hhmm(c.installTime) : "All day", who: c.name, what: c.installDays > 1 ? `install, ${c.installDays} days` : "install", sub: [line(c), String(c.details.address ?? "")].filter(Boolean).join(", "), go: () => go.record(c.id, { view: "job" }) })),
  ].sort((a, b) => a.at - b.at);
  const todayList = sched.filter(s => s.day === "Today"), week = sched.filter(s => s.day !== "Today").slice(0, 8);

  const sent = invoices.filter(i => i.status === "sent"), owed = sent.reduce((a, i) => a + i.total, 0), late = sent.filter(i => overdue(i.status, i.due_on, today));
  const sources = sourceReport(cards.filter(c => c.source !== "owner" || c.stage !== "new")).filter(r => r.won > 0).slice(0, 4);
  const lastWeek = L.weeks.at(-1);
  const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return <>
    <header className="tb">
      <h1 className="h1">Home</h1><span className="sub">{dateLine}</span>
      {wide && <div className="figs">
        <span className="fig"><b>{usd(L.wonValue)}</b><span>won, 30 days</span></span>
        <span className="fig"><b style={late.length ? { color: "var(--bad)" } : undefined}>{usd(owed)}</b><span>owed{late.length ? `, ${late.length} late` : ""}</span></span>
        <span className="fig"><b>{usd(L.chasingValue)}</b><span>quotes out</span></span>
        <span className="fig"><b>{secs(L.replySec)}</b><span>first reply</span></span>
      </div>}
      <div className="acts"><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead{wide && <kbd>c</kbd>}</button></div>
    </header>
    {!wide && <div className="figs-row">
      <span className="fig"><b>{usd(L.wonValue)}</b><span>won</span></span>
      <span className="fig"><b style={late.length ? { color: "var(--bad)" } : undefined}>{usd(owed)}</b><span>owed</span></span>
      <span className="fig"><b>{usd(L.chasingValue)}</b><span>quoted</span></span>
      <span className="fig"><b>{secs(L.replySec)}</b><span>reply</span></span>
    </div>}
    <div className="pad home">
      <div className="col">
        <section className="card" style={{ paddingTop: 0 }}>
          <div className="hd"><h2>Needs you</h2><small>{actions.length || "Clear"}</small><button type="button" className="link" onClick={() => go.tab("jobs")}>All jobs</button></div>
          {actions.length ? actions.slice(0, 8).map(a => <div key={a.key} className="row tall">
            <span className={"ic " + ICON[a.kind][1]}><Icon name={ICON[a.kind][0]} size={14} /></span>
            <span style={{ minWidth: 0 }}><b>{a.title}</b><small>{a.sub}</small></span>
            <button type="button" className={"btn sm" + (a.primary ? " ink" : "")} onClick={a.go}>{a.cta}</button>
          </div>) : <p className="fine" style={{ padding: "6px 0" }}>Nothing waiting on you. New leads, late invoices and quotes to write land here.</p>}
        </section>
        <section className="card">
          <div className="hd"><h2>Cinder this week</h2><button type="button" className="link" onClick={() => go.tab("system")}>Settings</button></div>
          <div className="row tall"><span className="ic"><Icon name="bolt" size={14} /></span><span><b>{lastWeek ? `${lastWeek.leads} ${lastWeek.leads === 1 ? "lead" : "leads"} answered, ${lastWeek.booked} ${lastWeek.booked === 1 ? "estimate" : "estimates"} booked` : "Waiting for the first lead"}</b><small>{L.replySec != null ? `Typical first reply in ${secs(L.replySec)}, day or night` : "Day or night"}</small></span></div>
          <div className="row tall"><span className="ic"><Icon name="clock" size={14} /></span><span><b>{L.chasing ? `${L.chasing} ${L.chasing === 1 ? "quote" : "quotes"} being followed up` : "No quotes waiting"}</b><small>{L.chasing ? `${usd(L.chasingValue)} open, stops the moment they reply` : "Quoted jobs get four follow-ups"}</small></span></div>
          {sources.length > 0 && <div className="row tall"><span className="ic"><Icon name="bars" size={14} /></span><span><b>{sources.map(r => `${r.label} ${usd(r.wonValue)}`).join(", ")}</b><small>Where the won jobs came from, last 4 months</small></span><button type="button" className="btn sm" onClick={() => go.tab("invoices")}>Money</button></div>}
          <div className="row tall"><span className="ic"><Icon name="user" size={14} /></span><span><b>{d.unreadFromSam ? "Sam wrote to you" : "Sam Ward, your rep"}</b><small>{d.unreadFromSam ? `${d.unreadFromSam} new` : "Hours, prices, wording changes"}</small></span><button type="button" className="btn sm" onClick={() => go.tab("sam")}>Open</button></div>
        </section>
      </div>
      <div className="col">
        <section className="card" style={{ paddingTop: 0 }}>
          <div className="hd"><h2>Today</h2><small>{todayList.length ? `${todayList.length} ${todayList.length === 1 ? "visit" : "visits"}` : "Nothing booked"}</small><button type="button" className="link" onClick={() => go.tab("calendar")}>Calendar</button></div>
          {todayList.length ? todayList.map(w => <button key={w.key} type="button" className="t" onClick={w.go}><time>{w.time}</time><span style={{ minWidth: 0 }}><b>{w.who}, {w.what}</b><small>{w.sub}</small></span><span className="dot ink">{w.what === "estimate" ? "Estimate" : "Install"}</span></button>)
            : <p className="fine" style={{ padding: "6px 0" }}>A clear day. Cinder books estimates where you&rsquo;re free as leads come in.</p>}
        </section>
        <section className="card">
          <div className="hd"><h2>This week</h2><small>{week.length ? `${week.filter(w => w.what === "estimate").length} estimates, ${week.filter(w => w.what !== "estimate").length} installs` : "Nothing yet"}</small></div>
          {week.map(w => <button key={w.key} type="button" className="t" onClick={w.go}><time>{w.day}<br />{w.time}</time><span style={{ minWidth: 0 }}><b>{w.who}, {w.what}</b><small>{w.sub}</small></span><span className="dot ink">{w.what === "estimate" ? "Estimate" : "Install"}</span></button>)}
        </section>
      </div>
    </div>
  </>;
}
