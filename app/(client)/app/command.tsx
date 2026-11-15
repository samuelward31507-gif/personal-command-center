"use client";

// ⌘K (or / when not typing): find anyone, or start with a verb. "text tom", "call dana", "quote priya",
// "nudge lena", "directions henderson", "invoice 1042". Every row shows the one thing you'd do as its button, with
// call, text and directions beside it. Arrows move, Enter does it, Esc closes.
import { useEffect, useMemo, useRef, useState } from "react";
import { STAGE_LABEL } from "@/lib/crm";
import { Icon, first, fmtPhone, usd } from "./parts";
import { suggestReply } from "./replies";
import type { Data, Go, Tab } from "./types";

type Extra = { icon: string; label: string; href?: string; run?: () => void };
type Hit = { key: string; group: string; icon: string; title: string; sub?: string; cta: string; kbd?: string; run: () => void; href?: string; extra?: Extra[] };
const VERBS = ["text", "call", "open", "quote", "invoice", "nudge", "directions", "job"] as const;
type Verb = (typeof VERBS)[number];
const maps = (addr: string) => `https://maps.google.com/?daddr=${encodeURIComponent(addr)}`;

export function CommandBar({ d, go, onClose, onWinback }: { d: Data; go: Go; onClose: () => void; onWinback?: () => void }) {
  const [q, setQ] = useState(""), [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const hits = useMemo<Hit[]>(() => {
    const raw = q.trim().toLowerCase(), word = raw.split(/\s+/)[0];
    const verb: Verb | null = (VERBS as readonly string[]).includes(word) ? word as Verb : word === "map" || word === "drive" ? "directions" : null;
    const t = verb ? raw.slice(word.length).trim() : raw, digits = t.replace(/\D/g, "");
    const cards = d.board ?? [], invoices = d.invoices ?? [], byId = new Map(cards.map(c => [c.id, c]));
    const run = (f: () => void) => () => { onClose(); f(); };

    const sections: [Tab, string, string, string, string][] = [["today", "Home", "home", "⌘1", "home dashboard today"], ["inbox", "Inbox", "chat", "⌘2", "inbox messages texts replies"], ["jobs", "Jobs", "jobs", "⌘3", "jobs board pipeline customers everyone"], ["calendar", "Calendar", "cal", "⌘4", "calendar estimates schedule week"], ["invoices", "Money", "invoice", "⌘5", "money invoices owed what's owed whats owed paid quotes"], ["numbers", "Reports", "bars", "⌘6", "reports numbers stats sources"], ["system", "Settings", "gear", "⌘7", "settings system wires website chat number"]];
    const actions: Hit[] = [
      { key: "add", group: "Actions", icon: "plus", title: "Add a lead", sub: "Someone who called you directly", cta: "Add", kbd: "c", run: run(go.addLead) },
      { key: "imp", group: "Actions", icon: "upload", title: "Import customers", sub: "Jobber export or CSV", cta: "Import", run: run(go.importCustomers) },
      ...(onWinback && d.winback && d.winback.past > 0 ? [{ key: "wb", group: "Actions", icon: "users", title: "Text past customers", sub: `${d.winback.eligible} can get it`, cta: "Open", run: run(onWinback) }] : []),
      { key: "setup", group: "Actions", icon: "edit", title: "Edit prices and setup", cta: "Open", run: run(go.setup) },
    ];
    if (!verb && raw.length < 2) {
      const owed = invoices.filter(i => i.status === "sent"), sum = owed.reduce((a, i) => a + i.total, 0);
      const waiting = d.live.conversations.filter(c => c.status === "paused").slice(0, 3).map<Hit>(c => ({ key: "w" + c.id, group: "Waiting on you", icon: "chat", title: `Reply to ${c.name}`, sub: c.ask || c.last, cta: "Reply", run: run(() => go.thread(c.id)) }));
      const money: Hit[] = owed.length ? [{ key: "owed", group: "Waiting on you", icon: "invoice", title: `What's owed, ${usd(sum)}`, sub: `${owed.length} ${owed.length === 1 ? "invoice" : "invoices"} out`, cta: "Open", run: run(() => go.tab("invoices")) }] : [];
      return [...waiting, ...money, ...actions, ...sections.map<Hit>(([k, l, ic, kb]) => ({ key: "s" + k, group: "Go to", icon: ic, title: l, cta: "Go", kbd: kb, run: run(() => go.tab(k)) }))];
    }

    // People: everyone the business knows, matched by name, street or the digits of a phone number.
    type P = { id: string; name: string; phone: string; address: string; stage: string; line: string };
    const people = new Map<string, P>();
    for (const c of d.customers ?? []) people.set(c.id, { id: c.id, name: c.name, phone: c.phone, address: c.address, stage: c.stage ?? "", line: c.line });
    for (const c of cards) if (!people.has(c.id)) people.set(c.id, { id: c.id, name: c.name, phone: c.phone, address: String(c.details.address ?? ""), stage: c.stage, line: c.line });
    for (const c of d.live.conversations) if (!people.has(c.id)) people.set(c.id, { id: c.id, name: c.name, phone: "", address: "", stage: "", line: c.last });
    const match = (p: P) => !t || p.name.toLowerCase().includes(t) || p.address.toLowerCase().includes(t) || (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits));
    const found = [...people.values()].filter(p => match(p) && (verb !== "nudge" || byId.get(p.id)?.stage === "quoted") && (verb !== "directions" || !!p.address))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t))).slice(0, 7);
    const personHit = (p: P): Hit => {
      const card = byId.get(p.id), who = p.name || fmtPhone(p.phone);
      const sub = [p.stage ? STAGE_LABEL[p.stage as keyof typeof STAGE_LABEL] : "", (p.line || p.address).replace(/\s·\s/g, ", ")].filter(Boolean).join(", ");
      const extra: Extra[] = [];
      if (p.phone) extra.push({ icon: "phone", label: `Call ${first(who)}`, href: `tel:${p.phone}` });
      extra.push({ icon: "chat", label: `Text ${first(who)}`, run: run(() => go.thread(p.id)) });
      if (p.address) extra.push({ icon: "pin", label: "Directions", href: maps(p.address) });
      const base = { key: "c" + p.id, group: "People", icon: "user", title: who, sub, extra };
      if (verb === "call" && p.phone) return { ...base, title: `Call ${who}`, cta: "Call", href: `tel:${p.phone}`, run: onClose };
      if (verb === "directions" && p.address) return { ...base, title: `Directions to ${who}`, sub: p.address, cta: "Map", href: maps(p.address), run: onClose };
      if (verb === "text") return { ...base, title: `Text ${who}`, cta: "Text", run: run(() => go.thread(p.id)) };
      if (verb === "quote") return { ...base, title: `Write ${first(who)}'s quote`, cta: "Quote", run: run(() => go.record(p.id, { ask: "quoted" })) };
      if (verb === "nudge" || (!verb && card?.stage === "quoted" && card.quote?.linked)) {
        const draft = suggestReply(who, null, { stage: "quoted", owner: d.owner, quoteAmount: card?.quote?.amount });
        return { ...base, title: verb ? `Nudge ${who}` : who, sub: verb ? draft : sub, cta: "Nudge", run: run(() => go.record(p.id, { view: "activity", draft })) };
      }
      if (verb === "invoice" && card?.invoice) { const inv = card.invoice; return { ...base, title: `${who}, invoice #${inv.number}`, sub: `${usd(inv.total)}, ${inv.status}`, cta: "Open", run: run(() => go.invoice(inv.id)) }; }
      if (verb === "job" || card?.stage === "won") return { ...base, cta: "Open job", run: run(() => go.record(p.id, { view: "job" })) };
      return { ...base, cta: "Open", run: run(() => go.record(p.id)) };
    };
    const out = found.map(personHit);
    if (!verb || verb === "invoice") for (const i of invoices.filter(i => `#${i.number}`.includes(t) || String(i.number) === digits || (verb === "invoice" && (i.customer || "").toLowerCase().includes(t))).slice(0, 3))
      out.push({ key: "i" + i.id, group: "Invoices", icon: "invoice", title: `Invoice #${i.number}`, sub: `${i.customer || fmtPhone(i.phone)}, ${usd(i.total)}, ${i.status}`, cta: "Open", run: run(() => go.invoice(i.id)) });
    if (!verb) {
      for (const [k, l, ic, kb, words] of sections) if (words.includes(t) || l.toLowerCase().includes(t)) out.push({ key: "s" + k, group: "Go to", icon: ic, title: l, cta: "Go", kbd: kb, run: run(() => go.tab(k)) });
      for (const a of actions) if (a.title.toLowerCase().includes(t) || (a.sub ?? "").toLowerCase().includes(t) || (t.startsWith("lead") && a.key === "add")) out.push(a);
    }
    return out.slice(0, 12);
  }, [q, d, go, onClose, onWinback]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { list.current?.querySelector(".hl")?.scrollIntoView({ block: "nearest" }); }, [sel]);
  const fire = (h: Hit | undefined) => { if (!h) return; if (h.href) { if (h.href.startsWith("http")) window.open(h.href, "_blank", "noopener"); else location.href = h.href; } h.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(x => Math.min(hits.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(x => Math.max(0, x - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); fire(hits[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };
  let lastGroup = "";
  return <div className="scrim top" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="cmd" role="dialog" aria-label="Find or do anything" onKeyDown={onKey}>
      <div className="q"><Icon name="search" size={16} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find anyone, or type text, call, quote, nudge, directions" aria-label="Find or do anything" autoComplete="off" spellCheck={false} /><kbd>esc</kbd></div>
      <div className="list" ref={list} role="listbox">
        {hits.length ? hits.map((h, k) => { const lbl = h.group !== lastGroup ? <div key={"g" + h.group} className="lbl">{h.group}</div> : null; lastGroup = h.group;
          return <div key={h.key}>{lbl}<div role="option" aria-selected={k === sel} className={"it" + (k === sel ? " hl" : "")} onMouseMove={() => setSel(k)} onClick={() => fire(h)}>
            <Icon name={h.icon} size={14} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{h.title}</b>{h.sub && <small>{h.sub}</small>}</span>
            <span className="it-acts" onClick={e => e.stopPropagation()}>
              {h.extra?.map(x => x.href ? <a key={x.label} className="btn ghost sm ic" href={x.href} target={x.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" title={x.label} aria-label={x.label}><Icon name={x.icon} size={13} /></a>
                : <button key={x.label} type="button" className="btn ghost sm ic" title={x.label} aria-label={x.label} onClick={x.run}><Icon name={x.icon} size={13} /></button>)}
              {h.kbd && k !== sel ? <kbd>{h.kbd}</kbd> : <button type="button" className={"btn sm" + (k === sel ? " ink" : "")} onClick={() => fire(h)}>{h.cta}{k === sel && <kbd>↵</kbd>}</button>}
            </span></div></div>; })
          : <div className="lbl" style={{ padding: "14px 10px" }}>No one matches “{q.trim()}”. Try a first name, a street or the last 4 of a phone number.</div>}
      </div>
      <div className="ft hint"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> do it</span><span><kbd>esc</kbd> close</span><span style={{ marginLeft: "auto" }}>Try “text tom” or “nudge lena”</span></div>
    </div>
  </div>;
}
