"use client";

// Jobber's core in the owner's app, minus the bloat: quote lines he checks and sends himself, invoices paid through his
// own pay link, every customer in one list, every invoice in one list. Same look as the rest of the app.
import { useEffect, useMemo, useState } from "react";
import { dollars, lineTotal, totals, overdue, type Item } from "@/lib/billing";
import type { CardInvoice } from "@/lib/crm";
import { Telemetry } from "./sx";

type Api = <T>(path: string, body?: unknown) => Promise<T>;
type Toast = (t: string, bad?: boolean) => void;
export type Customer = { id: string; name: string; phone: string; address: string; source: string; status: string; stage: string | null; since: string; last: string;
  jobs: number; spent: number; owed: number; open_quote: number | null; line: string };
export type InvoiceRow = CardInvoice & { thread_id: string; customer: string; phone: string };

const fmtPhone = (p: string) => { const d = p.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };
const tone = (s: string) => [...(s || "#")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 6;
const initials = (s: string) => s.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "#";
const short = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : dollars(n);
const day = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const todayIso = () => new Date().toLocaleDateString("en-CA");
const X = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** Editable quote or invoice lines: what, how many, the unit price. Totals are worked out, never typed. */
export function LineEditor({ items, setItems, tax, setTax }: { items: Item[]; setItems: (f: (x: Item[]) => Item[]) => void; tax: number; setTax: (n: number) => void }) {
  const t = totals(items.filter(i => i.name.trim() && i.qty > 0), tax);
  const set = (k: number, patch: Partial<Item>) => setItems(xs => xs.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  const n = (v: string) => { const x = Number(v.replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };
  return <div className="bl">
    <ul>{items.map((i, k) => <li key={k} className="bl-row">
      <input className="bl-name" aria-label="What" value={i.name} placeholder="What it is" onChange={e => set(k, { name: e.target.value })} />
      <span className="bl-nums">
        <label className="bl-q"><input aria-label="Quantity" inputMode="decimal" value={i.qty || ""} placeholder="1" onChange={e => set(k, { qty: n(e.target.value) })} />{i.unit && <em>{i.unit}</em>}</label>
        <span className="bl-x" aria-hidden="true">×</span>
        <label className="bl-p"><i>$</i><input aria-label="Price each" inputMode="decimal" value={i.price || ""} placeholder="0" onChange={e => set(k, { price: n(e.target.value) })} /></label>
        <b className="bl-t">{dollars(lineTotal(i))}</b>
        <button type="button" className="bl-rm" aria-label={`Remove ${i.name || "line"}`} onClick={() => setItems(xs => xs.filter((_, j) => j !== k))}>{X}</button>
      </span>
    </li>)}</ul>
    <button type="button" className="bl-add" onClick={() => setItems(xs => [...xs, { name: "", qty: 1, unit: "", price: 0 }])}>+ Add a line</button>
    <dl className="bl-sum">
      <div><dt>Subtotal</dt><dd>{dollars(t.subtotal)}</dd></div>
      <div><dt><label>Tax <span className="bl-tax"><input aria-label="Tax percent" inputMode="decimal" value={tax || ""} placeholder="0" onChange={e => setTax(Math.min(20, n(e.target.value)))} />%</span></label></dt><dd>{dollars(t.tax)}</dd></div>
      <div className="tot"><dt>Total</dt><dd>{dollars(t.total)}</dd></div>
    </dl>
  </div>;
}

export function invoiceState(i: CardInvoice): { text: string; tone: "" | "green" | "blue" | "warn" | "red" } {
  if (i.status === "paid") return { text: `Paid ${i.paid_at ? day(i.paid_at) : ""}`.trim(), tone: "green" };
  if (i.status === "void") return { text: "Voided", tone: "" };
  if (i.status === "draft") return { text: "Draft", tone: "" };
  if (i.paid_claimed_at) return { text: "Says they paid", tone: "warn" };
  if (overdue(i.status, i.due_on, todayIso())) return { text: "Past due", tone: "red" };
  return { text: i.viewed_at ? "Opened" : "Sent", tone: "blue" };
}

function Sheet({ title, sub, onClose, children }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, [onClose]);
  return <div className="jb-scrim" onClick={onClose}><div className="jb-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
    <div className="jb-sheet-h"><div className="jb-who"><span><b>{title}</b>{sub && <small>{sub}</small>}</span></div><button type="button" className="jb-x" onClick={onClose} aria-label="Close">{X}</button></div>
    <div className="jb-sheet-b">{children}</div></div></div>;
}

/** One invoice: lines, due date, note; send it, copy the link, mark it paid. */
export function InvoiceSheet({ inv, customer, project, api, toast, reload, payLink, onClose, onSetup }: { inv: CardInvoice; customer: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; payLink: boolean; onClose: () => void; onSetup: () => void }) {
  const [items, setItems] = useState<Item[]>(inv.items), [tax, setTax] = useState(inv.tax_rate), [note, setNote] = useState(inv.note), [due, setDue] = useState(inv.due_on ?? "");
  const [busy, setBusy] = useState(""), [arm, setArm] = useState("");
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(""), 4000); return () => clearTimeout(t); }, [arm]);
  const locked = inv.status === "paid" || inv.status === "void";
  const dirty = JSON.stringify(items) !== JSON.stringify(inv.items) || tax !== inv.tax_rate || note !== inv.note || due !== (inv.due_on ?? "");
  const st = invoiceState(inv);
  const first = customer.split(" ")[0] || "them";
  async function act(key: string, body: Record<string, unknown>, done: string | ((r: { sent?: boolean; warn?: string; link?: string }) => string), close = false) {
    setBusy(key);
    try { const r = await api<{ sent?: boolean; warn?: string; link?: string }>("/api/app/act", { p: project, invoice: inv.id, ...body }); toast(typeof done === "string" ? done : done(r), !!r.warn && !r.sent); await reload(); if (close) onClose(); return r; }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return null; }
    finally { setBusy(""); setArm(""); }
  }
  async function save() { return act("save", { action: "invoicesave", items, tax, note, due: due || null }, "Saved."); }
  async function send() {
    if (dirty && !(await save())) return;
    await act("send", { action: "invoicesend" }, r => r.sent ? `Invoice texted to ${first}.` : r.warn || "Ready.");
  }
  async function copy() {
    let url = inv.url;
    if (!url) { const r = await act("send", { action: "invoicesend" }, r2 => r2.sent ? `Invoice texted to ${first}.` : "Link ready."); url = r?.link ?? null; }
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast("Invoice link copied."); } catch { prompt("Copy the invoice link:", url); }
  }
  return <Sheet onClose={onClose} title={<>Invoice #{inv.number}</>} sub={<>{customer} · <span className={"bl-st " + st.tone}>{st.text}</span></>}>
    {!payLink && !locked && <div className="bl-warn"><b>Add your pay link</b><p>The invoice gets a Pay button that opens your Square, Stripe or PayPal page. Cinder never touches the money.</p>
      <button type="button" onClick={onSetup}>Add pay link</button></div>}
    {inv.paid_claimed_at && inv.status === "sent" && <div className="bl-warn"><b>{first} says they paid</b><p>Check your account, then mark it paid. Reminders are paused.</p></div>}
    {locked ? <div className="bl-read"><ul>{inv.items.map((i, k) => <li key={k}><span>{i.name}<small>{i.qty} {i.unit} × {dollars(i.price)}</small></span><b>{dollars(lineTotal(i))}</b></li>)}</ul>
      <p className="bl-read-t"><span>Total</span><b>{dollars(inv.total)}</b></p></div>
      : <>
        <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />
        <div className="jb-two" style={{ marginTop: 14 }}>
          <label className="jb-f"><span>Due</span><span className="jb-in"><input type="date" value={due} onChange={e => setDue(e.target.value)} /></span></label>
          <span />
        </div>
        <label className="jb-f full"><span>Note <em>they&rsquo;ll see it</em></span><textarea rows={2} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Thanks for your business. Two-year warranty on the install." /></label>
      </>}
    {inv.status === "sent" && <p className="jb-fine">{inv.reminders_paused ? "Payment reminders are paused." : inv.reminders ? `${inv.reminders} of 3 payment reminders sent.` : "If it goes past due, Cinder sends up to 3 friendly reminders. A reply pauses them."}</p>}
    <div className="jb-box-acts" style={{ marginTop: 16 }}>
      {!locked && <button type="button" className="go" disabled={!!busy} onClick={() => void send()}>{busy === "send" ? <span className="ca-spin" /> : inv.status === "sent" ? "Text it again" : `Text ${first} the invoice`}</button>}
      {!locked && <button type="button" disabled={!!busy} onClick={() => void copy()}>Copy link</button>}
      {!locked && dirty && <button type="button" disabled={!!busy} onClick={() => void save()}>Save</button>}
    </div>
    <div className="bl-foot">
      {inv.status === "paid" ? <button type="button" disabled={!!busy} onClick={() => void act("unpaid", { action: "invoiceset", what: "unpaid" }, "Marked unpaid.")}>Mark unpaid</button>
        : !locked && <button type="button" className="ok" disabled={!!busy} onClick={() => void act("paid", { action: "invoiceset", what: "paid" }, `Paid. ${dollars(inv.total)} recorded.`, true)}>Mark paid</button>}
      {inv.status === "sent" && <button type="button" disabled={!!busy} onClick={() => void act("pause", { action: "invoiceset", what: inv.reminders_paused ? "resume" : "pause" }, inv.reminders_paused ? "Reminders back on." : "Reminders paused.")}>{inv.reminders_paused ? "Resume reminders" : "Pause reminders"}</button>}
      {!locked && <button type="button" className="bad" disabled={!!busy} onClick={() => arm === "void" ? void act("void", { action: "invoiceset", what: "void" }, "Invoice voided.", true) : setArm("void")}>{arm === "void" ? "Tap again to void" : "Void"}</button>}
    </div>
  </Sheet>;
}

