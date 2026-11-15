"use client";

// Today: the one screen an owner opens between jobs. What's in play, what needs him right now (each a single tap),
// and what's on the calendar today. Everything else lives a tab away.
import type { Card, CardInvoice } from "@/lib/crm";
import { overdue } from "@/lib/billing";
import { useCountUp } from "./sx";

type Ask = { id: string; name: string; ask?: string; last: string; at: string | null };
type Appt = { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string };
type Inv = CardInvoice & { thread_id: string; customer: string; phone: string };
export type TodayGo = { thread: (id: string) => void; card: (id: string, stage?: "quoted" | "won") => void; invoice: (id: string) => void; calendar: () => void; sam: () => void; numbers: () => void };
type Kind = "reply" | "money" | "quote" | "install" | "invoice" | "sam";
type Action = { key: string; kind: Kind; title: string; sub: string; go: () => void; cta: string };

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

export function TodayTab({ owner, cards, invoices, asks, due, appts, unreadSam, live, go }: {
  owner: string; cards: Card[]; invoices: Inv[]; asks: Ask[]; due: Appt[]; appts: Appt[]; unreadSam: number;
  live: { wonValue: number; won: number; answered: number; leads: number; replySec: number | null; booked: number }; go: TodayGo;
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const byThread = new Map(cards.map(c => [c.id, c]));
  const actions: Action[] = [];
  // 1. People waiting on him.
  for (const a of asks) actions.push({ key: "r" + a.id, kind: "reply", title: `Reply to ${first(a.name)}`, sub: a.ask || a.last, go: () => go.thread(a.id), cta: "Reply" });
  for (const c of cards) if (c.stage === "quoted" && c.quote?.status === "replied") actions.push({ key: "qr" + c.id, kind: "reply", title: `${first(c.name)} answered your quote`, sub: c.quote.amount ? `${usd(c.quote.amount)} quote` : "Read what they said", go: () => go.thread(c.id), cta: "Read" });
  // 2. Money.
  for (const i of invoices) {
    if (i.status === "sent" && i.paid_claimed_at) actions.push({ key: "pc" + i.id, kind: "money", title: `${first(i.customer)} says they paid`, sub: `Invoice #${i.number} · ${usd(i.total)}. Check your account.`, go: () => go.invoice(i.id), cta: "Check" });
    else if (overdue(i.status, i.due_on, today)) actions.push({ key: "od" + i.id, kind: "money", title: `${first(i.customer)} is ${daysPast(i.due_on!)} ${daysPast(i.due_on!) === 1 ? "day" : "days"} past due`, sub: `Invoice #${i.number} · ${usd(i.total)}${i.reminders ? ` · ${i.reminders} reminder${i.reminders === 1 ? "" : "s"} sent` : ""}`, go: () => go.invoice(i.id), cta: "Open" });
    else if (i.status === "draft") actions.push({ key: "dr" + i.id, kind: "invoice", title: `Send ${first(i.customer)}'s invoice`, sub: `#${i.number} · ${usd(i.total)}, not sent yet`, go: () => go.invoice(i.id), cta: "Send" });
  }
  // 3. Quotes to write: the estimate happened and there's no quote yet.
  const quoted = new Set<string>();
  for (const a of due) {
    const c = byThread.get(a.thread_id);
    if (c && (c.stage === "quoted" || c.stage === "won" || c.stage === "lost")) continue;
    quoted.add(a.thread_id);
    actions.push({ key: "q" + a.id, kind: "quote", title: `Quote ${first(a.customer_name)}`, sub: `Estimate was ${new Date(a.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`, go: () => c ? go.card(c.id, "quoted") : go.calendar(), cta: "Quote" });
  }
  for (const c of cards) if (!quoted.has(c.id) && c.stage === "quoted" && c.quote && !c.quote.linked && c.quote.amount) actions.push({ key: "qs" + c.id, kind: "quote", title: `Send ${first(c.name)} the quote`, sub: `${usd(c.quote.amount)}, saved but not sent`, go: () => go.card(c.id), cta: "Send" });
  // 4. Won jobs: get them on the calendar, then invoiced.
  for (const c of cards) {
    if (c.stage !== "won" || c.pastCustomer) continue;
    if (!c.install && !c.invoice) actions.push({ key: "in" + c.id, kind: "install", title: `Schedule ${first(c.name)}'s install`, sub: `${c.value ? usd(c.value) + " job" : "Won"}${c.line ? ` · ${c.line}` : ""}`, go: () => go.card(c.id), cta: "Schedule" });
    else if (c.install && c.install < today && !c.invoice) actions.push({ key: "iv" + c.id, kind: "invoice", title: `Invoice ${first(c.name)}`, sub: `Installed ${new Date(c.install + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}${c.value ? ` · ${usd(c.value)}` : ""}`, go: () => go.card(c.id), cta: "Invoice" });
  }
  if (unreadSam) actions.push({ key: "sam", kind: "sam", title: "Sam sent you a message", sub: "Your Cinder contact", go: go.sam, cta: "Open" });

  // What's on today: estimates Cinder booked and installs he set.
  const now = Date.now();
  const sched = [
    ...appts.filter(a => new Date(a.starts_at).toDateString() === new Date().toDateString()).map(a => ({ key: "a" + a.id, at: Date.parse(a.starts_at), time: clock(a.starts_at), what: "Estimate", who: a.customer_name || a.customer_phone, where: String(byThread.get(a.thread_id)?.details.address ?? ""), go: () => go.thread(a.thread_id), past: Date.parse(a.starts_at) < now - 3600000 })),
    ...cards.filter(c => c.stage === "won" && c.install && c.install <= today && Date.parse(c.install + "T12:00:00") + (c.installDays - 1) * 86400000 >= Date.parse(today + "T00:00:00"))
      .map(c => ({ key: "i" + c.id, at: c.installTime ? Date.parse(`${today}T${c.installTime}`) : 0, time: c.installTime ? hhmm(c.installTime) : "All day", what: c.installDays > 1 ? `Install · ${c.installDays} days` : "Install", who: c.name, where: String(c.details.address ?? ""), go: () => go.card(c.id), past: false })),
  ].sort((a, b) => a.at - b.at);

  const open = cards.filter(c => c.stage === "new" || c.stage === "booked" || c.stage === "quoted");
  const inPlay = open.reduce((a, c) => a + (c.value ?? (c.ballpark ? (c.ballpark.low + c.ballpark.high) / 2 : 0)), 0);
  const shown = useCountUp(inPlay, 900);
  const hour = new Date().getHours();
  const hello = `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}${owner ? `, ${first(owner)}` : ""}.`;

  return <div className="td">
    <header className="td-hero">
      <p className="td-date">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1 className="td-hello">{hello}</h1>
      <p className="td-big" aria-label={`${usd(inPlay)} in open jobs`}>{usd(shown)}</p>
      <p className="td-cap">in {open.length} open {open.length === 1 ? "job" : "jobs"}{actions.length ? <> · <b>{actions.length} {actions.length === 1 ? "thing needs" : "things need"} you</b></> : " · nothing needs you"}</p>
    </header>

    <div className="td-cols"><section className="td-sec" aria-label="Needs you">
      <h2>Needs you</h2>
      {actions.length ? <ul className="td-acts">{actions.slice(0, 8).map(a => <li key={a.key}><button type="button" onClick={a.go}>
        <span className={"td-g " + a.kind} aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{GLYPH[a.kind]}</svg></span>
        <span className="td-t"><b>{a.title}</b><small>{a.sub}</small></span>
        <span className="td-cta">{a.cta}</span>
      </button></li>)}</ul>
        : <div className="td-clear"><b>You&rsquo;re all caught up.</b><p>Cinder is answering every lead. Anything that needs you shows up here.</p></div>}
      {actions.length > 8 && <p className="td-more">and {actions.length - 8} more in Inbox and Jobs</p>}
    </section>
    <div className="td-side"><section className="td-sec" aria-label="Today's schedule">
      <h2>Today</h2>
      {sched.length ? <ul className="td-sched">{sched.map(s => <li key={s.key} className={s.past ? "past" : ""}><button type="button" onClick={s.go}>
        <span className="td-time">{s.time}</span>
        <span className="td-t"><b>{s.who}</b><small>{s.what}{s.where ? ` · ${s.where}` : ""}</small></span>
      </button></li>)}</ul>
        : <p className="td-none">Nothing on the calendar today.</p>}
    </section>

    <section className="td-sec" aria-label="This month">
      <h2>Last 30 days <button type="button" className="td-link" onClick={go.numbers}>All numbers</button></h2>
      <dl className="td-month">
        <div><dt>Won</dt><dd>{short(live.wonValue)}</dd></div>
        <div><dt>Answered</dt><dd>{live.answered}<small>/{live.leads}</small></dd></div>
        <div><dt>First reply</dt><dd>{live.replySec == null ? "–" : live.replySec < 60 ? <>{live.replySec}<small>s</small></> : <>{Math.round(live.replySec / 60)}<small>m</small></>}</dd></div>
      </dl>
    </section></div></div>
  </div>;
}
