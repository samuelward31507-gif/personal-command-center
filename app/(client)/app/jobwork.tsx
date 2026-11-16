"use client";

// On a won job: change orders (extra work the customer approves from a link), and the hours the crew clocked on it,
// turned into a labor cost. In Your day: the clock. In Reports: hours by person and recurring revenue.
import { useEffect, useState } from "react";
import { dollars, totals, type Item } from "@/lib/billing";
import { hoursText, laborOf, minutesOf, monthlyValue, ratesOf, type ChangeOrder, type TimeEntry } from "@/lib/service";
import { parseTeam, type Card, type Costs } from "@/lib/crm";
import { Avatar, Icon, Sheet, Spinner, ago, clock, dateLabel, first, fmtPhone, todayIso, usd, useArm } from "./parts";
import { LineEditor } from "./money";
import { crewName } from "./crew";
import type { Data, Go } from "./types";

type R = { sent?: boolean; warn?: string; link?: string };
type Act = (k: string, b: Record<string, unknown>, done: string | ((r: R) => string)) => Promise<R | null>;

const coState = (c: ChangeOrder): { text: string; tone: string } => c.status === "approved" ? { text: c.invoiced ? "Approved, on the invoice" : "Approved", tone: "good" }
  : c.status === "declined" ? { text: "Declined", tone: "bad" } : c.status === "sent" ? { text: c.viewed_at ? `Opened ${ago(c.viewed_at)}` : "Texted, not opened", tone: c.viewed_at ? "ink" : "" } : { text: "Draft", tone: "" };

/** Extra work mid-job. Each one is its own little quote the customer approves; approved ones go on the invoice. */
export function ChangeOrders({ card, act, busy, canText, taxRate }: { card: Card; act: Act; busy: string; canText: boolean; taxRate: number }) {
  const cos = card.changeOrders ?? [];
  const [edit, setEdit] = useState<ChangeOrder | "new" | null>(null), [arm, setArm] = useArm();
  const added = cos.filter(c => c.status === "approved").reduce((a, c) => a + c.total, 0);
  async function copy(c: ChangeOrder) {
    const r = c.url ? { link: c.url } : await act("co" + c.id, { action: "cosend", co: c.id }, x => x.sent ? `Texted to ${first(card.name)}.` : x.warn || "Link ready.");
    if (!r?.link) return;
    try { await navigator.clipboard.writeText(r.link); } catch { prompt("Copy the link:", r.link); }
  }
  return <section className="card"><div className="hd"><h2>Change orders</h2>{added > 0 && <small style={{ marginLeft: "auto" }}>+{dollars(added)} approved</small>}</div>
    <div className="bd" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {cos.length ? <ul className="cos">{cos.map(c => { const st = coState(c); return <li key={c.id}>
        <div className="co-h"><span className="t"><b>#{c.number} {c.title}</b><small className={st.tone ? "dot " + st.tone : "dot"}>{st.text}{c.signed_by ? `, signed ${c.signed_by}` : ""}</small></span><b className="num">{dollars(c.total)}</b></div>
        {(c.status === "draft" || c.status === "sent") && <div className="acts-row end">
          <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => setEdit(c)}>Edit</button>
          <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => arm === "drop" + c.id ? void act("co" + c.id, { action: "coset", co: c.id, what: "void" }, "Dropped.") : setArm("drop" + c.id)}>{arm === "drop" + c.id ? "Tap to drop" : "Drop"}</button>
          <button type="button" className="btn sm" disabled={!!busy} onClick={() => arm === "yes" + c.id ? void act("co" + c.id, { action: "coset", co: c.id, what: "approved" }, `Approved. ${dollars(c.total)} added to the job.`) : setArm("yes" + c.id)} title="They said yes in person">{arm === "yes" + c.id ? "Tap: they said yes" : "Approved in person"}</button>
          <button type="button" className="btn sm" disabled={!!busy} onClick={() => void copy(c)}>Copy link</button>
          <button type="button" className="btn sm ink" disabled={!!busy || !canText} onClick={() => void act("co" + c.id, { action: "cosend", co: c.id }, x => x.sent ? `Texted ${first(card.name)} change order #${c.number}.` : x.warn || "Ready.")}>{busy === "co" + c.id ? <Spinner /> : c.status === "sent" ? "Text again" : `Text ${first(card.name)}`}</button>
        </div>}
      </li>; })}</ul> : <p className="fine">Customer wants a second gate, or you found rot under the old fence? Write it up here. They approve it from a link with their name, and it goes on the invoice.</p>}
      <div className="acts-row"><button type="button" className="btn sm" onClick={() => setEdit("new")}><Icon name="plus" size={13} />Add a change order</button></div>
    </div>
    {edit && <ChangeOrderSheet card={card} co={edit === "new" ? null : edit} taxRate={taxRate} act={act} busy={busy} canText={canText} onClose={() => setEdit(null)} />}
  </section>;
}

