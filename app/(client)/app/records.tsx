"use client";

// Equipment at a customer's address, documents on their job, and the office's to-dos.
import { useMemo, useState } from "react";
import { Icon, Sheet, Spinner, dateLabel, type Api, type Toast } from "./parts";
import { EQUIPMENT_KINDS, ageYears, taskOrder, type Equipment } from "@/lib/records";
import type { Data, Go } from "./types";

type Ctx = { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void> };
const todayIso = () => new Date().toLocaleDateString("en-CA");

// ---------- Equipment ----------
function EquipmentSheet({ ctx, thread, item, onClose }: { ctx: Ctx; thread: string; item?: Equipment; onClose: () => void }) {
  const [f, setF] = useState({ kind: item?.kind ?? "", make: item?.make ?? "", model: item?.model ?? "", serial: item?.serial ?? "", location: item?.location ?? "", installed_on: item?.installed_on ?? "", warranty_until: item?.warranty_until ?? "", notes: item?.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => { setBusy(true); try { await ctx.api("/api/app/act", { p: ctx.project, action: "equipment", thread, entry: item?.id, input: f }); ctx.toast(item ? "Saved." : "Added."); await ctx.reload(); onClose(); }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Couldn't save.", true); } finally { setBusy(false); } };
  return <Sheet title={item ? "Edit equipment" : "Add equipment"} sub="What's installed at this address" onClose={onClose}
    foot={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn ink" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : null}Save</button></>}>
    <div className="two">
      <label className="field"><span>What it is</span><input list="eq-kinds" value={f.kind} onChange={set("kind")} placeholder="Furnace" autoFocus /><datalist id="eq-kinds">{EQUIPMENT_KINDS.map(k => <option key={k} value={k} />)}</datalist></label>
      <label className="field"><span>Where</span><input value={f.location} onChange={set("location")} placeholder="Basement" /></label>
    </div>
    <div className="two">
      <label className="field"><span>Make</span><input value={f.make} onChange={set("make")} placeholder="Carrier" /></label>
      <label className="field"><span>Model</span><input value={f.model} onChange={set("model")} placeholder="59SC5A060E17" /></label>
    </div>
    <label className="field"><span>Serial number</span><input value={f.serial} onChange={set("serial")} placeholder="From the nameplate" autoCapitalize="characters" /></label>
    <div className="two">
      <label className="field"><span>Installed</span><input type="date" value={f.installed_on} onChange={set("installed_on")} /></label>
      <label className="field"><span>Warranty until</span><input type="date" value={f.warranty_until} onChange={set("warranty_until")} /></label>
    </div>
    <label className="field"><span>Notes</span><input value={f.notes} onChange={set("notes")} placeholder="Filter size 16x25x1, condensate pump replaced 2025" /></label>
  </Sheet>;
}

export function EquipmentBox({ ctx, thread }: { ctx: Ctx; thread: string }) {
  const list = (ctx.d.equipment ?? []).filter(e => e.thread_id === thread);
  const [edit, setEdit] = useState<Equipment | "new" | null>(null), [busy, setBusy] = useState("");
  const today = todayIso();
  const serviced = async (e: Equipment) => { const note = prompt(`What was done on the ${e.kind || e.make || "equipment"}?`, "Annual service"); if (note === null) return; setBusy(e.id);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "equipservice", entry: e.id, note }); ctx.toast("Service logged."); await ctx.reload(); } catch (x) { ctx.toast(x instanceof Error ? x.message : "Couldn't save.", true); } finally { setBusy(""); } };
  const remove = async (e: Equipment) => { if (!confirm(`Take the ${e.kind || "equipment"} off this address? Its history is kept.`)) return; setBusy(e.id);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "equipremove", entry: e.id }); await ctx.reload(); } catch (x) { ctx.toast(x instanceof Error ? x.message : "Couldn't remove.", true); } finally { setBusy(""); } };
  return <section className="card"><div className="hd"><h2>Equipment</h2>{list.length > 0 && <small style={{ marginLeft: "auto" }}>{list.length} at this address</small>}</div>
    {list.length ? list.map(e => { const age = ageYears(e.installed_on, today), warrantyOut = e.warranty_until && e.warranty_until < today;
      return <div key={e.id} className="eq-row">
        <div className="eq-t"><b>{e.kind || "Equipment"}{e.location ? <span className="mut">, {e.location}</span> : null}</b>
          <small>{[e.make, e.model].filter(Boolean).join(" ") || "Make and model not set"}{e.serial ? `, serial ${e.serial}` : ""}</small>
          <small>{age != null ? `Installed ${dateLabel(e.installed_on!)} (${age} ${age === 1 ? "year" : "years"})` : "Install date not set"}{e.warranty_until ? <>, warranty {warrantyOut ? <span className="bad-t">ended {dateLabel(e.warranty_until)}</span> : `until ${dateLabel(e.warranty_until)}`}</> : ""}</small>
          {e.history[0] && <small className="mut">Last service {dateLabel(e.history[0].on)}: {e.history[0].note}</small>}</div>
        <div className="eq-a"><button type="button" className="btn sm" disabled={busy === e.id} onClick={() => void serviced(e)}>Log service</button>
          <button type="button" className="btn ghost sm" onClick={() => setEdit(e)}>Edit</button>{ctx.d.role !== "crew" && <button type="button" className="btn ghost sm ic" aria-label="Remove" title="Remove" onClick={() => void remove(e)}><Icon name="x" size={12} /></button>}</div>
      </div>; })
      : <p className="fine">Furnaces, water heaters, panels, pumps: what&rsquo;s here, its serial number and warranty, and every service. Your crew can add it from the nameplate.</p>}
    <div className="acts-row end" style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={() => setEdit("new")}><Icon name="plus" size={13} />Add equipment</button></div>
    {edit && <EquipmentSheet ctx={ctx} thread={thread} item={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
  </section>;
}

// ---------- Documents ----------
const readAsDataUrl = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(f); });
export function FilesBox({ ctx, thread }: { ctx: Ctx; thread: string }) {
  const list = (ctx.d.files ?? []).filter(f => f.thread_id === thread);
  const [busy, setBusy] = useState(false);
  const add = async (file: File) => {
    if (file.size > 3_000_000) { ctx.toast("That file is over 3 MB. Save a smaller copy and try again.", true); return; }
    setBusy(true);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "fileadd", thread, input: { name: file.name, data: await readAsDataUrl(file) } }); ctx.toast("Document added."); await ctx.reload(); }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Couldn't add it.", true); } finally { setBusy(false); }
  };
  const remove = async (id: string, name: string) => { if (!confirm(`Delete ${name}?`)) return; try { await ctx.api("/api/app/act", { p: ctx.project, action: "fileremove", entry: id }); await ctx.reload(); } catch (e) { ctx.toast(e instanceof Error ? e.message : "Couldn't delete.", true); } };
  return <section className="card"><div className="hd"><h2>Documents</h2>{list.length > 0 && <small style={{ marginLeft: "auto" }}>{list.length}</small>}</div>
    {list.length ? list.map(f => <div key={f.id} className="money"><a href={`/api/app/file?p=${ctx.project}&id=${f.id}`} target="_blank" rel="noreferrer"><Icon name={f.mime === "application/pdf" ? "invoice" : "eye"} size={13} /> {f.name}</a>
      <span className="acts-row"><small className="mut">{dateLabel(f.created_at)}</small>{ctx.d.role !== "crew" && <button type="button" className="btn ghost sm ic" aria-label={`Delete ${f.name}`} onClick={() => void remove(f.id, f.name)}><Icon name="x" size={12} /></button>}</span></div>)
      : <p className="fine">Permits, contracts, drawings and inspection reports, kept with the job. PDFs or photos, up to 3 MB each.</p>}
    <div className="acts-row end" style={{ marginTop: 6 }}><label className={"btn sm" + (busy ? " busy" : "")}>{busy ? <Spinner /> : <Icon name="upload" size={13} />}Add a document<input type="file" accept="application/pdf,image/*" hidden disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = ""; }} /></label></div>
  </section>;
}