/** Payments settings: the owner's own pay link, sales tax and how long invoices give. */
export function BillingSettings({ setup, project, api, toast, reload, onClose }: { setup: Record<string, string>; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [link, setLink] = useState(setup.pay_link || ""), [tax, setTax] = useState(setup.tax_rate || ""), [daysDue, setDays] = useState(setup.invoice_days || "7"), [busy, setBusy] = useState(false);
  return <Sheet onClose={onClose} title="Invoices and payments" sub="Used on every quote and invoice">
    <label className="jb-f full"><span>Your pay link</span><span className="jb-in"><input inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="square.link/u/yourbusiness" /></span></label>
    <p className="jb-fine">The link you already use to get paid: Square, Stripe, PayPal or your own site. The invoice&rsquo;s Pay button opens it. Cinder never holds the money.</p>
    <div className="jb-two" style={{ marginTop: 14 }}>
      <label className="jb-f"><span>Sales tax</span><span className="jb-in"><input inputMode="decimal" value={tax} onChange={e => setTax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><em>%</em></span></label>
      <label className="jb-f"><span>Invoices are due</span><select value={daysDue} onChange={e => setDays(e.target.value)}><option value="0">On receipt</option><option value="7">In 7 days</option><option value="14">In 14 days</option><option value="30">In 30 days</option></select></label>
    </div>
    <div className="jb-save"><button type="button" className="go" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api("/api/app/act", { p: project, action: "setup", setup: { pay_link: link, tax_rate: tax || "0", invoice_days: daysDue } }); toast("Saved."); await reload(); onClose(); }
      catch (e) { toast(e instanceof Error ? e.message : "Couldn't save.", true); } finally { setBusy(false); }
    }}>Save</button></div>
  </Sheet>;
}

