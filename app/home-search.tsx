"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AskAction } from "@/lib/ask";
import { ActionCard, Markdown } from "./ask-answer";
import "./home-search.css";

type Contact = { id: string; name: string; company: string; location?: string; status?: string };
type Deal = { id: string; title: string; stage: string; company?: string; contactName?: string };
type Artifact = { id: string; title: string; company?: string; contactName?: string; status?: string };
type Jump = { key: string; icon: string; title: string; sub: string; href: string };
type Turn = { id: number; query: string; status: string; answer?: string; actions?: AskAction[]; sources?: { url: string; title: string }[]; error?: string; ms?: number };

const SUGGESTIONS = [
  "Who should I call today?",
  "Pool companies in El Paso with no website",
  "What's my pipeline worth right now?",
  "What's on my calendar this week?",
  "Everyone I left a voicemail for — set follow-ups for Friday",
  "What do pool builders in Arizona usually charge?",
];
const PAGES: { title: string; href: string; words: string }[] = [
  { title: "Needs you", href: "/crm/needs-you", words: "attention queue today follow ups" },
  { title: "Contacts", href: "/crm", words: "growth people prospects leads" },
  { title: "Sales pipeline", href: "/crm/pipeline", words: "deals pipeline sales" },
  { title: "Calendar", href: "/crm/calendar", words: "meetings events schedule" },
  { title: "Business audit", href: "/crm/audit", words: "audit research" },
  { title: "Preparation", href: "/crm/preparation", words: "briefs prep audits" },
  { title: "Tasks", href: "/crm/tasks", words: "todo tasks" },
  { title: "Delivery", href: "/crm/projects", words: "projects onboarding" },
  { title: "Money", href: "/crm/finance", words: "finance revenue expenses payments" },
  { title: "Settings", href: "/crm/settings", words: "settings integrations" },
];
const initials = (v: string) => v.trim().split(/\s+/).slice(0, 2).map(x => x[0] ?? "").join("").toUpperCase() || "·";
const norm = (v: unknown) => String(v ?? "").toLowerCase();
const matches = (hay: string, terms: string[]) => terms.every(t => hay.includes(t));

function Logo() {
  return <svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" /><circle className="hs-logo-dot" cx="25.5" cy="16" r="3.1" /></svg>;
}

