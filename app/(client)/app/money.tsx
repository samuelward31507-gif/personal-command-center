"use client";

// Customers and invoices: every person in one table, every invoice in one table, and the invoice sheet where the
// owner edits lines, texts it, copies the link and marks it paid. Customers pay through the owner's own pay link.
import { useEffect, useMemo, useState } from "react";
import { dollars, lineTotal, overdue, totals, type Item } from "@/lib/billing";
import type { CardInvoice } from "@/lib/crm";
import { Avatar, Empty, Icon, Sheet, Spinner, dateLabel, fmtPhone, short, todayIso, useArm, type Api, type Toast } from "./parts";
import { sourceLabel, type Data, type Go, type InvoiceRow } from "./types";

const X = <Icon name="x" size={14} />;

/** Editable quote or invoice lines: what, how many, the unit price. Totals are worked out, never typed. */
export function LineEditor({ items, setItems, tax, setTax }: { items: Item[]; setItems: (f: (x: Item[]) => Item[]) => void; tax: number; setTax: (n: number) => void }) {
  const t = totals(items.filter(i => i.name.trim() && i.qty > 0), tax);
  const set = (k: number, patch: Partial<Item>) => setItems(xs => xs.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  const n = (v: string) => { const x = Number(v.replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };
  return <div className="le">
    <ul>{items.map((i, k) => <li key={k} className="lrow">
      <input className="in" aria-label="What" value={i.name} placeholder="What it is" onChange={e => set(k, { name: e.target.value })} />
      <span className="nums">
        <label className="inwrap"><input aria-label="Quantity" inputMode="decimal" value={i.qty || ""} placeholder="1" onChange={e => set(k, { qty: n(e.target.value) })} />{i.unit && <em>{i.unit}</em>}</label>
        <span className="x" aria-hidden="true">×</span>
        <label className="inwrap"><i>$</i><input aria-label="Price each" inputMode="decimal" value={i.price || ""} placeholder="0" onChange={e => set(k, { price: n(e.target.value) })} /></label>
        <b className="t">{dollars(lineTotal(i))}</b>
        <button type="button" className="btn ghost sm ic" aria-label={`Remove ${i.name || "line"}`} onClick={() => setItems(xs => xs.filter((_, j) => j !== k))}>{X}</button>
      </span>
    </li>)}</ul>
    <button type="button" className="btn sm add" onClick={() => setItems(xs => [...xs, { name: "", qty: 1, unit: "", price: 0 }])}><Icon name="plus" size={14} />Add a line</button>
    <dl>
      <div><dt>Subtotal</dt><dd>{dollars(t.subtotal)}</dd></div>
      <div><dt>Tax<label className="tax"><input aria-label="Tax percent" inputMode="decimal" value={tax || ""} placeholder="0" onChange={e => setTax(Math.min(20, n(e.target.value)))} />%</label></dt><dd>{dollars(t.tax)}</dd></div>
      <div className="tot"><dt>Total</dt><dd>{dollars(t.total)}</dd></div>
    </dl>
  </div>;
}

export function invoiceState(i: CardInvoice): { text: string; tone: "" | "green" | "blue" | "amber" | "red" } {
  if (i.status === "paid") return { text: `Paid${i.paid_at ? " " + dateLabel(i.paid_at) : ""}`, tone: "green" };
  if (i.status === "void") return { text: "Voided", tone: "" };
  if (i.status === "draft") return { text: "Draft", tone: "" };
  if (i.paid_claimed_at) return { text: "Says they paid", tone: "amber" };
  if (overdue(i.status, i.due_on, todayIso())) return { text: "Past due", tone: "red" };
  return { text: i.viewed_at ? "Opened" : "Sent", tone: "blue" };
}

/** One invoice: lines, due date, note; send it, copy the link, mark it paid. */
export function InvoiceSheet({ inv, customer, project, api, toast, reload, payLink, onClose, onSetup }: { inv: CardInvoice; customer: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; payLink: boolean; onClose: () => void; onSetup: () => void }) {
  const [items, setItems] = useState<Item[]>(inv.items), [tax, setTax] = useState(inv.tax_rate), [note, setNote] = useState(inv.note), [due, setDue] = useState(inv.due_on ?? "");
  const [busy, setBusy] = useState(""), [arm, setArm] = useArm();
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
  async function send() { if (dirty && !(await save())) return; await act("send", { action: "invoicesend" }, r => r.sent ? `Invoice texted to ${first}.` : r.warn || "Ready."); }
  async function copy() {
    let url = inv.url;
    if (!url) { const r = await act("send", { action: "invoicesend" }, r2 => r2.sent ? `Invoice texted to ${first}.` : "Link ready."); url = r?.link ?? null; }
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast("Invoice link copied."); } catch { prompt("Copy the invoice link:", url); }
  }
  return <Sheet onClose={onClose} title={`Invoice #${inv.number}`} sub={<>{customer} · <span className={"tag " + st.tone}>{st.text}</span></>}
    foot={<>
      {inv.status === "paid" ? <button type="button" className="btn" disabled={!!busy} onClick={() => void act("unpaid", { action: "invoiceset", what: "unpaid" }, "Marked unpaid.")}>Mark unpaid</button>
        : !locked && <button type="button" className="btn ok" disabled={!!busy} onClick={() => void act("paid", { action: "invoiceset", what: "paid" }, `Paid. ${dollars(inv.total)} recorded.`, true)}><Icon name="check" size={14} />Mark paid</button>}
      {inv.status === "sent" && <button type="button" className="btn" disabled={!!busy} onClick={() => void act("pause", { action: "invoiceset", what: inv.reminders_paused ? "resume" : "pause" }, inv.reminders_paused ? "Reminders back on." : "Reminders paused.")}>{inv.reminders_paused ? "Resume reminders" : "Pause reminders"}</button>}
      {!locked && <button type="button" className="btn danger" disabled={!!busy} onClick={() => arm === "void" ? void act("void", { action: "invoiceset", what: "void" }, "Invoice voided.", true) : setArm("void")}>{arm === "void" ? "Tap again to void" : "Void"}</button>}
      <span style={{ flex: 1 }} />
      {!locked && dirty && <button type="button" className="btn" disabled={!!busy} onClick={() => void save()}>Save</button>}
      {!locked && <button type="button" className="btn" disabled={!!busy} onClick={() => void copy()}><Icon name="link" size={14} />Copy link</button>}
      {!locked && <button type="button" className="btn ink" disabled={!!busy} onClick={() => void send()}>{busy === "send" ? <Spinner /> : <><Icon name="send" size={14} />{inv.status === "sent" ? "Text it again" : `Text ${first}`}</>}</button>}
    </>}>
    {!payLink && !locked && <div className="card warn"><div className="bd"><b className="t-em">No pay link yet</b><p className="fine" style={{ marginTop: 2 }}>Add your Square, Stripe or PayPal link so customers can pay from the invoice.</p>
      <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={onSetup}>Add pay link</button></div></div>}
    {inv.paid_claimed_at && inv.status === "sent" && <div className="card warn"><div className="bd"><b className="t-em">{first} says they paid</b><p className="fine" style={{ marginTop: 2 }}>Check your account. Reminders are paused until you mark it paid.</p></div></div>}
    {locked ? <div><ul className="lines">{inv.items.map((i, k) => <li key={k}><span>{i.name}<small>{i.qty} {i.unit} × {dollars(i.price)}</small></span><b>{dollars(lineTotal(i))}</b></li>)}</ul>
      <div className="money sum"><span className="t-em">Total</span><b>{dollars(inv.total)}</b></div></div>
      : <>
        <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />
        <div className="two">
          <label className="field"><span>Due</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        </div>
        <label className="field"><span>Note <em>they&rsquo;ll see it</em></span><textarea rows={2} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Thanks for your business. Two-year warranty on the install." /></label>
      </>}
    {inv.status === "sent" && <p className="fine">{inv.reminders_paused ? "Payment reminders are paused." : inv.reminders ? `${inv.reminders} of 3 payment reminders sent.` : "Up to 3 reminders after the due date."}</p>}
  </Sheet>;
}

/** Payments settings: the owner's own pay link, sales tax and how long invoices give. */
export function BillingSettings({ setup, project, api, toast, reload, onClose }: { setup: Record<string, string>; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [link, setLink] = useState(setup.pay_link || ""), [tax, setTax] = useState(setup.tax_rate || ""), [daysDue, setDays] = useState(setup.invoice_days || "7"), [busy, setBusy] = useState(false);
  return <Sheet onClose={onClose} title="Invoices and payments" sub="Used on every quote and invoice"
    foot={<button type="button" className="btn ink" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api("/api/app/act", { p: project, action: "setup", setup: { pay_link: link, tax_rate: tax || "0", invoice_days: daysDue } }); toast("Saved."); await reload(); onClose(); }
      catch (e) { toast(e instanceof Error ? e.message : "Couldn't save.", true); } finally { setBusy(false); }
    }}>{busy ? <Spinner /> : "Save"}</button>}>
    <label className="field"><span>Your pay link</span><input inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="square.link/u/yourbusiness" /></label>
    <p className="fine" style={{ marginTop: -8 }}>Square, Stripe, PayPal or your own site. The invoice&rsquo;s Pay button opens it. Cinder never touches the money.</p>
    <div className="two">
      <label className="field"><span>Sales tax</span><span className="inwrap"><input inputMode="decimal" value={tax} onChange={e => setTax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><em>%</em></span></label>
      <label className="field"><span>Invoices are due</span><select value={daysDue} onChange={e => setDays(e.target.value)}><option value="0">On receipt</option><option value="7">In 7 days</option><option value="14">In 14 days</option><option value="30">In 30 days</option></select></label>
    </div>
  </Sheet>;
}

