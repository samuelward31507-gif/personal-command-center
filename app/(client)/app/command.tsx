"use client";

// ⌘K: find anyone, jump to a section, or run the few actions that matter. Arrow keys move, Enter picks, Esc closes.
import { useEffect, useMemo, useRef, useState } from "react";
import { STAGE_LABEL } from "@/lib/crm";
import { Icon, fmtPhone, usd } from "./parts";
import type { Data, Go, Tab } from "./types";

type Item = { key: string; group: string; title: string; sub?: string; icon: string; kbd?: string; run: () => void };

export function CommandBar({ d, go, onClose, onWinback }: { d: Data; go: Go; onClose: () => void; onWinback?: () => void }) {
  const [q, setQ] = useState(""), [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const items = useMemo<Item[]>(() => {
    const t = q.trim().toLowerCase(), digits = t.replace(/\D/g, "");
    const out: Item[] = [];
    if (t.length >= 2) {
      for (const c of (d.customers ?? []).filter(c => c.name.toLowerCase().includes(t) || c.address.toLowerCase().includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))).slice(0, 6))
        out.push({ key: "c" + c.id, group: "People", title: c.name || fmtPhone(c.phone), sub: [c.stage ? STAGE_LABEL[c.stage as keyof typeof STAGE_LABEL] : "", c.line || c.address].filter(Boolean).join(", "), icon: "user", run: () => go.record(c.id) });
      for (const inv of (d.invoices ?? []).filter(x => `#${x.number}`.includes(t) || String(x.number) === digits || (x.customer || "").toLowerCase().includes(t)).slice(0, 3))
        out.push({ key: "i" + inv.id, group: "Invoices", title: `Invoice #${inv.number}`, sub: `${inv.customer || fmtPhone(inv.phone)}, ${usd(inv.total)}`, icon: "invoice", run: () => go.invoice(inv.id) });
    }
    const sections: [Tab, string, string, string][] = [["today", "Home", "home", "1"], ["inbox", "Inbox", "chat", "2"], ["jobs", "Jobs", "jobs", "3"], ["calendar", "Calendar", "cal", "4"], ["invoices", "Money", "invoice", "5"], ["numbers", "Reports", "bars", "6"], ["system", "Settings", "gear", "7"]];
    for (const [k, l, ic, n] of sections) if (!t || l.toLowerCase().includes(t)) out.push({ key: "s" + k, group: "Go to", title: l, icon: ic, kbd: "⌘" + n, run: () => go.tab(k) });
    const acts: Item[] = [
      { key: "add", group: "Actions", title: "Add lead", icon: "plus", kbd: "c", run: go.addLead },
      { key: "imp", group: "Actions", title: "Import customers", sub: "Jobber export or CSV", icon: "upload", run: go.importCustomers },
      ...(onWinback && d.winback && d.winback.past > 0 ? [{ key: "wb", group: "Actions", title: "Text past customers", sub: `${d.winback.eligible} can get it`, icon: "users", run: onWinback }] : []),
      { key: "setup", group: "Actions", title: "Edit prices and setup", icon: "edit", run: go.setup },
    ];
    for (const a of acts) if (!t || a.title.toLowerCase().includes(t) || (a.sub ?? "").toLowerCase().includes(t)) out.push(a);
    return out;
  }, [q, d, go, onWinback]);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { box.current?.querySelector(".hl")?.scrollIntoView({ block: "nearest" }); }, [i]);
  const pick = (it: Item) => { onClose(); it.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI(x => Math.min(items.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    else if (e.key === "Enter" && items[i]) { e.preventDefault(); pick(items[i]); }
    else if (e.key === "Escape") onClose();
  };
  let lastGroup = "";
  return <div className="scrim top" onClick={onClose}>
    <div className="cmd" role="dialog" aria-label="Command bar" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
      <div className="in"><Icon name="search" size={16} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find a customer, invoice or section" aria-label="Command" /><kbd>esc</kbd></div>
      <div className="list" ref={box} role="listbox">
        {items.length ? items.map((it, k) => { const lbl = it.group !== lastGroup ? <div key={"g" + it.group} className="lbl">{it.group}</div> : null; lastGroup = it.group;
          return <div key={it.key}>{lbl}<button type="button" role="option" aria-selected={k === i} className={"it" + (k === i ? " hl" : "")} onMouseEnter={() => setI(k)} onClick={() => pick(it)}>
            <Icon name={it.icon} size={14} /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{it.title}</b>{it.sub && <small>{it.sub}</small>}</span>{it.kbd ? <kbd>{it.kbd}</kbd> : <span />}</button></div>; })
          : <div className="lbl" style={{ padding: "14px 10px" }}>Nothing matches “{q.trim()}”.</div>}
      </div>
      <div className="ft hint"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </div>
  </div>;
}
