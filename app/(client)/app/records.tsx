"use client";

// Equipment at a customer's address, documents on their job, and the office's to-dos.
import { useMemo, useState } from "react";
import { Icon, Sheet, Spinner, dateLabel, type Api, type Toast } from "./parts";
import { EQUIPMENT_KINDS, LOGGED, ageYears, taskOrder, type Equipment } from "@/lib/records";
import type { Data, Go } from "./types";
import { ORDER_STATUS, linesFromQuote, orderText, orderTotal, type Order, type OrderLine } from "@/lib/orders";
import { catalogFrom } from "./catalog";
import { cleanDaysOff, type DayOff } from "@/lib/client-booking";
import { teamOf } from "./crew";

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

// ---------- Who did what ----------
export function ActivityLog({ ctx, go }: { ctx: Ctx; go: Go }) {
  const list = ctx.d.activity ?? [];
  const [all, setAll] = useState(false);
  const team = (() => { try { const v = JSON.parse(ctx.d.setup?.team || "[]"); return Array.isArray(v) ? (v as { cell: string; name: string }[]) : []; } catch { return []; } })();
  const who = (cell: string) => !cell ? (ctx.d.owner ? ctx.d.owner.split(" ")[0] : "You") : team.find(m => m.cell.replace(/\D/g, "").slice(-10) === cell.replace(/\D/g, "").slice(-10))?.name || cell;
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 15);
  return <>
    <p className="sec" style={{ marginTop: 20 }}>Activity<small>who did what, newest first</small></p>
    <table className="tbl flush log"><tbody>{shown.map((a, i) => <tr key={i} onClick={a.thread ? () => go.record(a.thread!) : undefined} style={{ cursor: a.thread ? "pointer" : "default" }}>
      <td className="mut nowrap">{new Date(a.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
      <td className="nowrap"><b>{who(a.who)}</b></td><td>{LOGGED[a.action] ?? a.action}{a.detail ? <span className="mut">, {a.detail}</span> : null}</td><td className="mut ell">{a.customer}</td></tr>)}</tbody></table>
    {list.length > 15 && !all && <button type="button" className="link" style={{ padding: "8px 0" }} onClick={() => setAll(true)}>Show all {list.length}</button>}
  </>;
}

// ---------- Material orders ----------
const ORDER_TONE: Record<string, string> = { draft: "", ordered: "warn", received: "ok", canceled: "mut" };
export function OrdersBox({ ctx, card }: { ctx: Ctx; card: { id: string; name: string; details?: { address?: string }; quote?: { items: { name: string; qty: number; unit: string; price: number; tier?: string; opt?: boolean }[] } | null; job?: Record<string, string> } }) {
  const list = (ctx.d.orders ?? []).filter(o => o.thread_id === card.id);
  const [edit, setEdit] = useState<Order | "new" | null>(null), [busy, setBusy] = useState("");
  const status = async (o: Order, s: string, done: string) => { setBusy(o.id);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "orderstatus", entry: o.id, status: s }); ctx.toast(done); await ctx.reload(); } catch (x) { ctx.toast(x instanceof Error ? x.message : "Couldn't save.", true); } finally { setBusy(""); } };
  const open = list.filter(o => o.status === "draft" || o.status === "ordered");
  return <section className="card"><div className="hd"><h2>Materials</h2>{open.length > 0 && <small style={{ marginLeft: "auto" }}>{open.length} open</small>}</div>
    {list.length ? list.map(o => { const tot = orderTotal(o.items), late = o.status === "ordered" && o.needed_on && o.needed_on < todayIso();
      return <div key={o.id} className="eq-row">
        <div className="eq-t"><b>{o.supplier || "Supplier not set"}<span className={"mut"}>, {ORDER_STATUS.find(s => s[0] === o.status)?.[1]}{o.status === "received" && o.received_at ? ` ${dateLabel(o.received_at)}` : ""}</span></b>
          <small>{o.items.length} {o.items.length === 1 ? "line" : "lines"}: {o.items.slice(0, 3).map(i => i.name).join(", ")}{o.items.length > 3 ? ", and more" : ""}</small>
          <small>{tot > 0 ? dollarsOf(tot) : "Costs not set"}{o.needed_on ? <>, needed {late ? <span className="bad-t">{dateLabel(o.needed_on)}</span> : dateLabel(o.needed_on)}</> : null}{o.status === "received" && tot > 0 ? ", in this job's costs" : ""}</small></div>
        <div className="eq-a">
          {o.status === "draft" && <button type="button" className="btn sm" disabled={busy === o.id} onClick={() => void status(o, "ordered", "Marked ordered.")}>Mark ordered</button>}
          {o.status === "ordered" && <button type="button" className="btn sm" disabled={busy === o.id} onClick={() => void status(o, "received", tot > 0 ? `Received. ${dollarsOf(tot)} added to this job's costs.` : "Marked received.")}>Received</button>}
          {o.status === "received" && <button type="button" className="btn ghost sm" disabled={busy === o.id} onClick={() => void status(o, "ordered", "Back to ordered. The expense came off the job.")}>Undo</button>}
          {o.status !== "received" && <button type="button" className="btn ghost sm" onClick={() => setEdit(o)}>Open</button>}
        </div>
      </div>; })
      : <p className="fine">What to buy for this job and from whom. Pull the lines from the quote, send it to the supplier, and mark it received: the cost lands in this job&rsquo;s expenses.</p>}
    <div className="acts-row end" style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={() => setEdit("new")}><Icon name="plus" size={13} />New order</button></div>
    {edit && <OrderSheet ctx={ctx} card={card} order={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
  </section>;
}

const dollarsOf = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
type LineRow = { name: string; qty: string; unit: string; cost: string };
function OrderSheet({ ctx, card, order, onClose }: { ctx: Ctx; card: Parameters<typeof OrdersBox>[0]["card"]; order?: Order; onClose: () => void }) {
  const toRows = (l: OrderLine[]): LineRow[] => l.map(i => ({ name: i.name, qty: String(i.qty), unit: i.unit, cost: i.cost ? String(i.cost) : "" }));
  const past = (ctx.d.orders ?? []).map(o => o.supplier).filter(Boolean);
  const [supplier, setSupplier] = useState(order?.supplier ?? past[0] ?? ""), [email, setEmail] = useState(order?.supplier_email ?? (ctx.d.orders ?? []).find(o => o.supplier === (order?.supplier ?? past[0]))?.supplier_email ?? "");
  const [needed, setNeeded] = useState(order?.needed_on ?? ""), [note, setNote] = useState(order?.note ?? ""), [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<LineRow[]>(order ? toRows(order.items) : [{ name: "", qty: "1", unit: "", cost: "" }]);
  const fromQuote = () => { const l = linesFromQuote(card.quote?.items ?? [], catalogFrom(ctx.d.setup)); if (!l.length) { ctx.toast("The quote has no lines to pull.", true); return; }
    if (rows.some(r => r.name.trim()) && !confirm("Replace these lines with the quote's?")) return; setRows(toRows(l)); };
  const lines = rows.map(r => ({ name: r.name, qty: Number(r.qty) || 0, unit: r.unit, cost: Number(r.cost) || 0 })).filter(r => r.name.trim() && r.qty > 0);
  const input = { supplier, supplier_email: email, needed_on: needed || null, note, items: lines };
  const save = async (then?: "ordered") => { setBusy(true);
    try { const r = await ctx.api<{ id?: string }>("/api/app/act", { p: ctx.project, action: "order", thread: card.id, entry: order?.id, input });
      if (then && (r.id || order?.id)) await ctx.api("/api/app/act", { p: ctx.project, action: "orderstatus", entry: r.id || order!.id, status: then });
      ctx.toast(then ? "Saved and marked ordered." : "Order saved."); await ctx.reload(); onClose(); }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Couldn't save.", true); } finally { setBusy(false); } };
  const remove = async () => { if (!order || !confirm("Delete this order?")) return; setBusy(true);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "orderdelete", entry: order.id }); await ctx.reload(); onClose(); } catch (e) { ctx.toast(e instanceof Error ? e.message : "Couldn't delete.", true); setBusy(false); } };
  const text = orderText(input, { business: ctx.d.setup?.display_name || "", owner: (ctx.d.setup?.owner_name || "").split(" ")[0], phone: ctx.d.setup?.texting_number || "", address: card.details?.address });
  const copy = async () => { try { await navigator.clipboard.writeText(text); ctx.toast("Order copied. Paste it into a text or email to the supplier."); } catch { prompt("Copy the order:", text); } };
  const set = (k: number, p: Partial<LineRow>) => setRows(r => r.map((x, i) => i === k ? { ...x, ...p } : x));
  return <Sheet onClose={onClose} title={order ? "Material order" : "New material order"} sub={card.name}
    foot={<>{order && <button type="button" className="btn danger" disabled={busy} onClick={() => void remove()}>Delete</button>}<span style={{ flex: 1 }} />
      <button type="button" className="btn" disabled={busy || !lines.length} onClick={() => void copy()}>Copy order</button>
      {email && lines.length > 0 && <a className="btn" href={`mailto:${email}?subject=${encodeURIComponent(`Material order: ${card.details?.address || card.name}`)}&body=${encodeURIComponent(text)}`}>Email {supplier || "supplier"}</a>}
      <button type="button" className="btn" disabled={busy || !lines.length} onClick={() => void save()}>Save</button>
      {(!order || order.status === "draft") && <button type="button" className="btn ink" disabled={busy || !lines.length} onClick={() => void save("ordered")}>{busy ? <Spinner /> : "Save as ordered"}</button>}</>}>
    <div className="two"><label className="field"><span>Supplier</span><input value={supplier} maxLength={80} list="cx-suppliers" onChange={e => { setSupplier(e.target.value); const m = (ctx.d.orders ?? []).find(o => o.supplier === e.target.value); if (m?.supplier_email && !email) setEmail(m.supplier_email); }} placeholder="ABC Supply, Ferguson" />
      <datalist id="cx-suppliers">{[...new Set(past)].map(s => <option key={s} value={s} />)}</datalist></label>
      <label className="field"><span>Their email <em>optional</em></span><input type="email" value={email} maxLength={120} onChange={e => setEmail(e.target.value)} /></label></div>
    <div className="two"><label className="field"><span>Needed by</span><input type="date" value={needed} onChange={e => setNeeded(e.target.value)} /></label><span /></div>
    <p className="sec">Lines{card.quote?.items?.length ? <button type="button" className="link" style={{ marginLeft: 12, fontWeight: 400 }} onClick={fromQuote}>Fill from the quote</button> : null}<small>your cost per unit, for job costing; it isn&rsquo;t sent</small></p>
    <div className="cat-r h" role="row" style={{ gridTemplateColumns: "1fr 70px 70px 100px 28px" }}><span>What</span><span>Qty</span><span>Unit</span><span>Your cost</span><span /></div>
    {rows.map((r, k) => <div key={k} className="cat-r" style={{ gridTemplateColumns: "1fr 70px 70px 100px 28px" }}>
      <input className="input sm" aria-label="What" value={r.name} maxLength={120} onChange={e => set(k, { name: e.target.value })} />
      <input className="input sm" aria-label="Quantity" inputMode="decimal" value={r.qty} onChange={e => set(k, { qty: e.target.value.replace(/[^\d.]/g, "") })} />
      <input className="input sm" aria-label="Unit" value={r.unit} maxLength={12} onChange={e => set(k, { unit: e.target.value })} />
      <span className="inwrap"><i>$</i><input aria-label="Your cost" inputMode="decimal" value={r.cost} placeholder="optional" onChange={e => set(k, { cost: e.target.value.replace(/[^\d.]/g, "") })} /></span>
      <button type="button" className="btn ghost sm ic" aria-label="Remove line" onClick={() => setRows(x => x.length > 1 ? x.filter((_, i) => i !== k) : [{ name: "", qty: "1", unit: "", cost: "" }])}><Icon name="x" size={12} /></button></div>)}
    <div className="acts-row" style={{ marginTop: 6 }}><button type="button" className="btn ghost sm" onClick={() => setRows(r => [...r, { name: "", qty: "1", unit: "", cost: "" }])}><Icon name="plus" size={13} />Add a line</button>
      <span style={{ flex: 1 }} />{orderTotal(lines) > 0 && <b>{dollarsOf(orderTotal(lines))}</b>}</div>
    <label className="field"><span>Note for the supplier</span><textarea rows={2} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Deliver to the driveway, call on arrival." /></label>
  </Sheet>;
}