const isCustomer = (c: { jobs: number; stage: string | null }) => c.jobs > 0 || c.stage === "won";
/** Everyone who ever got in touch: who they are, where, what they've bought, what they owe. */
export function CustomersScreen({ d, go }: { d: Data; go: Go }) {
  const list = d.customers ?? [];
  const [q, setQ] = useState(""), [f, setF] = useState<"all" | "customers" | "owes" | "leads">("all");
  const [wide, setWide] = useState(false);
  useEffect(() => { const m = matchMedia("(min-width: 900px)"); const h = () => setWide(m.matches); h(); m.addEventListener("change", h); return () => m.removeEventListener("change", h); }, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(), dg = s.replace(/\D/g, "");
    return list.filter(c => (f === "customers" ? isCustomer(c) : f === "owes" ? c.owed > 0 : f === "leads" ? !isCustomer(c) : true))
      .filter(c => !s || c.name.toLowerCase().includes(s) || c.address.toLowerCase().includes(s) || (dg.length >= 3 && c.phone.replace(/\D/g, "").includes(dg)));
  }, [list, q, f]);
  const spent = list.reduce((a, c) => a + c.spent, 0), owed = list.reduce((a, c) => a + c.owed, 0), paying = list.filter(isCustomer).length;
  const status = (c: typeof list[number]) => c.owed > 0 ? ["Owes you", "red"] : isCustomer(c) ? ["Customer", "green"] : c.open_quote ? ["Quoted", "amber"] : ["Lead", ""];
  return <>
    <header className="ph"><h1>Customers</h1><span className="sub">{list.length} people · {paying} paying</span>
      <div className="acts"><button type="button" className="btn" onClick={go.importCustomers}><Icon name="upload" size={15} />Import</button><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={15} />Add lead</button></div></header>
    <div className="pad jobs">
      <div className="kpis">
        <div className="kpi"><span>People</span><b>{list.length}</b><small>everyone who got in touch</small></div>
        <div className="kpi"><span>Customers</span><b>{paying}</b><small>bought at least once</small></div>
        <div className="kpi"><span>Lifetime billed</span><b>{short(spent)}</b><small>across every job</small></div>
        <div className="kpi"><span>Owed to you</span><b className={owed ? "" : "mut"}>{short(owed)}</b><small>{owed ? "open invoices" : "all paid up"}</small></div>
      </div>
      <div className="bar-tools">
        <label className="inwrap search"><Icon name="search" size={15} /><span className="sr">Search customers</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, address or phone" /></label>
        <div className="seg" role="tablist" aria-label="Show">{([["all", "Everyone"], ["customers", "Customers"], ["leads", "Leads"], ["owes", "Owes you"]] as const).map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div>
      </div>
      {!shown.length ? <Empty icon="users" title={q ? "No one matches that" : "No customers yet"} text={q ? "Try a name, street or the last 4 digits." : "Import your list from Jobber or a spreadsheet, or add people as they call."} action={!q && <button type="button" className="btn" onClick={go.importCustomers}>Import customers</button>} />
      : wide ? <div className="tbl-wrap"><table className="tbl" style={{ minWidth: 820 }}>
        <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Source</th><th>Last contact</th><th className="right">Value</th></tr></thead>
        <tbody>{shown.map(c => { const name = c.name || fmtPhone(c.phone), st = status(c); return <tr key={c.id} tabIndex={0} onClick={() => go.record(c.id)} onKeyDown={e => { if (e.key === "Enter") go.record(c.id); }}>
          <td><span className="name"><span><b>{name}</b><small>{c.address || c.line || " "}</small></span></span></td>
          <td className="mut">{fmtPhone(c.phone)}</td>
          <td><span className={"tag " + st[1]}>{st[0]}</span></td>
          <td className="mut">{sourceLabel(c.source)}</td>
          <td className="mut">{dateLabel(c.last)}</td>
          <td className="num">{c.owed > 0 ? <span style={{ color: "var(--red-text)" }}>{dollars(c.owed)} owed</span> : c.spent > 0 ? <>{dollars(c.spent)} <span className="mut" style={{ fontWeight: 400 }}>· {c.jobs} {c.jobs === 1 ? "job" : "jobs"}</span></> : c.open_quote ? <span className="mut" style={{ fontWeight: 400 }}>{dollars(c.open_quote)} quoted</span> : <span className="mut">–</span>}</td>
        </tr>; })}</tbody></table>
        <div className="tbl-foot"><span>{shown.length} of {list.length} people</span></div></div>
      : <div>{shown.map(c => { const name = c.name || fmtPhone(c.phone), st = status(c); return <button key={c.id} type="button" className="jrow" onClick={() => go.record(c.id)}>
        <Avatar name={name} size="lg" /><span style={{ minWidth: 0 }}><b>{name}</b><small>{c.address || c.line || fmtPhone(c.phone)}</small></span>
        <span className="r"><b>{c.owed > 0 ? dollars(c.owed) : c.spent > 0 ? dollars(c.spent) : c.open_quote ? dollars(c.open_quote) : ""}</b><em className={st[1] === "" ? "" : st[1]}>{st[0]}</em></span></button>; })}</div>}
    </div>
  </>;
}