function ChangeOrderSheet({ card, co, taxRate, act, busy, canText, onClose }: { card: Card; co: ChangeOrder | null; taxRate: number; act: Act; busy: string; canText: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(co?.title ?? ""), [items, setItemsRaw] = useState<Item[]>(co?.items.length ? co.items : [{ name: "", qty: 1, unit: "", price: 0 }]);
  const [tax, setTax] = useState(co ? co.tax_rate : taxRate), [note, setNote] = useState(co?.note ?? "");
  const total = totals(items.filter(i => i.name.trim() && i.qty > 0), tax).total;
  const input = { title, items, tax_rate: tax, note };
  const save = async (send: boolean) => { const r = await act("cosave", { action: "co", co: co?.id, input, send }, x => send ? (x.sent ? `Texted ${first(card.name)} the change order: ${dollars(total)}.` : x.warn || "Saved.") : "Change order saved. Not sent yet."); if (r) onClose(); };
  return <Sheet onClose={onClose} title={co ? `Change order #${co.number}` : "New change order"} sub={`${card.name}, added to the job once they approve`} wide
    foot={<><span style={{ flex: 1 }} /><button type="button" className="btn" disabled={!!busy || total <= 0 || !title.trim()} onClick={() => void save(false)}>Save, don&rsquo;t send</button>
      <button type="button" className="btn ink" disabled={!!busy || total <= 0 || !title.trim() || !canText} onClick={() => void save(true)}>{busy === "cosave" ? <Spinner /> : `Text ${first(card.name)} ${dollars(total)}`}</button></>}>
    <label className="field"><span>What changed</span><input value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="Add a second walk gate, replace 3 rotted posts" autoFocus /></label>
    <LineEditor items={items} setItems={f => setItemsRaw(f)} tax={tax} setTax={setTax} />
    <label className="field"><span>Details <em>optional, they&rsquo;ll see it</em></span><textarea rows={2} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Found while pulling the old posts. Same wood as the rest of the fence." /></label>
    <p className="fine">They get a link, see the lines and approve with their name. You get a text the moment they do, and it&rsquo;s added to the open invoice (or the next one you make).</p>
  </Sheet>;
}

/** Hours clocked on this job, and what they cost at each person's rate. One tap makes it the job's labor cost. */
export function HoursBox({ d, card, act, busy }: { d: Data; card: Card; act: Act; busy: string }) {
  const entries = (d.time ?? []).filter(e => e.thread_id === card.id);
  const rates = ratesOf(parseTeam(d.setup?.team ?? "[]")), ownerRate = Number(d.setup?.labor_rate) || 0;
  const mine = (d.time ?? []).find(e => !e.ended_at && e.member === (d.role === "crew" ? d.me : ""));
  const here = mine?.thread_id === card.id;
  const l = laborOf(entries, rates, ownerRate);
  const byWho = new Map<string, number>(); for (const e of entries) byWho.set(e.member, (byWho.get(e.member) ?? 0) + minutesOf(e));
  const noRates = !ownerRate && !Object.keys(rates).length;
  return <section className="card"><div className="hd"><h2>Hours on this job</h2>{l.minutes > 0 && <small style={{ marginLeft: "auto" }}>{hoursText(l.minutes)}</small>}</div>
    {[...byWho.entries()].map(([m, min]) => <div key={m || "me"} className="money"><span>{m ? crewName(d, m) : `${first(d.owner || "You")} (you)`}</span><b>{hoursText(min)}</b></div>)}
    {l.minutes > 0 && !noRates && <div className="money sum"><span className="t-em">Labor at your rates</span><b>{usd(l.cost)}</b></div>}
    {!entries.length && <p className="fine">Clock in from Your day or right here, and the hours land on this job.</p>}
    {l.minutes > 0 && noRates && <p className="fine">Add hourly rates in Settings, Account to turn hours into a labor cost.</p>}
    <div className="acts-row end" style={{ marginTop: 6 }}>
      {l.cost > 0 && l.cost !== card.costs.labor && <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("costs", { action: "jobcosts", costs: { ...card.costs, labor: l.cost } as Costs }, `Labor set to ${usd(l.cost)}.`)}>Use {usd(l.cost)} as labor</button>}
      <button type="button" className={"btn sm" + (here ? " ink" : "")} disabled={!!busy} onClick={() => void act("clock", here ? { action: "clockout" } : { action: "clockin" }, here ? "Clocked out." : `Clocked in on ${first(card.name)}'s job.`)}>{busy === "clock" ? <Spinner /> : <><Icon name="clock" size={13} />{here ? "Clock out" : "Clock in here"}</>}</button>
    </div>
  </section>;
}

