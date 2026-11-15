"use client";

// Calendar: the real week, estimates Cinder booked alongside the owner's own Google Calendar, how each estimate
// went, and the quotes being chased.
import { useMemo, useState } from "react";
import { agenda, googleCalendarUrl, onMyWayText, splitAppointments } from "@/lib/client-schedule";
import { Avatar, Empty, Icon, Spinner, clock, dayName, first, fmtPhone, useArm, usd, type Api, type Toast } from "./parts";
import type { Data, Go } from "./types";

type Sheet = { kind: "quoted" | "won" | "quote-won"; id: string };
function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="#dadce0" /><path d="M3 8h18" stroke="#4285f4" strokeWidth="2.4" /><text x="12" y="17.6" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1a73e8" fontFamily="Arial, sans-serif">{new Date().getDate()}</text></svg>;
}

export function CalendarScreen({ d, project, api, toast, reload, go }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go }) {
  const { due, upcoming } = useMemo(() => splitAppointments(d.appointments), [d.appointments]);
  const cal = d.calendar ?? { connected: false, email: "", events: [], error: "", connectUrl: "" };
  const days = useMemo(() => agenda(upcoming, cal.events ?? []), [upcoming, cal.events]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [amt, setAmt] = useState(""), [review, setReview] = useState(false), [busy, setBusy] = useState(""), [arm, setArm] = useArm();
  const week = upcoming.filter(a => Date.parse(a.starts_at) < Date.now() + 7 * 86400000).length;
  const byThread = new Map((d.board ?? []).map(c => [c.id, c]));
  async function act(key: string, body: Record<string, unknown>, done: (r: { review?: string }) => string) {
    setBusy(key);
    try { const r = await api<{ review?: string }>("/api/app/act", { p: project, ...body }); toast(done(r)); setSheet(null); setAmt(""); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
    finally { setBusy(""); }
  }
  const open = (kind: Sheet["kind"], id: string) => { setSheet({ kind, id }); setAmt(""); setReview(!!d.repeat); };
  const amountForm = (onSave: () => void) => <form className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }} onSubmit={e => { e.preventDefault(); onSave(); }}>
    <label className="field"><span>{sheet?.kind === "quoted" ? "Quote amount" : "Job amount"} <em>{sheet?.kind === "quoted" ? "optional, shows in your numbers" : "counts toward what Cinder brought in"}</em></span>
      <span className="inwrap"><i>$</i><input inputMode="decimal" autoFocus placeholder="9,400" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></span></label>
    {sheet?.kind === "won" && <label className="check"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} /><span><b>Job done? Ask for a Google review</b></span></label>}
    <div className="acts-row end"><button type="button" className="btn" onClick={() => setSheet(null)}>Cancel</button><button type="submit" className="btn ink" disabled={!!busy}>{busy ? <Spinner /> : sheet?.kind === "quoted" ? "Start follow-up" : "Mark won"}</button></div>
  </form>;

  return <>
    <header className="ph"><h1>Calendar</h1><span className="sub">{week ? `${week} ${week === 1 ? "estimate" : "estimates"} this week` : "No estimates this week yet"}{due.length ? ` · ${due.length} ${due.length === 1 ? "needs" : "need"} an update` : ""}</span>
      <div className="acts">{cal.connected ? <a className="btn" href={googleCalendarUrl(cal.email)} target="_blank" rel="noreferrer"><GoogleMark />Open Google Calendar</a>
        : <a className="btn ink" href={cal.connectUrl} target="_blank" rel="noreferrer"><Icon name="cal" size={15} />Connect Google Calendar</a>}</div></header>
    <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      {cal.error && <div className="card warn"><div className="bd" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><span>{cal.error}</span><a className="btn sm" href={cal.connectUrl} target="_blank" rel="noreferrer">Reconnect</a></div></div>}
      {!cal.connected && <p className="fine">Connect your Google Calendar and Cinder only books estimates where you&rsquo;re free. Your own events show up here too.</p>}

      {due.length > 0 && <section className="card">
        <div className="hd"><h2>How did it go?</h2><small>{due.length} {due.length === 1 ? "estimate" : "estimates"} waiting on an update</small></div>
        {due.map(a => { const name = a.customer_name || fmtPhone(a.customer_phone), c = byThread.get(a.thread_id); return <div key={a.id} className="outcome">
          <button type="button" className="who" onClick={() => c ? go.record(c.id) : go.thread(a.thread_id)}><Avatar name={name} /><span><b>{name}</b><small>Estimate · {dayName(a.starts_at)}, {clock(a.starts_at)}{c?.line ? ` · ${c.line}` : ""}</small></span></button>
          {sheet?.id === a.id ? amountForm(() => void act(a.id, { action: "outcome", appt: a.id, result: sheet.kind, amount: amt, review: sheet.kind === "won" && review },
            r => sheet.kind === "quoted" ? "Cinder will follow up on the quote until they answer." : r.review === "sent" ? "Marked won. Review request sent." : r.review === "no_link" ? "Marked won. Ask Sam to add your review link." : r.review === "later" ? "Marked won. It's after texting hours, so the review request goes in the morning." : "Marked won."))
            : <div className="acts-row">
              <button type="button" className="btn sm ink" onClick={() => c ? go.record(c.id, { ask: "quoted" }) : open("quoted", a.id)}><Icon name="quote" size={14} />Write quote</button>
              <button type="button" className="btn sm ok" onClick={() => open("won", a.id)}><Icon name="check" size={14} />Won it</button>
              <button type="button" className="btn sm" disabled={busy === a.id} onClick={() => arm === "ns" + a.id ? void act(a.id, { action: "outcome", appt: a.id, result: "no_show" }, () => "Texted them to pick a new time.") : setArm("ns" + a.id)}>{arm === "ns" + a.id ? "Text to rebook?" : <><Icon name="x" size={14} />No-show</>}</button>
            </div>}
        </div>; })}
      </section>}

      <section className="card agenda">
        <div className="hd"><h2>Next 7 days</h2><small>{cal.connected ? `Synced with ${cal.email || "your calendar"}` : "Estimates booked by Cinder"}</small></div>
        {days.length ? days.map(g => <div key={g.day}><div className="grp padx" style={{ paddingTop: 10 }}><b>{dayName(g.at)}</b><span>{g.items.length}</span></div>
          {g.items.map(it => {
            if (it.kind === "event") { const e = it.event; return <div key={"e" + e.id} className="ev-row"><time>{e.allDay ? "All day" : clock(e.start)}</time><span style={{ minWidth: 0 }}><b>{e.title}</b><small>{e.allDay ? "Your calendar" : `Until ${clock(e.end)} · your calendar`}</small></span>{e.link ? <a className="btn sm ic" href={e.link} target="_blank" rel="noreferrer" aria-label={`Open ${e.title} in Google Calendar`}><Icon name="ext" size={14} /></a> : <span />}</div>; }
            const a = it.appt, name = a.customer_name || fmtPhone(a.customer_phone), c = byThread.get(a.thread_id);
            return <div key={"a" + a.id} className="ev-row"><time>{clock(a.starts_at)}</time>
              <button type="button" style={{ minWidth: 0, textAlign: "left" }} onClick={() => c ? go.record(c.id) : go.thread(a.thread_id)}><b>{name} · estimate</b><small>{[c?.line, String(c?.details.address ?? "")].filter(Boolean).join(" · ") || "Booked by Cinder"}</small></button>
              <span className="acts-row">
                <button type="button" className={"btn sm" + (arm === "omw" + a.id ? " ink" : "")} disabled={busy === "omw" + a.id} onClick={() => arm === "omw" + a.id
                  ? void act("omw" + a.id, { action: "reply", thread: a.thread_id, body: onMyWayText(a.customer_name, d.owner, d.business) }, () => `Texted ${first(a.customer_name)} you're on the way.`)
                  : setArm("omw" + a.id)}><Icon name="car" size={14} />{arm === "omw" + a.id ? "Tap to send" : "On my way"}</button>
                {a.link && <a className="btn sm ic" href={a.link} target="_blank" rel="noreferrer" aria-label="Open in Google Calendar"><Icon name="ext" size={14} /></a>}
              </span></div>;
          })}</div>)
          : <Empty icon="cal" title="Nothing on the calendar this week" text="Booked estimates and installs show up here." />}
      </section>

      {d.quotes.length > 0 && <section className="card">
        <div className="hd"><h2>Open quotes</h2><small>{d.quotes.length} · Cinder follows up until they answer</small></div>
        {d.quotes.map(q => { const name = q.customer_name || fmtPhone(q.customer_phone); return <div key={q.id} className="outcome">
          <div className="who"><Avatar name={name} /><span><b>{name}{q.amount ? ` · ${usd(q.amount)}` : ""}</b><small>Sent {new Date(q.sent_on + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {q.status === "replied" ? "They replied. Check the conversation." : q.steps_sent ? `Follow-up ${q.steps_sent} of ${d.quoteSteps} sent` : "First follow-up goes out in 2 days"}</small></span></div>
          {sheet?.id === q.id ? amountForm(() => void act(q.id, { action: "quote", quote: q.id, status: "won", amount: amt }, () => "Marked won. Follow-ups stopped."))
            : <div className="acts-row"><button type="button" className="btn sm ok" onClick={() => { open("quote-won", q.id); setAmt(q.amount ? String(q.amount) : ""); }}><Icon name="check" size={14} />Won</button>
              <button type="button" className="btn sm" disabled={busy === q.id} onClick={() => arm === "lost" + q.id ? void act(q.id, { action: "quote", quote: q.id, status: "lost" }, () => "Marked lost. Follow-ups stopped.") : setArm("lost" + q.id)}>{arm === "lost" + q.id ? "Tap again: lost" : "Lost"}</button></div>}
        </div>; })}
      </section>}

      {(d.wonJobs?.length ?? 0) > 0 && d.hasReviewLink && <section className="card">
        <div className="hd"><h2>Jobs you won</h2><small>Tap Job done to ask for a review</small></div>
        {d.wonJobs!.map(j => { const name = j.customer_name || fmtPhone(j.customer_phone); return <div key={j.id} className="outcome">
          <div className="who"><Avatar name={name} /><span><b>{name}{j.amount ? ` · ${usd(j.amount)}` : ""}</b><small>Won {new Date(j.won_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></span></div>
          <div className="acts-row"><button type="button" className="btn sm ok" disabled={busy === "rv" + j.id} onClick={() => arm === "rv" + j.id ? void act("rv" + j.id, { action: "review", quote: j.id }, () => `Review request sent to ${first(name)}.`) : setArm("rv" + j.id)}><Icon name="star" size={14} />{arm === "rv" + j.id ? "Tap to send the review request" : "Job done"}</button></div>
        </div>; })}
      </section>}
    </div>
  </>;
}
