"use client";

// Pops up inside the CRM when someone books through your Cal.com link: a card, a short chime,
// a desktop notification (once you allow it) and a count in the tab title. Checks every 30 seconds.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Booking = { id: string; title: string; startsAt: string; createdAt: string; contactId: string | null; who: string };
type Pending = { id: string; title: string; startsAt: string; who: string };
type Reply = { id: string; who: string; summary: string; category: string };
type Watch = { id: string; who: string; name: string; played: boolean; audit?: boolean; contactId: string | null; phone: string };
type Sign = { id: string; dealId: string; who: string; signed: boolean };
type Done = { id: string; who: string; text: string; sms?: { href: string; body: string } };
const KEY = "cinder.bookings.seen";

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch { /* sound is a bonus */ }
}

export default function BookingAlerts() {
  const [items, setItems] = useState<Booking[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [signs, setSigns] = useState<Sign[]>([]);
  const [watch, setWatch] = useState<Watch[]>([]);
  const seenWatch = useRef<Set<string>>(new Set());
  const seenSigns = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState<string>("");
  const skipped = useRef<Set<string>>(new Set());
  const seenReplies = useRef<Set<string>>(new Set());
  const [canNotify, setCanNotify] = useState<NotificationPermission | "none">("none");
  const since = useRef<string>("");
  const baseTitle = useRef<string>("");
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    try { since.current = localStorage.getItem(KEY) || new Date().toISOString(); localStorage.setItem(KEY, since.current); } catch { since.current = new Date().toISOString(); }
    if (typeof Notification !== "undefined") setCanNotify(Notification.permission);
  }, []);

  const check = useCallback(async () => {
    if (!since.current) return;
    try {
      const r = await fetch(`/api/alerts/bookings?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { now?: string; bookings?: Booking[]; pending?: Pending[]; replies?: Reply[]; signing?: Sign[]; watching?: Watch[] };
      const newWatch = (j.watching ?? []).filter(x => !seenWatch.current.has(x.id));
      if (newWatch.length) { newWatch.forEach(x => seenWatch.current.add(x.id)); setWatch(cur => [...newWatch, ...cur.filter(c => !newWatch.some(n => n.who === c.who))].slice(0, 3)); chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") for (const x of newWatch) { try { new Notification(`${x.who} is watching your demo`, { body: "Call them now", tag: x.id }); } catch { /* fine */ } } }
      const newSigns = (j.signing ?? []).filter(x => !seenSigns.current.has(x.id));
      if (newSigns.length) { newSigns.forEach(x => seenSigns.current.add(x.id)); setSigns(cur => [...newSigns, ...cur].slice(0, 3)); chime(); }
      setPending((j.pending ?? []).filter(p => !skipped.current.has(p.id)));
      const newReplies = (j.replies ?? []).filter(x => !seenReplies.current.has(x.id));
      if (newReplies.length) { newReplies.forEach(x => seenReplies.current.add(x.id)); setReplies(cur => [...newReplies, ...cur].slice(0, 4)); chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") for (const x of newReplies) { try { new Notification(`${x.who} replied`, { body: x.summary || "Positive reply in your inbox", tag: x.id }); } catch { /* fine */ } } }
      const fresh = (j.bookings ?? []).filter(b => !shown.current.has(b.id));
      fresh.forEach(b => shown.current.add(b.id));
      if (j.now) { since.current = j.now; try { localStorage.setItem(KEY, j.now); } catch { /* fine */ } }
      if (!fresh.length) return;
      setItems(cur => [...fresh, ...cur].slice(0, 5));
      chime();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const b of fresh) { try { new Notification("New meeting booked", { body: `${b.who || b.title} · ${when(b.startsAt)}`, tag: b.id }); } catch { /* fine */ } }
      }
    } catch { /* offline: try again next tick */ }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void check(), 3000);
    const t = setInterval(() => void check(), 30000);
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(first); clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [check]);

  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title.replace(/^\(\d+\) New booking · /, "");
    document.title = items.length ? `(${items.length}) New booking · ${baseTitle.current}` : baseTitle.current;
  }, [items.length]);

  async function mark(p: Pending, outcome: "showed" | "no_show" | "rescheduled") {
    setBusy(p.id);
    try {
      const r = await fetch("/api/calendar-events/outcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, outcome }) });
      const j = await r.json().catch(() => ({})) as { emailed?: string; emailError?: string; text?: { href: string; body: string }; task?: string; error?: string };
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      setPending(cur => cur.filter(x => x.id !== p.id));
      const text = outcome === "no_show"
        ? [j.emailed ? `Reschedule email sent to ${j.emailed}.` : j.emailError ? `Couldn't email them: ${j.emailError}` : "No email on file.", j.task ? `Callback set for tomorrow 10am.` : ""].filter(Boolean).join(" ")
        : outcome === "showed" ? "Logged. \"Send next step\" is on today's list." : "Logged as rescheduled.";
      setDone(cur => [{ id: p.id, who: p.who, text, sms: j.text }, ...cur].slice(0, 3));
    } catch (e) { setDone(cur => [{ id: p.id, who: p.who, text: e instanceof Error ? e.message : "Couldn't save that." }, ...cur]); }
    setBusy("");
  }
  if (!items.length && !pending.length && !replies.length && !done.length && !signs.length && !watch.length) return null;
  return <div className="ba-stack" role="status" aria-live="polite">
    {pending.map(p => <div key={"p" + p.id} className="ba-card">
      <div className="ba-top"><b className="ba-ask">Did they show?</b><button type="button" className="ba-x" aria-label="Ask later" onClick={() => { skipped.current.add(p.id); setPending(cur => cur.filter(x => x.id !== p.id)); }}>×</button></div>
      <p className="ba-who">{p.who || p.title}</p>
      <p className="ba-when">{when(p.startsAt)}</p>
      <div className="ba-actions">
        <button type="button" className="u-btn u-btn-light" disabled={busy === p.id} onClick={() => void mark(p, "showed")}>Showed</button>
        <button type="button" className="u-btn u-btn-light" disabled={busy === p.id} onClick={() => void mark(p, "no_show")}>No-show</button>
        <button type="button" className="u-btn u-btn-bare" disabled={busy === p.id} onClick={() => void mark(p, "rescheduled")}>Rescheduled</button>
      </div>
    </div>)}
    {done.map(d => <div key={"d" + d.id} className="ba-card">
      <div className="ba-top"><b>{d.who}</b><button type="button" className="ba-x" aria-label="Dismiss" onClick={() => setDone(cur => cur.filter(x => x.id !== d.id))}>×</button></div>
      <p className="ba-when">{d.text}</p>
      {d.sms && <div className="ba-actions"><a className="u-btn u-btn-light" href={d.sms.href}>Text them a new time</a></div>}
    </div>)}
    {watch.map(x => <div key={x.id} className="ba-card">
      <div className="ba-top"><b className="ba-ask">{x.audit ? "Reading their free audit now" : x.played ? "Watching your demo now" : "Opened your demo"}</b><button type="button" className="ba-x" aria-label="Dismiss" onClick={() => setWatch(cur => cur.filter(y => y.id !== x.id))}>×</button></div>
      <p className="ba-who">{x.who}</p>
      <p className="ba-when">They're looking at it right now. Best time to call.</p>
      <div className="ba-actions">
        {x.phone && <a className="u-btn u-btn-light" href={"tel:" + x.phone.replace(/[^+\d]/g, "")}>Call now</a>}
        {x.contactId && <Link className="u-btn u-btn-bare" href={`/crm?contact=${x.contactId}`}>Open contact</Link>}
      </div>
    </div>)}
    {signs.map(x => <div key={"s" + x.id} className="ba-card">
      <div className="ba-top"><b>{x.signed ? "Agreement signed" : "Agreement opened"}</b><button type="button" className="ba-x" aria-label="Dismiss" onClick={() => setSigns(cur => cur.filter(y => y.id !== x.id))}>×</button></div>
      <p className="ba-who">{x.who}</p>
      <p className="ba-when">{x.signed ? "They got the setup payment link and kickoff checklist by email." : "They're reading it now. Good time to call."}</p>
      <div className="ba-actions"><Link className="u-btn u-btn-light" href={`/crm/deals/${x.dealId}#agreement`} onClick={() => setSigns(cur => cur.filter(y => y.id !== x.id))}>Open the deal</Link></div>
    </div>)}
    {replies.map(x => <div key={"r" + x.id} className="ba-card">
      <div className="ba-top"><b>{x.category === "meeting" ? "Wants to meet" : x.category === "question" ? "Asked a question" : "Interested reply"}</b><button type="button" className="ba-x" aria-label="Dismiss" onClick={() => setReplies(cur => cur.filter(y => y.id !== x.id))}>×</button></div>
      <p className="ba-who">{x.who}</p>
      {x.summary && <p className="ba-when">{x.summary}</p>}
      <div className="ba-actions"><Link className="u-btn u-btn-light" href="/crm/email" onClick={() => setReplies(cur => cur.filter(y => y.id !== x.id))}>Answer it</Link></div>
    </div>)}
    {items.map(b => <div key={b.id} className="ba-card">
      <div className="ba-top"><b>New meeting booked</b><button type="button" className="ba-x" aria-label="Dismiss" onClick={() => setItems(cur => cur.filter(x => x.id !== b.id))}>×</button></div>
      <p className="ba-who">{b.who || b.title}</p>
      <p className="ba-when">{when(b.startsAt)}</p>
      <div className="ba-actions">
        {b.contactId ? <Link className="u-btn u-btn-light" href={`/crm?contact=${b.contactId}`} onClick={() => setItems(cur => cur.filter(x => x.id !== b.id))}>Open contact</Link> : null}
        <Link className="u-btn u-btn-bare" href="/crm/calendar" onClick={() => setItems(cur => cur.filter(x => x.id !== b.id))}>Calendar</Link>
        {canNotify === "default" && <button type="button" className="u-btn u-btn-bare" onClick={() => void Notification.requestPermission().then(setCanNotify)}>Desktop alerts</button>}
      </div>
    </div>)}
  </div>;
}
