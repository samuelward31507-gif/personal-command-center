"use client";

// Things owners had in the old tool and expect on day one: more than one property per customer, reusable checklists filled
// in on the job (with a photo per item), and the day's stops as one route on the map.
import { useRef, useState } from "react";
import type { Card } from "@/lib/crm";
import { DEFAULT_CHECKLISTS, cleanChecklists } from "@/lib/client-parity-shared";
import { Icon, Sheet, Spinner, ago, type Api, type Toast } from "./parts";
import { crewName } from "./crew";
import type { Data } from "./types";

type Act = (k: string, b: Record<string, unknown>, done: string) => Promise<unknown>;

/** Every address this customer has, with the gate code and what the crew should know. */
export function PropertiesBox({ card, act, busy, canEdit }: { card: Card; act: Act; busy: string; canEdit: boolean }) {
  const props = card.properties?.length ? card.properties : card.details.address ? [{ id: "", address: String(card.details.address), gate_code: "", notes: "" }] : [];
  const [edit, setEdit] = useState<{ id: string; address: string; gate: string; notes: string } | null>(null);
  return <section className="card"><div className="hd"><h2>{props.length > 1 ? `${props.length} properties` : "Property"}</h2>{canEdit && <button type="button" className="link" style={{ marginLeft: "auto" }} onClick={() => setEdit({ id: "", address: "", gate: "", notes: "" })}>Add</button>}</div>
    {props.length ? <ul className="props">{props.map((p, i) => <li key={p.id || i}>
      <a className="link" href={`https://maps.google.com/?q=${encodeURIComponent(p.address)}`} target="_blank" rel="noreferrer"><Icon name="pin" size={12} />{p.address}</a>
      {(p.gate_code || p.notes) && <small>{[p.gate_code ? `Gate ${p.gate_code}` : "", p.notes].filter(Boolean).join(". ")}</small>}
      {canEdit && p.id && <button type="button" className="link" onClick={() => setEdit({ id: p.id, address: p.address, gate: p.gate_code, notes: p.notes })}>Edit</button>}
    </li>)}</ul> : <p className="fine">No address yet.</p>}
    {edit && <Sheet onClose={() => setEdit(null)} title={edit.id ? "Edit property" : "Add a property"} sub={card.name}
      foot={<>{edit.id && <button type="button" className="btn ghost" disabled={!!busy} onClick={async () => { await act("prop", { action: "property", input: { id: edit.id, remove: true } }, "Property removed."); setEdit(null); }}>Remove</button>}<span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn ink" disabled={!!busy || !edit.address.trim()} onClick={async () => { await act("prop", { action: "property", input: { id: edit.id || undefined, address: edit.address, gate: edit.gate, notes: edit.notes } }, "Property saved."); setEdit(null); }}>{busy === "prop" ? <Spinner /> : "Save"}</button></>}>
      <label className="field"><span>Address</span><input value={edit.address} maxLength={300} autoFocus onChange={e => setEdit({ ...edit, address: e.target.value })} placeholder="2210 Oak Dr, Littleton, CO" /></label>
      <label className="field"><span>Gate code or access <em>optional</em></span><input value={edit.gate} maxLength={120} onChange={e => setEdit({ ...edit, gate: e.target.value })} placeholder="4418, lockbox on the side gate" /></label>
      <label className="field"><span>Notes for the crew <em>optional</em></span><textarea rows={2} value={edit.notes} maxLength={600} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Two dogs. Park on the street." /></label>
    </Sheet>}
  </section>;
}

/** The job's checklist: the owner picks one, whoever's on the job ticks it, a photo can go with any item. */
export function ChecklistBox({ d, card, trade, act, busy, canPick, onPhoto }: { d: Data; card: Card; trade: string; act: Act; busy: string; canPick: boolean; onPhoto?: (label: string, file: File) => Promise<void> }) {
  const lists = [...cleanChecklists(d.setup?.checklists), ...DEFAULT_CHECKLISTS(trade).filter(x => !cleanChecklists(d.setup?.checklists).some(y => y.name === x.name))];
  const cl = card.checklist, done = cl ? cl.items.filter(i => i.done).length : 0;
  const file = useRef<HTMLInputElement>(null), [for_, setFor] = useState("");
  return <section className="card"><div className="hd"><h2>{cl ? cl.name : "Checklist"}</h2>{cl && <small style={{ marginLeft: "auto" }}>{done} of {cl.items.length}</small>}</div>
    {cl ? <>
      <div className="prog" style={{ margin: "2px 0 6px" }}><b style={{ width: `${(done / Math.max(1, cl.items.length)) * 100}%` }} /></div>
      {cl.items.map((it, i) => <div key={i} className={"ck" + (it.done ? " done" : "")}>
        <button type="button" role="checkbox" aria-checked={it.done} disabled={!!busy} onClick={() => void act("ck" + i, { action: "checktick", step: i, done: !it.done }, it.done ? "Unticked." : "Done.")}><i>{busy === "ck" + i ? <Spinner /> : it.done ? <Icon name="check" size={10} /> : null}</i><span>{it.label}</span></button>
        <small>{it.done && it.at ? `${it.by && it.by !== "owner" ? crewName(d, it.by) + ", " : ""}${ago(it.at)}` : ""}</small>
        {onPhoto && <button type="button" className="btn ghost sm ic" aria-label={`Photo for ${it.label}`} title="Add a photo for this" onClick={() => { setFor(it.label); file.current?.click(); }}><Icon name="upload" size={12} /></button>}
      </div>)}
      {onPhoto && <input ref={file} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await onPhoto(for_, f); }} />}
      {canPick && <div className="acts-row end" style={{ marginTop: 6 }}><button type="button" className="link" onClick={() => void act("cl", { action: "checklist", name: null }, "Checklist removed.")}>Remove checklist</button></div>}
    </> : canPick ? <>
      <p className="fine">Pick the list for this job. Your crew ticks it off on their phone, with a photo where it matters.</p>
      <div className="chips" style={{ marginTop: 8 }}>{lists.map(l => <button key={l.name} type="button" disabled={!!busy} onClick={() => void act("cl", { action: "checklist", name: l.name }, `${l.name} checklist added.`)}>{l.name}<small style={{ color: "var(--g2)" }}> {l.items.length}</small></button>)}</div>
    </> : <p className="fine">No checklist on this job.</p>}
  </section>;
}