/** The running clock in Your day: where you're clocked in and for how long, and one tap to stop it. */
export function ClockBar({ d, onOut, busy }: { d: Data; onOut: () => void; busy: boolean }) {
  const mine = (d.time ?? []).find(e => !e.ended_at && e.member === (d.role === "crew" ? d.me : ""));
  const [, tick] = useState(0);
  useEffect(() => { if (!mine) return; const i = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(i); }, [mine]);
  if (!mine) return null;
  const where = mine.thread_id ? (d.board ?? []).find(c => c.id === mine.thread_id)?.name || mine.customer || "a job" : "general time";
  return <div className="clockbar" role="status"><i aria-hidden="true" /><span><b>On the clock, {hoursText(minutesOf(mine))}</b><small>Since {clock(mine.started_at)}, {where}</small></span>
    <button type="button" className="btn sm ink" disabled={busy} onClick={onOut}>{busy ? <Spinner /> : "Clock out"}</button></div>;
}
export const myClock = (d: Data): TimeEntry | undefined => (d.time ?? []).find(e => !e.ended_at && e.member === (d.role === "crew" ? d.me : ""));

/** Reports: hours by person over the last two weeks, and what they cost. */
export function HoursPanel({ d, go }: { d: Data; go: Go }) {
  const since = Date.now() - 14 * 86400000;
  const entries = (d.time ?? []).filter(e => Date.parse(e.started_at) > since);
  const rates = ratesOf(parseTeam(d.setup?.team ?? "[]")), ownerRate = Number(d.setup?.labor_rate) || 0;
  const people = new Map<string, TimeEntry[]>(); for (const e of entries) people.set(e.member, [...(people.get(e.member) ?? []), e]);
  const rows = [...people.entries()].map(([m, es]) => ({ m, ...laborOf(es, rates, ownerRate), jobs: new Set(es.map(e => e.thread_id).filter(Boolean)).size })).sort((a, b) => b.minutes - a.minutes);
  const top = rows[0]?.minutes || 1, tot = rows.reduce((a, r) => a + r.cost, 0);
  return <section className="panel s6">
    <div className="panel-h"><h2>Crew hours</h2><small>last 14 days{tot ? `, ${usd(tot)} in labor` : ""}</small></div>
    <div className="panel-b">{rows.length ? <ul className="bars hours-bars">{rows.map(r => <li key={r.m || "owner"}><span>{r.m ? crewName(d, r.m) : `${first(d.owner || "You")} (you)`}</span><i style={{ width: `${(r.minutes / top) * 100}%` }} /><b>{hoursText(r.minutes)}<small>{r.cost ? ` ${usd(r.cost)}` : ""}, {r.jobs} {r.jobs === 1 ? "job" : "jobs"}</small></b></li>)}</ul>
      : <p className="fine" style={{ padding: "8px 0" }}>When you or your crew clock in from Your day, hours show here by person, and on each job as a labor cost. <button type="button" className="link" onClick={() => go.tab("today")}>Your day</button></p>}</div>
  </section>;
}

/** Reports: what service plans bring in every month, and who's on one. */
export function RecurringPanel({ d, go, onPlans }: { d: Data; go: Go; onPlans: () => void }) {
  const active = (d.plans ?? []).filter(p => p.status === "active");
  const mrr = active.reduce((a, p) => a + monthlyValue(p), 0), today = todayIso();
  return <section className="panel s6">
    <div className="panel-h"><h2>Recurring revenue</h2><small>{active.length ? `${active.length} on a plan` : "service plans"}</small></div>
    <div className="panel-b">{active.length ? <>
      <div className="money"><span>A month, on average</span><b>{usd(mrr)}</b></div>
      <div className="money"><span>A year</span><b>{usd(mrr * 12)}</b></div>
      <ul className="rows-mini">{[...active].sort((a, b) => monthlyValue(b) - monthlyValue(a)).slice(0, 4).map(p => <li key={p.id}><button type="button" className="link" onClick={() => go.record(p.thread_id)}><Avatar name={p.customer || fmtPhone(p.phone)} size="sm" />{p.customer || fmtPhone(p.phone)}</button><small>{p.name}, next {p.next_on ? (p.next_on < today ? "late" : dateLabel(p.next_on)) : "–"}</small><b>{usd(monthlyValue(p))}</b></li>)}</ul>
      <div className="acts-row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={onPlans}>All plans</button></div>
    </> : <p className="fine" style={{ padding: "8px 0" }}>Put repeat customers on a service plan and this shows the money that comes back every month. <button type="button" className="link" onClick={onPlans}>Service plans</button></p>}</div>
  </section>;
}
