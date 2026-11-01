"use client";
import "./command-bar.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { matches } from "@/lib/crm-ux";

type Item = { id: string; label: string; hint: string; href: string; group: "Go to" | "Do" | "Contacts" | "Deals"; keywords?: string };

const PAGES: Item[] = [
  ["Today", "/crm/needs-you", "my day queue"], ["Call mode", "/crm/call", "dial phone"], ["Calendar", "/crm/calendar", "meetings schedule"],
  ["Contacts", "/crm", "leads people"], ["Pipeline", "/crm/pipeline", "deals board"], ["Research", "/crm/preparation", "preparation audits briefs"],
  ["Tasks", "/crm/tasks", "todo"], ["Delivery", "/crm/projects", "projects onboarding playbook"], ["Clients", "/crm/client-success", "health renewals"],
  ["Monthly reports", "/crm/reports", "client report results"], ["Money", "/crm/finance", "revenue payments invoices"], ["Scoreboard", "/crm/scoreboard", "goal calls stats"], ["Operations", "/crm/operations", "deadlines compliance taxes playbook registration a2p"],
  ["Business audit", "/crm/audit", "research prospect audit"], ["AI team", "/crm/workforce", "agents"], ["Intelligence", "/crm/intelligence", "signals problems"],
  ["Strategy & memory", "/crm/strategy", "offer icp goals"], ["Settings", "/crm/settings", "business offers prices payment links goal"], ["Automations", "/crm/settings#automations", "lead form overnight audits sunday review"],
].map(([label, href, keywords]) => ({ id: "p:" + href, label, hint: "Page", href, group: "Go to" as const, keywords }));

const ACTIONS: Item[] = [
  { id: "a:contact", label: "Add a contact", hint: "New lead", href: "/crm?new=1", group: "Do", keywords: "new create lead person" },
  { id: "a:deal", label: "Add a deal", hint: "New opportunity", href: "/crm/pipeline?new=1", group: "Do", keywords: "new create opportunity" },
  { id: "a:call", label: "Start calling", hint: "Call mode", href: "/crm/call", group: "Do", keywords: "dial phone" },
  { id: "a:audit", label: "Audit a business", hint: "Research before you call", href: "/crm/audit", group: "Do", keywords: "research" },
  { id: "a:report", label: "Write a monthly report", hint: "Clients", href: "/crm/reports", group: "Do", keywords: "client results" },
  { id: "a:ask", label: "Ask Cinder", hint: "Chat about your business", href: "/", group: "Do", keywords: "chat question ai" },
];

/** ⌘K / Ctrl+K: jump to any page, contact or deal, or start a common action. */
export default function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [records, setRecords] = useState<Item[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const loadRecords = useCallback(async () => {
    if (records) return;
    try {
      const [c, d] = await Promise.all([fetch("/api/contacts", { cache: "no-store" }), fetch("/api/deals", { cache: "no-store" })]);
      const cj = c.ok ? await c.json() : { contacts: [] }; const dj = d.ok ? await d.json() : { deals: [] };
      const contacts: Item[] = (cj.contacts ?? []).slice(0, 2000).map((x: { id: string; name: string; company?: string; phone?: string; email?: string }) => ({
        id: "c:" + x.id, label: x.company || x.name || "Contact", hint: [x.company ? x.name : "", x.phone].filter(Boolean).join(" · ") || "Contact",
        href: `/crm?contact=${x.id}`, group: "Contacts" as const, keywords: [x.name, x.email, x.phone].filter(Boolean).join(" "),
      }));
      const deals: Item[] = (dj.deals ?? []).slice(0, 1000).map((x: { id: string; title: string; stage: string; company?: string; contactName?: string }) => ({
        id: "d:" + x.id, label: x.title || x.company || "Deal", hint: String(x.stage ?? "").replace(/_/g, " "),
        href: `/crm/deals/${x.id}`, group: "Deals" as const, keywords: [x.company, x.contactName].filter(Boolean).join(" "),
      }));
      setRecords([...deals, ...contacts]);
    } catch { setRecords([]); }
  }, [records]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cinder:command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("cinder:command", onOpen); };
  }, []);
  useEffect(() => { if (open) { setQ(""); setSel(0); void loadRecords(); setTimeout(() => input.current?.focus(), 0); } }, [open, loadRecords]);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return [...ACTIONS, ...PAGES.slice(0, 6)];
    const fixed = [...ACTIONS, ...PAGES].filter(i => matches(i, t));
    const recs = (records ?? []).filter(i => matches(i, t)).slice(0, 8);
    return [...recs, ...fixed].slice(0, 14);
  }, [q, records]);
  useEffect(() => { setSel(0); }, [q]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;
  let lastGroup = "";
  return <div className="cb-scrim" onMouseDown={() => setOpen(false)}>
    <div className="cb-box" role="dialog" aria-label="Search and jump" onMouseDown={e => e.stopPropagation()}>
      <input ref={input} className="cb-input" placeholder="Search contacts, deals and pages, or type an action…" value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(results.length - 1, s + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
        }} aria-activedescendant={results[sel]?.id} />
      <div className="cb-list" role="listbox">
        {results.length === 0 && <div className="cb-empty">{records === null ? "Loading…" : `Nothing matches "${q}".`}</div>}
        {results.map((it, i) => {
          const head = it.group !== lastGroup ? (lastGroup = it.group) : "";
          return <div key={it.id}>{head && <div className="cb-group">{head}</div>}
            <button id={it.id} role="option" aria-selected={i === sel} className={"cb-item" + (i === sel ? " is-sel" : "")} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
              <span className="cb-label">{it.label}</span><span className="cb-hint">{it.hint}</span>
            </button></div>;
        })}
      </div>
      <div className="cb-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
    </div>
  </div>;
}
