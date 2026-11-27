"use client";

// The Cinder app for client owners. Sign in with a text code (or straight from the portal link), then one shell:
// a rail on a desk, a tab bar on a phone, the same screens on both. Home, Inbox, Jobs, Calendar, Money, Settings.
// ⌘K finds anyone. Installs to the home screen like an app (/app.webmanifest).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./app.css";
import "./v5.css";
import "./v6.css";
import "./kit.css";
import { Av, Head, ShellCtx, type View } from "./kit";
import { Wordmark } from "../brand";
import { QuotesScreen, QuoteEditor } from "./quotes";
import { Avatar, Icon, Spinner, fmtPhone, initials, typePhone, useToast } from "./parts";
import type { Biz, Data, Go, Tab } from "./types";
import { mailWaiting } from "./types";
import { splitAppointments } from "@/lib/client-schedule";
import { TodayScreen } from "./today";
import { JobsScreen, type JobsView } from "./jobs";
import { PlansScreen } from "./plans";
import { CatalogContext, PriceListSheet, catalogFrom } from "./catalog";
import { RecordPage } from "./record";
import { InboxScreen, ThreadView } from "./inbox";
import { MyDay } from "./crew";
import { MoneyScreen, InvoiceSheet, BillingSettings } from "./money";
import dynamic from "next/dynamic";

// Screens most visits never open load on demand, then warm in the background once the first screen is up (warmScreens),
// so a tab is ready by the time it's tapped. The first paint carries only Home, Inbox, Jobs and the record.
const Wait = () => <div className="page-wait" role="status" aria-label="Loading"><i className="skel" /><i className="skel" /><i className="skel" /></div>;
const CalendarScreen = dynamic(() => import("./calendar").then(m => m.CalendarScreen), { ssr: false, loading: Wait });
const ReportsScreen = dynamic(() => import("./numbers").then(m => m.ReportsScreen), { ssr: false, loading: Wait });
const SystemScreen = dynamic(() => import("./system").then(m => m.SystemScreen), { ssr: false, loading: Wait });
const SwitchScreen = dynamic(() => import("./switch").then(m => m.SwitchScreen), { ssr: false, loading: Wait });
const ComingFromScreen = dynamic(() => import("./coming-from").then(m => m.ComingFromScreen), { ssr: false, loading: Wait });
const HelpScreen = dynamic(() => import("./help").then(m => m.HelpScreen), { ssr: false, loading: Wait });
const Onboarding = dynamic(() => import("./setup").then(m => m.Onboarding), { ssr: false, loading: Wait });
const CommandBar = dynamic(() => import("./command").then(m => m.CommandBar), { ssr: false });
const AddLeadSheet = dynamic(() => import("./sheets").then(m => m.AddLeadSheet), { ssr: false });
const ImportSheet = dynamic(() => import("./sheets").then(m => m.ImportSheet), { ssr: false });
const WinbackSheet = dynamic(() => import("./sheets").then(m => m.WinbackSheet), { ssr: false });
/** The app's own outline while the first data comes in: a rail, a title, rows. Fades in only if it takes a moment. */
function Boot() {
  return <div className="boot" role="status" aria-label="Loading">
    <aside className="boot-rail" aria-hidden="true">{[70, 55, 60, 50, 65, 45, 58].map((w, i) => <i key={i} className="skel" style={{ width: w + "%" }} />)}</aside>
    <div className="boot-main" aria-hidden="true"><i className="skel boot-h" />{[92, 78, 85, 70, 88, 64].map((w, i) => <div key={i} className="boot-row"><i className="skel" style={{ width: w + "%" }} /><i className="skel" style={{ width: (w - 30) + "%" }} /></div>)}</div>
  </div>;
}
function warmScreens() {
  const go = () => { for (const f of [() => import("./calendar"), () => import("./system"), () => import("./numbers"), () => import("./command"), () => import("./sheets"), () => import("./switch"), () => import("./setup"), () => import("./coming-from")]) void f().catch(() => {}); };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500);
}

// The example business (/app?demo=1) answers every call in the browser; nothing reaches the server.
const DEMO_KEY = "cinder-demo";
// Read once when the module loads, so a reload (or a dev hot-reload) of the example business stays in it.
let demoOn = (() => { try { return typeof window !== "undefined" && sessionStorage.getItem(DEMO_KEY) === "1"; } catch { return false; } })();
const demoStart = () => { demoOn = true; try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* private mode */ } };
const demoStop = () => { demoOn = false; try { sessionStorage.removeItem(DEMO_KEY); } catch { /* private mode */ } };

