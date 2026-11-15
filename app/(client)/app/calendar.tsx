"use client";

// Calendar: the week as a grid, hours down the side. Estimates Cinder booked, installs the owner set, and the
// owner's own Google events, each a block. Estimates still waiting on an outcome sit in a strip above.
// On a phone it is one day at a time with a strip of days to pick from.
import { useMemo, useState } from "react";
import { googleCalendarUrl, onMyWayText, splitAppointments } from "@/lib/client-schedule";
import { Empty, Icon, Spinner, clock, dayName, first, fmtPhone, useArm, type Api, type Toast } from "./parts";
import { Inspector } from "./record";
import { line } from "./jobs";
import type { Biz, Data, Go } from "./types";

type Block = { key: string; kind: "estimate" | "install" | "event"; title: string; sub: string; start: number; end: number; allDay: boolean; day: string; thread?: string; link?: string; apptId?: string; name?: string };
const H0 = 6, H1 = 20, ROW = 44;
const iso = (d: Date) => d.toLocaleDateString("en-CA");
/** The week starts on Sunday, the way US calendars do. */
const sunday = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
const mins = (t: number, day: string) => (t - Date.parse(day + "T00:00:00")) / 60000;

export function CalendarScreen({ d, biz, project, api, toast, reload, go, wide }: { d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean }) {
  const today = iso(new Date());
  const [week, setWeek] = useState(0), [day, setDay] = useState(today), [sel, setSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: "quoted" | "won"; id: string } | null>(null);
  const [amt, setAmt] = useState(""), [review, setReview] = useState(false), [busy, setBusy] = useState(""), [arm, setArm] = useArm();
  const { due } = useMemo(() => splitAppointments(d.appointments), [d.appointments]);
  const cal = d.calendar ?? { connected: false, email: "", events: [], error: "", connectUrl: "" };
  const start = useMemo(() => { const m = sunday(new Date()); m.setDate(m.getDate() + week * 7); return m; }, [week]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, k) => { const x = new Date(start); x.setDate(start.getDate() + k); return iso(x); }), [start]);
  const byThread = useMemo(() => new Map((d.board ?? []).map(c => [c.id, c])), [d.board]);

  const blocks = useMemo<Block[]>(() => {
    const out: Block[] = [];
    for (const a of d.appointments) { const t = Date.parse(a.starts_at), dd = iso(new Date(t)); const c = byThread.get(a.thread_id);
      out.push({ key: "a" + a.id, kind: "estimate", title: a.customer_name || fmtPhone(a.customer_phone), sub: c ? line(c) : "Estimate", start: t, end: t + 3600000, allDay: false, day: dd, thread: a.thread_id, link: a.link, apptId: a.id, name: a.customer_name }); }
    for (const c of d.board ?? []) if (c.stage === "won" && c.install) for (let k = 0; k < (c.installDays || 1); k++) {
      const dd = iso(new Date(Date.parse(c.install + "T12:00:00") + k * 86400000));
      const timed = !!c.installTime && (c.installDays || 1) === 1;
      const st = timed ? Date.parse(`${dd}T${c.installTime}`) : Date.parse(dd + "T07:00:00");
      out.push({ key: `i${c.id}${k}`, kind: "install", title: c.name, sub: `Install${(c.installDays || 1) > 1 ? `, day ${k + 1} of ${c.installDays}` : ""}${c.line ? `, ${line(c)}` : ""}`, start: st, end: st + (timed ? 4 : 9) * 3600000, allDay: !timed, day: dd, thread: c.id });
    }
    for (const e of cal.events ?? []) { const st = Date.parse(e.start), en = Date.parse(e.end); const first = iso(new Date(st));
      if (e.allDay) { for (let t = st; t < en; t += 86400000) out.push({ key: "e" + e.id + t, kind: "event", title: e.title, sub: "Your calendar", start: t, end: t + 86400000, allDay: true, day: iso(new Date(t + 43200000)), link: e.link }); }
      else out.push({ key: "e" + e.id, kind: "event", title: e.title, sub: `Until ${clock(e.end)}, your calendar`, start: st, end: en, allDay: false, day: first, link: e.link }); }
    return out;
  }, [d.appointments, d.board, cal.events, byThread]);

  async function act(key: string, body: Record<string, unknown>, done: (r: { review?: string }) => string) {
    setBusy(key);
    try { const r = await api<{ review?: string }>("/api/app/act", { p: project, ...body }); toast(done(r)); setSheet(null); setAmt(""); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
    finally { setBusy(""); }
  }
  const open = (b: Block) => { if (b.thread) { if (wide) setSel(s => s === b.thread ? null : b.thread!); else go.record(b.thread); } else if (b.link) window.open(b.link, "_blank", "noreferrer"); };
  const range = `${new Date(days[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(days[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const hours = Array.from({ length: H1 - H0 }, (_, k) => H0 + k);
  const now = new Date(), nowTop = ((now.getHours() - H0) * 60 + now.getMinutes()) / 60 * ROW;
  const estWeek = blocks.filter(b => b.kind === "estimate" && days.includes(b.day)).length;

  const outcomes = due.length > 0 && <section className="card outcomes"><div className="hd"><h2>How did it go?</h2><small>{due.length} {due.length === 1 ? "estimate" : "estimates"} waiting on an update</small></div>
    <div className="outc-row">{due.map(a => { const name = a.customer_name || fmtPhone(a.customer_phone), c = byThread.get(a.thread_id); return <div key={a.id} className="outc">
      <button type="button" className="who" onClick={() => open({ key: "", kind: "estimate", title: name, sub: "", start: 0, end: 0, allDay: false, day: "", thread: a.thread_id })}><b>{name}</b><small>{dayName(a.starts_at)} {clock(a.starts_at)}{c?.line ? `, ${line(c)}` : ""}</small></button>
      {sheet?.id === a.id ? <form className="acts-row" onSubmit={e => { e.preventDefault(); void act(a.id, { action: "outcome", appt: a.id, result: sheet.kind, amount: amt, review: sheet.kind === "won" && review }, r => sheet.kind === "quoted" ? "Cinder will follow up on the quote until they answer." : r.review === "sent" ? "Marked won. Review request sent." : "Marked won."); }}>
          <span className="inwrap" style={{ width: 120 }}><i>$</i><input inputMode="decimal" autoFocus placeholder={sheet.kind === "won" ? "Job amount" : "Amount"} value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></span>
          {sheet.kind === "won" && <label className="check" style={{ fontSize: 12 }}><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} /><span>Ask for a review</span></label>}
          <button type="submit" className="btn sm ink" disabled={!!busy}>{busy ? <Spinner /> : sheet.kind === "won" ? "Mark won" : "Start follow-up"}</button><button type="button" className="btn sm ghost" onClick={() => setSheet(null)}>Cancel</button></form>
        : <div className="acts-row">
          <button type="button" className="btn sm ink" onClick={() => c ? go.record(c.id, { ask: "quoted" }) : setSheet({ kind: "quoted", id: a.id })}>Write quote</button>
          <button type="button" className="btn sm" onClick={() => { setSheet({ kind: "won", id: a.id }); setAmt(""); setReview(!!d.repeat); }}>Won it</button>
          <button type="button" className="btn sm" disabled={busy === a.id} onClick={() => arm === "ns" + a.id ? void act(a.id, { action: "outcome", appt: a.id, result: "no_show" }, () => "Texted them to pick a new time.") : setArm("ns" + a.id)}>{arm === "ns" + a.id ? "Text to rebook?" : "No-show"}</button>
        </div>}
    </div>; })}</div></section>;

  const omw = (b: Block) => <button type="button" className={"btn sm" + (arm === "omw" + b.apptId ? " ink" : "")} disabled={busy === "omw" + b.apptId} onClick={e => { e.stopPropagation(); if (arm === "omw" + b.apptId) void act("omw" + b.apptId, { action: "reply", thread: b.thread, body: onMyWayText(b.name || "", d.owner, d.business) }, () => `Texted ${first(b.name || "them")} you're on the way.`); else setArm("omw" + b.apptId); }}><Icon name="car" size={13} />{arm === "omw" + b.apptId ? "Tap to send" : "On my way"}</button>;

  if (!wide) {
    const list = blocks.filter(b => b.day === day).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
    const strip = Array.from({ length: 14 }, (_, k) => { const x = new Date(Date.parse(today + "T12:00:00") + k * 86400000); return iso(x); });
    return <>
      <header className="tb"><h1 className="h1">Calendar</h1><span className="sub">{estWeek} estimates this week</span></header>
      <div className="daystrip">{strip.map(dd => { const x = new Date(dd + "T12:00:00"); const n = blocks.filter(b => b.day === dd).length; return <button key={dd} type="button" className={(dd === day ? "on" : "") + (dd === today ? " today" : "")} onClick={() => setDay(dd)}><small>{x.toLocaleDateString("en-US", { weekday: "short" })}</small><b>{x.getDate()}</b><i style={{ opacity: n ? 1 : 0 }} /></button>; })}</div>
      <div className="pad" style={{ paddingTop: 8 }}>
        {outcomes}
        {list.length ? list.map(b => <button key={b.key} type="button" className={"dayrow " + b.kind} onClick={() => open(b)}><time>{b.allDay ? "All day" : clock(new Date(b.start).toISOString())}</time><span style={{ minWidth: 0 }}><b>{b.title}</b><small>{b.sub}</small></span>{b.kind === "estimate" && b.apptId && Date.parse(b.day + "T23:59:00") > Date.now() && omw(b)}</button>)
          : <Empty title={`Nothing on ${dayName(day + "T12:00:00")}`} text="Estimates Cinder books and installs you set show up here." />}
        {!cal.connected && <p className="fine" style={{ marginTop: 12 }}>Connect Google Calendar and your own events show here too. <a className="link" href={cal.connectUrl} target="_blank" rel="noreferrer">Connect</a></p>}
      </div>
    </>;
  }

  return <>
    <header className="tb"><h1 className="h1">Calendar</h1>
      <div className="acts-row" style={{ gap: 2 }}><button type="button" className="btn ghost sm ic" aria-label="Previous week" onClick={() => setWeek(w => w - 1)}><Icon name="back" size={14} /></button><button type="button" className="btn ghost sm" onClick={() => setWeek(0)}>Today</button><button type="button" className="btn ghost sm ic" aria-label="Next week" onClick={() => setWeek(w => w + 1)}><Icon name="fwd" size={14} /></button></div>
      <span className="sub">{range}{week === 0 ? `, ${estWeek} ${estWeek === 1 ? "estimate" : "estimates"}` : ""}</span>
      <div className="acts">{cal.connected ? <a className="btn" href={googleCalendarUrl(cal.email)} target="_blank" rel="noreferrer"><Icon name="ext" size={13} />Google Calendar</a>
        : <a className="btn ink" href={cal.connectUrl} target="_blank" rel="noreferrer">Connect Google Calendar</a>}</div></header>
    <div className={"split" + (sel ? " has-insp" : "")}>
      <div className="pane list">
        {(cal.error || !cal.connected || due.length > 0) && <div className="pad" style={{ paddingBottom: 0 }}>
          {cal.error && <div className="card box" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><span>{cal.error}</span><a className="btn sm" href={cal.connectUrl} target="_blank" rel="noreferrer">Reconnect</a></div>}
          {!cal.connected && !cal.error && <p className="fine">Connect your Google Calendar and Cinder only books where you&rsquo;re free. Your own events show up here too.</p>}
          {outcomes}
        </div>}
        <div className="cal">
          <div className="cal-head"><div className="cal-gutter" />{days.map(dd => { const x = new Date(dd + "T12:00:00"); return <div key={dd} className={"cal-dh" + (dd === today ? " today" : "")}><small>{x.toLocaleDateString("en-US", { weekday: "short" })}</small><b>{x.getDate()}</b></div>; })}</div>
          <div className="cal-allday"><div className="cal-gutter"><small>All day</small></div>{days.map(dd => <div key={dd} className="cal-ad">{blocks.filter(b => b.day === dd && b.allDay).map(b => <button key={b.key} type="button" className={"cal-chip " + b.kind + (sel && sel === b.thread ? " sel" : "")} onClick={() => open(b)} title={`${b.title}, ${b.sub}`}>{b.title}</button>)}</div>)}</div>
          <div className="cal-body" style={{ height: hours.length * ROW }}>
            <div className="cal-gutter">{hours.map(h => <div key={h} className="cal-h" style={{ top: (h - H0) * ROW }}><small>{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</small></div>)}</div>
            {days.map(dd => <div key={dd} className={"cal-col" + (dd === today ? " today" : "")}>
              {hours.map(h => <i key={h} className="cal-line" style={{ top: (h - H0) * ROW }} />)}
              {dd === today && nowTop > 0 && nowTop < hours.length * ROW && <i className="cal-now" style={{ top: nowTop }} />}
              {blocks.filter(b => b.day === dd && !b.allDay).map(b => { const top = Math.max(0, (mins(b.start, dd) - H0 * 60) / 60 * ROW), h = Math.max(ROW * 0.6, (b.end - b.start) / 3600000 * ROW); return <button key={b.key} type="button" className={"cal-ev " + b.kind + (sel && sel === b.thread ? " sel" : "")} style={{ top, height: h }} onClick={() => open(b)} title={`${clock(new Date(b.start).toISOString())} ${b.title}, ${b.sub}`}>
                <b>{b.title}</b><small>{clock(new Date(b.start).toISOString()).replace(":00", "")}{b.kind !== "event" ? `, ${b.kind}` : ""}</small>
                {b.kind === "estimate" && h >= ROW * 1.4 && b.sub && <small>{b.sub}</small>}
              </button>; })}
            </div>)}
          </div>
        </div>
        {week === 0 && blocks.some(b => b.kind === "estimate" && b.day >= today && days.includes(b.day)) && <div className="pad" style={{ paddingTop: 8 }}><section className="card"><div className="hd"><h2>On the way</h2><small>one tap texts the customer you&rsquo;re coming</small></div>
          {blocks.filter(b => b.kind === "estimate" && b.day >= today && days.includes(b.day)).sort((a, b) => a.start - b.start).map(b => <div key={b.key} className="row"><span className="ic"><Icon name="cal" size={14} /></span><span style={{ minWidth: 0 }}><b>{b.title}<span className="faint" style={{ fontWeight: 400 }}>, {dayName(new Date(b.start).toISOString())} {clock(new Date(b.start).toISOString())}</span></b></span>{omw(b)}</div>)}
        </section></div>}
      </div>
      {sel && <aside className="pane insp" aria-label="Record"><Inspector key={sel} id={sel} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onClose={() => setSel(null)} onExpand={() => go.record(sel)} /></aside>}
    </div>
  </>;
}