/** Settings: the owner's checklists by job type. One line per item. */
export function ChecklistsSheet({ d, project, api, toast, reload, onClose }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const start = cleanChecklists(d.setup?.checklists);
  const [lists, setLists] = useState(() => (start.length ? start : DEFAULT_CHECKLISTS(d.setup?.trade || "")).map(l => ({ name: l.name, text: l.items.join("\n") })));
  const [busy, setBusy] = useState(false);
  return <Sheet onClose={onClose} title="Job checklists" sub="Pick one on any job; the crew ticks it off on their phone" wide
    foot={<><button type="button" className="btn ghost" onClick={() => setLists(x => [...x, { name: "", text: "" }])}><Icon name="plus" size={13} />Add a checklist</button><span style={{ flex: 1 }} />
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn ink" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: { checklists: lists.map(l => ({ name: l.name, items: l.text.split("\n") })) } }); toast("Checklists saved."); await reload(); onClose(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } }}>{busy ? <Spinner /> : "Save"}</button></>}>
    {lists.map((l, k) => <div key={k} className="cl-edit">
      <div className="acts-row"><input aria-label="Checklist name" className="input" style={{ flex: 1 }} value={l.name} maxLength={60} placeholder="Fence install" onChange={e => setLists(x => x.map((y, j) => j === k ? { ...y, name: e.target.value } : y))} />
        <button type="button" className="btn ghost sm ic" aria-label="Remove this checklist" onClick={() => setLists(x => x.filter((_, j) => j !== k))}><Icon name="x" size={13} /></button></div>
      <textarea className="input" rows={Math.min(10, Math.max(3, l.text.split("\n").length + 1))} value={l.text} onChange={e => setLists(x => x.map((y, j) => j === k ? { ...y, text: e.target.value } : y))} placeholder={"Locate utilities\nSet posts\nFinal walk"} />
    </div>)}
  </Sheet>;
}

/** The day's stops, in order, as one route on Google Maps. */
export function routeUrl(addresses: string[]): string | null {
  const a = addresses.map(x => x.trim()).filter(Boolean);
  if (!a.length) return null;
  const dest = a[a.length - 1], way = a.slice(0, -1).slice(0, 9);
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(dest)}${way.length ? `&waypoints=${encodeURIComponent(way.join("|"))}` : ""}`;
}
