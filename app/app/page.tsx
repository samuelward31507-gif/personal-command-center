"use client";

// The Cinder app for client owners. Sign in with a text code (or straight from the portal link), then:
// every lead in one inbox, reply or call back from the business number, numbers, estimates, and a line to Sam.
// Installs to the home screen like an app (manifest in /app.webmanifest). Same look as cinderrevenue.com.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./app.css";
import { CinderLogo, CinderMark } from "../cinder-brand";
import { demoApi } from "./demo";
import { agenda, googleCalendarUrl, onMyWayText, splitAppointments, type CalEvent } from "@/lib/client-schedule";

type Conv = { id: string; name: string; source: string; status: string; at: string | null; last: string; ask?: string };
type Live = { leads: number; needs: number; answered: number; booked: number; replySec: number | null; chasing: number; chasingValue: number; won: number; wonValue: number; revived: number; reviews: number; weeks: { week: string; leads: number; booked: number }[]; conversations: Conv[] };
type Appt = { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string; event_id?: string; link?: string };
type Quote = { id: string; customer_name: string; customer_phone: string; amount: number | null; sent_on: string; steps_sent: number; status: string };
type Cal = { connected: boolean; email: string; events: CalEvent[]; error: string; connectUrl: string };
type Data = { project: string; business: string; number: string; canCall: boolean; businesses: { project_id: string; name: string }[]; live: Live; owner: string; appointments: Appt[]; quotes: Quote[]; quoteSteps: number; wonJobs?: { id: string; customer_name: string; customer_phone: string; amount: number | null; won_at: string }[]; hasReviewLink?: boolean; repeat?: boolean; calendar: Cal; messages: { author: string; body: string; created_at: string }[]; unreadFromSam: number };
type Text = { id: string; direction: string; author: string; body: string; at: string; media?: { url: string; type: string }[] };
type Thread = { id: string; customer_name: string; customer_phone: string; source: string; status: string };
type Tab = "leads" | "numbers" | "estimates" | "sam";

const SOURCE: Record<string, string> = { missed_call: "Missed call", "web chat": "Website chat", "web form": "Web form", text: "Text", quote: "Quote follow-up", review: "Review request", rehash: "Old lead", angi: "Angi", thumbtack: "Thumbtack", facebook: "Facebook ad", zapier: "Form" };
const SRC_ICON: Record<string, string> = { missed_call: "phone", "web chat": "chat", "web form": "form", text: "chat", quote: "quote", review: "star", rehash: "quote", angi: "form", thumbtack: "form", facebook: "form", zapier: "form" };
const STATUS: Record<string, [string, string]> = { auto: ["Cinder's on it", "auto"], paused: ["Needs you", "needs"], booked: ["Booked", "booked"], closed: ["Done", "done"], opted_out: ["Opted out", "done"] };
const QUICK = ["On my way", "I'll call you in 10 minutes", "Sending your quote now", "Can you send a photo?"];

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const ago = (d: string | null) => { if (!d) return ""; const m = Math.round((Date.now() - Date.parse(d)) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const clock = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayKey = (d: string) => new Date(d).toDateString();
const dayName = (d: string) => { const x = new Date(d), t = new Date(); const y = new Date(Date.now() - 86400000); const tm = new Date(Date.now() + 86400000);
  return x.toDateString() === t.toDateString() ? "Today" : x.toDateString() === y.toDateString() ? "Yesterday" : x.toDateString() === tm.toDateString() ? "Tomorrow" : x.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }); };
const initials = (s: string) => s.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "#";
const fmtPhone = (p: string) => { const d = p.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };
const typePhone = (v: string) => { const d = v.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10); return d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d; };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const secs = (n: number | null) => (n == null ? "–" : n < 60 ? `${n} sec` : `${Math.round(n / 60)} min`);

// The example business (/app?demo=1) answers every call in the browser; nothing reaches the server.
const DEMO_KEY = "cinder-demo";
let demoOn = false;
const demoStart = () => { demoOn = true; try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* private mode */ } };
const demoStop = () => { demoOn = false; try { sessionStorage.removeItem(DEMO_KEY); } catch { /* private mode */ } };

async function api<T>(path: string, body?: unknown): Promise<T> {
  if (demoOn && !path.startsWith("/api/app/auth") && !path.startsWith("/api/app/push")) return await demoApi(path, (body ?? {}) as Record<string, unknown>) as T;
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong.") as Error & { status?: number }; e.status = r.status; throw e; }
  return j as T;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
    chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 20 12z" />,
    form: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></>,
    quote: <><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5" /><path d="M14 3.5V8h4M9.5 13h5M9.5 16.5h3" /></>,
    star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />,
    back: <path d="M15 5l-7 7 7 7" />,
    send: <path d="M12 19V5M6 11l6-6 6 6" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
    cal: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    out: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />,
    ext: <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
    car: <><path d="M5 16V11l2-4.5h10L19 11v5" /><path d="M3.5 16h17v2.5h-17zM5 11h14" /><circle cx="8" cy="13.5" r=".6" /><circle cx="16" cy="13.5" r=".6" /></>,
    x: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>;
}

