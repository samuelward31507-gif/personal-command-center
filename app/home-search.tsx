"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./home-search.css";

type Contact = { id: string; name: string; company: string; location?: string; email?: string; phone?: string; status?: string };

const initials = (v: string) => v.trim().split(/\s+/).slice(0, 2).map(x => x[0] ?? "").join("").toUpperCase() || "·";
const norm = (v: unknown) => String(v ?? "").toLowerCase();

/** Live contact search for Home: results as you type, ↑/↓/Enter, Esc, and ⌘K / Ctrl+K to focus. */
export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => { setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function load() {
    if (contacts || error) return;
    try {
      const r = await fetch("/api/contacts", { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to search your workspace." : data.error || "Search is unavailable right now.");
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Search is unavailable right now."); }
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !contacts) return [];
    const terms = q.split(/\s+/);
    return contacts
      .map(c => {
        const hay = [c.name, c.company, c.location, c.email, c.phone].map(norm).join(" ");
        if (!terms.every(t => hay.includes(t))) return null;
        const score = (norm(c.company).startsWith(q) || norm(c.name).startsWith(q) ? 0 : 1);
        return { c, score };
      })
      .filter((x): x is { c: Contact; score: number } => x !== null)
      .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
      .slice(0, 7)
      .map(x => x.c);
  }, [query, contacts]);

  useEffect(() => { setActive(0); }, [query]);

  const openContact = (c: Contact) => window.location.assign("/crm?contact=" + encodeURIComponent(c.id) + "&q=" + encodeURIComponent(c.company || c.name));
  const openAll = () => { const q = query.trim(); if (q) window.location.assign("/crm?q=" + encodeURIComponent(q)); };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = results.length + (query.trim() ? 1 : 0); // last row = "see all"
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (total ? (a + 1) % total : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => (total ? (a - 1 + total) % total : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (active < results.length) openContact(results[active]); else openAll(); }
    else if (e.key === "Escape") { setQuery(""); input.current?.blur(); }
  }

  const open = focused && query.trim().length > 0;

  return <div className="hs-wrap">
    <div className={"hs-bar" + (focused ? " is-focused" : "") + (open ? " is-open" : "")} role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-owns="hs-results">
      <svg className="hs-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        ref={input}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); void load(); }}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Search contacts, companies, cities…"
        aria-label="Search your workspace"
        aria-autocomplete="list"
        aria-controls="hs-results"
        aria-activedescendant={open ? "hs-opt-" + active : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {query
        ? <button type="button" className="hs-clear" onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search">esc</button>
        : <kbd className="hs-kbd" aria-hidden="true">{isMac ? "⌘" : "Ctrl"} K</kbd>}
    </div>

    {open && <div className="hs-panel" id="hs-results" role="listbox">
      {error ? <div className="hs-empty">{error}</div>
        : !contacts ? <div className="hs-empty">Searching…</div>
        : results.length === 0 ? <div className="hs-empty">No contacts match “{query.trim()}”.</div>
        : <div className="hs-section">Contacts</div>}
      {results.map((c, i) => <button key={c.id} id={"hs-opt-" + i} type="button" role="option" aria-selected={active === i}
        className={"hs-row" + (active === i ? " is-active" : "")} onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => openContact(c)}>
        <span className="hs-avatar">{initials(c.company || c.name)}</span>
        <span className="hs-main"><strong>{c.company || c.name}</strong><small>{[c.company && c.name !== c.company ? c.name : "", c.location].filter(Boolean).join(" · ") || c.email || c.phone || "Contact"}</small></span>
        {c.status && <span className="hs-tag">{c.status}</span>}
      </button>)}
      {contacts && !error && <button id={"hs-opt-" + results.length} type="button" role="option" aria-selected={active === results.length}
        className={"hs-row hs-all" + (active === results.length ? " is-active" : "")} onMouseEnter={() => setActive(results.length)} onMouseDown={e => e.preventDefault()} onClick={openAll}>
        <span className="hs-avatar hs-avatar-ghost">↗</span>
        <span className="hs-main"><strong>See all results for “{query.trim()}”</strong><small>Open Contacts filtered</small></span>
      </button>}
      <div className="hs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> clear</span></div>
    </div>}
  </div>;
}