/** Everyone who ever got in touch: who they are, where, what they've bought, what they owe. */
export function CustomersView({ list, onOpen }: { list: Customer[]; onOpen: (c: Customer) => void }) {
  const [q, setQ] = useState(""), [f, setF] = useState<"all" | "customers" | "owes">("all");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(), d = s.replace(/\D/g, "");
    return list.filter(c => (f === "customers" ? c.jobs > 0 : f === "owes" ? c.owed > 0 : true))
      .filter(c => !s || c.name.toLowerCase().includes(s) || c.address.toLowerCase().includes(s) || (d.length >= 3 && c.phone.replace(/\D/g, "").includes(d)));
  }, [list, q, f]);
  const spent = list.reduce((a, c) => a + c.spent, 0), owed = list.reduce((a, c) => a + c.owed, 0), paying = list.filter(c => c.jobs > 0).length;
  return <>
    <Telemetry label="Customers" items={[{ k: "People", v: list.length }, { k: "Customers", v: paying }, { k: "Lifetime", v: short(spent) }, { k: "Owed", v: short(owed) }]} />
    <div className="cu-bar">
      <label className="cu-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, address or phone" aria-label="Search customers" /></label>
      <div className="ca-seg" role="tablist" aria-label="Show">{([["all", "Everyone"], ["customers", "Paying"], ["owes", "Owes you"]] as const).map(([k, l]) =>
        <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div>
    </div>
    {shown.length ? <ul className="cu-list">{shown.map(c => { const name = c.name || fmtPhone(c.phone); return <li key={c.id}><button type="button" onClick={() => onOpen(c)}>
      <span className="ca-av sm" data-tone={tone(name)} aria-hidden="true">{initials(name)}</span>
      <span className="cu-mid"><b>{name}</b><small>{c.address || c.line || fmtPhone(c.phone)}</small></span>
      <span className="cu-num">{c.owed > 0 ? <><b className="owe">{short(c.owed)}</b><small>owed</small></> : c.spent > 0 ? <><b>{short(c.spent)}</b><small>{c.jobs} {c.jobs === 1 ? "job" : "jobs"}</small></>
        : c.open_quote ? <><b className="q">{short(c.open_quote)}</b><small>quoted</small></> : <small>{day(c.last)}</small>}</span>
    </button></li>; })}</ul>
      : <div className="ca-empty"><b>{q ? "No one matches that" : "No customers yet"}</b><p>{q ? "Try part of a name, a street, or the last 4 digits of their number." : "Everyone who calls, texts or fills out your form lands here."}</p></div>}
  </>;
}

/** Every invoice in one list: what's out, what's late, what's paid. */
export function InvoicesView({ list, onOpen }: { list: InvoiceRow[]; onOpen: (i: InvoiceRow) => void }) {
  const today = todayIso();
  const out = list.filter(i => i.status === "sent"), late = out.filter(i => overdue(i.status, i.due_on, today));
  const paid30 = list.filter(i => i.status === "paid" && i.paid_at && Date.parse(i.paid_at) > Date.now() - 30 * 86400000).reduce((a, i) => a + i.total, 0);
  const [f, setF] = useState<"open" | "all">("open");
  const shown = f === "open" ? list.filter(i => i.status === "sent" || i.status === "draft") : list;
  return <>
    <Telemetry label="Invoices" items={[{ k: "Outstanding", v: short(out.reduce((a, i) => a + i.total, 0)) }, { k: "Past due", v: short(late.reduce((a, i) => a + i.total, 0)) }, { k: "Paid · 30 days", v: short(paid30) }]} />
    <div className="cu-bar"><div className="ca-seg" role="tablist" aria-label="Show">{([["open", "Open"], ["all", "All"]] as const).map(([k, l]) =>
      <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div></div>
    {shown.length ? <ul className="cu-list">{shown.map(i => { const st = invoiceState(i); const name = i.customer || fmtPhone(i.phone); return <li key={i.id}><button type="button" onClick={() => onOpen(i)}>
      <span className="iv-no">#{i.number}</span>
      <span className="cu-mid"><b>{name}</b><small>{i.status === "paid" ? `Paid ${i.paid_at ? day(i.paid_at) : ""}` : i.due_on ? `Due ${day(i.due_on)}` : "Draft"}</small></span>
      <span className="cu-num"><b>{dollars(i.total)}</b><span className={"jb-tag " + st.tone}>{st.text}</span></span>
    </button></li>; })}</ul>
      : <div className="ca-empty"><b>{f === "open" ? "Nothing outstanding" : "No invoices yet"}</b><p>Open a won job and tap Create invoice. It comes from the quote&rsquo;s lines, and they pay through your own pay link.</p></div>}
  </>;
}