/** Ask Cinder: an AI search bar over the whole business (and the web). Enter asks; arrow keys can jump straight to a record. */
export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const [data, setData] = useState<{ contacts: Contact[]; deals: Deal[]; audits: Artifact[] } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const loading = useRef(false);

  useEffect(() => { setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (turns.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns]);

  async function loadRecords() {
    if (data || loading.current) return;
    loading.current = true;
    try {
      const [c, d, a] = await Promise.all(["/api/contacts", "/api/deals", "/api/research-artifacts?type=audit_prep"].map(u => fetch(u, { cache: "no-store" }).then(r => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<{ contacts?: Contact[]; deals?: Deal[]; artifacts?: Artifact[] }>));
      setData({ contacts: c.contacts ?? [], deals: d.deals ?? [], audits: (a.artifacts ?? []).filter((x: Artifact) => x.status !== "archived") });
    } finally { loading.current = false; }
  }

  // Instant "jump to" matches shown under the Ask row while typing.
  const jumps = useMemo<Jump[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !data) return [];
    const terms = q.split(/\s+/);
    const out: Jump[] = [];
    data.contacts.filter(c => matches(norm([c.company, c.name, c.location].join(" ")), terms)).slice(0, 3)
      .forEach(c => out.push({ key: "c" + c.id, icon: initials(c.company || c.name), title: c.company || c.name, sub: [c.company && c.name !== c.company ? c.name : "", c.location].filter(Boolean).join(" · ") || "Contact", href: "/crm?contact=" + c.id }));
    data.deals.filter(d => matches(norm([d.title, d.company, d.contactName].join(" ")), terms)).slice(0, 2)
      .forEach(d => out.push({ key: "d" + d.id, icon: "$", title: d.title, sub: "Deal · " + d.stage.replace(/_/g, " "), href: "/crm/pipeline?deal=" + d.id }));
    data.audits.filter(a => matches(norm([a.title, a.company].join(" ")), terms)).slice(0, 1)
      .forEach(a => out.push({ key: "a" + a.id, icon: "✦", title: a.title.replace(/^Business audit — /, ""), sub: "Saved audit", href: "/crm/preparation?artifact=" + a.id }));
    PAGES.filter(p => matches(norm(p.title + " " + p.words), terms)).slice(0, 2)
      .forEach(p => out.push({ key: "p" + p.href, icon: "→", title: p.title, sub: "Page", href: p.href }));
    return out.slice(0, 6);
  }, [query, data]);

  const thread = turns.length > 0;
  const rows = query.trim() ? 1 + jumps.length : SUGGESTIONS.length;
  useEffect(() => { setActive(0); }, [query]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    abort.current?.abort();
    const ctrl = new AbortController(); abort.current = ctrl;
    const id = Date.now();
    const history = turns.filter(t => t.answer).flatMap(t => [{ role: "user", content: t.query }, { role: "assistant", content: t.answer! }]);
    setTurns(old => [...old, { id, query: q, status: "Thinking" }]);
    setQuery(""); setBusy(true); input.current?.blur();
    const update = (patch: Partial<Turn>) => setTurns(old => old.map(t => (t.id === id ? { ...t, ...patch } : t)));
    const started = Date.now();
    try {
      const now = new Date();
      const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/ask", {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history, today, dayEnd: tomorrow.toISOString(), windowEnd: dayAfter.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, tzOffsetMinutes: now.getTimezoneOffset() }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(res.status === 401 ? "Sign in to use Ask Cinder." : data.error || "Ask Cinder is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "status") update({ status: ev.text });
          else if (ev.type === "answer") { finished = true; update({ answer: ev.text, actions: ev.actions, sources: ev.sources, ms: Date.now() - started }); }
          else if (ev.type === "error") { finished = true; update({ error: ev.error }); }
        }
      }
      if (!finished) update({ error: "The answer was cut off. Try again." });
    } catch (e) {
      if ((e as Error).name !== "AbortError") update({ error: e instanceof Error ? e.message : "Ask Cinder is unavailable right now." });
    } finally { setBusy(false); }
  }

  function choose(i: number) {
    if (!query.trim()) return void ask(SUGGESTIONS[i]);
    if (i === 0) return void ask(query);
    const j = jumps[i - 1];
    if (j) window.location.assign(j.href);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (a + 1) % rows); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => (a - 1 + rows) % rows); }
    else if (e.key === "Enter") { e.preventDefault(); if (query.trim() || !thread) choose(active); }
    else if (e.key === "Escape") { if (query) setQuery(""); else input.current?.blur(); }
  }
  function reset() { abort.current?.abort(); setTurns([]); setBusy(false); setQuery(""); input.current?.focus(); }

  const open = focused && !busy && (query.trim().length > 0 || !thread);

  return <div className={"hs-wrap" + (thread ? " has-thread" : "")}>
    <div className="hs-head">
    <div className={"hs-bar" + (focused ? " is-focused" : "") + (open ? " is-open" : "") + (busy ? " is-busy" : "")}>
      <span className="hs-logo" aria-hidden="true"><Logo /></span>
      <span className="hs-divider" aria-hidden="true" />
      <input
        ref={input}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); void loadRecords(); }}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={thread ? "Ask a follow-up…" : "Ask Cinder anything — or tell it what to do"}
        aria-label="Ask Cinder"
        autoComplete="off"
        spellCheck={false}
      />
      {busy ? <span className="hs-spinner" aria-label="Working" />
        : query ? <button type="button" className="hs-send" onMouseDown={e => e.preventDefault()} onClick={() => void ask(query)} aria-label="Ask">↵</button>
        : thread ? <button type="button" className="hs-clear" onMouseDown={e => e.preventDefault()} onClick={reset}>New</button>
        : <kbd className="hs-kbd" aria-hidden="true">{isMac ? "⌘" : "Ctrl"} K</kbd>}
    </div>

    {open && <div className="hs-panel" role="listbox">
      <div className="hs-scroll">
        {!query.trim() ? <>
          <div className="hs-section">Try asking</div>
          {SUGGESTIONS.map((s, i) => <button key={s} type="button" role="option" aria-selected={active === i} className={"hs-row hs-row-suggest" + (active === i ? " is-active" : "")}
            onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(i)}>
            <span className="hs-spark" aria-hidden="true">✦</span><span className="hs-main"><strong>{s}</strong></span>
          </button>)}
        </> : <>
          <button type="button" role="option" aria-selected={active === 0} className={"hs-row hs-row-ask" + (active === 0 ? " is-active" : "")}
            onMouseEnter={() => setActive(0)} onMouseDown={e => e.preventDefault()} onClick={() => choose(0)}>
            <span className="hs-avatar hs-avatar-ask" aria-hidden="true"><Logo /></span>
            <span className="hs-main"><strong>{query.trim()}</strong><small>Ask Cinder · searches your CRM and the web, can make changes you confirm</small></span>
            {active === 0 && <span className="hs-enter" aria-hidden="true">↵</span>}
          </button>
          {jumps.length > 0 && <div className="hs-section">Jump to</div>}
          {jumps.map((j, k) => <button key={j.key} type="button" role="option" aria-selected={active === k + 1} className={"hs-row" + (active === k + 1 ? " is-active" : "")}
            onMouseEnter={() => setActive(k + 1)} onMouseDown={e => e.preventDefault()} onClick={() => choose(k + 1)}>
            <span className={"hs-avatar" + (j.icon.length === 1 ? " hs-avatar-glyph" : "")}>{j.icon}</span>
            <span className="hs-main"><strong>{j.title}</strong><small>{j.sub}</small></span>
            {active === k + 1 && <span className="hs-enter" aria-hidden="true">↵</span>}
          </button>)}
        </>}
      </div>
      <div className="hs-foot"><span><kbd>↵</kbd> ask</span><span><kbd>↑</kbd><kbd>↓</kbd> pick</span><span><kbd>esc</kbd> {query ? "clear" : "close"}</span></div>
    </div>}
    </div>

    {thread && <div className="ask-thread">
      {turns.map(t => <article key={t.id} className="ask-turn">
        <h3 className="ask-q">{t.query}</h3>
        {!t.answer && !t.error && <div className="ask-status"><span className="ask-pulse" />{t.status}…</div>}
        {t.error && <div className="ask-error" role="alert">{t.error} <button type="button" onClick={() => void ask(t.query)}>Try again</button></div>}
        {t.answer && <>
          <Markdown text={t.answer} />
          {!!t.actions?.length && <div className="ask-actions">{t.actions.map((a, i) => <ActionCard key={i} action={a} />)}</div>}
          {!!t.sources?.length && <div className="ask-sources">{t.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title.slice(0, 60)}</a>)}</div>}
        </>}
      </article>)}
      <div ref={bottom} />
    </div>}
  </div>;
}
