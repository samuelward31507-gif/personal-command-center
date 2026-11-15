"use client";

// Today: the one screen an owner opens between jobs. What's in play, what needs him right now (each a single tap),
// and what's on the calendar today. Everything else lives a tab away.
import { jobSteps, type Card, type CardInvoice } from "@/lib/crm";
import { overdue } from "@/lib/billing";
import { useMemo, useState } from "react";
import { CinderEmber } from "../cinder-brand";

type Ask = { id: string; name: string; ask?: string; last: string; at: string | null };
type Appt = { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string };
type Inv = CardInvoice & { thread_id: string; customer: string; phone: string };
export type TodayGo = { thread: (id: string) => void; card: (id: string, stage?: "quoted" | "won") => void; invoice: (id: string) => void; calendar: () => void; sam: () => void; numbers: () => void; jobs: () => void; invoices: () => void; inbox: () => void };
type Kind = "reply" | "money" | "quote" | "install" | "invoice" | "sam";
type Action = { key: string; kind: Kind; title: string; sub: string; go: () => void; cta: string };

const STAGE_WORD: Record<string, string> = { new: "New", booked: "Estimate booked", quoted: "Quoted", won: "Won", lost: "Lost" };
const first = (s: string) => (s || "").trim().split(" ")[0] || "them";
const short = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : "$" + Math.round(n).toLocaleString("en-US");
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const clock = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
const ago = (d: string | null) => { if (!d) return ""; const m = Math.round((Date.now() - Date.parse(d)) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };
const daysPast = (d: string) => Math.max(1, Math.round((Date.now() - Date.parse(d + "T23:59:00")) / 86400000));

const GLYPH: Record<Kind, React.ReactNode> = {
  reply: <path d="M4 12a8 8 0 1 1 3.3 6.5L4 20l1.2-3.6A8 8 0 0 1 4 12z" />,
  money: <><path d="M12 3v18" /><path d="M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.5 0-4 1.3-4 3s1.5 2.6 4 3 4 1.4 4 3.2-1.6 3.1-4.2 3.1c-2.2 0-3.8-.9-4.6-2.2" /></>,
  quote: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4M10 13h5M10 16.5h3.5" /></>,
  install: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  invoice: <><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" /><path d="M9.5 9h5M9.5 12.5h5" /></>,
  sam: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
};

export function TodayTab({ owner, business, trade, cards, invoices, asks, due, appts, unreadSam, live, go }: {
  owner: string; trade?: string; business: string; cards: Card[]; invoices: Inv[]; asks: Ask[]; due: Appt[]; appts: Appt[]; unreadSam: number;
  live: { wonValue: number; won: number; answered: number; leads: number; replySec: number | null; booked: number }; go: TodayGo;
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const byThread = new Map(cards.map(c => [c.id, c]));
  const actions: Action[] = [];
  // 1. People waiting on him.
  for (const a of asks) actions.push({ key: "r" + a.id, kind: "reply", title: `Reply to ${first(a.name)}`, sub: a.ask || a.last, go: () => go.thread(a.id), cta: "Reply" });
  for (const c of cards) if (c.stage === "quoted" && c.quote?.status === "replied") actions.push({ key: "qr" + c.id, kind: "reply", title: `${first(c.name)} answered your quote`, sub: c.quote.amount ? `${usd(c.quote.amount)} quote` : "", go: () => go.thread(c.id), cta: "Read" });
  // 2. Money.
  for (const i of invoices) {
    if (i.status === "sent" && i.paid_claimed_at) actions.push({ key: "pc" + i.id, kind: "money", title: `${first(i.customer)} says they paid`, sub: `${usd(i.total)} · invoice #${i.number}`, go: () => go.invoice(i.id), cta: "Check" });
    else if (overdue(i.status, i.due_on, today)) actions.push({ key: "od" + i.id, kind: "money", title: `${first(i.customer)}: ${daysPast(i.due_on!)} ${daysPast(i.due_on!) === 1 ? "day" : "days"} late`, sub: `${usd(i.total)} · invoice #${i.number}${i.reminders ? ` · ${i.reminders} reminder${i.reminders === 1 ? "" : "s"} sent` : ""}`, go: () => go.invoice(i.id), cta: "Open" });
    else if (i.status === "draft") actions.push({ key: "dr" + i.id, kind: "invoice", title: `Send ${first(i.customer)}'s invoice`, sub: `${usd(i.total)} · invoice #${i.number}`, go: () => go.invoice(i.id), cta: "Send" });
  }
  // 3. Quotes to write: the estimate happened and there's no quote yet.
  const quoted = new Set<string>();
  for (const a of due) {
    const c = byThread.get(a.thread_id);
    if (c && (c.stage === "quoted" || c.stage === "won" || c.stage === "lost")) continue;
    quoted.add(a.thread_id);
    actions.push({ key: "q" + a.id, kind: "quote", title: `Quote ${first(a.customer_name)}`, sub: `Estimate ${new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`, go: () => c ? go.card(c.id, "quoted") : go.calendar(), cta: "Quote" });
  }
  for (const c of cards) if (!quoted.has(c.id) && c.stage === "quoted" && c.quote && !c.quote.linked && c.quote.amount) actions.push({ key: "qs" + c.id, kind: "quote", title: `Send ${first(c.name)} the quote`, sub: `${usd(c.quote.amount)} · not sent`, go: () => go.card(c.id), cta: "Send" });
  // 4. Won jobs: get them on the calendar, then invoiced.
  for (const c of cards) {
    if (c.stage !== "won" || c.pastCustomer) continue;
    if (!c.install && !c.invoice) actions.push({ key: "in" + c.id, kind: "install", title: `Schedule ${first(c.name)}'s install`, sub: `${c.value ? usd(c.value) + " job" : "Won"}${c.line ? ` · ${c.line}` : ""}`, go: () => go.card(c.id), cta: "Schedule" });
    else if (c.install && c.install >= today && trade !== undefined) {
      // Before the install: whatever has to happen first (deposit, HOA, permit, 811, materials) shows up a week out.
      const days = Math.round((Date.parse(c.install + "T12:00:00") - Date.parse(today + "T12:00:00")) / 86400000);
      const step = jobSteps(trade, c.details).find(s => !c.job[s.key]);
      if (days <= 7 && step && step.key !== "installed" && step.key !== "walk") actions.push({ key: "js" + c.id, kind: "install", title: `${first(c.name)}: ${step.label.toLowerCase()}?`,
        sub: `Install ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}${step.hint ? ` · ${step.hint}` : ""}`, go: () => go.card(c.id), cta: "Open" });
    }
    else if (c.install && c.install < today && !c.invoice) actions.push({ key: "iv" + c.id, kind: "invoice", title: `Invoice ${first(c.name)}`, sub: `Installed ${new Date(c.install + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}${c.value ? ` · ${usd(c.value)}` : ""}`, go: () => go.card(c.id), cta: "Invoice" });
  }
  if (unreadSam) actions.push({ key: "sam", kind: "sam", title: "Message from Sam", sub: "Your Cinder rep", go: go.sam, cta: "Open" });

  // What's on today: estimates Cinder booked and installs he set.
  const now = Date.now();
  const sched = [
    ...appts.filter(a => new Date(a.starts_at).toDateString() === new Date().toDateString()).map(a => ({ key: "a" + a.id, at: Date.parse(a.starts_at), time: clock(a.starts_at), what: "Estimate", who: a.customer_name || a.customer_phone, where: String(byThread.get(a.thread_id)?.details.address ?? ""), go: () => go.thread(a.thread_id), past: Date.parse(a.starts_at) < now - 3600000 })),
    ...cards.filter(c => c.stage === "won" && c.install && c.install <= today && Date.parse(c.install + "T12:00:00") + (c.installDays - 1) * 86400000 >= Date.parse(today + "T00:00:00"))
      .map(c => ({ key: "i" + c.id, at: c.installTime ? Date.parse(`${today}T${c.installTime}`) : 0, time: c.installTime ? hhmm(c.installTime) : "All day", what: c.installDays > 1 ? `Install · ${c.installDays} days` : "Install", who: c.name, where: String(c.details.address ?? ""), go: () => go.card(c.id), past: false })),
  ].sort((a, b) => a.at - b.at);

  // The week ahead: so a quiet today still shows what's coming.
  const end = Date.now() + 7 * 86400000, tomorrow = new Date(Date.parse(today + "T12:00:00") + 86400000).toLocaleDateString("en-CA");
  const dayOf = (iso: string) => { const d = iso.slice(0, 10); return d === tomorrow ? "Tomorrow" : new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
  const ahead = [
    ...appts.filter(a => { const t = Date.parse(a.starts_at); return new Date(a.starts_at).toLocaleDateString("en-CA") > today && t < end; })
      .map(a => ({ key: "na" + a.id, at: Date.parse(a.starts_at), day: dayOf(new Date(a.starts_at).toLocaleDateString("en-CA")), time: clock(a.starts_at), what: "Estimate", who: a.customer_name || a.customer_phone, go: () => go.thread(a.thread_id) })),
    ...cards.filter(c => c.stage === "won" && c.install && c.install > today && Date.parse(c.install + "T12:00:00") < end)
      .map(c => ({ key: "ni" + c.id, at: Date.parse(`${c.install}T${c.installTime || "07:00"}`), day: dayOf(c.install!), time: c.installTime ? hhmm(c.installTime) : "All day", what: c.installDays > 1 ? `Install, ${c.installDays} days` : "Install", who: c.name, go: () => go.card(c.id) })),
  ].sort((a, b) => a.at - b.at).slice(0, 6);


  const sent = invoices.filter(i => i.status === "sent");
  const owed = sent.reduce((a, i) => a + i.total, 0), late = sent.filter(i => overdue(i.status, i.due_on, today));
  const lateTotal = late.reduce((a, i) => a + i.total, 0);
  const hour = new Date().getHours();
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const hello = `${hour < 12 ? "Good morning" : hour >= 17 ? "Good evening" : `Happy ${day}`}${owner ? `, ${first(owner)}` : ""}`;

  // The box finds anyone: a name, a street, a phone number or an invoice number.
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase(), digits = t.replace(/\D/g, "");
    if (t.length < 2) return [];
    const people = cards.filter(c => c.name.toLowerCase().includes(t) || String(c.details.address ?? "").toLowerCase().includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 5).map(c => ({ key: "c" + c.id, title: c.name || c.phone, sub: [STAGE_WORD[c.stage], c.line].filter(Boolean).join(" · "), go: () => go.card(c.id) }));
    const bills = invoices.filter(i => `#${i.number}`.includes(t) || String(i.number) === digits || (i.customer || "").toLowerCase().includes(t))
      .slice(0, 3).map(i => ({ key: "i" + i.id, title: `Invoice #${i.number}`, sub: `${i.customer || i.phone} · ${usd(i.total)}`, go: () => go.invoice(i.id) }));
    return [...people, ...bills];
  }, [q, cards, invoices, go]);
  const next = [...sched.filter(s => !s.past).map(s => ({ ...s, day: "Today" })), ...ahead][0];

  return <div className="hm">
    <div className="hm-hero">
      <h1 className="hm-hello"><CinderEmber className="hm-mark" />{hello}</h1>
      <form className="hm-box" role="search" onSubmit={e => { e.preventDefault(); hits[0]?.go(); }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a customer, job or invoice" aria-label="Find a customer, job or invoice" autoComplete="off" />
        {q && <button type="button" className="hm-clear" onClick={() => setQ("")} aria-label="Clear">×</button>}
      </form>
      {q.trim().length >= 2 ? <ul className="hm-hits">{hits.length ? hits.map(h => <li key={h.key}><button type="button" onClick={h.go}><b>{h.title}</b><small>{h.sub}</small></button></li>)
        : <li className="hm-none">No one matches &ldquo;{q.trim()}&rdquo;.</li>}</ul>
      : <div className="hm-chips">
        <button type="button" onClick={go.inbox}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH.reply}</svg>Who needs a reply?</button>
        <button type="button" onClick={go.invoices}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH.money}</svg>What&rsquo;s owed?</button>
        <button type="button" onClick={go.calendar}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH.install}</svg>My week</button>
      </div>}
    </div>

    <section className="hm-next" aria-label="Pick up where you left off">
      <div className="hm-next-h"><span>Pick up where you left off</span><button type="button" onClick={go.jobs}>View all</button></div>
      <div className="hm-grid">
        <button type="button" className="hm-card" onClick={actions[0]?.go ?? go.jobs}>
          <div className="hm-thumb"><b>Today · {actions.length} to do</b>
            {actions.slice(0, 3).map(a => <span key={a.key} className={a.kind === "money" ? "late" : ""}>{a.title}</span>)}
            {!actions.length && <span>Nothing waiting on you</span>}</div>
          <div className="hm-t">{actions[0]?.title ?? "You're clear"}</div>
          <div className="hm-s">{actions[0]?.sub ?? "Cinder is handling the rest"}</div>
        </button>
        <button type="button" className="hm-card" onClick={go.invoices}>
          <div className="hm-thumb"><b>Owed · {usd(owed)}</b>
            {sent.slice(0, 3).map(i => <span key={i.id} className="hm-money"><em>{i.customer || i.phone}</em><i>{usd(i.total)}</i></span>)}
            {!sent.length && <span>All paid up</span>}</div>
          <div className="hm-t">{sent[0] ? `${first(sent[0].customer)} owes ${usd(sent[0].total)}` : "Nobody owes you"}</div>
          <div className={"hm-s" + (late.length ? " late" : "")}>{late.length ? `${usd(lateTotal)} overdue` : "Nothing overdue"}</div>
        </button>
        <button type="button" className="hm-card" onClick={next ? next.go : go.calendar}>
          <div className="hm-thumb"><b>Next 7 days · {sched.length + ahead.length}</b>
            {[...sched.map(s => ({ key: s.key, t: `Today ${s.time}`, w: s.who })), ...ahead.map(a => ({ key: a.key, t: a.day, w: a.who }))].slice(0, 3).map(r => <span key={r.key} className="hm-money"><em>{r.w}</em><i>{r.t}</i></span>)}
            {!sched.length && !ahead.length && <span>Nothing booked yet</span>}</div>
          <div className="hm-t">{next ? `${next.who}, ${next.what.toLowerCase()}` : "A clear week"}</div>
          <div className="hm-s">{next ? `${next.day} at ${next.time}` : "Cinder books estimates as leads come in"}</div>
        </button>
      </div>
      <p className="hm-foot"><button type="button" onClick={go.numbers}><b>{short(live.wonValue)}</b> won in the last 30 days</button><span>·</span><button type="button" onClick={go.numbers}><b>{live.answered} of {live.leads}</b> leads answered</button><span>·</span><button type="button" onClick={go.numbers}>first reply in <b>{live.replySec == null ? "–" : live.replySec < 60 ? `${live.replySec}s` : `${Math.round(live.replySec / 60)}m`}</b></button></p>
    </section>
  </div>;
}