// Work done on the job without signal: these actions wait on the phone and go out, in order, when it's back.
const QUEUE_KEY = "cinder-queue", QUEUEABLE = new Set(["jobstep", "checktick", "clockin", "clockout", "card", "photo", "signoff", "expense"]);
type Queued = { path: string; body: Record<string, unknown>; at: string };
const readQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; } };
const writeQueue = (q: Queued[]): boolean => { let ok = true; try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200))); } catch { ok = false; } dispatchEvent(new Event("cinder-queue")); return ok; };
/** Send what waited. Stops at the first network failure; a change the server refuses is dropped and reported. */
async function flushQueue(): Promise<{ sent: number; dropped: string[] }> {
  let q = readQueue(), sent = 0; const dropped: string[] = [];
  while (q.length) {
    const it = q[0];
    let r: Response;
    try { r = await fetch(it.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(it.body) }); } catch { break; }
    if (r.ok) sent++; else if (r.status >= 400 && r.status < 500) { const j = await r.json().catch(() => ({})) as { error?: string }; dropped.push(j.error || "A change couldn't be saved."); } else break;
    q = q.slice(1); writeQueue(q);
  }
  return { sent, dropped };
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  if (demoOn && !path.startsWith("/api/app/auth") && !path.startsWith("/api/app/push")) { const { demoApi } = await import("./demo"); return await demoApi(path, (body ?? {}) as Record<string, unknown>) as T; }
  const b = body as Record<string, unknown> | undefined;
  const queueable = !!b && path === "/api/app/act" && QUEUEABLE.has(String(b.action));
  const queue = () => { const at = new Date().toISOString();
    if (!writeQueue([...readQueue(), { path, body: { ...b!, at: b!.at ?? at }, at }])) throw new Error("No room on this phone to keep that until you have signal. Try again when you're back online.");
    return { ok: true, queued: true } as T; };
  if (queueable && typeof navigator !== "undefined" && navigator.onLine === false) return queue();
  let r: Response;
  try { r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" }); }
  catch (e) { if (queueable) return queue(); throw new Error(typeof navigator !== "undefined" && navigator.onLine === false ? "You're offline. Try again when you have signal." : (e instanceof Error ? e.message : "No connection.")); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong.") as Error & { status?: number }; e.status = r.status; throw e; }
  return j as T;
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
    if (perm !== "granted") return "Notifications are blocked. Turn them on for this app in your phone's settings.";
    const reg = await navigator.serviceWorker.register("/app-sw.js", { scope: "/app" });
    await navigator.serviceWorker.ready;
    const { publicKey } = await api<{ publicKey: string }>("/api/app/push");
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey(publicKey) });
    await api("/api/app/push", { p: project, action: "subscribe", sub: sub.toJSON() });
    return null;
  } catch (e) { return e instanceof Error ? e.message : "Couldn't turn on notifications."; }
}

// ---------- Sign in ----------
function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [focus, setFocus] = useState(true);
  return <div className="otp">
    {Array.from({ length: 6 }, (_, i) => <span key={i} className={focus && i === Math.min(value.length, 5) ? "on" : ""} aria-hidden="true">{value[i] ?? ""}</span>)}
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
  return <main className="gate">
    <Wordmark className="word" />
    <div className="box">
      <h1>{sent ? "Check your texts" : "Sign in"}</h1>
      <p>{sent ? <>We texted a code to <b className="t-em">{fmtPhone(phone)}</b>.</> : "Use the cell number you gave Sam."}</p>
      <form onSubmit={e => { e.preventDefault(); if (!sent) void send(); else if (code.length === 6) void verify(code); }}>
        {!sent ? <label className="inwrap"><span className="sr">Cell number</span><i>+1</i>
          <input inputMode="tel" autoComplete="tel-national" placeholder="(720) 555-0148" value={phone} onChange={e => { setPhone(typePhone(e.target.value)); setErr(""); }} autoFocus /></label>
          : <CodeBoxes value={code} disabled={busy} onChange={v => { setCode(v); setErr(""); if (v.length === 6) void verify(v); }} />}
        {err && <p className="err" role="alert">{err}</p>}
        <button type="submit" className="btn ink lg full" disabled={busy || (!sent ? digits < 10 : code.length !== 6)}>{busy ? <Spinner /> : sent ? "Sign in" : "Continue"}</button>
      </form>
      {!sent ? <div className="alt"><button type="button" className="link" onClick={onDemo}>See an example business</button></div>
        : <div className="alt">
          <button type="button" className="link" disabled={wait > 0 || busy} onClick={() => void send()}>{wait > 0 ? `Resend in ${wait}s` : "Resend code"}</button><span>·</span>
          <button type="button" className="link" onClick={() => { setSent(false); setCode(""); setErr(""); }}>Change number</button>
        </div>}
    </div>
    <p className="foot">Have a portal link from Sam? It signs you in too.</p>
  </main>;
}