// ---------- Notifications ----------
type PushState = "unsupported" | "ios-install" | "off" | "on" | "blocked";
const urlKey = (k: string) => { const p = "=".repeat((4 - (k.length % 4)) % 4); const b = atob((k + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...b].map(c => c.charCodeAt(0))); };
function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-install" : "unsupported";
  return Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "blocked" : "off";
}
async function turnOnPush(project: string): Promise<string | null> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "Notifications are blocked. Turn them on for Cinder in your phone's settings.";
    const reg = await navigator.serviceWorker.register("/app-sw.js", { scope: "/app" });
    await navigator.serviceWorker.ready;
    const { publicKey } = await api<{ publicKey: string }>("/api/app/push");
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey(publicKey) });
    await api("/api/app/push", { p: project, action: "subscribe", sub: sub.toJSON() });
    return null;
  } catch (e) { return e instanceof Error ? e.message : "Couldn't turn on notifications."; }
}

function Mark({ small }: { small?: boolean }) { return <span className={"ca-mark" + (small ? " sm" : "")} aria-hidden="true"><CinderMark ring="#ededed" /></span>; }

function useToast() {
  const [t, setT] = useState<{ text: string; bad?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, bad = false) => { setT({ text, bad }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 3200); }, []);
  const node = t ? <div className={"ca-toast" + (t.bad ? " bad" : "")} role="status">{!t.bad && <Icon name="check" size={16} />}{t.text}</div> : null;
  return { show, node };
}

// ---------- Sign in ----------
/** Six boxes over one real input, so paste, iOS code autofill and the number pad all still work. */
function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [focus, setFocus] = useState(true);
  return <div className={"ca-otp" + (focus ? " focus" : "")}>
    {Array.from({ length: 6 }, (_, i) => <span key={i} className={"ca-otp-box" + (value[i] ? " full" : "") + (focus && i === Math.min(value.length, 5) ? " on" : "")} aria-hidden="true">
      {value[i] ?? (focus && i === value.length ? <i className="ca-caret" /> : null)}</span>)}
    <input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value} autoFocus disabled={disabled}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
  </div>;
}