// ---------- To-dos ----------
export function TasksSection({ ctx, go }: { ctx: Ctx; go: Go }) {
  const today = todayIso();
  const open = useMemo(() => taskOrder(ctx.d.tasks ?? [], today), [ctx.d.tasks, today]);
  const [title, setTitle] = useState(""), [due, setDue] = useState(""), [busy, setBusy] = useState("");
  const add = async () => { if (!title.trim()) return; setBusy("add");
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "task", input: { title, due_on: due || null } }); setTitle(""); setDue(""); await ctx.reload(); } catch (e) { ctx.toast(e instanceof Error ? e.message : "Couldn't add it.", true); } finally { setBusy(""); } };
  const done = async (id: string) => { setBusy(id); try { await ctx.api("/api/app/act", { p: ctx.project, action: "taskdone", entry: id, done: true }); await ctx.reload(); } catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(""); } };
  return <section className="t5-sec">
    <header><h2>To-dos</h2><small>{open.length ? `${open.length} open` : "nothing open"}</small></header>
    <form className="todo-add" onSubmit={e => { e.preventDefault(); void add(); }}>
      <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Order posts for the Becker job, call the city about the permit" aria-label="New to-do" />
      <input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due" style={{ width: 150 }} />
      <button type="submit" className="btn" disabled={busy === "add" || !title.trim()}>{busy === "add" ? <Spinner /> : "Add"}</button>
    </form>
    {open.length > 0 && <div className="t5-list">{open.map(t => { const late = t.due_on && t.due_on < today;
      return <div key={t.id} className="todo-row">
        <button type="button" className="todo-ck" role="checkbox" aria-checked={false} aria-label={`Done: ${t.title}`} disabled={busy === t.id} onClick={() => void done(t.id)} />
        <span className="tt"><b>{t.title}</b>{(t.due_on || t.customer) && <small>{t.due_on ? <span className={late ? "bad-t" : ""}>{t.due_on === today ? "Today" : late ? `Was due ${dateLabel(t.due_on)}` : `Due ${dateLabel(t.due_on)}`}</span> : null}{t.due_on && t.customer ? ", " : ""}{t.customer && t.thread ? <button type="button" className="link" onClick={() => go.record(t.thread!)}>{t.customer}</button> : null}</small>}</span>
      </div>; })}</div>}
  </section>;
}

