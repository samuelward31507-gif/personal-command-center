"use client";

// The Cinder app for client owners. Sign in with a text code (or straight from the portal link), then:
// every lead in one inbox, reply or call back from the business number, numbers, estimates, and a line to Sam.
// Installs to the home screen like an app (manifest in /app.webmanifest).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./app.css";

type Conv = { id: string; name: string; source: string; status: string; at: string | null; last: string };
type Live = { leads: number; needs: number; answered: number; booked: number; replySec: number | null; chasing: number; chasingValue: number; won: number; wonValue: number; revived: number; reviews: number; weeks: { week: string; leads: number; booked: number }[]; conversations: Conv[] };
type Data = { project: string; business: string; number: string; canCall: boolean; businesses: { project_id: string; name: string }[]; live: Live; appointments: { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string }[]; messages: { author: string; body: string; created_at: string }[]; unreadFromSam: number };
type Text = { direction: string; author: string; body: string; at: string };
type Thread = { id: string; customer_name: string; customer_phone: string; source: string; status: string };
type Tab = "leads" | "today" | "estimates" | "sam";

const SOURCE: Record<string, string> = { missed_call: "Missed call", "web chat": "Website chat", "web form": "Web form", text: "Text", quote: "Quote follow-up", review: "Review request", rehash: "Old lead" };
const STATUS: Record<string, [string, string]> = { auto: ["Cinder's on it", "auto"], paused: ["Needs you", "needs"], booked: ["Booked", "booked"], closed: ["Done", "done"], opted_out: ["Opted out", "done"] };
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const ago = (d: string | null) => { if (!d) return ""; const m = Math.round((Date.now() - Date.parse(d)) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const clock = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayLabel = (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const initials = (s: string) => s.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "#";
const fmtPhone = (p: string) => { const d = p.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong.") as Error & { status?: number }; e.status = r.status; throw e; }
  return j as T;
}

function SignIn({ onIn }: { onIn: () => void }) {
  const [phone, setPhone] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    try {
      if (!sent) { await api("/api/app/auth", { action: "send", phone }); setSent(true); }
      else { await api("/api/app/auth", { action: "verify", phone, code }); onIn(); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  return <div className="ca-sign" role="main">
    <div className="ca-mark" aria-hidden="true">c<i /></div>
    <h1>Sign in to Cinder</h1>
    <p>{sent ? `We texted a 6-digit code to ${fmtPhone(phone)}.` : "Every lead, every conversation, every booked estimate. Enter the cell number you gave us."}</p>
    <form onSubmit={e => { e.preventDefault(); void go(); }}>
      {!sent ? <input inputMode="tel" autoComplete="tel" placeholder="(720) 555-0148" value={phone} onChange={e => setPhone(e.target.value)} aria-label="Cell number" autoFocus />
        : <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Code" autoFocus />}
      <button type="submit" disabled={busy || (!sent ? phone.replace(/\D/g, "").length < 10 : code.length !== 6)}>{busy ? "One moment…" : sent ? "Sign in" : "Text me a code"}</button>
    </form>
    {err && <p className="ca-err" role="alert">{err}</p>}
    {sent && <button type="button" className="ca-link" onClick={() => { setSent(false); setCode(""); }}>Use a different number</button>}
    <small>No code? Open the portal link Sam sent you; it signs you in too.</small>
  </div>;
}

function ThreadView({ id, project, canCall, onBack, onChange }: { id: string; project: string; canCall: boolean; onBack: () => void; onChange: () => void }) {
  const [t, setT] = useState<Thread | null>(null), [texts, setTexts] = useState<Text[]>([]);
  const [draft, setDraft] = useState(""), [busy, setBusy] = useState(""), [note, setNote] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => api<{ thread: Thread; texts: Text[] }>(`/api/app/data?p=${project}&thread=${id}`).then(j => { setT(j.thread); setTexts(j.texts); }).catch(() => {}), [id, project]);
  useEffect(() => { void load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [texts.length]);
  async function act(action: string, extra: Record<string, unknown>, done: string) {
    setBusy(action); setNote("");
    try { await api("/api/app/act", { p: project, thread: id, action, ...extra }); setNote(done); await load(); onChange(); return true; }
    catch (e) { setNote(e instanceof Error ? e.message : "That didn't work."); return false; }
    finally { setBusy(""); }
  }
  const st = STATUS[t?.status ?? "auto"] ?? STATUS.auto;
  return <section className="ca-thread">
    <div className="ca-stick">
    <header className="ca-thead">
      <button type="button" className="ca-back" onClick={onBack} aria-label="Back to leads">‹</button>
      <div><b>{t?.customer_name || (t ? fmtPhone(t.customer_phone) : "…")}</b><small>{t ? `${fmtPhone(t.customer_phone)} · ${SOURCE[t.source] ?? t.source}` : ""}</small></div>
      {canCall && <button type="button" className="ca-call" disabled={!!busy} onClick={() => void act("call", {}, "Calling your cell now. Pick up and we'll connect them from your business number.")}>Call</button>}
    </header>
    <div className="ca-state">
      <span className={"ca-pill is-" + st[1]}>{st[0]}</span>
      {t?.status === "paused" ? <button type="button" disabled={!!busy} onClick={() => void act("status", { status: "auto" }, "Cinder will handle replies again.")}>Let Cinder handle it</button>
        : t?.status === "auto" ? <button type="button" disabled={!!busy} onClick={() => void act("status", { status: "paused" }, "Cinder stepped back. You've got this one.")}>I&rsquo;ll handle it</button> : null}
      {t && t.status !== "booked" && t.status !== "opted_out" && <button type="button" disabled={!!busy} onClick={() => void act("status", { status: "booked" }, "Marked booked.")}>Mark booked</button>}
    </div>
    </div>
    <div className="ca-texts">
      {texts.map((x, i) => x.author === "system" ? <p key={i} className="ca-sys">{x.body} · {clock(x.at)}</p> :
        <div key={i} className={"ca-b " + (x.direction === "in" ? "in" : "out")}><p>{x.body}</p><small>{x.direction === "in" ? "" : x.author === "owner" ? "You · " : "Cinder · "}{clock(x.at)}</small></div>)}
      <div ref={end} />
    </div>
    {note && <p className="ca-note" role="status">{note}</p>}
    <form className="ca-compose" onSubmit={async e => { e.preventDefault(); if (await act("reply", { body: draft }, "Sent from your business number. Cinder stepped back on this one.")) setDraft(""); }}>
      <textarea rows={1} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Text from your business number" aria-label="Reply" />
      <button type="submit" disabled={!!busy || !draft.trim()} aria-label="Send">↑</button>
    </form>
  </section>;
}

export default function CinderApp() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [d, setD] = useState<Data | null>(null);
  const [project, setProject] = useState<string>("");
  const [tab, setTab] = useState<Tab>("leads");
  const [filter, setFilter] = useState<"needs" | "all" | "booked">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState(""), [msgNote, setMsgNote] = useState("");

  const load = useCallback(async (p = project, t = tab) => {
    try { const j = await api<Data>(`/api/app/data?p=${p}${t === "sam" ? "&tab=sam" : ""}`); setD(j); setProject(j.project); setState("in"); }
    catch (e) { if ((e as { status?: number }).status === 401) setState("out"); }
  }, [project, tab]);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t");
    (async () => {
      if (t) { await api("/api/app/auth", { action: "link", token: t }).catch(() => null); history.replaceState(null, "", "/app"); }
      await load("");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (state !== "in") return; const i = setInterval(() => void load(), 20000); return () => clearInterval(i); }, [state, load]);

  const convs = useMemo(() => { const all = d?.live.conversations ?? []; return filter === "needs" ? all.filter(c => c.status === "paused") : filter === "booked" ? all.filter(c => c.status === "booked") : all; }, [d, filter]);
  if (state === "loading") return <div className="ca-load" role="main"><div className="ca-mark" aria-hidden="true">c<i /></div></div>;
  if (state === "out") return <SignIn onIn={() => void load("")} />;
  if (!d) return null;
  const L = d.live;
  const maxW = Math.max(1, ...L.weeks.map(w => w.leads));

  if (open) return <div className="ca"><ThreadView id={open} project={project} canCall={d.canCall} onBack={() => { setOpen(null); void load(); }} onChange={() => void load()} /></div>;

  return <div className="ca">
    <header className="ca-top">
      <div className="ca-mark sm" aria-hidden="true">c<i /></div>
      {d.businesses.length > 1 ? <select value={project} onChange={e => { setProject(e.target.value); void load(e.target.value); }} aria-label="Business">{d.businesses.map(b => <option key={b.project_id} value={b.project_id}>{b.name}</option>)}</select>
        : <b>{d.business || d.businesses[0]?.name}</b>}
      <span className="ca-live"><i />Live</span>
    </header>

    <div className="ca-main" role="main">
      {tab === "leads" && <>
        {L.needs > 0 && <button type="button" className="ca-needs" onClick={() => setFilter("needs")}><b>{L.needs}</b> {L.needs === 1 ? "conversation needs" : "conversations need"} you</button>}
        <div className="ca-filters" role="tablist">{([["all", "All"], ["needs", "Needs you"], ["booked", "Booked"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
        {convs.length ? <ul className="ca-list">{convs.map(c => { const st = STATUS[c.status] ?? STATUS.auto; return <li key={c.id}><button type="button" onClick={() => setOpen(c.id)}>
          <span className="ca-av">{initials(c.name)}</span>
          <span className="ca-mid"><span className="ca-row1"><b>{c.name}</b><time>{ago(c.at)}</time></span><small>{SOURCE[c.source] ?? c.source}</small><em>{c.last}</em></span>
          <span className={"ca-dot is-" + st[1]} title={st[0]} />
        </button></li>; })}</ul>
          : <div className="ca-empty"><b>{filter === "all" ? "No leads yet" : "Nothing here"}</b><p>{filter === "all" ? "When someone calls, texts or fills out your form, it shows up here with Cinder's reply." : "You're all caught up."}</p></div>}
      </>}

      {tab === "today" && <>
        <h1 className="ca-h">Last 30 days</h1>
        <div className="ca-kpis">
          <div><span>Leads answered</span><b>{L.answered}<small>/{L.leads}</small></b></div>
          <div><span>Typical first reply</span><b>{L.replySec == null ? "–" : L.replySec < 60 ? <>{L.replySec}<small>s</small></> : <>{Math.round(L.replySec / 60)}<small>m</small></>}</b></div>
          <div><span>Estimates booked</span><b>{L.booked}</b></div>
          <div><span>Quotes being chased</span><b>{L.chasing}</b>{L.chasingValue > 0 && <em>{usd(L.chasingValue)} open</em>}</div>
        </div>
        {L.weeks.length > 1 && <section className="ca-card"><h2>Every week <span><i className="l" />Leads <i className="b" />Booked</span></h2>
          <div className="ca-bars">{L.weeks.map(w => <div key={w.week} title={`${w.leads} leads, ${w.booked} booked`}><i className="l" style={{ height: (w.leads / maxW) * 100 + "%" }} /><i className="b" style={{ height: (w.booked / maxW) * 100 + "%" }} /></div>)}</div></section>}
        <ul className="ca-mini">
          <li><b>{L.won}</b><span>quotes won after follow-up{L.wonValue ? `, ${usd(L.wonValue)}` : ""}</span></li>
          <li><b>{L.revived}</b><span>old leads who replied</span></li>
          <li><b>{L.reviews}</b><span>review requests sent</span></li>
        </ul>
      </>}

      {tab === "estimates" && <>
        <h1 className="ca-h">Coming up</h1>
        {d.appointments.length ? <ul className="ca-appts">{d.appointments.map(a => <li key={a.id}><button type="button" onClick={() => setOpen(a.thread_id)}>
          <span className="ca-when"><b>{clock(a.starts_at)}</b><small>{dayLabel(a.starts_at)}</small></span>
          <span className="ca-mid"><b>{a.customer_name || fmtPhone(a.customer_phone)}</b><small>Booked by Cinder · on your calendar</small></span></button></li>)}</ul>
          : <div className="ca-empty"><b>No estimates booked yet</b><p>When Cinder books one, it lands here and on your calendar.</p></div>}
      </>}

      {tab === "sam" && <>
        <h1 className="ca-h">Message Sam</h1>
        <p className="ca-sub">Changes to your texts, new hours, a question. Sam usually replies the same day.</p>
        {d.messages.length > 0 && <ol className="ca-msgs">{d.messages.map((m, i) => <li key={i} className={m.author === "client" ? "me" : "them"}><p>{m.body}</p><small>{m.author === "client" ? "You" : "Sam"} · {ago(m.created_at)}</small></li>)}</ol>}
        <form className="ca-compose static" onSubmit={async e => { e.preventDefault(); try { await api("/api/app/act", { p: project, action: "message", body: msg }); setMsg(""); setMsgNote("Sent."); void load(project, "sam"); } catch (er) { setMsgNote(er instanceof Error ? er.message : "Didn't send."); } }}>
          <textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write to Sam" aria-label="Message to Sam" />
          <button type="submit" disabled={!msg.trim()} aria-label="Send">↑</button>
        </form>
        {msgNote && <p className="ca-note">{msgNote}</p>}
        <button type="button" className="ca-link out" onClick={async () => { await api("/api/app/auth", { action: "logout" }).catch(() => null); setState("out"); }}>Sign out</button>
      </>}
    </div>

    <nav className="ca-nav" aria-label="Sections">
      {([["leads", "Leads", L.needs], ["today", "Numbers", 0], ["estimates", "Estimates", d.appointments.length], ["sam", "Sam", d.unreadFromSam]] as const).map(([k, l, n]) =>
        <button key={k} type="button" aria-current={tab === k ? "page" : undefined} className={tab === k ? "on" : ""} onClick={() => { setTab(k); if (k === "sam") void load(project, "sam"); }}>
          <i className={"ic ic-" + k} aria-hidden="true" />{l}{n ? <em>{n}</em> : null}</button>)}
    </nav>
  </div>;
}
