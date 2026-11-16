"use client";

// The price list: lines the owner saves once (name, unit, price, and what it costs them) and picks on every quote,
// invoice, change order and plan. The line editor reads it from context; the sheet edits it.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dollars, type Item } from "@/lib/billing";
import { cleanCatalog, searchCatalog, type CatalogItem } from "@/lib/service";
import { Icon, Sheet, Spinner, type Api, type Toast } from "./parts";

export const CatalogContext = createContext<{ items: CatalogItem[]; edit: () => void }>({ items: [], edit: () => {} });
export const useCatalog = () => useContext(CatalogContext);
export const catalogFrom = (setup?: Record<string, string>) => cleanCatalog(setup?.catalog ?? "[]");
export const asLine = (c: CatalogItem): Item => ({ name: c.name, qty: 1, unit: c.unit, price: c.price });

/** "From price list": a searchable list under the lines; one tap adds that line. */
export function CatalogPicker({ onPick }: { onPick: (c: CatalogItem) => void }) {
  const { items, edit } = useCatalog();
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [k, setK] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchCatalog(items, q, 8), [items, q]);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("mousedown", h); return () => removeEventListener("mousedown", h); }, [open]);
  const pick = (c: CatalogItem) => { onPick(c); setQ(""); setK(0); };
  if (!items.length) return <button type="button" className="btn sm ghost" onClick={edit} title="Save the lines you use all the time">Set up a price list</button>;
  return <div className="cat-pick" ref={box}>
    <button type="button" className={"btn sm" + (open ? " on" : "")} onClick={() => setOpen(o => !o)}><Icon name="search" size={13} />From price list</button>
    {open && <div className="cat-pop" role="dialog" aria-label="Your price list">
      <input className="input" autoFocus value={q} placeholder="Search your price list" onChange={e => { setQ(e.target.value); setK(0); }}
        onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setK(x => Math.min(hits.length - 1, x + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setK(x => Math.max(0, x - 1)); } else if (e.key === "Enter" && hits[k]) { e.preventDefault(); pick(hits[k]); } else if (e.key === "Escape") setOpen(false); }} />
      <ul>{hits.length ? hits.map((c, i) => <li key={c.name}><button type="button" className={i === k ? "on" : ""} onMouseEnter={() => setK(i)} onClick={() => pick(c)}><span>{c.name}</span><b>{dollars(c.price)}{c.unit ? <small>/{c.unit}</small> : null}</b></button></li>)
        : <li className="none">Nothing called that. <button type="button" className="link" onClick={edit}>Add it to the list</button></li>}</ul>
      <div className="cat-foot"><small>{items.length} saved {items.length === 1 ? "line" : "lines"}. Enter adds the highlighted one.</small><button type="button" className="link" onClick={() => { setOpen(false); edit(); }}>Edit list</button></div>
    </div>}
  </div>;
}

type Row = { name: string; unit: string; price: string; cost: string };
const toRows = (l: CatalogItem[]): Row[] => l.map(c => ({ name: c.name, unit: c.unit, price: String(c.price), cost: c.cost ? String(c.cost) : "" }));
/** The price list itself: name, unit, price, and (optional) what it costs you, so margins show on every job. */
export function PriceListSheet({ items, project, api, toast, reload, onClose, seed }: { items: CatalogItem[]; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void; seed?: Item[] }) {
  const [rows, setRows] = useState<Row[]>(() => { const r = toRows(items); const have = new Set(items.map(i => i.name.toLowerCase()));
    for (const s of seed ?? []) if (s.name.trim() && !have.has(s.name.trim().toLowerCase())) r.push({ name: s.name.trim(), unit: s.unit, price: String(s.price), cost: "" });
    return r.length ? r : [{ name: "", unit: "", price: "", cost: "" }]; });
  const [busy, setBusy] = useState(false), [q, setQ] = useState("");
  const set = (k: number, p: Partial<Row>) => setRows(xs => xs.map((x, j) => j === k ? { ...x, ...p } : x));
  const num = (v: string) => v.replace(/[^\d.]/g, "");
  const clean = cleanCatalog(rows.filter(r => r.name.trim()).map(r => ({ ...r, price: r.price || "0" })));
  const shown = rows.map((r, k) => ({ r, k })).filter(({ r }) => !q.trim() || !r.name || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  async function save() {
    setBusy(true);
    try { await api("/api/app/act", { p: project, action: "catalog", items: clean }); toast(`Price list saved: ${clean.length} ${clean.length === 1 ? "line" : "lines"}.`); await reload(); onClose(); }
    catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); }
  }
  return <Sheet onClose={onClose} title="Price list" sub="Saved lines you pick on quotes, invoices, change orders and plans" wide
    foot={<><span className="fine" style={{ marginRight: "auto" }}>{clean.length} {clean.length === 1 ? "line" : "lines"}</span><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn ink" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : "Save price list"}</button></>}>
    {rows.length > 8 && <label className="inwrap search"><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a line" /></label>}
    <div className="cat-tbl" role="table">
      <div className="cat-r h" role="row"><span>What</span><span>Unit</span><span>Price</span><span title="What it costs you, for margins">Your cost</span><span /></div>
      {shown.map(({ r, k }) => <div key={k} className="cat-r" role="row">
        <input className="input" aria-label="What" value={r.name} placeholder="6 ft cedar privacy, installed" onChange={e => set(k, { name: e.target.value })} />
        <input className="input" aria-label="Unit" value={r.unit} placeholder="ft" maxLength={12} onChange={e => set(k, { unit: e.target.value })} />
        <span className="inwrap"><i>$</i><input aria-label="Price" inputMode="decimal" value={r.price} placeholder="0" onChange={e => set(k, { price: num(e.target.value) })} /></span>
        <span className="inwrap"><i>$</i><input aria-label="Your cost" inputMode="decimal" value={r.cost} placeholder="optional" onChange={e => set(k, { cost: num(e.target.value) })} /></span>
        <button type="button" className="btn ghost sm ic" aria-label={`Remove ${r.name || "line"}`} onClick={() => setRows(xs => xs.filter((_, j) => j !== k))}><Icon name="x" size={13} /></button>
      </div>)}
    </div>
    <div className="acts-row"><button type="button" className="btn sm" onClick={() => { setQ(""); setRows(xs => [...xs, { name: "", unit: "", price: "", cost: "" }]); }}><Icon name="plus" size={13} />Add a line</button></div>
    <p className="fine">Per foot, per gate, per visit: set the unit and the quantity does the math. Your cost stays private; it never shows on a quote.</p>
  </Sheet>;
}