// ---------- Days off ----------
/** Holidays, vacation, a crew member out: the booking page and the agent skip business closures; the crew view shows who's out. */
export function DaysOffEditor({ ctx }: { ctx: Ctx }) {
  const today = todayIso(), list = cleanDaysOff(ctx.d.setup?.days_off ?? "[]", today), team = teamOf(ctx.d);
  const [adding, setAdding] = useState(false), [v, setV] = useState({ from: today, to: today, who: "", note: "" }), [busy, setBusy] = useState(false);
  const save = async (next: DayOff[], done: string) => { setBusy(true);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "daysoff", input: next }); ctx.toast(done); await ctx.reload(); return true; }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); return false; } finally { setBusy(false); } };
  const who = (cell: string) => !cell ? "Closed" : team.find(t => t.cell.replace(/\D/g, "").slice(-10) === cell.replace(/\D/g, "").slice(-10))?.name ?? cell;
  const span = (o: DayOff) => o.from === o.to ? dateLabel(o.from) : `${dateLabel(o.from)} to ${dateLabel(o.to)}`;
  const upcoming = list.filter(o => o.to >= today);
  return <li style={{ height: "auto", padding: "8px 0", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
    <span>Days off<small className="mut" style={{ display: "block" }}>Holidays and vacation close the booking page and the agent won&rsquo;t offer those days. A crew member&rsquo;s days off show on the crew view.</small></span>
    {upcoming.length > 0 && <table className="tbl flush"><tbody>{upcoming.map((o, k) => <tr key={k}><td className="nowrap">{span(o)}</td><td><b>{who(o.who)}</b>{o.note ? <span className="mut">, {o.note}</span> : null}</td>
      <td className="right"><button type="button" className="btn ghost sm ic" aria-label="Remove" disabled={busy} onClick={() => void save(list.filter(x => x !== o), "Removed.")}><Icon name="x" size={12} /></button></td></tr>)}</tbody></table>}
    {adding ? <form className="acts-row" style={{ flexWrap: "wrap", gap: 8 }} onSubmit={async e => { e.preventDefault(); if (await save([...list, { ...v, to: v.to < v.from ? v.from : v.to }], v.who ? `${who(v.who)} is off ${span({ ...v, to: v.to < v.from ? v.from : v.to })}.` : "Closed. Nothing will be offered those days.")) { setAdding(false); setV({ from: today, to: today, who: "", note: "" }); } }}>
        <select className="input sm" style={{ width: "auto" }} aria-label="Who" value={v.who} onChange={e => setV({ ...v, who: e.target.value })}><option value="">Whole business</option>{team.filter(t => t.cell).map(t => <option key={t.cell} value={t.cell}>{t.name}</option>)}</select>
        <input className="input sm" style={{ width: "auto" }} type="date" aria-label="From" value={v.from} min={today} onChange={e => setV({ ...v, from: e.target.value, to: v.to < e.target.value ? e.target.value : v.to })} />
        <input className="input sm" style={{ width: "auto" }} type="date" aria-label="To" value={v.to} min={v.from} onChange={e => setV({ ...v, to: e.target.value })} />
        <input className="input sm" style={{ width: 160 }} aria-label="Note" value={v.note} maxLength={60} placeholder="Thanksgiving" onChange={e => setV({ ...v, note: e.target.value })} />
        <button type="submit" className="btn sm ink" disabled={busy}>{busy ? <Spinner /> : "Add"}</button><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button></form>
      : <span className="acts-row"><button type="button" className="btn sm" onClick={() => setAdding(true)}><Icon name="plus" size={13} />Add days off</button></span>}
  </li>;
}
