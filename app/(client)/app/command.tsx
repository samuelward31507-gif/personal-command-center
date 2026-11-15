"use client";

// The command bar, in the Raycast spirit: ⌘K (or /) anywhere, or the search box on Today on a phone. Type a name, a
// street, a phone number or an invoice number, or start with a verb: "text tom", "call dana", "quote priya",
// "nudge mike", "directions henderson", "what's owed". Every result shows the one thing you'd do with it as a
// button; Enter does it, the arrow keys move.
import { useEffect, useMemo, useRef, useState } from "react";
import { STAGE_LABEL } from "@/lib/crm";
import { Icon, first, fmtPhone, usd } from "./parts";
import { suggestReply } from "./replies";
import type { Data, Go, Tab } from "./types";

type Hit = { key: string; icon: string; title: string; sub: string; cta: string; run: () => void; href?: string; extra?: { icon: string; label: string; href?: string; run?: () => void }[] };
const VERBS = ["text", "call", "open", "quote", "invoice", "nudge", "directions", "job"] as const;
type Verb = (typeof VERBS)[number];
const maps = (addr: string) => `https://maps.google.com/?daddr=${encodeURIComponent(addr)}`;

export function CommandBar({ d, go, onClose }: { d: Data; go: Go; onClose: () => void }) {
  const [q, setQ] = useState(""), [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  useEffect(() => { input.current?.focus(); const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  const hits = useMemo<Hit[]>(() => {
    const raw = q.trim().toLowerCase();
    const word = raw.split(/\s+/)[0];
    const verb: Verb | null = (VERBS as readonly string[]).includes(word) ? word as Verb : word === "map" || word === "drive" ? "directions" : null;
    const t = verb ? raw.slice(word.length).trim() : raw, digits = t.replace(/\D/g, "");
    const cards = d.board ?? [], invoices = d.invoices ?? [];
    const byId = new Map(cards.map(c => [c.id, c]));
    const run = (f: () => void) => () => { onClose(); f(); };

    // Places to go and things to start, shown when the box is empty or the words match.
    const places: { k: Tab; l: string; ic: string; words: string }[] = [
      { k: "inbox", l: "Inbox", ic: "chat", words: "inbox messages texts conversations replies" },
      { k: "jobs", l: "Jobs", ic: "jobs", words: "jobs board pipeline quotes" }, { k: "calendar", l: "Calendar", ic: "cal", words: "calendar estimates schedule week appointments" },
      { k: "invoices", l: "Invoices · what's owed", ic: "invoice", words: "invoices owed money what's owed whats owed unpaid late paid" },
      { k: "customers", l: "Customers", ic: "users", words: "customers people contacts" }, { k: "numbers", l: "Numbers", ic: "bars", words: "numbers stats report results" },
      { k: "system", l: "System", ic: "gear", words: "system settings wires website chat number" }, { k: "sam", l: "Message Sam", ic: "user", words: "sam rep help support message settings" },
    ];
    const starts: Hit[] = [
      { key: "add", icon: "plus", title: "Add a lead", sub: "Someone who called you directly", cta: "Add", run: run(go.addLead) },
      { key: "imp", icon: "upload", title: "Import customers", sub: "From Jobber or a spreadsheet", cta: "Import", run: run(go.importCustomers) },
    ];
    if (!verb && raw.length < 2) {
      const owed = invoices.filter(i => i.status === "sent"), sum = owed.reduce((a, i) => a + i.total, 0);
      const waiting = d.live.conversations.filter(c => c.status === "paused").slice(0, 3).map<Hit>(c => ({ key: "w" + c.id, icon: "chat", title: `Reply to ${first(c.name)}`, sub: c.ask || c.last, cta: "Reply", run: run(() => go.thread(c.id)) }));
      return [...waiting,
        ...(owed.length ? [{ key: "owed", icon: "invoice", title: `What's owed: ${usd(sum)}`, sub: `${owed.length} ${owed.length === 1 ? "invoice" : "invoices"} out`, cta: "Open", run: run(() => go.tab("invoices")) }] : []),
        ...starts, ...places.slice(0, 4).map<Hit>(p => ({ key: "p" + p.k, icon: p.ic, title: p.l, sub: "Go to", cta: "Go", run: run(() => go.tab(p.k)) }))];
    }

    // People: customers first (everyone), then anyone on the board who isn't a customer yet.
    type P = { id: string; name: string; phone: string; address: string; stage: string; line: string };
    const people = new Map<string, P>();
    for (const c of d.customers ?? []) people.set(c.id, { id: c.id, name: c.name, phone: c.phone, address: c.address, stage: c.stage ?? "", line: c.line });
    for (const c of cards) if (!people.has(c.id)) people.set(c.id, { id: c.id, name: c.name, phone: c.phone, address: String(c.details.address ?? ""), stage: c.stage, line: c.line });
    for (const c of d.live.conversations) if (!people.has(c.id)) people.set(c.id, { id: c.id, name: c.name, phone: "", address: "", stage: "", line: c.last });
    const match = (p: P) => !t || p.name.toLowerCase().includes(t) || p.address.toLowerCase().includes(t) || (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits));
    const found = [...people.values()].filter(p => match(p) && (verb !== "nudge" || byId.get(p.id)?.stage === "quoted") && (verb !== "directions" || !!p.address)).sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t))).slice(0, 7);

    const personHit = (p: P): Hit => {
      const card = byId.get(p.id), who = p.name || fmtPhone(p.phone), sub = [p.stage ? STAGE_LABEL[p.stage as keyof typeof STAGE_LABEL] : "", p.line || p.address].filter(Boolean).join(" · ");
      const extra: Hit["extra"] = [];
      if (p.phone) extra.push({ icon: "phone", label: `Call ${first(who)}`, href: `tel:${p.phone}` });
      extra.push({ icon: "chat", label: `Text ${first(who)}`, run: run(() => go.thread(p.id)) });
      if (p.address) extra.push({ icon: "pin", label: "Directions", href: maps(p.address) });
      const base = { key: "c" + p.id, icon: "user", title: who, sub, extra };
      if (verb === "call" && p.phone) return { ...base, title: `Call ${who}`, cta: "Call", href: `tel:${p.phone}`, run: onClose };
      if (verb === "directions" && p.address) return { ...base, title: `Directions to ${who}`, sub: p.address, cta: "Map", href: maps(p.address), run: onClose };
      if (verb === "text") return { ...base, title: `Text ${who}`, cta: "Text", run: run(() => go.thread(p.id)) };
      if (verb === "quote") return { ...base, title: `Write ${first(who)}'s quote`, cta: "Quote", run: run(() => go.record(p.id, { ask: "quoted" })) };
      if (verb === "nudge" || (!verb && card?.stage === "quoted" && card.quote?.linked)) {
        const draft = suggestReply(who, null, { stage: "quoted", owner: d.owner, quoteAmount: card?.quote?.amount });
        return { ...base, title: verb ? `Nudge ${who}` : who, sub: verb ? draft : sub, cta: "Nudge", run: run(() => go.record(p.id, { view: "activity", draft })) };
      }
      if (verb === "invoice" && card?.invoice) { const inv = card.invoice; return { ...base, title: `${who}: invoice #${inv.number}`, sub: `${usd(inv.total)} · ${inv.status}`, cta: "Open", run: run(() => go.invoice(inv.id)) }; }
      if (verb === "job" || card?.stage === "won") return { ...base, cta: "Open job", run: run(() => go.record(p.id, { view: "job" })) };
      return { ...base, cta: "Open", run: run(() => go.record(p.id)) };
    };
    const out = found.map(personHit);

    if (!verb || verb === "invoice") for (const i of invoices.filter(i => `#${i.number}`.includes(t) || String(i.number) === digits || (verb === "invoice" && (i.customer || "").toLowerCase().includes(t))).slice(0, 3))
      if (!out.some(h => h.key === "c" + i.thread_id && verb === "invoice")) out.push({ key: "i" + i.id, icon: "invoice", title: `Invoice #${i.number}`, sub: `${i.customer || fmtPhone(i.phone)} · ${usd(i.total)} · ${i.status}`, cta: "Open", run: run(() => go.invoice(i.id)) });
    if (!verb) {
      for (const p of places) if (p.words.includes(t) || p.l.toLowerCase().includes(t)) out.push({ key: "p" + p.k, icon: p.ic, title: p.l, sub: "Go to", cta: "Go", run: run(() => go.tab(p.k)) });
      for (const s of starts) if (s.title.toLowerCase().includes(t) || (t.startsWith("add") && s.key === "add") || (t.startsWith("lead") && s.key === "add")) out.push(s);
    }
    return out.slice(0, 10);
  }, [q, d, go, onClose]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);
  const fire = (h: Hit | undefined) => { if (!h) return; if (h.href) { if (h.href.startsWith("http")) window.open(h.href, "_blank", "noopener"); else location.href = h.href; } h.run(); };

  return <div className="cmdk-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="cmdk" role="dialog" aria-label="Find or do anything">
      <label className="cmdk-in"><Icon name="search" size={16} />
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Find anyone, or type: text, call, quote, nudge, directions…" aria-label="Find or do anything" autoComplete="off" spellCheck={false}
          onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(hits.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); fire(hits[sel]); }
          }} />
        <kbd>esc</kbd></label>
      <div className="cmdk-list" ref={list} role="listbox">
        {hits.length ? hits.map((h, i) => <div key={h.key} data-i={i} role="option" aria-selected={i === sel} className={"cmdk-row" + (i === sel ? " on" : "")} onMouseMove={() => setSel(i)} onClick={() => fire(h)}>
          <span className="cmdk-ic"><Icon name={h.icon} size={15} /></span>
          <span className="cmdk-t"><b>{h.title}</b>{h.sub && <small>{h.sub}</small>}</span>
          <span className="cmdk-acts" onClick={e => e.stopPropagation()}>
            {h.extra?.map(x => x.href ? <a key={x.label} className="btn ghost sm ic" href={x.href} target={x.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" title={x.label} aria-label={x.label}><Icon name={x.icon} size={14} /></a>
              : <button key={x.label} type="button" className="btn ghost sm ic" title={x.label} aria-label={x.label} onClick={x.run}><Icon name={x.icon} size={14} /></button>)}
            <button type="button" className={"btn sm" + (i === sel ? " ink" : "")} onClick={() => fire(h)}>{h.cta}{i === sel && <kbd>↵</kbd>}</button>
          </span>
        </div>) : <p className="cmdk-none">No one matches “{q.trim()}”. Try a first name, a street or the last 4 of a phone number.</p>}
      </div>
      <footer className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> do it</span><span>Try “text tom” or “what’s owed”</span></footer>
    </div>
  </div>;
}

/** ⌘K or Ctrl+K anywhere, and / when you're not typing. */
export function useCommandKey(open: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(); }
    };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  }, [open]);
}

/** The search box that opens the command bar (Today's header, and the sidebar). */
export function FindButton({ onOpen, label = "Search or do anything" }: { onOpen: () => void; label?: string }) {
  return <button type="button" className="findbtn" onClick={onOpen} aria-label={label}><Icon name="search" size={14} /><span>{label}</span><kbd>⌘K</kbd></button>;
}