/** Every invoice in one list: what's out, what's late, what's paid. */
export function InvoicesScreen({ d, go }: { d: Data; go: Go }) {
  const list = d.invoices ?? [], today = todayIso();
  const [f, setF] = useState<"open" | "paid" | "all">("open");
  const [wide, setWide] = useState(false);
  useEffect(() => { const m = matchMedia("(min-width: 900px)"); const h = () => setWide(m.matches); h(); m.addEventListener("change", h); return () => m.removeEventListener("change", h); }, []);
  const out = list.filter(i => i.status === "sent"), late = out.filter(i => overdue(i.status, i.due_on, today));
  const paid30 = list.filter(i => i.status === "paid" && i.paid_at && Date.parse(i.paid_at) > Date.now() - 30 * 86400000).reduce((a, i) => a + i.total, 0);
  const shown = f === "open" ? list.filter(i => i.status === "sent" || i.status === "draft") : f === "paid" ? list.filter(i => i.status === "paid") : list;
  const Row = ({ i }: { i: InvoiceRow }) => { const st = invoiceState(i), name = i.customer || fmtPhone(i.phone); return <tr tabIndex={0} onClick={() => go.invoice(i.id)} onKeyDown={e => { if (e.key === "Enter") go.invoice(i.id); }}>
    <td className="mut">#{i.number}</td>
    <td><span className="name"><span><b>{name}</b><small>{i.items[0]?.name || " "}</small></span></span></td>
    <td className="mut">{i.sent_at ? dateLabel(i.sent_at) : "Not sent"}</td>
    <td><span className={"tag " + st.tone}>{st.text}</span></td>
    <td className={st.tone === "red" ? "" : "mut"} style={st.tone === "red" ? { color: "var(--red-text)" } : undefined}>{i.due_on ? dateLabel(i.due_on) : "–"}</td>
    <td className="num">{dollars(i.total)}</td>
  </tr>; };
  return <>
    <header className="ph"><h1>Invoices</h1><span className="sub">{out.length ? `${out.length} outstanding · ${dollars(out.reduce((a, i) => a + i.total, 0))}` : "Nothing outstanding"}</span>
      <div className="acts"><button type="button" className="btn" onClick={go.billing}><Icon name="gear" size={15} />Pay link and tax</button></div></header>
    <div className="pad jobs">
      <div className="kpis">
        <div className="kpi"><span>Outstanding</span><b>{short(out.reduce((a, i) => a + i.total, 0))}</b><small>{out.length} {out.length === 1 ? "invoice" : "invoices"} out</small></div>
        <div className="kpi"><span>Past due</span><b className={late.length ? "" : "mut"} style={late.length ? { color: "var(--red-text)" } : undefined}>{short(late.reduce((a, i) => a + i.total, 0))}</b><small>{late.length ? `${late.length} late · reminders running` : "nothing late"}</small></div>
        <div className="kpi"><span>Paid · 30 days</span><b>{short(paid30)}</b><small>through your pay link</small></div>
      </div>
      <div className="bar-tools"><div className="seg" role="tablist" aria-label="Show">{([["open", "Open"], ["paid", "Paid"], ["all", "All"]] as const).map(([k, l]) =>
        <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div></div>
      {!shown.length ? <Empty icon="invoice" title={f === "open" ? "Nothing outstanding" : "No invoices yet"} text="Create one from a won job. It pulls the lines from the quote." />
      : wide ? <div className="tbl-wrap"><table className="tbl" style={{ minWidth: 760 }}>
        <thead><tr><th>Invoice</th><th>Customer</th><th>Sent</th><th>Status</th><th>Due</th><th className="right">Amount</th></tr></thead>
        <tbody>{shown.map(i => <Row key={i.id} i={i} />)}</tbody></table></div>
      : <div>{shown.map(i => { const st = invoiceState(i), name = i.customer || fmtPhone(i.phone); return <button key={i.id} type="button" className="jrow" onClick={() => go.invoice(i.id)}>
        <Avatar name={name} size="lg" /><span style={{ minWidth: 0 }}><b>{name}</b><small>#{i.number}{i.due_on ? ` · due ${dateLabel(i.due_on)}` : ""}</small></span>
        <span className="r"><b>{dollars(i.total)}</b><em className={st.tone}>{st.text}</em></span></button>; })}</div>}
    </div>
  </>;
}