function SignIn({ onIn, onDemo }: { onIn: () => void; onDemo: () => void }) {
  const [phone, setPhone] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = useCallback(async () => {
    setBusy(true); setErr("");
    try { await api("/api/app/auth", { action: "send", phone }); setSent(true); setWait(30); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }, [phone]);
  const verify = useCallback(async (c: string) => {
    setBusy(true); setErr("");
    try { await api("/api/app/auth", { action: "verify", phone, code: c }); onIn(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); setCode(""); } finally { setBusy(false); }
  }, [phone, onIn]);
  const digits = phone.replace(/\D/g, "").length;
  return <div className="ca-sign" role="main">
    <div className="ca-sign-card">
      <Mark />
      <h1>{sent ? "Check your texts" : "Sign in to Cinder"}</h1>
      <p>{sent ? <>We texted a code to <b>{fmtPhone(phone)}</b>.</> : "Use the cell number you gave Sam."}</p>
      <form onSubmit={e => { e.preventDefault(); if (!sent) void send(); else if (code.length === 6) void verify(code); }}>
        {!sent ? <label className="ca-field ca-phone"><span className="ca-sr">Cell number</span><i aria-hidden="true">+1</i>
          <input inputMode="tel" autoComplete="tel-national" placeholder="(720) 555-0148" value={phone} onChange={e => { setPhone(typePhone(e.target.value)); setErr(""); }} autoFocus /></label>
          : <CodeBoxes value={code} disabled={busy} onChange={v => { setCode(v); setErr(""); if (v.length === 6) void verify(v); }} />}
        {err && <p className="ca-err" role="alert">{err}</p>}
        <button type="submit" className="ca-primary" disabled={busy || (!sent ? digits < 10 : code.length !== 6)}>{busy ? <span className="ca-spin" /> : sent ? "Sign in" : "Continue"}</button>
      </form>
      {sent && <div className="ca-sign-alt">
        <button type="button" className="ca-text-btn" disabled={wait > 0 || busy} onClick={() => void send()}>{wait > 0 ? <>Resend in <span className="ca-num">{wait}s</span></> : "Resend code"}</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="ca-text-btn" onClick={() => { setSent(false); setCode(""); setErr(""); }}>Change number</button>
      </div>}
    </div>
    <div className="ca-sign-foot">
      <button type="button" className="ca-text-btn ca-demo-link" onClick={onDemo}>See an example business</button>
      <p>Have a portal link from Sam? It signs you in too.</p>
      <CinderLogo className="ca-sign-word" ink="#121417" title="Cinder Revenue Company" />
    </div>
  </div>;
}

// ---------- One conversation ----------
function ThreadView({ id, project, canCall, onBack, onChange, toast }: { id: string; project: string; canCall: boolean; onBack: () => void; onChange: () => void; toast: (t: string, bad?: boolean) => void }) {
  const [t, setT] = useState<Thread | null>(null), [texts, setTexts] = useState<Text[] | null>(null);
  const [draft, setDraft] = useState(""), [busy, setBusy] = useState("");
  const end = useRef<HTMLDivElement>(null), ta = useRef<HTMLTextAreaElement>(null);
  const load = useCallback(() => api<{ thread: Thread; texts: Text[] }>(`/api/app/data?p=${project}&thread=${id}`).then(j => { setT(j.thread); setTexts(j.texts); }).catch(() => {}), [id, project]);
  useEffect(() => { void load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [texts?.length]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(140, el.scrollHeight) + "px"; } }, [draft]);
  async function act(action: string, extra: Record<string, unknown>, done: string) {
    setBusy(action);
    try { await api("/api/app/act", { p: project, thread: id, action, ...extra }); toast(done); await load(); onChange(); return true; }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return false; }
    finally { setBusy(""); }
  }
  const mine = t?.status === "paused";
  const name = t?.customer_name || (t ? fmtPhone(t.customer_phone) : "");
  let lastDay = "";
  return <section className="ca-thread">
    <div className="ca-stick">
      <header className="ca-thead">
        <button type="button" className="ca-icon-btn" onClick={onBack} aria-label="Back to leads"><Icon name="back" size={22} /></button>
        <span className="ca-av sm" aria-hidden="true">{t ? initials(name) : ""}</span>
        <div className="ca-thead-who"><b>{name || "Loading…"}</b><small>{t ? <><a href={`tel:${t.customer_phone}`}>{fmtPhone(t.customer_phone)}</a> · {SOURCE[t.source] ?? t.source}</> : " "}</small></div>
        {canCall && <button type="button" className="ca-call" disabled={!!busy} onClick={() => void act("call", {}, "Calling your cell. Pick up and we'll connect them.")}><Icon name="phone" size={16} />Call</button>}
      </header>
      {t && t.status !== "opted_out" && <div className="ca-who-handles">
        <div className="ca-seg" role="group" aria-label="Who handles replies">
          <button type="button" aria-pressed={!mine} className={!mine ? "on" : ""} disabled={!!busy || t.status === "booked"} onClick={() => mine && void act("status", { status: "auto" }, "Cinder will handle replies again.")}><Icon name="bolt" size={14} />Cinder replies</button>
          <button type="button" aria-pressed={mine} className={mine ? "on" : ""} disabled={!!busy} onClick={() => !mine && void act("status", { status: "paused" }, "Cinder stepped back. You've got this one.")}>I&rsquo;ll reply</button>
        </div>
        {t.status === "booked" ? <span className="ca-chip is-booked"><Icon name="check" size={13} />Booked</span>
          : <button type="button" className="ca-chip-btn" disabled={!!busy} onClick={() => void act("status", { status: "booked" }, "Marked booked.")}>Mark booked</button>}
      </div>}
    </div>
    <div className="ca-texts">
      {texts === null ? <div className="ca-skel-thread"><i /><i /><i /></div> : texts.map((x, i) => {
        const sep = dayKey(x.at) !== lastDay ? <p className="ca-day" key={"d" + i}>{dayName(x.at)}</p> : null; lastDay = dayKey(x.at);
        if (x.author === "system") return <div key={i}>{sep}<p className="ca-event">{x.body}<span>{clock(x.at)}</span></p></div>;
        const photos = (x.media ?? []).map((_, k) => `/api/app/media?id=${x.id}&i=${k}`);
        const words = photos.length && /^\(sent (a photo|\d+ photos)\)$/.test(x.body) ? "" : x.body;
        return <div key={i} className="ca-bwrap">{sep}<div className={"ca-b " + (x.direction === "in" ? "in" : "out")}>
          {photos.length > 0 && <div className="ca-photos">{photos.map(src => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo from the customer" loading="lazy" /></a>)}</div>}
          {words && <p>{words}</p>}<small>{x.direction === "in" ? clock(x.at) : `${x.author === "owner" ? "You" : "Cinder"} · ${clock(x.at)}`}</small></div></div>;
      })}
      <div ref={end} />
    </div>
    <div className="ca-composer">
      {mine && !draft && <div className="ca-quick">{QUICK.map(q => <button key={q} type="button" onClick={() => setDraft(q)}>{q}</button>)}</div>}
      <form className="ca-compose" onSubmit={async e => { e.preventDefault(); if (draft.trim() && await act("reply", { body: draft }, "Sent from your business number.")) setDraft(""); }}>
        <textarea ref={ta} rows={1} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Text from your business number" aria-label="Reply" />
        <button type="submit" disabled={!!busy || !draft.trim()} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
      {!mine && t?.status !== "booked" && <p className="ca-hint">Replying hands this conversation to you; Cinder steps back.</p>}
    </div>
  </section>;
}

// ---------- Calendar: the real week, how each estimate went, quotes being chased ----------
function GoogleCalMark() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="#dadce0" /><path d="M3 8h18" stroke="#4285f4" strokeWidth="2.4" /><text x="12" y="17.6" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1a73e8" fontFamily="Arial, sans-serif">{new Date().getDate()}</text></svg>;
}
type Sheet = { kind: "quoted" | "won" | "quote-won"; id: string };
function CalendarTab({ d, project, onOpen, reload, toast }: { d: Data; project: string; onOpen: (id: string) => void; reload: () => Promise<void>; toast: (t: string, bad?: boolean) => void }) {
  const { due, upcoming } = useMemo(() => splitAppointments(d.appointments), [d.appointments]);
  const days = useMemo(() => agenda(upcoming, d.calendar.events), [upcoming, d.calendar.events]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [amt, setAmt] = useState(""), [review, setReview] = useState(false), [busy, setBusy] = useState(""), [arm, setArm] = useState("");
  useEffect(() => { if (!arm) return; const i = setTimeout(() => setArm(""), 4000); return () => clearTimeout(i); }, [arm]);
  const cal = d.calendar;
  const week = upcoming.filter(a => Date.parse(a.starts_at) < Date.now() + 7 * 86400000).length;
  async function act(key: string, body: Record<string, unknown>, done: (r: { review?: string }) => string) {
    setBusy(key);
    try { const r = await api<{ review?: string }>("/api/app/act", { p: project, ...body }); toast(done(r)); setSheet(null); setAmt(""); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
    finally { setBusy(""); }
  }
  // Repeat-service visits are the whole job, so a review fits right away; a won estimate waits for "Job done".
  const open = (kind: Sheet["kind"], id: string) => { setSheet({ kind, id }); setAmt(""); setReview(!!d.repeat); };
  const amountSheet = (onSave: () => void) => <form className="ca-amt" onSubmit={e => { e.preventDefault(); onSave(); }}>
    <label htmlFor={"amt-" + sheet?.id}>{sheet?.kind === "quoted" ? "Quote amount" : "Job amount"}<small>{sheet?.kind === "quoted" ? "Optional. Shows in your numbers." : "Counts toward what Cinder brought in."}</small></label>
    <div className="ca-amt-in"><span>$</span><input id={"amt-" + sheet?.id} inputMode="decimal" autoFocus placeholder="9,400" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></div>
    {sheet?.kind === "won" && <label className="ca-amt-check"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} /><span>Job&rsquo;s already finished? Text them for a Google review now</span></label>}
    <div className="ca-amt-row"><button type="button" className="ca-amt-no" onClick={() => setSheet(null)}>Cancel</button>
      <button type="submit" className="ca-amt-go" disabled={!!busy}>{sheet?.kind === "quoted" ? "Start follow-up" : "Mark won"}</button></div>
  </form>;

  return <>
    <div className="ca-hello"><p>Your week</p><h1>{week ? <>{week} {week === 1 ? "estimate" : "estimates"} booked.</> : "No estimates this week yet."}<span>{due.length ? ` ${due.length} ${due.length === 1 ? "needs" : "need"} an update.` : cal.connected ? " Synced with your calendar." : ""}</span></h1></div>

    {cal.connected ? <div className="ca-calbar">
      <span className="ca-calbar-ic"><GoogleCalMark /></span>
      <div><b>Google Calendar</b><small>{cal.email ? `${cal.email} · ` : ""}Cinder only books when you&rsquo;re free</small></div>
      <a className="ca-calbar-go" href={googleCalendarUrl(cal.email)} target="_blank" rel="noreferrer">Open<Icon name="ext" size={14} /></a>
    </div> : <div className="ca-pushcard">
      <span className="ca-pushcard-ic"><Icon name="cal" size={18} /></span>
      <div><b>Connect your Google Calendar</b>
        <p>Cinder books estimates only when you&rsquo;re free, puts them on your calendar, and shows your whole week here.</p>
        <div className="ca-pushcard-row"><a className="ca-pushcard-go" href={cal.connectUrl} target="_blank" rel="noreferrer">Connect calendar</a></div></div>
    </div>}
    {cal.error && <p className="ca-calerr">{cal.error} <a href={cal.connectUrl} target="_blank" rel="noreferrer">Reconnect</a></p>}

    {due.length > 0 && <section className="ca-group"><h2>How did it go?</h2>
      <ul className="ca-cards">{due.map(a => { const name = a.customer_name || fmtPhone(a.customer_phone); return <li key={a.id} className="ca-out">
        <button type="button" className="ca-out-h" onClick={() => onOpen(a.thread_id)}><span className="ca-av sm" aria-hidden="true">{initials(name)}</span>
          <span><b>{name}</b><small>Estimate · {dayName(a.starts_at)}, {clock(a.starts_at)}</small></span></button>
        {sheet?.id === a.id ? amountSheet(() => void act(a.id, { action: "outcome", appt: a.id, result: sheet.kind, amount: amt, review: sheet.kind === "won" && review },
            r => sheet.kind === "quoted" ? "Cinder will follow up on the quote until they answer." : r.review === "sent" ? "Marked won. Review request sent." : r.review === "no_link" ? "Marked won. Ask Sam to add your review link." : "Marked won."))
          : <div className="ca-out-btns">
            <button type="button" onClick={() => open("quoted", a.id)}><Icon name="quote" size={15} />Quoted</button>
            <button type="button" className="win" onClick={() => open("won", a.id)}><Icon name="check" size={15} />Won it</button>
            <button type="button" disabled={busy === a.id} onClick={() => arm === "ns" + a.id ? void act(a.id, { action: "outcome", appt: a.id, result: "no_show" }, () => "Texted them to pick a new time.") : setArm("ns" + a.id)}>
              {arm === "ns" + a.id ? "Text to rebook?" : <><Icon name="x" size={15} />No-show</>}</button>
          </div>}
      </li>; })}</ul></section>}

    {days.length ? days.map(g => <section key={g.day} className="ca-group"><h2>{dayName(g.at)}</h2>
      <ul className="ca-cards ca-agenda">{g.items.map(it => {
        if (it.kind === "event") { const e = it.event; return <li key={"e" + e.id} className="ca-ev">
          <span className="ca-ev-t">{e.allDay ? "All day" : clock(e.start)}</span>
          <span className="ca-ev-m"><b>{e.title}</b><small>{e.allDay ? "Your calendar" : `Until ${clock(e.end)} · your calendar`}</small></span>
          {e.link && <a href={e.link} target="_blank" rel="noreferrer" aria-label={`Open ${e.title} in Google Calendar`}><Icon name="ext" size={15} /></a>}
        </li>; }
        const a = it.appt, name = a.customer_name || fmtPhone(a.customer_phone);
        return <li key={"a" + a.id} className="ca-est">
          <button type="button" className="ca-est-main" onClick={() => onOpen(a.thread_id)}>
            <span className="ca-time"><b>{clock(a.starts_at).replace(/ (AM|PM)/, "")}</b><small>{clock(a.starts_at).slice(-2)}</small></span>
            <span className="ca-mid"><span className="ca-row1"><b>{name}</b></span><em>Estimate · booked by Cinder</em></span>
          </button>
          <div className="ca-est-acts">
            <button type="button" disabled={busy === "omw" + a.id} className={arm === "omw" + a.id ? "armed" : ""} onClick={() => arm === "omw" + a.id
              ? void act("omw" + a.id, { action: "reply", thread: a.thread_id, body: onMyWayText(a.customer_name, d.owner, d.business) }, () => `Texted ${a.customer_name.split(" ")[0] || "them"} you're on the way.`)
              : setArm("omw" + a.id)}><Icon name="car" size={15} />{arm === "omw" + a.id ? "Tap to send" : "On my way"}</button>
            {a.link ? <a href={a.link} target="_blank" rel="noreferrer"><Icon name="cal" size={15} />Calendar</a>
              : cal.connected ? null : <span className="ca-est-note">Not on a calendar yet</span>}
          </div>
        </li>; })}</ul></section>)
      : <div className="ca-empty"><span className="ca-empty-ic"><Icon name="cal" size={22} /></span><b>Nothing on the calendar this week</b><p>When Cinder books an estimate, it lands here and on your Google Calendar, and the customer gets a reminder the day before.</p></div>}

    {d.quotes.length > 0 && <section className="ca-group"><h2>Quotes Cinder is following up</h2>
      <ul className="ca-cards">{d.quotes.map(q => { const name = q.customer_name || fmtPhone(q.customer_phone); return <li key={q.id} className="ca-q">
        <div className="ca-q-h"><b>{name}</b><span>{q.amount ? usd(q.amount) : "No amount"}</span></div>
        <small>Sent {new Date(q.sent_on + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {q.status === "replied" ? "They replied. Check the conversation." : q.steps_sent ? `Follow-up ${q.steps_sent} of ${d.quoteSteps} sent` : "First follow-up goes out in 2 days"}</small>
        {sheet?.id === q.id ? amountSheet(() => void act(q.id, { action: "quote", quote: q.id, status: "won", amount: amt }, () => "Marked won. Follow-ups stopped."))
          : <div className="ca-q-btns"><button type="button" className="win" onClick={() => { open("quote-won", q.id); setAmt(q.amount ? String(q.amount) : ""); }}>Won</button>
            <button type="button" disabled={busy === q.id} onClick={() => arm === "lost" + q.id ? void act(q.id, { action: "quote", quote: q.id, status: "lost" }, () => "Marked lost. Follow-ups stopped.") : setArm("lost" + q.id)}>{arm === "lost" + q.id ? "Tap again: lost" : "Lost"}</button></div>}
      </li>; })}</ul></section>}

    {(d.wonJobs?.length ?? 0) > 0 && d.hasReviewLink && <section className="ca-group"><h2>Jobs you won</h2>
      <p className="ca-sub">When the job&rsquo;s finished, tap Job done and Cinder texts them for a Google review.</p>
      <ul className="ca-cards">{d.wonJobs!.map(j => { const name = j.customer_name || fmtPhone(j.customer_phone); return <li key={j.id} className="ca-q">
        <div className="ca-q-h"><b>{name}</b><span>{j.amount ? usd(j.amount) : ""}</span></div>
        <small>Won {new Date(j.won_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
        <div className="ca-q-btns"><button type="button" className="win" disabled={busy === "rv" + j.id} onClick={() => arm === "rv" + j.id
          ? void act("rv" + j.id, { action: "review", quote: j.id }, () => `Review request sent to ${name.split(" ")[0]}.`)
          : setArm("rv" + j.id)}>{arm === "rv" + j.id ? "Tap to send review request" : "Job done"}</button></div>
      </li>; })}</ul></section>}
  </>;
}

// ---------- The app ----------
export default function CinderApp() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [d, setD] = useState<Data | null>(null);
  const [project, setProject] = useState<string>("");
  const [tab, setTab] = useState<Tab>("leads");
  const [filter, setFilter] = useState<"all" | "needs" | "booked">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const { show: toast, node: toastNode } = useToast();
  const [push, setPush] = useState<PushState>("unsupported");
  const [hidePushCard, setHidePushCard] = useState(false);
  const [demo, setDemo] = useState(false);
  const exitDemo = () => { demoStop(); setDemo(false); setD(null); setOpen(null); setProject(""); setState("out"); };
  useEffect(() => {
    setPush(pushState());
    try { setHidePushCard(localStorage.getItem("cinder-push-card") === "hide"); } catch { /* private mode */ }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app-sw.js", { scope: "/app" }).catch(() => {});
  }, []);
  async function enablePush() {
    const err = await turnOnPush(project);
    setPush(pushState());
    toast(err ?? "Notifications are on.", !!err);
  }

  const load = useCallback(async (p = project, t = tab) => {
    try { const j = await api<Data>(`/api/app/data?p=${p}${t === "sam" ? "&tab=sam" : t === "estimates" ? "&tab=cal" : ""}`); setD(j); setProject(j.project); setState("in"); }
    catch (e) { if ((e as { status?: number }).status === 401) setState("out"); }
  }, [project, tab]);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t");
    (async () => {
      const q = new URLSearchParams(location.search);
      let wasDemo = false; try { wasDemo = sessionStorage.getItem(DEMO_KEY) === "1"; } catch { /* private mode */ }
      if (q.get("demo") === "1" || (wasDemo && !t)) { demoStart(); setDemo(true); setHidePushCard(true); }
      else if (t) demoStop();
      if (t) await api("/api/app/auth", { action: "link", token: t }).catch(() => null);
      // Opened from a notification: go straight to that conversation or tab.
      const th = q.get("thread"), tb = q.get("tab");
      if (th && /^[0-9a-f-]{36}$/i.test(th)) setOpen(th);
      if (tb === "sam" || tb === "estimates" || tb === "numbers") setTab(tb);
      if (location.search) try { history.replaceState(null, "", "/app"); } catch { /* keep the URL */ }
      await load("", tb === "sam" || tb === "estimates" ? tb : "leads");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (state !== "in") return; const i = setInterval(() => void load(), 20000); return () => clearInterval(i); }, [state, load]);

  const convs = useMemo(() => { const all = d?.live.conversations ?? []; return filter === "needs" ? all.filter(c => c.status === "paused") : filter === "booked" ? all.filter(c => c.status === "booked") : all; }, [d, filter]);
  const groups = useMemo(() => { const g: { day: string; items: Conv[] }[] = []; for (const c of convs) { const k = c.at ? dayName(c.at) : "Earlier"; const last = g.at(-1); if (last && last.day === k) last.items.push(c); else g.push({ day: k, items: [c] }); } return g; }, [convs]);
  const due = useMemo(() => splitAppointments(d?.appointments ?? []).due, [d]);
  const dueCount = due.length;

  if (state === "loading") return <div className="ca-load" role="main"><Mark /></div>;
  if (state === "out") return <SignIn onIn={() => void load("")} onDemo={() => { demoStart(); setDemo(true); setHidePushCard(true); setTab("leads"); void load("", "leads"); }} />;
  if (!d) return null;
  const L = d.live;
  const today = L.conversations.filter(c => c.at && dayKey(c.at) === new Date().toDateString()).length;
  const needsList = L.conversations.filter(c => c.status === "paused");
  const maxW = Math.max(1, ...L.weeks.map(w => w.leads));
  const bizName = d.business || d.businesses.find(b => b.project_id === project)?.name || "";

  if (open) return <div className="ca">{demo && <div className="ca-demo"><span>Example business with sample data. This is the app you’d get.</span><button type="button" onClick={exitDemo}>Exit</button></div>}<ThreadView id={open} project={project} canCall={d.canCall} onBack={() => { setOpen(null); void load(); }} onChange={() => void load()} toast={toast} />{toastNode}</div>;

  return <div className="ca">
    {demo && <div className="ca-demo"><span>Example business with sample data. This is the app you’d get.</span><button type="button" onClick={exitDemo}>Exit</button></div>}
    <header className="ca-top">
      <Mark small />
      {d.businesses.length > 1
        ? <select value={project} onChange={e => { setProject(e.target.value); void load(e.target.value); }} aria-label="Business">{d.businesses.map(b => <option key={b.project_id} value={b.project_id}>{b.name}</option>)}</select>
        : <b className="ca-top-name">{bizName}</b>}
      <span className="ca-live"><i />Live</span>
    </header>

    <div className="ca-main" role="main">
      {tab === "leads" && <>
        <div className="ca-hello">
          <p>{greeting()}</p>
          <h1>{today ? <>{today} new {today === 1 ? "lead" : "leads"} today.<span> All answered.</span></> : <>Every lead answered.<span> {secs(L.replySec)} typical reply.</span></>}</h1>
        </div>
        {(needsList.length > 0 || due.length > 0) && <section className="ca-todo" aria-label="Things that need you">
          <h2><i />{needsList.length + due.length} {needsList.length + due.length === 1 ? "thing needs" : "things need"} you</h2>
          <ul>
            {needsList.slice(0, 3).map(c => <li key={c.id}><button type="button" onClick={() => setOpen(c.id)}>
              <span className="ca-av sm" aria-hidden="true">{initials(c.name)}</span>
              <span className="ca-todo-m"><b>Reply to {c.name.split(" ")[0]}</b><em>&ldquo;{c.ask || c.last}&rdquo;</em></span><span className="ca-todo-go">Reply</span></button></li>)}
            {due.slice(0, 3).map(a => { const n = a.customer_name || fmtPhone(a.customer_phone); return <li key={a.id}><button type="button" onClick={() => { setTab("estimates"); window.scrollTo(0, 0); void load(project, "estimates"); }}>
              <span className="ca-av sm" aria-hidden="true">{initials(n)}</span>
              <span className="ca-todo-m"><b>{n.split(" ")[0]}&rsquo;s estimate</b><em>How did it go? Tap to update.</em></span><span className="ca-todo-go">Update</span></button></li>; })}
          </ul>
        </section>}
        {!hidePushCard && (push === "off" || push === "ios-install") && <div className="ca-pushcard">
          <span className="ca-pushcard-ic"><Icon name="bolt" size={18} /></span>
          <div><b>Know the second a lead needs you</b>
            <p>{push === "off" ? "Turn on notifications for new leads, bookings and anything Cinder hands you." : "Tap the Share button, then \u201cAdd to Home Screen\u201d. Open Cinder from there to turn on notifications."}</p>
            <div className="ca-pushcard-row">{push === "off" && <button type="button" className="ca-pushcard-go" onClick={() => void enablePush()}>Turn on</button>}
              <button type="button" className="ca-pushcard-no" onClick={() => { setHidePushCard(true); try { localStorage.setItem("cinder-push-card", "hide"); } catch { /* private mode */ } }}>Not now</button></div></div>
        </div>}
        <div className="ca-seg wide" role="tablist" aria-label="Filter leads">{([["all", "All"], ["needs", `Needs you${L.needs ? ` · ${L.needs}` : ""}`], ["booked", "Booked"]] as const).map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
        {groups.length ? groups.map(g => <section key={g.day} className="ca-group"><h2>{g.day}</h2>
          <ul className="ca-list">{g.items.map(c => { const st = STATUS[c.status] ?? STATUS.auto; return <li key={c.id}><button type="button" onClick={() => setOpen(c.id)}>
            <span className="ca-av">{initials(c.name)}<i className="ca-src"><Icon name={SRC_ICON[c.source] ?? "chat"} size={11} /></i></span>
            <span className="ca-mid">
              <span className="ca-row1"><b>{c.name}</b><time>{ago(c.at)}</time></span>
              <em>{c.last}</em>
              <span className="ca-row3"><small>{SOURCE[c.source] ?? c.source}</small><span className={"ca-chip is-" + st[1]}>{st[0]}</span></span>
            </span>
          </button></li>; })}</ul></section>)
          : <div className="ca-empty"><span className="ca-empty-ic"><Icon name="chat" size={22} /></span><b>{filter === "all" ? "No leads yet" : filter === "needs" ? "You're all caught up" : "No bookings yet"}</b><p>{filter === "all" ? "When someone calls, texts or fills out your form, it shows up here with Cinder's reply." : filter === "needs" ? "Cinder hands you anything it shouldn't answer. Nothing's waiting." : "Booked estimates show up here and on your calendar."}</p></div>}
      </>}

      {tab === "numbers" && <>
        {L.wonValue > 0 ? <div className="ca-money"><p>Jobs won from leads Cinder handled</p><b>{usd(L.wonValue)}</b>
          <small>{L.won} {L.won === 1 ? "job" : "jobs"}{L.chasingValue ? ` · ${usd(L.chasingValue)} more in quotes Cinder is chasing` : ""}</small></div>
          : <div className="ca-hello"><p>Last 30 days</p><h1>Cinder answered {L.answered} {L.answered === 1 ? "lead" : "leads"} and booked {L.booked} {L.booked === 1 ? "estimate" : "estimates"}.</h1></div>}
        <div className="ca-kpis">
          <div><span>Leads answered</span><b>{L.answered}<small>/{L.leads}</small></b><em>{L.leads ? `${Math.round((L.answered / L.leads) * 100)}% answered` : " "}</em></div>
          <div><span>Typical first reply</span><b>{L.replySec == null ? "–" : L.replySec < 60 ? <>{L.replySec}<small>sec</small></> : <>{Math.round(L.replySec / 60)}<small>min</small></>}</b><em>Day or night</em></div>
          <div><span>Estimates booked</span><b>{L.booked}</b><em>On your calendar</em></div>
          <div><span>Quotes being chased</span><b>{L.chasing}</b><em>{L.chasingValue ? `${usd(L.chasingValue)} open` : " "}</em></div>
        </div>
        {L.weeks.length > 1 && <section className="ca-card"><div className="ca-card-h"><h2>Every week</h2><span><i className="k l" />Leads<i className="k b" />Booked</span></div>
          <div className="ca-bars">{L.weeks.map(w => <div key={w.week} className="ca-bar" title={`${w.leads} leads, ${w.booked} booked`}><span><i className="l" style={{ height: (w.leads / maxW) * 100 + "%" }} /><i className="b" style={{ height: (w.booked / maxW) * 100 + "%" }} /></span><small>{w.leads}</small></div>)}</div></section>}
        <ul className="ca-stats">
          <li><span className="ca-stat-ic"><Icon name="quote" /></span><span><b>{L.won} {L.won === 1 ? "quote" : "quotes"} won</b><small>after follow-up{L.wonValue ? ` · ${usd(L.wonValue)}` : ""}</small></span></li>
          <li><span className="ca-stat-ic"><Icon name="bolt" /></span><span><b>{L.revived} old {L.revived === 1 ? "lead" : "leads"} replied</b><small>from the revive campaign</small></span></li>
          <li><span className="ca-stat-ic"><Icon name="star" /></span><span><b>{L.reviews} review {L.reviews === 1 ? "request" : "requests"}</b><small>sent after finished jobs</small></span></li>
        </ul>
      </>}

      {tab === "estimates" && <CalendarTab d={d} project={project} onOpen={setOpen} reload={() => load(project, "estimates")} toast={toast} />}

      {tab === "sam" && <>
        <div className="ca-sam">
          <span className="ca-av lg">S</span>
          <div><b>Sam Ward</b><small>Your Cinder contact · usually replies the same day</small></div>
        </div>
        {d.messages.length > 0 ? <ol className="ca-msgs">{d.messages.map((m, i) => <li key={i} className={m.author === "client" ? "me" : "them"}><p>{m.body}</p><small>{m.author === "client" ? "You" : "Sam"} · {ago(m.created_at)}</small></li>)}</ol>
          : <p className="ca-sub">Changes to your texts, new hours, a question about your setup. Write it here.</p>}
        <form className="ca-compose inline" onSubmit={async e => { e.preventDefault(); if (!msg.trim()) return; try { await api("/api/app/act", { p: project, action: "message", body: msg }); setMsg(""); toast("Sent to Sam."); void load(project, "sam"); } catch (er) { toast(er instanceof Error ? er.message : "Didn't send.", true); } }}>
          <textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message Sam" aria-label="Message to Sam" />
          <button type="submit" disabled={!msg.trim()} aria-label="Send"><Icon name="send" size={18} /></button>
        </form>
        <ul className="ca-settings">
          <li><span>Business</span><b>{bizName}</b></li>
          {d.number && <li><span>Your Cinder number</span><b>{fmtPhone(d.number)}</b></li>}
          <li><span>Notifications</span>{push === "on" ? <b className="ca-on">On</b> : push === "off" ? <button type="button" className="ca-set-btn" onClick={() => void enablePush()}>Turn on</button> : <b>{push === "blocked" ? "Blocked in settings" : push === "ios-install" ? "Add to Home Screen first" : "Not on this browser"}</b>}</li>
          <li><button type="button" onClick={async () => { if (demo) return exitDemo(); await api("/api/app/auth", { action: "logout" }).catch(() => null); setState("out"); }}><Icon name="out" size={16} />{demo ? "Leave the example" : "Sign out"}</button></li>
        </ul>
      </>}
    </div>

    <nav className="ca-nav" aria-label="Sections">
      {([["leads", "Leads", L.needs, "chat"], ["numbers", "Numbers", 0, "bolt"], ["estimates", "Calendar", dueCount, "cal"], ["sam", "Sam", d.unreadFromSam, "sam"]] as const).map(([k, l, n, ic]) =>
        <button key={k} type="button" aria-current={tab === k ? "page" : undefined} className={tab === k ? "on" : ""} onClick={() => { setTab(k); window.scrollTo(0, 0); if (k === "sam" || k === "estimates") void load(project, k); }}>
          <span className="ca-nav-ic">{ic === "sam" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg> : ic === "bolt" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-7" /></svg> : <Icon name={ic} size={22} />}{n ? <em>{n}</em> : null}</span>{l}</button>)}
    </nav>
    {toastNode}
  </div>;
}