// ---------- The app ----------
type Open = { kind: "record"; id: string; ask?: "quoted" | "won"; view?: "activity" | "job"; draft?: string } | { kind: "thread"; id: string } | { kind: "quote"; id: string } | null;
// Five places. Everything else is a view inside one of them: Quotes and Customers under Jobs, Plans and Numbers under Money,
// Sam, Help and moving in under Settings. Quick search (⌘K) reaches all of it.
const SECTIONS: { k: Tab; l: string; ic: string }[] = [{ k: "today", l: "Today", ic: "home" }, { k: "inbox", l: "Inbox", ic: "chat" }, { k: "jobs", l: "Jobs", ic: "jobs" }, { k: "calendar", l: "Calendar", ic: "cal" }, { k: "invoices", l: "Money", ic: "dollar" }];
const PLACE: Partial<Record<Tab, Tab>> = { customers: "jobs", quotes: "jobs", plans: "invoices", numbers: "invoices", sam: "system", help: "system", switch: "system", from: "system" };

export default function CinderApp() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [d, setD] = useState<Data | null>(null);
  const [project, setProject] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [open, setOpen] = useState<Open>(null);
  const [jobsView, setJobsView] = useState<JobsView>("open");
  const [wide, setWide] = useState(false);
  useEffect(() => { const m = matchMedia("(min-width: 900px)"); const f = () => setWide(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  const { show: toast, node: toastNode } = useToast();
  // Offline: whether there's signal, and how many changes are waiting on this phone.
  const [online, setOnline] = useState(true), [pending, setPending] = useState(0);
  const reloadRef = useRef<() => void>(() => {});
  useEffect(() => {
    const count = () => setPending(readQueue().length);
    const up = async () => { setOnline(true); count(); if (!readQueue().length) return; const r = await flushQueue(); count();
      if (r.sent) toast(`Back online. ${r.sent} ${r.sent === 1 ? "change" : "changes"} from while you were offline saved.`);
      if (r.dropped.length) toast(`${r.dropped.length} couldn't be saved: ${r.dropped[0]}`, true);
      reloadRef.current(); };
    const down = () => { setOnline(false); count(); };
    setOnline(navigator.onLine); count(); if (navigator.onLine) void up();
    addEventListener("online", up); addEventListener("offline", down); addEventListener("cinder-queue", count);
    return () => { removeEventListener("online", up); removeEventListener("offline", down); removeEventListener("cinder-queue", count); };
  }, [toast]);
  const [push, setPush] = useState<PushState>("unsupported");
  const [demo, setDemo] = useState(false);
  const [sheet, setSheet] = useState<"add" | "import" | "billing" | "winback" | "cmd" | "pricelist" | null>(null);
  const [askQ, setAskQ] = useState<{ q: string; n: number } | undefined>(undefined);
  const [inv, setInv] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false), [setupDone, setSetupDone] = useState(false);
  const exitDemo = () => { demoStop(); setDemo(false); setD(null); setOpen(null); setProject(""); setState("out"); };

  useEffect(() => {
    setPush(pushState());
    // Not on a dev server: there, built files keep their names while their content changes, and the cache would serve old ones.
    if ("serviceWorker" in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) navigator.serviceWorker.register("/app-sw.js", { scope: "/app" }).catch(() => {});
  }, []);
  async function enablePush() { const err = await turnOnPush(project); setPush(pushState()); toast(err ?? "Notifications are on.", !!err); }

  const load = useCallback(async (p = project, t = tab) => {
    try { const j = await api<Data & { signedOut?: boolean }>(`/api/app/data?p=${p}${t === "sam" ? "&tab=sam" : t === "calendar" ? "&tab=cal" : ""}${p ? "" : "&probe=1"}`);
      if (j.signedOut) { setState("out"); return; } setD(j); setProject(j.project); setState("in"); }
    catch (e) { if ((e as { status?: number }).status === 401) setState("out"); }
  }, [project, tab]);
  useEffect(() => { reloadRef.current = () => { if (project) void load(project, tab); }; }, [load, project, tab]);
  const warmed = useRef(false);
  useEffect(() => { if (d && !warmed.current) { warmed.current = true; warmScreens(); } }, [d]);

  useEffect(() => {
    const q = new URLSearchParams(location.search), t = q.get("t");
    (async () => {
      let wasDemo = false; try { wasDemo = sessionStorage.getItem(DEMO_KEY) === "1"; } catch { /* private mode */ }
      if (q.get("demo")) { try { if (q.get("demo") === "empty") sessionStorage.setItem("cinder-demo-empty", "1"); else sessionStorage.removeItem("cinder-demo-empty"); if (q.get("demo") === "crew") sessionStorage.setItem("cinder-demo-crew", "1"); else sessionStorage.removeItem("cinder-demo-crew"); } catch { /* private mode */ } }
      if (q.get("demo") === "1" || q.get("demo") === "empty" || (wasDemo && !t)) { demoStart(); setDemo(true); } else if (t) demoStop();
      if (t) await api("/api/app/auth", { action: "link", token: t }).catch(() => null);
      const th = q.get("thread"), tb = q.get("tab");
      if (th && /^[0-9a-f-]{36}$/i.test(th)) setOpen({ kind: "thread", id: th });
      const map: Record<string, Tab> = { sam: "sam", estimates: "calendar", calendar: "calendar", numbers: "numbers", jobs: "jobs", leads: "inbox", inbox: "inbox", today: "today", home: "today", invoices: "invoices", money: "invoices", customers: "customers", system: "system", quotes: "quotes", plans: "plans", switch: "switch", move: "switch", from: "from", "coming-from": "from", jobber: "from", housecall: "from" };
      if (tb && map[tb]) setTab(map[tb]);
      if (location.search) try { history.replaceState(null, "", "/app"); } catch { /* keep the URL */ }
      await load("", tb && map[tb] ? map[tb] : "today");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (state !== "in") return; const i = setInterval(() => void load(), 20000); return () => clearInterval(i); }, [state, load]);

  const goTab = useCallback((t: Tab) => { setTab(t); setOpen(null); window.scrollTo(0, 0); if (t === "sam" || t === "calendar") void load(project, t); }, [load, project]);
  const go: Go = useMemo(() => ({
    tab: goTab,
    // Writing a quote always happens in the quote editor, wherever the button was.
    record: (id, opts) => { setOpen(opts?.ask === "quoted" ? { kind: "quote", id } : { kind: "record", id, ask: opts?.ask, view: opts?.view, draft: opts?.draft }); window.scrollTo(0, 0); },
    quote: id => { setOpen({ kind: "quote", id }); window.scrollTo(0, 0); },
    thread: id => { setOpen(wide ? { kind: "record", id, view: "activity" } : { kind: "thread", id }); window.scrollTo(0, 0); },
    invoice: id => setInv(id),
    addLead: () => setSheet("add"), importCustomers: () => setSheet("import"), billing: () => setSheet("billing"),
    setup: () => { setSetupOpen(true); window.scrollTo(0, 0); },
    find: () => setSheet("cmd"),
  }), [goTab, wide]);

  // Global keys: ⌘K for the command bar, ⌘1 to ⌘6 for sections, Esc to leave a record.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSheet(s => s === "cmd" ? null : "cmd"); return; }
      const typingNow = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.key === "/" && !typingNow && !e.metaKey && !e.ctrlKey && !sheet) { e.preventDefault(); setSheet("cmd"); return; }
      if ((e.metaKey || e.ctrlKey) && /^[1-7]$/.test(e.key)) { e.preventDefault(); const t = ([...SECTIONS.map(s => s.k), "system", "quotes"] as Tab[])[Number(e.key) - 1]; if (t) goTab(t); return; }
      const el = e.target as HTMLElement | null;
      if (e.key === "Escape" && open && !sheet && !inv && !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"))) setOpen(null);
    };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, [goTab, open, sheet, inv]);

  // The workspace scrolls inside its window: every move starts at the top.
  useEffect(() => { document.querySelector(".main > .page")?.scrollTo(0, 0); }, [tab, open]);
  const due = useMemo(() => splitAppointments(d?.appointments ?? []).due, [d]);
  if (state === "loading") return <Boot />;
  if (state === "out") return <SignIn onIn={() => { demoStop(); void load(""); }} onDemo={() => { demoStart(); setDemo(true); setTab("today"); setState("loading"); void load("", "today"); }} />;
  if (!d) return <Boot />;

  const L = d.live;
  const bizName = d.business || d.businesses.find(b => b.project_id === project)?.name || "";
  const biz: Biz = { crew: d.role === "crew", reviewLink: d.setup?.has_review_link === "yes" || !!d.hasReviewLink, number: d.setup?.has_number === "yes" || !!d.number, owner: d.owner, business: bizName,
    priceBook: d.setup?.price_book || "", taxRate: d.setup?.tax_rate || "", payLink: !!d.setup?.pay_link, calendar: d.setup?.has_calendar === "yes" || !!d.calendar?.connected, trade: d.setup?.trade || "", canCall: d.canCall };
  const owed = (d.invoices ?? []).filter(i => i.status === "sent").length;
  const crew = d.role === "crew";
  const signOut = async () => { if (demo) return exitDemo(); await api("/api/app/auth", { action: "logout" }).catch(() => null);
    // A shared phone keeps nothing: the saved copy of the app's data and anything still waiting go with the sign-out.
    try { localStorage.removeItem(QUEUE_KEY); navigator.serviceWorker?.controller?.postMessage("cinder-clear"); } catch { /* nothing saved */ }
    setState("out"); };
  const reload = () => load(project, tab);
  const invNow = inv ? ((d.invoices ?? []).find(i => i.id === inv) ?? null) : null;
  const cards = d.board ?? [];
  const jobCounts = { open: cards.filter(c => c.stage === "new" || c.stage === "booked" || c.stage === "quoted").length, won: (d.customers ?? []).filter(c => c.stage === "won" || c.jobs > 0).length, all: d.customers?.length ?? cards.length };

  if ((setupOpen || (!demo && !setupDone && d.setup && !d.setup.onboarded_at)) && !open) return <Onboarding project={project} initial={d.setup ?? {}} api={api}
    onDone={() => setSetupDone(true)} onClose={() => { setSetupOpen(false); setSetupDone(true); setTab("jobs"); window.scrollTo(0, 0); void load(project, "jobs"); }} />;

  const mailN = crew ? 0 : mailWaiting(d).length;
  const counts: Partial<Record<Tab, number>> = { inbox: L.needs + mailN, calendar: due.length, invoices: owed };
  // The place you're in: a quote is Jobs, a conversation is Inbox, a record is Jobs.
  const here: Tab = !open ? (PLACE[tab] ?? tab) : open.kind === "thread" ? "inbox" : "jobs";
  const places = crew ? SECTIONS.filter(s => s.k === "inbox" || s.k === "jobs" || s.k === "calendar") : SECTIONS;
  const quotesOut = cards.filter(c => c.stage === "quoted" && c.quote && !c.pastCustomer).length;
  const views: View[] | undefined = open || crew ? undefined
    : here === "jobs" ? [
      { k: "open", l: "Open", n: jobCounts.open, on: tab === "jobs" && jobsView === "open", go: () => { setJobsView("open"); goTab("jobs"); } },
      { k: "won", l: "Won", n: jobCounts.won, on: tab === "jobs" && jobsView === "won", go: () => { setJobsView("won"); goTab("jobs"); } },
      { k: "quotes", l: "Quotes", n: quotesOut, on: tab === "quotes", go: () => goTab("quotes") },
      { k: "customers", l: "Customers", n: jobCounts.all, on: tab === "customers", go: () => goTab("customers") }]
    : here === "invoices" ? [
      { k: "invoices", l: "Invoices", n: owed, on: tab === "invoices", go: () => goTab("invoices") },
      { k: "plans", l: "Service plans", on: tab === "plans", go: () => goTab("plans") },
      { k: "numbers", l: "Numbers", on: tab === "numbers", go: () => goTab("numbers") }]
    : here === "system" ? [
      { k: "system", l: "Settings", on: tab === "system", go: () => goTab("system") },
      { k: "sam", l: "Sam", n: d.unreadFromSam, on: tab === "sam", go: () => goTab("sam") },
      { k: "help", l: "Help", on: tab === "help", go: () => goTab("help") },
      { k: "switch", l: "Move your business in", on: tab === "switch" || tab === "from", go: () => goTab("switch") }]
    : undefined;
  const shellCtx = { views, onMore: wide ? undefined : () => goTab(crew ? "system" : "more"), me: d.owner || bizName || "Me" };
  let page: React.ReactNode;
  if (open?.kind === "thread") page = <ThreadView id={open.id} project={project} canCall={d.canCall} api={api} toast={toast} onBack={() => { setOpen(null); void reload(); }} onChange={() => void reload()} onRecord={() => setOpen({ kind: "record", id: open.id })} />;
  else if (open?.kind === "quote") page = <QuoteEditor key={open.id} id={open.id} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onBack={() => setOpen(null)} />;
  else if (open?.kind === "record") page = <RecordPage key={open.id + (open.draft ? ":d" : "")} id={open.id} ask={open.ask} view={open.view} draft={open.draft} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onBack={() => { setOpen(null); void reload(); }} />;
  else if (tab === "today" && crew) page = <MyDay d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} />;
  else if (tab === "today") page = <TodayScreen reload={reload} d={d} biz={biz} go={go} wide={wide} api={api} project={project} ask={askQ} toast={toast} demo={demo} />;
  else if (tab === "inbox") page = <InboxScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} wide={wide} push={push} onPush={() => void enablePush()} />;
  else if (tab === "jobs" || tab === "customers") page = <JobsScreen d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} wide={wide} view={tab === "customers" ? "all" : jobsView} setView={v => { setJobsView(v); setTab("jobs"); }} onWinback={() => setSheet("winback")} />;
  else if (tab === "switch") page = <SwitchScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} />;
  else if (tab === "from") page = <ComingFromScreen go={go} from={/housecall/i.test(d.setup?.software ?? "") ? "housecall" : "jobber"} />;
  else if (tab === "plans") page = <PlansScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} />;
  else if (tab === "quotes") page = <QuotesScreen d={d} go={go} wide={wide} biz={biz} />;
  else if (tab === "calendar") page = <CalendarScreen d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} wide={wide} />;
  else if (tab === "invoices") page = <MoneyScreen d={d} go={go} wide={wide} biz={biz} project={project} api={api} toast={toast} reload={reload} />;
  else if (tab === "numbers") page = <ReportsScreen d={d} biz={biz} go={go} project={project} api={api} toast={toast} reload={reload} onWinback={() => setSheet("winback")} />;
  else if (tab === "system") page = <SystemScreen d={d} biz={biz} go={go} push={push} onPush={() => void enablePush()} toast={toast} api={api} project={project} reload={reload} demo={demo} onSignOut={signOut} />;
  else if (tab === "more") page = <MoreScreen d={d} go={go} owed={owed} />;
  else if (tab === "help") page = <SystemScreen key="help" view="help" d={d} biz={biz} go={go} push={push} onPush={() => void enablePush()} toast={toast} api={api} project={project} reload={reload} demo={demo} onSignOut={signOut} />;
  else page = <SamScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} />;

  const catalog = { items: catalogFrom(d.setup), edit: () => setSheet("pricelist") };
  // The business's own color is the one accent everywhere; its logo sits top left. "Cinder" shows only if they opt in.
  const brand = d.setup?.brand_color && /^#[0-9a-f]{6}$/i.test(d.setup.brand_color) ? d.setup.brand_color : "";
  const tint = (a: number) => brand ? `rgba(${parseInt(brand.slice(1, 3), 16)}, ${parseInt(brand.slice(3, 5), 16)}, ${parseInt(brand.slice(5, 7), 16)}, ${a})` : "";
  const shellStyle = brand ? { "--ember": brand, "--ember-soft": tint(0.12), "--ember-bg": tint(0.1) } as React.CSSProperties : undefined;
  return <CatalogContext.Provider value={catalog}><div className="shell v5" style={shellStyle}>
    <nav className="k-rail" aria-label="Places">
      <div className="k-ws" title={bizName}>
        <span className="k-mark" style={brand ? { background: brand } : undefined} aria-hidden="true">{d.setup?.brand_logo ? <img src={d.setup.brand_logo} alt="" /> : initials(bizName || "B").charAt(0)}</span>
        <b>{(bizName || "Your business").replace(/ \(example\)$/, "")}</b>{d.businesses.length > 1 && <Icon name="updown" size={13} />}
        {d.businesses.length > 1 && <select value={project} aria-label="Business" onChange={e => { setProject(e.target.value); void load(e.target.value); }}>{d.businesses.map(b => <option key={b.project_id} value={b.project_id}>{b.name}</option>)}</select>}
      </div>
      <button type="button" className="k-search" onClick={() => setSheet("cmd")}><Icon name="search" size={14} /><span>Search</span><kbd>⌘K</kbd></button>
      <div className="k-nav">{places.map(s => { const on = here === s.k, n = counts[s.k];
        return <button key={s.k} type="button" className={"k-ri" + (on ? " on" : "")} aria-current={on ? "page" : undefined} onClick={() => goTab(s.k)}>
          <Icon name={s.ic} size={16} /><span>{s.l}</span>{n ? <em className={s.k === "inbox" ? "hot" : ""}>{n}</em> : null}</button>; })}</div>
      <div className="k-rail-sp" />
      {!crew && d.role !== "office" && <div className="k-nav">
        <button type="button" className={"k-ri" + (here === "system" ? " on" : "")} aria-current={here === "system" ? "page" : undefined} onClick={() => goTab("system")}><Icon name="gear" size={16} /><span>Settings</span>{d.unreadFromSam ? <em className="hot">{d.unreadFromSam}</em> : null}</button>
      </div>}
      {d.setup?.show_powered === "yes" && <a className="k-powered" href="https://cinderrevenue.com" target="_blank" rel="noreferrer">Powered by Cinder</a>}
      <div className="k-rail-me">
        {crew ? <button type="button" className="k-who" onClick={() => void signOut()}><Av name="Crew" /><span><b>Crew</b><small>Sign out</small></span></button>
          : <><button type="button" className="k-who" onClick={() => goTab("sam")}><Av name={d.owner || bizName || "Me"} /><span><b>{(d.owner || "You").split(" ")[0]}</b><small>{demo ? "Example business" : "Owner"}</small></span></button>
            <button type="button" className="k-btn ghost ic sm" aria-label="Help" title="Help" onClick={() => goTab("help")}><kbd>?</kbd></button></>}
      </div>
    </nav>
    <div className="main">
      {demo && <div className="k-demo"><i aria-hidden="true" /><span>Example business, sample data</span><button type="button" onClick={exitDemo}>Exit</button></div>}
      {!demo && (d.failed?.length ?? 0) > 0 && <div className="offline-bar" role="alert"><span>Your {d.failed!.length > 1 ? `${d.failed!.slice(0, -1).join(", ")} and ${d.failed!.at(-1)}` : d.failed![0]} didn&rsquo;t load. Nothing is lost.</span>
        <button type="button" className="btn sm" onClick={() => void reload()}>Try again</button></div>}
      {!demo && (!online || pending > 0) && <div className={"offline-bar" + (online ? " syncing" : "")} role="status"><span>{online ? `Saving ${pending} ${pending === 1 ? "change" : "changes"} from while you were offline` : `Offline. You're seeing what was saved on this phone${pending ? `; ${pending} ${pending === 1 ? "change waits" : "changes wait"} to send` : ""}. Checklists, photos, notes and the clock still work.`}</span></div>}
      <div className={"page" + (open ? " has-open" : "")} role="main"><ShellCtx.Provider value={shellCtx}>{page}</ShellCtx.Provider></div>
    </div>
    <nav className="k-tabs" aria-label="Places">
      {places.map(t => { const on = here === t.k, n = t.k === "inbox" ? counts.inbox : undefined;
        return <button key={t.k} type="button" className={on ? "on" : ""} aria-current={on ? "page" : undefined} onClick={() => goTab(t.k)}>
          <Icon name={t.ic} size={21} />{t.l}{n ? <em>{n}</em> : null}</button>; })}
    </nav>
    {sheet === "cmd" && <CommandBar d={d} go={go} onClose={() => setSheet(null)} onWinback={() => setSheet("winback")} onAsk={crew ? undefined : q => { setAskQ({ q, n: Date.now() }); goTab("today"); }} />}
    {sheet === "add" && <AddLeadSheet trade={biz.trade} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {sheet === "import" && <ImportSheet project={project} api={api} toast={toast} reload={reload} customers={d.customers ?? []} business={bizName} onClose={() => setSheet(null)} />}
    {sheet === "pricelist" && <PriceListSheet items={catalog.items} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {sheet === "billing" && <BillingSettings setup={d.setup ?? {}} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {sheet === "winback" && d.winback && <WinbackSheet w={d.winback} biz={biz} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} tags={[...new Set((d.board ?? []).flatMap(c => c.tags ?? []))].sort()} />}
    {invNow && <InvoiceSheet key={invNow.id + invNow.status + (invNow.paid_amount ?? 0)} inv={invNow} payments={d.payments} customer={invNow.customer || fmtPhone(invNow.phone)} email={(d.board ?? []).find(b => b.id === invNow.thread_id)?.email} emailReady={d.emailReady} project={project} api={api} toast={toast} reload={reload} payLink={biz.payLink} onClose={() => setInv(null)} onSetup={() => { setInv(null); setSheet("billing"); }} />}
    {toastNode}
  </div></CatalogContext.Provider>;
}

// ---------- More (phone): everything that isn't one of the five tabs ----------
function MoreScreen({ d, go, owed }: { d: Data; go: Go; owed: number }) {
  const items: { k: Tab; l: string; s: string; ic: string; n?: number }[] = [
    { k: "quotes", l: "Quotes", s: "Every quote out, and who's looking", ic: "quote" },
    { k: "customers", l: "Customers", s: `${d.customers?.length ?? 0} people`, ic: "users" },
    { k: "plans", l: "Service plans", s: (d.plans ?? []).some(p => p.status === "active") ? `${(d.plans ?? []).filter(p => p.status === "active").length} active` : "Repeat work on a schedule", ic: "clock" },
    { k: "numbers", l: "Numbers", s: owed ? `What came in and what it made. ${owed} invoices out` : "What came in and what it made", ic: "bars" },
    { k: "system", l: "Settings", s: "How leads come in, prices, notifications", ic: "gear" },
    { k: "sam", l: "Sam", s: d.unreadFromSam ? `${d.unreadFromSam} new` : "Your account rep", ic: "user", n: d.unreadFromSam },
    { k: "switch", l: "Move your business in", s: "From Jobber, QuickBooks, a spreadsheet or your phone", ic: "upload" },
    { k: "from", l: "Coming from Jobber or Housecall Pro", s: "What each thing is called here", ic: "table" },
    { k: "help", l: "Help", s: "Short answers to common questions", ic: "search" },
  ];
  return <div className="k-page">
    <Head title="More" noViews />
    <div className="k-body"><div className="k-box k-list">{items.map(it => <button key={it.k} type="button" className="k-row" onClick={() => go.tab(it.k)}>
      <span className="k-head-ic" style={{ display: "grid", width: 32, height: 32, borderRadius: 8 }} aria-hidden="true"><Icon name={it.ic} size={16} /></span>
      <span className="k-row-m"><span className="k-row-t"><b>{it.l}</b></span><span className="k-row-s">{it.s}</span></span>
      <span className="k-row-r">{it.n ? <span className="k-count hot">{it.n}</span> : <Icon name="fwd" size={14} className="k-faint" />}</span></button>)}</div></div>
  </div>;
}

// ---------- Sam and settings ----------
function SamScreen({ d, project, api: call, toast, reload, go }: { d: Data; project: string; api: typeof api; toast: (t: string, bad?: boolean) => void; reload: () => Promise<void>; go: Go }) {
  const [msg, setMsg] = useState("");
  const agoText = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  return <>
    <Head title="Sam" sub="Your account rep" icon="user" />
    <div className="pad" style={{ maxWidth: 760 }}>
      <section className="card" style={{ paddingTop: 0 }}>
        {d.messages.length > 0 ? <div className="sam-msgs">{d.messages.map((m, i) => <article key={i} className="sam-msg">
          {m.author === "client" ? <Avatar name={d.owner || "You"} /> : <span className="av ink">S</span>}
          <div><header><b>{m.author === "client" ? "You" : "Sam Ward"}</b><time>{agoText(m.created_at)}</time></header><p>{m.body}</p></div></article>)}</div>
          : <p className="fine" style={{ padding: "8px 0" }}>Write Sam about anything: texting hours, prices, how leads get answered, a number to add.</p>}
        <form onSubmit={async e => { e.preventDefault(); if (!msg.trim()) return; try { await call("/api/app/act", { p: project, action: "message", body: msg }); setMsg(""); toast("Sent to Sam."); void reload(); } catch (er) { toast(er instanceof Error ? er.message : "Didn't send.", true); } }}>
          <div className="compose" style={{ position: "static", padding: 0 }}><div className="box">
            <textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message Sam" aria-label="Message to Sam" />
            <div className="tools"><button type="submit" className="btn ink sm send" disabled={!msg.trim()}>Send</button></div>
          </div></div>
        </form>
      </section>
    </div>
  </>;
}
