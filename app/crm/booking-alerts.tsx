"use client";

// Pops up inside the CRM when someone books through your Cal.com link: a card, a short chime,
// a desktop notification (once you allow it) and a count in the tab title. Checks every 30 seconds.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Booking = { id: string; title: string; startsAt: string; createdAt: string; contactId: string | null; who: string };
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
      const j = await r.json() as { now?: string; bookings?: Booking[] };
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

  if (!items.length) return null;
  return <div className="ba-stack" role="status" aria-live="polite">
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
