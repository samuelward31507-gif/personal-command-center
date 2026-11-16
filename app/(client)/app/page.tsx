"use client";

// The Cinder app for client owners. Sign in with a text code (or straight from the portal link), then one shell:
// a rail on a desk, a tab bar on a phone, the same screens on both. Home, Inbox, Jobs, Calendar, Money, Settings.
// ⌘K finds anyone. Installs to the home screen like an app (/app.webmanifest).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./app.css";
import { Wordmark } from "../brand";
import { QuotesScreen, QuoteEditor } from "./quotes";
import { demoApi } from "./demo";
import { Avatar, Icon, Spinner, fmtPhone, initials, typePhone, useToast } from "./parts";
import type { Biz, Data, Go, Tab } from "./types";
import { splitAppointments } from "@/lib/client-schedule";
import { TodayScreen } from "./today";
import { JobsScreen, type JobsView } from "./jobs";
import { PlansScreen } from "./plans";
import { CatalogContext, PriceListSheet, catalogFrom } from "./catalog";
import { RecordPage } from "./record";
import { InboxScreen, ThreadView } from "./inbox";
import { CalendarScreen } from "./calendar";
import { MyDay } from "./crew";
import { MoneyScreen, InvoiceSheet, BillingSettings } from "./money";
import { ReportsScreen } from "./numbers";
import { SystemScreen } from "./system";
import { Onboarding } from "./setup";
import { AddLeadSheet, ImportSheet, WinbackSheet } from "./sheets";
import { CommandBar } from "./command";

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
const MORE: Tab[] = ["customers", "invoices", "numbers", "system", "sam"];
const SECTIONS: { k: Tab; l: string; ic: string; n: string }[] = [{ k: "today", l: "Home", ic: "home", n: "1" }, { k: "inbox", l: "Inbox", ic: "chat", n: "2" }, { k: "jobs", l: "Jobs", ic: "jobs", n: "3" }, { k: "quotes", l: "Quotes", ic: "quote", n: "4" }, { k: "calendar", l: "Calendar", ic: "cal", n: "5" }, { k: "invoices", l: "Money", ic: "invoice", n: "5" }, { k: "numbers", l: "Reports", ic: "bars", n: "6" }];

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
  const [push, setPush] = useState<PushState>("unsupported");
  const [demo, setDemo] = useState(false);
  const [sheet, setSheet] = useState<"add" | "import" | "billing" | "winback" | "cmd" | "pricelist" | null>(null);
  const [askQ, setAskQ] = useState<{ q: string; n: number } | undefined>(undefined);
  const [inv, setInv] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false), [setupDone, setSetupDone] = useState(false);
  const exitDemo = () => { demoStop(); setDemo(false); setD(null); setOpen(null); setProject(""); setState("out"); };

  useEffect(() => {
    setPush(pushState());
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app-sw.js", { scope: "/app" }).catch(() => {});
  }, []);
  async function enablePush() { const err = await turnOnPush(project); setPush(pushState()); toast(err ?? "Notifications are on.", !!err); }

  const load = useCallback(async (p = project, t = tab) => {
    try { const j = await api<Data>(`/api/app/data?p=${p}${t === "sam" ? "&tab=sam" : t === "calendar" ? "&tab=cal" : ""}`); setD(j); setProject(j.project); setState("in"); }
    catch (e) { if ((e as { status?: number }).status === 401) setState("out"); }
  }, [project, tab]);

  useEffect(() => {
    const q = new URLSearchParams(location.search), t = q.get("t");
    (async () => {
      let wasDemo = false; try { wasDemo = sessionStorage.getItem(DEMO_KEY) === "1"; } catch { /* private mode */ }
      if (q.get("demo")) { try { if (q.get("demo") === "empty") sessionStorage.setItem("cinder-demo-empty", "1"); else sessionStorage.removeItem("cinder-demo-empty"); if (q.get("demo") === "crew") sessionStorage.setItem("cinder-demo-crew", "1"); else sessionStorage.removeItem("cinder-demo-crew"); } catch { /* private mode */ } }
      if (q.get("demo") === "1" || q.get("demo") === "empty" || (wasDemo && !t)) { demoStart(); setDemo(true); } else if (t) demoStop();
      if (t) await api("/api/app/auth", { action: "link", token: t }).catch(() => null);
      const th = q.get("thread"), tb = q.get("tab");
      if (th && /^[0-9a-f-]{36}$/i.test(th)) setOpen({ kind: "thread", id: th });
      const map: Record<string, Tab> = { sam: "sam", estimates: "calendar", calendar: "calendar", numbers: "numbers", jobs: "jobs", leads: "inbox", inbox: "inbox", today: "today", home: "today", invoices: "invoices", money: "invoices", customers: "customers", system: "system", quotes: "quotes", plans: "plans" };
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
      if ((e.metaKey || e.ctrlKey) && /^[1-7]$/.test(e.key)) { e.preventDefault(); const t = ([...SECTIONS.map(s => s.k), "system"] as Tab[])[Number(e.key) - 1]; if (t) goTab(t); return; }
      const el = e.target as HTMLElement | null;
      if (e.key === "Escape" && open && !sheet && !inv && !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"))) setOpen(null);
    };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, [goTab, open, sheet, inv]);

  // The workspace scrolls inside its window: every move starts at the top.
  useEffect(() => { document.querySelector(".main > .page")?.scrollTo(0, 0); }, [tab, open]);
  const due = useMemo(() => splitAppointments(d?.appointments ?? []).due, [d]);
  if (state === "loading") return <div className="load"><Wordmark /></div>;
  if (state === "out") return <SignIn onIn={() => void load("")} onDemo={() => { demoStart(); setDemo(true); setTab("today"); void load("", "today"); }} />;
  if (!d) return null;

  const L = d.live;
  const bizName = d.business || d.businesses.find(b => b.project_id === project)?.name || "";
  const biz: Biz = { crew: d.role === "crew", reviewLink: d.setup?.has_review_link === "yes" || !!d.hasReviewLink, number: d.setup?.has_number === "yes" || !!d.number, owner: d.owner, business: bizName,
    priceBook: d.setup?.price_book || "", taxRate: d.setup?.tax_rate || "", payLink: !!d.setup?.pay_link, calendar: d.setup?.has_calendar === "yes" || !!d.calendar?.connected, trade: d.setup?.trade || "", canCall: d.canCall };
  const owed = (d.invoices ?? []).filter(i => i.status === "sent").length;
  const crew = d.role === "crew";
  const sections = crew ? SECTIONS.filter(s => s.k === "inbox" || s.k === "jobs" || s.k === "calendar") : SECTIONS;
  const signOut = async () => { if (demo) return exitDemo(); await api("/api/app/auth", { action: "logout" }).catch(() => null); setState("out"); };
  const reload = () => load(project, tab);
  const invNow = inv ? ((d.invoices ?? []).find(i => i.id === inv) ?? null) : null;
  const cards = d.board ?? [];
  const jobCounts = { open: cards.filter(c => c.stage === "new" || c.stage === "booked" || c.stage === "quoted").length, won: (d.customers ?? []).filter(c => c.stage === "won" || c.jobs > 0).length, all: d.customers?.length ?? cards.length };

  if ((setupOpen || (!demo && !setupDone && d.setup && !d.setup.onboarded_at)) && !open) return <Onboarding project={project} initial={d.setup ?? {}} api={api}
    onDone={() => setSetupDone(true)} onClose={() => { setSetupOpen(false); setSetupDone(true); setTab("jobs"); window.scrollTo(0, 0); void load(project, "jobs"); }} />;

  const counts: Partial<Record<Tab, number>> = { inbox: L.needs, calendar: due.length, invoices: owed };
  const phoneTabs: { k: Tab; l: string; ic: string; n?: number }[] = crew ? [{ k: "inbox", l: "Inbox", ic: "chat", n: L.needs }, { k: "jobs", l: "Jobs", ic: "jobs" }, { k: "calendar", l: "Calendar", ic: "cal", n: due.length }]
    : [{ k: "today", l: "Home", ic: "home" }, { k: "inbox", l: "Inbox", ic: "chat", n: L.needs }, { k: "jobs", l: "Jobs", ic: "jobs" }, { k: "calendar", l: "Calendar", ic: "cal", n: due.length }, { k: "more", l: "More", ic: "more", n: d.unreadFromSam }];
  const phoneTab: Tab = MORE.includes(tab) ? "more" : tab;
  const active = (k: Tab) => (tab === k || (k === "jobs" && (tab === "customers" || tab === "plans"))) && !open;

  let page: React.ReactNode;
  if (open?.kind === "thread") page = <ThreadView id={open.id} project={project} canCall={d.canCall} api={api} toast={toast} onBack={() => { setOpen(null); void reload(); }} onChange={() => void reload()} onRecord={() => setOpen({ kind: "record", id: open.id })} />;
  else if (open?.kind === "quote") page = <QuoteEditor key={open.id} id={open.id} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onBack={() => setOpen(null)} />;
  else if (open?.kind === "record") page = <RecordPage key={open.id + (open.draft ? ":d" : "")} id={open.id} ask={open.ask} view={open.view} draft={open.draft} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onBack={() => { setOpen(null); void reload(); }} />;
  else if (tab === "today" && crew) page = <MyDay d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} />;
  else if (tab === "today") page = <TodayScreen d={d} biz={biz} go={go} wide={wide} api={api} project={project} ask={askQ} />;
  else if (tab === "inbox") page = <InboxScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} wide={wide} push={push} onPush={() => void enablePush()} />;
  else if (tab === "jobs" || tab === "customers") page = <JobsScreen d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} wide={wide} view={tab === "customers" ? "all" : jobsView} setView={v => { setJobsView(v); setTab("jobs"); }} onWinback={() => setSheet("winback")} />;
  else if (tab === "plans") page = <PlansScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} />;
  else if (tab === "quotes") page = <QuotesScreen d={d} go={go} wide={wide} biz={biz} />;
  else if (tab === "calendar") page = <CalendarScreen d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} wide={wide} />;
  else if (tab === "invoices") page = <MoneyScreen d={d} go={go} wide={wide} biz={biz} project={project} api={api} toast={toast} reload={reload} />;
  else if (tab === "numbers") page = <ReportsScreen d={d} biz={biz} go={go} project={project} api={api} toast={toast} reload={reload} onWinback={() => setSheet("winback")} />;
  else if (tab === "system") page = <SystemScreen d={d} biz={biz} go={go} push={push} onPush={() => void enablePush()} toast={toast} api={api} project={project} reload={reload} demo={demo} onSignOut={signOut} />;
  else if (tab === "more") page = <MoreScreen d={d} go={go} owed={owed} />;
  else page = <SamScreen d={d} project={project} api={api} toast={toast} reload={reload} go={go} />;

  const catalog = { items: catalogFrom(d.setup), edit: () => setSheet("pricelist") };
  return <CatalogContext.Provider value={catalog}><div className="shell">
    <nav className="rail" aria-label="Sections">
      <div className="brand-row"><Wordmark className="rail-mark" /></div>
      <button type="button" className="ws" title={bizName}>
        <span className="av sm">{initials(bizName || "C").charAt(0)}</span><b>{bizName || "Your business"}</b>{d.businesses.length > 1 && <Icon name="updown" size={13} />}
        {d.businesses.length > 1 && <select value={project} aria-label="Business" onChange={e => { setProject(e.target.value); void load(e.target.value); }}>{d.businesses.map(b => <option key={b.project_id} value={b.project_id}>{b.name}</option>)}</select>}
      </button>
      <button type="button" className="rail-search" onClick={() => setSheet("cmd")}><Icon name="search" size={14} />Search<kbd>⌘K</kbd></button>
      <div className="rail-grp">
        {sections.map(s => <button key={s.k} type="button" className={"ri" + (active(s.k) ? " on" : "")} aria-current={active(s.k) ? "page" : undefined} onClick={() => goTab(s.k)}>
          <Icon name={s.ic} size={15} />{s.l}{counts[s.k] ? <em className={s.k === "inbox" ? "hot" : ""}>{counts[s.k]}</em> : null}</button>)}
      </div>
      {(tab === "jobs" || tab === "plans") && !open && <div className="rail-grp views">
        <div className="rail-lbl">Views</div>
        {([["open", "Open", jobCounts.open], ["won", "Won", jobCounts.won], ["all", "Everyone", jobCounts.all]] as const).map(([k, l, n]) =>
          <button key={k} type="button" className={"ri" + (tab === "jobs" && jobsView === k ? " on" : "")} onClick={() => { setJobsView(k); setOpen(null); if (tab !== "jobs") goTab("jobs"); }}>{l}<em>{n}</em></button>)}
        {!crew && <button type="button" className={"ri" + (tab === "plans" ? " on" : "")} onClick={() => goTab("plans")}>Service plans<em>{(d.plans ?? []).filter(p => p.status === "active").length || ""}</em></button>}
      </div>}
      <div className="rail-foot">
        {d.role !== "crew" && d.role !== "office" && <button type="button" className={"ri" + (active("system") || active("sam") ? " on" : "")} onClick={() => goTab("system")}><Icon name="gear" size={15} />Settings{d.unreadFromSam ? <em className="hot">{d.unreadFromSam}</em> : null}</button>}
        {crew ? <button type="button" className="me" onClick={() => void signOut()}><Avatar name="Crew" /><span className="t"><b>Crew</b><small>Sign out</small></span></button>
          : <button type="button" className="me" onClick={() => goTab("sam")}><Avatar name={d.owner || bizName || "Me"} /><span className="t"><b>{d.owner || "You"}</b><small>Owner</small></span></button>}
      </div>
    </nav>
    <div className="main">
      {demo && <div className="demo"><span>Example business, sample data</span><button type="button" onClick={exitDemo}>Exit</button></div>}
      <div className={"page" + (open ? " has-open" : "")} role="main">{page}</div>
    </div>
    <nav className="tabs" aria-label="Sections">
      {phoneTabs.map(t => <button key={t.k} type="button" className={phoneTab === t.k && !open ? "on" : ""} aria-current={phoneTab === t.k && !open ? "page" : undefined} onClick={() => goTab(t.k)}>
        <Icon name={t.ic} size={21} />{t.l}{t.n ? <em>{t.n}</em> : null}</button>)}
    </nav>
    {sheet === "cmd" && <CommandBar d={d} go={go} onClose={() => setSheet(null)} onWinback={() => setSheet("winback")} onAsk={crew ? undefined : q => { setAskQ({ q, n: Date.now() }); goTab("today"); }} />}
    {sheet === "add" && <AddLeadSheet trade={biz.trade} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {sheet === "import" && <ImportSheet project={project} api={api} toast={toast} reload={reload} customers={d.customers ?? []} business={bizName} onClose={() => setSheet(null)} />}
    {sheet === "pricelist" && <PriceListSheet items={catalog.items} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {sheet === "billing" && <BillingSettings setup={d.setup ?? {}} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {sheet === "winback" && d.winback && <WinbackSheet w={d.winback} biz={biz} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
    {invNow && <InvoiceSheet key={invNow.id + invNow.status + (invNow.paid_amount ?? 0)} inv={invNow} payments={d.payments} customer={invNow.customer || fmtPhone(invNow.phone)} email={(d.board ?? []).find(b => b.id === invNow.thread_id)?.email} emailReady={d.emailReady} project={project} api={api} toast={toast} reload={reload} payLink={biz.payLink} onClose={() => setInv(null)} onSetup={() => { setInv(null); setSheet("billing"); }} />}
    {toastNode}
  </div></CatalogContext.Provider>;
}

// ---------- More (phone) ----------
function MoreScreen({ d, go, owed }: { d: Data; go: Go; owed: number }) {
  const items: { k: Tab; l: string; s: string; ic: string; n?: number }[] = [
    { k: "invoices", l: "Money", s: owed ? `${owed} outstanding` : "All paid up", ic: "invoice", n: owed },
    { k: "numbers", l: "Reports", s: "What Cinder brought in", ic: "bars" },
    { k: "customers", l: "Everyone", s: `${d.customers?.length ?? 0} people`, ic: "users" },
    { k: "plans", l: "Service plans", s: (d.plans ?? []).some(p => p.status === "active") ? `${(d.plans ?? []).filter(p => p.status === "active").length} active` : "Repeat work on a schedule", ic: "cal" },
    { k: "system", l: "Settings", s: "How leads reach Cinder, prices, notifications", ic: "gear" },
    { k: "sam", l: "Sam", s: d.unreadFromSam ? `${d.unreadFromSam} new` : "Your Cinder rep", ic: "user", n: d.unreadFromSam },
  ];
  return <>
    <header className="tb"><h1 className="h1">More</h1></header>
    <div className="pad">{items.map(it => <button key={it.k} type="button" className="row tall" style={{ gridTemplateColumns: "16px minmax(0,1fr) auto" }} onClick={() => go.tab(it.k)}>
      <span className="ic"><Icon name={it.ic} size={15} /></span><span><b>{it.l}</b><small>{it.s}</small></span>{it.n ? <span className="tag count">{it.n}</span> : <Icon name="fwd" size={14} className="faint" />}</button>)}</div>
  </>;
}

// ---------- Sam and settings ----------
function SamScreen({ d, project, api: call, toast, reload, go }: { d: Data; project: string; api: typeof api; toast: (t: string, bad?: boolean) => void; reload: () => Promise<void>; go: Go }) {
  const [msg, setMsg] = useState("");
  const agoText = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  return <>
    <header className="tb"><h1 className="h1">Sam</h1><span className="sub">Your Cinder rep</span><div className="acts"><button type="button" className="btn ghost" onClick={() => go.tab("system")}><Icon name="gear" size={14} />Settings</button></div></header>
    <div className="pad" style={{ maxWidth: 760 }}>
      <section className="card" style={{ paddingTop: 0 }}>
        {d.messages.length > 0 ? <div className="sam-msgs">{d.messages.map((m, i) => <article key={i} className="sam-msg">
          {m.author === "client" ? <Avatar name={d.owner || "You"} /> : <span className="av ink">S</span>}
          <div><header><b>{m.author === "client" ? "You" : "Sam Ward"}</b><time>{agoText(m.created_at)}</time></header><p>{m.body}</p></div></article>)}</div>
          : <p className="fine" style={{ padding: "8px 0" }}>Write Sam about anything: texting hours, prices, how Cinder answers a question, a number to add.</p>}
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
