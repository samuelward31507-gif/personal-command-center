"use client";

// Today: the page an owner opens between jobs. Four figures, what needs him (one action each), the week ahead,
// where the money stands and where the jobs came from. Everything is a tap from here.
import { jobSteps, sourceReport } from "@/lib/crm";
import { overdue } from "@/lib/billing";
import { Icon, clock, dateLabel, first, fmtPhone, secs, todayIso, usd } from "./parts";
import { FindButton } from "./command";
import { suggestReply } from "./replies";
import type { Biz, Data, Go } from "./types";

type Kind = "reply" | "money" | "quote" | "install" | "invoice" | "review" | "sam";
type Action = { key: string; kind: Kind; title: string; sub: string; go: () => void; cta: string; primary?: boolean; draft?: string };
const ICON: Record<Kind, [string, string]> = { reply: ["chat", "ember"], money: ["invoice", "red"], quote: ["quote", "blue"], install: ["cal", "blue"], invoice: ["invoice", "amber"], review: ["star", "ok"], sam: ["user", ""] };
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
const daysPast = (d: string) => Math.max(1, Math.round((Date.now() - Date.parse(d + "T23:59:00")) / 86400000));

export function TodayScreen({ d, biz, go }: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void }) {
  const today = todayIso(), L = d.live, cards = d.board ?? [], invoices = d.invoices ?? [];
  const byThread = new Map(cards.map(c => [c.id, c]));
  const asks = L.conversations.filter(c => c.status === "paused");

  // What needs him, in the order it costs him money.
  const actions: Action[] = [];
  for (const a of asks) actions.push({ key: "r" + a.id, kind: "reply", title: `Reply to ${first(a.name)}`, sub: a.ask || a.last, go: () => go.thread(a.id), cta: "Reply", primary: true });
  for (const c of cards) if (c.stage === "quoted" && c.quote?.status === "replied") actions.push({ key: "qr" + c.id, kind: "reply", title: `${first(c.name)} answered your quote`, sub: c.quote.amount ? `${usd(c.quote.amount)} quote` : "", go: () => go.thread(c.id), cta: "Read" });
  for (const i of invoices) {
    if (i.status === "sent" && i.paid_claimed_at) actions.push({ key: "pc" + i.id, kind: "money", title: `${first(i.customer)} says they paid`, sub: `${usd(i.total)} · invoice #${i.number}`, go: () => go.invoice(i.id), cta: "Check" });
    else if (overdue(i.status, i.due_on, today)) actions.push({ key: "od" + i.id, kind: "money", title: `${first(i.customer)}: invoice ${daysPast(i.due_on!)} ${daysPast(i.due_on!) === 1 ? "day" : "days"} late`, sub: `${usd(i.total)} · #${i.number}${i.reminders ? ` · ${i.reminders} reminder${i.reminders === 1 ? "" : "s"} sent` : ""}`, go: () => go.invoice(i.id), cta: "Open" });
    else if (i.status === "draft") actions.push({ key: "dr" + i.id, kind: "invoice", title: `Send ${first(i.customer)}'s invoice`, sub: `${usd(i.total)} · #${i.number} · draft`, go: () => go.invoice(i.id), cta: "Send" });
  }
  const due = d.appointments.filter(a => Date.parse(a.starts_at) < Date.now() - 3600000);
  const quoted = new Set<string>();
  for (const a of due) {
    const c = byThread.get(a.thread_id);
    if (c && (c.stage === "quoted" || c.stage === "won" || c.stage === "lost")) continue;
    quoted.add(a.thread_id);
    actions.push({ key: "q" + a.id, kind: "quote", title: `Quote ${first(a.customer_name)}`, sub: `Estimate ${new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${c?.line ? ` · ${c.line}` : ""}`, go: () => c ? go.record(c.id, { ask: "quoted" }) : go.tab("calendar"), cta: "Write quote" });
  }
  for (const c of cards) if (!quoted.has(c.id) && c.stage === "quoted" && c.quote && !c.quote.linked && c.quote.amount) actions.push({ key: "qs" + c.id, kind: "quote", title: `Send ${first(c.name)} the quote`, sub: `${usd(c.quote.amount)} · not sent yet`, go: () => go.record(c.id), cta: "Send" });
  // Quotes that went quiet after every follow-up: a nudge in his own words, written and waiting. One tap opens it in the reply box.
  for (const c of cards) if (c.stage === "quoted" && c.quote?.linked && c.quote.status !== "replied" && c.quote.steps >= (d.quoteSteps || 4)) {
    const draft = suggestReply(c.name, null, { stage: "quoted", owner: d.owner, quoteAmount: c.quote.amount });
    actions.push({ key: "nq" + c.id, kind: "quote", title: `${first(c.name)} went quiet`, sub: `${c.quote.amount ? usd(c.quote.amount) + " quote · " : ""}follow-ups done, no answer`, draft, go: () => go.record(c.id, { view: "activity", draft }), cta: "Nudge" });
  }
  for (const c of cards) {
    if (c.stage !== "won" || c.pastCustomer) continue;
    if (!c.install && !c.invoice) actions.push({ key: "in" + c.id, kind: "install", title: `Schedule ${first(c.name)}'s install`, sub: `${c.value ? usd(c.value) + " job" : "Won"}${c.line ? ` · ${c.line}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Schedule" });
    else if (c.install && c.install >= today) {
      const days = Math.round((Date.parse(c.install + "T12:00:00") - Date.parse(today + "T12:00:00")) / 86400000);
      const step = jobSteps(biz.trade, c.details).find(s => !c.job[s.key]);
      if (days <= 7 && step && step.key !== "installed" && step.key !== "walk") actions.push({ key: "js" + c.id, kind: "install", title: `${first(c.name)}: ${step.label.toLowerCase()}?`, sub: `Install ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}${c.line ? ` · ${c.line}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Open job" });
    }
    else if (c.install && c.install < today && !c.invoice) actions.push({ key: "iv" + c.id, kind: "invoice", title: `Invoice ${first(c.name)}`, sub: `Installed ${dateLabel(c.install)}${c.value ? ` · ${usd(c.value)}` : ""}`, go: () => go.record(c.id, { view: "job" }), cta: "Invoice" });
    else if (c.install && c.install < today && c.invoice?.status === "paid" && !c.reviewSent && biz.reviewLink) actions.push({ key: "rv" + c.id, kind: "review", title: `${first(c.name)}: ask for the review`, sub: `Installed ${dateLabel(c.install)} · paid in full`, go: () => go.record(c.id, { view: "job" }), cta: "Open" });
  }
  if (d.unreadFromSam) actions.push({ key: "sam", kind: "sam", title: "Message from Sam", sub: "Your Cinder rep", go: () => go.tab("sam"), cta: "Open" });

  // The week: estimates Cinder booked and installs he set.
  const end = Date.now() + 7 * 86400000;
  const dayOf = (iso: string) => { const dd = iso.slice(0, 10); return dd === today ? "Today" : new Date(dd + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
  const week = [
    ...d.appointments.filter(a => { const t = Date.parse(a.starts_at); return t > Date.now() - 3600000 && t < end; })
      .map(a => { const c = byThread.get(a.thread_id); return { key: "a" + a.id, at: Date.parse(a.starts_at), day: dayOf(new Date(a.starts_at).toLocaleDateString("en-CA")), time: clock(a.starts_at), who: a.customer_name || fmtPhone(a.customer_phone), what: "estimate", sub: [c?.line, String(c?.details.address ?? "")].filter(Boolean).join(" · ") || "Booked by Cinder", tag: ["Estimate", "blue"], phone: a.customer_phone || c?.phone || "", addr: String(c?.details.address ?? ""), id: c?.id ?? a.thread_id, go: () => c ? go.record(c.id) : go.thread(a.thread_id) }; }),
    ...cards.filter(c => c.stage === "won" && c.install && c.install >= today && Date.parse(c.install + "T12:00:00") < end)
      .map(c => ({ key: "i" + c.id, at: Date.parse(`${c.install}T${c.installTime || "07:00"}`), day: dayOf(c.install!), time: c.installTime ? hhmm(c.installTime) : "All day", who: c.name, what: c.installDays > 1 ? `install, ${c.installDays} days` : "install", sub: [c.line, String(c.details.address ?? "")].filter(Boolean).join(" · "), tag: ["Install", "ok"], phone: c.phone, addr: String(c.details.address ?? ""), id: c.id, go: () => go.record(c.id, { view: "job" }) })),
  ].sort((a, b) => a.at - b.at).slice(0, 6);

  // Money and sources.
  const sent = invoices.filter(i => i.status === "sent"), owed = sent.reduce((a, i) => a + i.total, 0), late = sent.filter(i => overdue(i.status, i.due_on, today));
  const paid30 = invoices.filter(i => i.status === "paid" && i.paid_at && Date.parse(i.paid_at) > Date.now() - 30 * 86400000).reduce((a, i) => a + i.total, 0);
  const sources = sourceReport(cards.filter(c => c.source !== "owner" || c.stage !== "new")).filter(r => r.won > 0 || r.leads > 0).slice(0, 5);
  const totalWon = sources.reduce((a, r) => a + r.wonValue, 0);
  const lastWeek = L.weeks.at(-1);

  const hour = new Date().getHours();
  const hello = `${hour < 12 ? "Good morning" : hour >= 17 ? "Good evening" : "Good afternoon"}${d.owner ? `, ${first(d.owner)}` : ""}`;
  const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return <>
    <header className="ph"><h1>{hello}</h1><span className="sub">{dateLine}{lastWeek?.leads ? ` · ${lastWeek.leads} ${lastWeek.leads === 1 ? "lead" : "leads"} answered this week` : ""}</span>
      <div className="acts">
        <div className="find"><FindButton onOpen={go.find} /></div>
        <button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />Add lead</button>
      </div></header>
    <div className="pad today">
      <div className="stats">
        <button type="button" className="stat" onClick={() => go.tab("numbers")}><span>Won · 30 days</span><b>{usd(L.wonValue)}</b><small className={L.won ? "up" : ""}>{L.won ? `${L.won} ${L.won === 1 ? "job" : "jobs"} from Cinder leads` : "No wins yet"}</small></button>
        <button type="button" className="stat" onClick={() => go.tab("invoices")}><span>Owed to you</span><b>{usd(owed)}</b><small className={late.length ? "down" : ""}>{late.length ? `${late.length} past due` : sent.length ? `${sent.length} ${sent.length === 1 ? "invoice" : "invoices"} out` : "All paid up"}</small></button>
        <button type="button" className="stat" onClick={() => go.tab("jobs")}><span>Quotes out</span><b>{usd(L.chasingValue)}</b><small>{L.chasing ? `${L.chasing} waiting on an answer` : "Nothing waiting"}</small></button>
        <button type="button" className="stat" onClick={() => go.tab("numbers")}><span>Leads answered</span><b>{L.answered}<small> / {L.leads}</small></b><small>{L.replySec != null ? `First reply in ${secs(L.replySec)}` : "Last 30 days"}</small></button>
      </div>
      <div className="cols">
        <div className="col">
          <section className="card">
            <div className="hd"><h2>Needs you</h2><small>{actions.length ? `${actions.length}` : "Clear"}</small><button type="button" className="link" onClick={() => go.tab("jobs")}>All jobs</button></div>
            {actions.length ? actions.slice(0, 8).map(a => <div key={a.key} className="row">
              <span className={"ic " + ICON[a.kind][1]}><Icon name={ICON[a.kind][0]} size={15} /></span>
              <span style={{ minWidth: 0 }}><b>{a.title}</b><small>{a.sub}</small>{a.draft && <q className="nudge">{a.draft}</q>}</span>
              <button type="button" className={"btn sm" + (a.primary ? " ink" : "")} onClick={a.go}>{a.cta}</button>
            </div>) : <div className="bd fine">Nothing waiting on you. New leads, late invoices and quotes to write land here.</div>}
          </section>
          <section className="card">
            <div className="hd"><h2>This week</h2><small>{week.length ? `${week.filter(w => w.what === "estimate").length} estimates · ${week.filter(w => w.what !== "estimate").length} installs` : "Nothing booked"}</small><button type="button" className="link" onClick={() => go.tab("calendar")}>Calendar</button></div>
            {week.length ? week.map(w => <div key={w.key} className="t wk">
              <button type="button" className="wk-main" onClick={w.go}><time>{w.day}<br />{w.time}</time><span style={{ minWidth: 0 }}><b>{w.who} · {w.what}</b><small>{w.sub}</small></span></button>
              <span className="wk-acts">
                {w.addr && <a className="btn ghost sm ic" href={`https://maps.google.com/?daddr=${encodeURIComponent(w.addr)}`} target="_blank" rel="noreferrer" title="Directions" aria-label={`Directions to ${w.who}`}><Icon name="pin" size={14} /></a>}
                {w.phone && <a className="btn ghost sm ic" href={`tel:${w.phone}`} title="Call" aria-label={`Call ${w.who}`}><Icon name="phone" size={14} /></a>}
                <button type="button" className="btn ghost sm ic" title="Text" aria-label={`Text ${w.who}`} onClick={() => go.thread(w.id)}><Icon name="chat" size={14} /></button>
                <span className={"tag " + w.tag[1]}>{w.tag[0]}</span></span></div>)
              : <div className="bd fine">Cinder books estimates where you&rsquo;re free as leads come in.</div>}
          </section>
        </div>
        <div className="col">
          <section className="card">
            <div className="hd"><h2>Money</h2><small>last 30 days</small><button type="button" className="link" onClick={() => go.tab("invoices")}>Invoices</button></div>
            <div className="money"><span>Won</span><b>{usd(L.wonValue)}</b></div>
            <div className="money"><span>Collected</span><b>{usd(paid30)}</b></div>
            <div className="money"><span>Owed{late.length ? <small> · {late.length} late</small> : null}</span><b style={late.length ? { color: "var(--red-text)" } : undefined}>{usd(owed)}</b></div>
            <div className="money"><span>Quoted, waiting</span><b>{usd(L.chasingValue)}</b></div>
          </section>
          <section className="card">
            <div className="hd"><h2>Where jobs came from</h2><small>last 4 months</small><button type="button" className="link" onClick={() => go.tab("numbers")}>Numbers</button></div>
            {sources.length ? sources.map(r => <div key={r.source} className="money"><span>{r.label}<small> · {r.leads} {r.leads === 1 ? "lead" : "leads"}{r.won ? `, ${r.won} won` : ""}</small></span><b className={r.wonValue ? "" : "mut"}>{r.wonValue ? `${usd(r.wonValue)}${totalWon ? ` · ${Math.round((r.wonValue / totalWon) * 100)}%` : ""}` : "–"}</b></div>)
              : <div className="bd fine">Once leads come in, this shows which source pays.</div>}
          </section>
          <section className="card">
            <div className="hd"><h2>Cinder this week</h2><button type="button" className="link" onClick={() => go.tab("system")}>System</button></div>
            <div className="row"><span className="ic"><Icon name="bolt" size={15} /></span><span><b>{lastWeek ? `${lastWeek.leads} ${lastWeek.leads === 1 ? "lead" : "leads"} answered, ${lastWeek.booked} ${lastWeek.booked === 1 ? "estimate" : "estimates"} booked` : "Waiting for the first lead"}</b><small>{L.replySec != null ? `Typical first reply in ${secs(L.replySec)}, day or night` : "Day or night"}</small></span></div>
            <div className="row"><span className="ic"><Icon name="clock" size={15} /></span><span><b>{L.chasing ? `${L.chasing} ${L.chasing === 1 ? "quote" : "quotes"} being followed up` : "No quotes waiting"}</b><small>{L.chasing ? `${usd(L.chasingValue)} open · stops the moment they reply` : "Quoted jobs get four follow-ups"}</small></span></div>
            <div className="row"><span className="ic"><Icon name="user" size={15} /></span><span><b>{d.unreadFromSam ? "Sam wrote to you" : "Sam Ward, your rep"}</b><small>{d.unreadFromSam ? `${d.unreadFromSam} new` : "Hours, prices, wording changes"}</small></span><button type="button" className="btn sm" onClick={() => go.tab("sam")}>Open</button></div>
          </section>
        </div>
      </div>
    </div>
  </>;
}