// ---------- Tags and referrals, on the customer ----------
export function TagsRow({ ctx, card, act }: { ctx: Ctx; card: { id: string; tags?: string[]; referredBy?: string | null }; act: (key: string, body: Record<string, unknown>, done: string) => Promise<unknown> }) {
  const [adding, setAdding] = useState(false), [v, setV] = useState("");
  const tags = card.tags ?? [];
  const all = useMemo(() => [...new Set((ctx.d.board ?? []).flatMap(c => c.tags ?? []))].filter(t => !tags.includes(t)).sort(), [ctx.d.board, tags]);
  const people = useMemo(() => (ctx.d.board ?? []).filter(c => c.id !== card.id).map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)), [ctx.d.board, card.id]);
  const referrer = people.find(p => p.id === card.referredBy);
  const referred = (ctx.d.board ?? []).filter(c => c.referredBy === card.id);
  const save = (next: string[]) => void act("tags", { action: "card", tags: next }, "Tags saved.");
  return <section className="card"><div className="hd"><h2>Tags and referrals</h2></div>
    <div className="tag-row">{tags.map(t => <span key={t} className="tagx">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => save(tags.filter(x => x !== t))}>×</button></span>)}
      {adding ? <form onSubmit={e => { e.preventDefault(); const t = v.trim().toLowerCase(); if (t) save([...tags, t]); setV(""); setAdding(false); }}><input className="input sm" list="tag-list" autoFocus value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (!v.trim()) setAdding(false); }} placeholder="commercial" style={{ width: 140 }} /><datalist id="tag-list">{all.map(t => <option key={t} value={t} />)}</datalist></form>
        : <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}>+ Tag</button>}</div>
    <div className="money"><span>Referred by</span><select className="input sm" style={{ width: 200 }} value={card.referredBy ?? ""} onChange={e => void act("ref", { action: "card", referredBy: e.target.value || null }, e.target.value ? "Referral saved." : "Referral removed.")}>
      <option value="">Nobody</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    {referrer && <p className="fine">Thank {referrer.name.split(" ")[0]} when this one closes.</p>}
    {referred.length > 0 && <p className="fine">Referred {referred.length}: {referred.slice(0, 4).map(c => c.name).join(", ")}{referred.length > 4 ? " and more" : ""}.</p>}
  </section>;
}

// ---------- The owner's own fields on a customer ----------
export function CustomFieldsBox({ ctx, card, act }: { ctx: Ctx; card: { id: string; custom?: Record<string, string> }; act: (key: string, body: Record<string, unknown>, done: string) => Promise<unknown> }) {
  const labels = (() => { try { const v = JSON.parse(ctx.d.setup?.custom_fields || "[]"); return Array.isArray(v) ? (v as string[]) : []; } catch { return []; } })();
  if (!labels.length) return null;
  const cur = card.custom ?? {};
  const save = (label: string, value: string) => { if ((cur[label] ?? "") === value.trim()) return; void act("custom", { action: "card", custom: { ...cur, [label]: value } }, "Saved."); };
  return <section className="card"><div className="hd"><h2>Details</h2></div>
    {labels.map(l => <label key={l} className="money"><span>{l}</span><input className="input sm" style={{ width: 220 }} defaultValue={cur[l] ?? ""} onBlur={e => save(l, e.target.value)} placeholder="–" /></label>)}
  </section>;
}

/** Settings: the fields every customer gets. */
export function FieldLabelsEditor({ ctx }: { ctx: Ctx }) {
  const labels = (() => { try { const v = JSON.parse(ctx.d.setup?.custom_fields || "[]"); return Array.isArray(v) ? (v as string[]) : []; } catch { return []; } })();
  const [v, setV] = useState(""), [busy, setBusy] = useState(false);
  const save = async (next: string[]) => { setBusy(true); try { await ctx.api("/api/app/act", { p: ctx.project, action: "setup", setup: { custom_fields: next } }); await ctx.reload(); } catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } };
  return <li style={{ height: "auto", padding: "8px 0", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
    <span>Your own fields on every customer<small className="mut" style={{ display: "block" }}>Gate code, HOA, PO number, dog&rsquo;s name: up to 10. They show on each job.</small></span>
    <span className="tag-row">{labels.map(l => <span key={l} className="tagx">{l}<button type="button" aria-label={`Remove ${l}`} disabled={busy} onClick={() => void save(labels.filter(x => x !== l))}>×</button></span>)}
      {labels.length < 10 && <form onSubmit={e => { e.preventDefault(); if (v.trim()) { void save([...labels, v.trim()]); setV(""); } }}><input className="input sm" style={{ width: 160 }} value={v} onChange={e => setV(e.target.value)} placeholder="Add a field" disabled={busy} /></form>}</span>
  </li>;
}
