"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./home-search.css";

type Contact = { id: string; name: string; company: string; location?: string; email?: string; phone?: string; status?: string };
type Deal = { id: string; title: string; stage: string; company?: string; contactName?: string; setupFee?: number; monthlyFee?: number };
type Artifact = { id: string; title: string; type: string; company?: string; contactName?: string; contactId?: string | null; createdAt?: string };
type Item = { key: string; group: string; icon: string; title: string; sub: string; tag?: string; href: string };

const initials = (v: string) => v.trim().split(/\s+/).slice(0, 2).map(x => x[0] ?? "").join("").toUpperCase() || "·";
const norm = (v: unknown) => String(v ?? "").toLowerCase();
const money = (n?: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const STAGE: Record<string, string> = { new: "New", contacted: "Contacted", meeting_booked: "Meeting booked", meeting_held: "Meeting held", proposal: "Proposal", won: "Won", lost: "Lost", nurture: "Nurture" };

const PAGES: { title: string; href: string; words: string }[] = [
  { title: "My day", href: "/?view=schedule", words: "today queue schedule plan" },
  { title: "Needs you", href: "/crm/needs-you", words: "attention follow ups queue" },
  { title: "Contacts", href: "/crm", words: "growth people prospects leads" },
  { title: "Sales pipeline", href: "/crm/pipeline", words: "deals pipeline sales" },
  { title: "Outreach", href: "/crm/outreach", words: "sequence calls prospecting" },
  { title: "Calendar", href: "/crm/calendar", words: "meetings events schedule" },
  { title: "Preparation", href: "/crm/preparation", words: "briefs research audits prep" },
  { title: "Business audit", href: "/crm/audit", words: "audit research" },
  { title: "Tasks", href: "/crm/tasks", words: "todo tasks" },
  { title: "Delivery", href: "/crm/projects", words: "projects onboarding clients" },
  { title: "Client success", href: "/crm/client-success", words: "support renewals health" },
  { title: "Money", href: "/crm/finance", words: "finance revenue expenses mrr cash payments" },
  { title: "Intelligence", href: "/crm/intelligence", words: "insights market signals" },
  { title: "Strategy", href: "/crm/strategy", words: "goals strategy plan offers" },
  { title: "AI team", href: "/crm/workforce", words: "hermes agents ai" },
  { title: "Settings", href: "/crm/settings", words: "settings cal.ai integrations" },
];
const ACTIONS: { title: string; sub: string; href: string; words: string }[] = [
  { title: "New contact", sub: "Add a prospect or client", href: "/crm?new=1", words: "new add contact prospect lead" },
  { title: "New deal", sub: "Start an opportunity in the pipeline", href: "/crm/pipeline?new=1", words: "new add deal opportunity" },
  { title: "Run a business audit", sub: "Research a company before you call", href: "/crm/audit", words: "audit research run" },
  { title: "Record a payment or expense", sub: "Open Money", href: "/crm/finance", words: "record payment expense log money" },
];

function score(hay: string, q: string, terms: string[]) {
  if (!terms.every(t => hay.includes(t))) return -1;
  return hay.startsWith(q) ? 3 : hay.includes(" " + q) ? 2 : 1;
}

/** Home command bar: search contacts, deals, audits and pages, and run actions. ⌘K / Ctrl+K focuses it. */
export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ contacts: Contact[]; deals: Deal[]; audits: Artifact[] } | null>(null);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function load() {
    if (data || error) return;
    try {
      const [c, d, a] = await Promise.all(["/api/contacts", "/api/deals", "/api/research-artifacts?type=audit_prep"].map(u => fetch(u, { cache: "no-store" })));
      if ([c, d, a].some(r => r.status === 401)) throw new Error("Sign in to search your workspace.");
      const [cj, dj, aj] = await Promise.all([c, d, a].map(r => r.json().catch(() => ({}))));
      setData({
        contacts: Array.isArray(cj.contacts) ? cj.contacts : [],
        deals: Array.isArray(dj.deals) ? dj.deals : [],
        audits: Array.isArray(aj.artifacts) ? aj.artifacts.filter((x: { status?: string }) => x.status !== "archived") : [],
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Search is unavailable right now."); }
  }

  const items = useMemo<Item[]>(() => {
    const raw = query.trim().toLowerCase();
    // "audit horizon" → audit action for the best matching contact
    const auditVerb = /^(audit|research)\s+(.+)/.exec(raw);
    const q = auditVerb ? auditVerb[2] : raw;
    const terms = q.split(/\s+/).filter(Boolean);
    const out: Item[] = [];

    if (!raw) {
      ACTIONS.forEach(a => out.push({ key: "act:" + a.href, group: "Quick actions", icon: "+", title: a.title, sub: a.sub, href: a.href }));
      PAGES.slice(0, 4).forEach(p => out.push({ key: "page:" + p.href, group: "Jump to", icon: "→", title: p.title, sub: "Page", href: p.href }));
      return out;
    }

    const contacts = (data?.contacts ?? [])
      .map(c => ({ c, s: score([c.company, c.name, c.location, c.email, c.phone].map(norm).join(" "), q, terms) }))
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name));

    if (auditVerb && contacts[0]) {
      const c = contacts[0].c;
      out.push({ key: "audit:" + c.id, group: "Actions", icon: "✦", title: `Run a business audit on ${c.company || c.name}`, sub: [c.location, "Opens the audit with this contact filled in"].filter(Boolean).join(" · "), href: "/crm/audit?contact=" + encodeURIComponent(c.id) });
    }
    ACTIONS.filter(a => score(a.words + " " + norm(a.title), q, terms) > 0).slice(0, 2)
      .forEach(a => out.push({ key: "act:" + a.href, group: "Actions", icon: "+", title: a.title, sub: a.sub, href: a.href }));

    contacts.slice(0, auditVerb ? 3 : 5).forEach(({ c }) => out.push({
      key: "c:" + c.id, group: "Contacts", icon: initials(c.company || c.name), title: c.company || c.name,
      sub: [c.company && c.name !== c.company ? c.name : "", c.location].filter(Boolean).join(" · ") || c.email || c.phone || "Contact",
      tag: c.status, href: "/crm?contact=" + encodeURIComponent(c.id) + "&q=" + encodeURIComponent(c.company || c.name),
    }));

    (data?.deals ?? []).map(d => ({ d, s: score([d.title, d.company, d.contactName].map(norm).join(" "), q, terms) }))
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3)
      .forEach(({ d }) => out.push({ key: "d:" + d.id, group: "Deals", icon: "$", title: d.title, sub: `${money(d.setupFee)} setup + ${money(d.monthlyFee)}/mo`, tag: STAGE[d.stage] ?? d.stage, href: "/crm/pipeline" }));

    (data?.audits ?? []).map(a => ({ a, s: score([a.title, a.company, a.contactName].map(norm).join(" "), q, terms) }))
      .filter(x => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 3)
      .forEach(({ a }) => out.push({ key: "a:" + a.id, group: "Audits", icon: "✦", title: a.title.replace(/^Business audit — /, ""), sub: "Saved business audit" + (a.createdAt ? " · " + String(a.createdAt).slice(0, 10) : ""), href: "/crm/preparation" }));

    PAGES.filter(p => score(norm(p.title) + " " + p.words, q, terms) > 0).slice(0, 3)
      .forEach(p => out.push({ key: "page:" + p.href, group: "Pages", icon: "→", title: p.title, sub: "Page", href: p.href }));

    if (contacts.length > 5) out.push({ key: "all", group: "Contacts", icon: "↗", title: `See all ${contacts.length} contacts matching “${q}”`, sub: "Open Contacts filtered", href: "/crm?q=" + encodeURIComponent(q) });
    return out;
  }, [query, data]);

  useEffect(() => { setActive(0); }, [query]);
  const go = (it: Item) => window.location.assign(it.href);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (items.length ? (a + 1) % items.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => (items.length ? (a - 1 + items.length) % items.length : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active]) go(items[active]); else if (query.trim()) window.location.assign("/crm?q=" + encodeURIComponent(query.trim())); }
    else if (e.key === "Escape") { if (query) setQuery(""); else input.current?.blur(); }
  }

  const open = focused;
  const loadingResults = query.trim() && !data && !error;
  let lastGroup = "";

  return <div className="hs-wrap">
    <div className={"hs-bar" + (focused ? " is-focused" : "") + (open ? " is-open" : "")} role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-owns="hs-results">
      <span className="hs-logo" aria-hidden="true">
        <svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" /><circle className="hs-logo-dot" cx="25.5" cy="16" r="3.1" /></svg>
      </span>
      <span className="hs-divider" aria-hidden="true" />
      <input
        ref={input}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); void load(); }}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Search contacts, deals, audits — or type “audit” + a company"
        aria-label="Search your workspace"
        aria-autocomplete="list"
        aria-controls="hs-results"
        aria-activedescendant={open && items[active] ? "hs-opt-" + active : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {query
        ? <button type="button" className="hs-clear" onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search">esc</button>
        : <kbd className="hs-kbd" aria-hidden="true">{isMac ? "⌘" : "Ctrl"} K</kbd>}
    </div>

    {open && <div className="hs-panel" id="hs-results" role="listbox">
      {error && <div className="hs-empty">{error}</div>}
      {!error && loadingResults && <div className="hs-empty">Searching…</div>}
      {!error && !loadingResults && query.trim() && items.length === 0 && <div className="hs-empty">Nothing matches “{query.trim()}”. Try a company, a city, or “audit” + a name.</div>}
      <div className="hs-scroll">
        {items.map((it, i) => {
          const header = it.group !== lastGroup ? <div className="hs-section" key={"h:" + it.group}>{it.group}</div> : null;
          lastGroup = it.group;
          return <div key={it.key}>{header}
            <button id={"hs-opt-" + i} type="button" role="option" aria-selected={active === i}
              className={"hs-row" + (active === i ? " is-active" : "")} onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => go(it)}>
              <span className={"hs-avatar" + (it.icon.length === 1 ? " hs-avatar-glyph" : "")}>{it.icon}</span>
              <span className="hs-main"><strong>{it.title}</strong><small>{it.sub}</small></span>
              {it.tag && <span className="hs-tag">{it.tag}</span>}
              {active === i && <span className="hs-enter" aria-hidden="true">↵</span>}
            </button>
          </div>;
        })}
      </div>
      <div className="hs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> {query ? "clear" : "close"}</span></div>
    </div>}
  </div>;
}
