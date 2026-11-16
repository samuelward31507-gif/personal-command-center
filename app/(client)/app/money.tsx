"use client";

// Money: every invoice, what's owed and late, the quotes still out, and what Cinder brought in. Numbers lives
// here as the right-hand pane. The invoice sheet is where lines are edited, texted and marked paid.
import { useState } from "react";
import { dollars, lineTotal, overdue, totals, type Item } from "@/lib/billing";
import { PAY_METHODS, type CardInvoice, type Payment } from "@/lib/crm";
import { Avatar, Icon, Sheet, Spinner, ago, dateLabel, fmtPhone, short, todayIso, useArm, usd, type Api, type Toast } from "./parts";
import { Guide, Kpis, MiniDoc, PageHead } from "./charts";
import type { Biz, Data, Go, InvoiceRow } from "./types";

/** Editable quote or invoice lines: what, how many, the unit price. Totals are worked out, never typed. */
export function LineEditor({ items, setItems, tax, setTax }: { items: Item[]; setItems: (f: (x: Item[]) => Item[]) => void; tax: number; setTax: (n: number) => void }) {
  const t = totals(items.filter(i => i.name.trim() && i.qty > 0), tax);
  const set = (k: number, patch: Partial<Item>) => setItems(xs => xs.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  const n = (v: string) => { const x = Number(v.replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };
  return <div className="le">
    <ul>{items.map((i, k) => <li key={k} className="lrow">
      <input className="input" aria-label="What" value={i.name} placeholder="What it is" onChange={e => set(k, { name: e.target.value })} />
      <span className="nums">
        <label className="inwrap"><input aria-label="Quantity" inputMode="decimal" value={i.qty || ""} placeholder="1" onChange={e => set(k, { qty: n(e.target.value) })} />{i.unit && <em>{i.unit}</em>}</label>
        <span className="x" aria-hidden="true">×</span>
        <label className="inwrap"><i>$</i><input aria-label="Price each" inputMode="decimal" value={i.price || ""} placeholder="0" onChange={e => set(k, { price: n(e.target.value) })} /></label>
        <b className="t">{dollars(lineTotal(i))}</b>
        <button type="button" className="btn ghost sm ic" aria-label={`Remove ${i.name || "line"}`} onClick={() => setItems(xs => xs.filter((_, j) => j !== k))}><Icon name="x" size={13} /></button>
      </span>
    </li>)}</ul>
    <button type="button" className="btn sm add" onClick={() => setItems(xs => [...xs, { name: "", qty: 1, unit: "", price: 0 }])}><Icon name="plus" size={13} />Add a line</button>
    <dl>
      <div><dt>Subtotal</dt><dd>{dollars(t.subtotal)}</dd></div>
      <div><dt>Tax<label className="tax"><input aria-label="Tax percent" inputMode="decimal" value={tax || ""} placeholder="0" onChange={e => setTax(Math.min(20, n(e.target.value)))} />%</label></dt><dd>{dollars(t.tax)}</dd></div>
      <div className="tot"><dt>Total</dt><dd>{dollars(t.total)}</dd></div>
    </dl>
  </div>;
}

/** What's still owed on an invoice. */
export const balanceOf = (i: CardInvoice) => i.status === "paid" || i.status === "void" ? 0 : Math.max(0, Math.round((i.total - (i.paid_amount ?? 0)) * 100) / 100);
/** A small set of states, lateness worked out from the due date (Stripe's way). */
export function invoiceState(i: CardInvoice): { text: string; tone: "" | "green" | "blue" | "amber" | "red" } {
  if (i.status === "paid") return { text: `Paid${i.paid_at ? " " + dateLabel(i.paid_at) : ""}`, tone: "green" };
  if (i.status === "void") return { text: "Voided", tone: "" };
  if (i.status === "draft") return { text: "Draft", tone: "" };
  if (i.paid_claimed_at) return { text: "Says they paid", tone: "amber" };
  if (overdue(i.status, i.due_on, todayIso())) return { text: (i.paid_amount ?? 0) > 0 ? "Past due, part paid" : "Past due", tone: "red" };
  if ((i.paid_amount ?? 0) > 0) return { text: "Part paid", tone: "blue" };
  return { text: "Awaiting payment", tone: "blue" };
}
const chipFor = (tone: string) => tone === "green" ? "good" : tone === "red" ? "bad" : tone === "amber" ? "ember" : tone === "blue" ? "blue" : "";
const dotFor = (tone: string) => tone === "green" ? "good" : tone === "red" ? "bad" : tone === "amber" ? "ember" : tone === "blue" ? "ink" : "";

/** One invoice: lines, due date, note; send it, copy the link, mark it paid. */
export function InvoiceSheet({ inv, customer, email, payments = [], project, api, toast, reload, payLink, onClose, onSetup }: { inv: CardInvoice; customer: string; email?: string; payments?: Payment[]; project: string; api: Api; toast: Toast; reload: () => Promise<void>; payLink: boolean; onClose: () => void; onSetup: () => void }) {
  const [items, setItems] = useState<Item[]>(inv.items), [tax, setTax] = useState(inv.tax_rate), [note, setNote] = useState(inv.note), [due, setDue] = useState(inv.due_on ?? "");
  const [busy, setBusy] = useState(""), [arm, setArm] = useArm();
  const bal = balanceOf(inv), mine = payments.filter(p => p.invoice_id === inv.id);
  const [paying, setPaying] = useState(false), [pAmt, setPAmt] = useState(String(bal || "")), [pMethod, setPMethod] = useState<string>("card"), [pOn, setPOn] = useState(todayIso()), [pNote, setPNote] = useState("");
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
  return <Sheet onClose={onClose} title={`Invoice #${inv.number}`} sub={<>{customer}, <span className={"dot " + dotFor(st.tone)} style={{ display: "inline-flex" }}>{st.text}</span></>}
    foot={<>
      {inv.status === "paid" ? <button type="button" className="btn" disabled={!!busy} onClick={() => void act("unpaid", { action: "invoiceset", what: "unpaid" }, "Marked unpaid.")}>Mark unpaid</button>
        : !locked && !paying && <button type="button" className="btn ok" disabled={!!busy} onClick={() => { setPAmt(String(bal)); setPaying(true); }}>Record payment</button>}
      {inv.status === "sent" && <button type="button" className="btn" disabled={!!busy} onClick={() => void act("pause", { action: "invoiceset", what: inv.reminders_paused ? "resume" : "pause" }, inv.reminders_paused ? "Reminders back on." : "Reminders paused.")}>{inv.reminders_paused ? "Resume reminders" : "Pause reminders"}</button>}
      {!locked && <button type="button" className="btn danger" disabled={!!busy} onClick={() => arm === "void" ? void act("void", { action: "invoiceset", what: "void" }, "Invoice voided.", true) : setArm("void")}>{arm === "void" ? "Tap again to void" : "Void"}</button>}
      <span style={{ flex: 1 }} />
      {!locked && dirty && <button type="button" className="btn" disabled={!!busy} onClick={() => void save()}>Save</button>}
      {!locked && <button type="button" className="btn" disabled={!!busy} onClick={() => void copy()}>Copy link</button>}
      {!locked && email && inv.url && <a className="btn" href={`mailto:${email}?subject=${encodeURIComponent(`Invoice #${inv.number}`)}&body=${encodeURIComponent(`Hi ${first}, here's your invoice for ${dollars(inv.total)}${inv.due_on ? `, due ${dateLabel(inv.due_on)}` : ""}. You can see it and pay here: ${inv.url}`)}`}>Email it</a>}
      {!locked && <button type="button" className="btn ink" disabled={!!busy} onClick={() => void send()}>{busy === "send" ? <Spinner /> : inv.status === "sent" ? "Text it again" : `Text ${first}`}</button>}
    </>}>
    {!payLink && !locked && <div className="card box"><b className="t-em">No pay link yet</b><p className="fine" style={{ marginTop: 2 }}>Add your Square, Stripe or PayPal link so customers can pay from the invoice.</p>
      <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={onSetup}>Add pay link</button></div>}
    {inv.paid_claimed_at && inv.status === "sent" && <div className="card box"><b className="t-em">{first} says they paid</b><p className="fine" style={{ marginTop: 2 }}>Check your account. Reminders are paused until you mark it paid.</p></div>}
    {locked ? <div><ul className="lines">{inv.items.map((i, k) => <li key={k}><span>{i.name}<small>{i.qty} {i.unit} × {dollars(i.price)}</small></span><b>{dollars(lineTotal(i))}</b></li>)}</ul>
      <div className="money sum"><span className="t-em">Total</span><b>{dollars(inv.total)}</b></div></div>
      : <>
        <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />
        <div className="two"><label className="field"><span>Due</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label></div>
        <label className="field"><span>Note <em>they&rsquo;ll see it</em></span><textarea rows={2} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Thanks for your business. Two-year warranty on the install." /></label>
      </>}
    {(mine.length > 0 || paying || (inv.status !== "draft" && inv.status !== "void")) && <section className="ledger">
      <p className="sec">Payments<small>{dollars(inv.total - bal)} of {dollars(inv.total)} in</small></p>
      {mine.map(p => <div key={p.id} className="lrow2"><span>{dateLabel(p.paid_on)}</span><span className="mut">{PAY_METHODS.find(m => m[0] === p.method)?.[1].split(",")[0] ?? "Other"}{p.note ? `, ${p.note}` : ""}</span><b>{dollars(p.amount)}</b>
        <button type="button" className="btn ghost sm ic" aria-label="Remove this payment" title="Remove" disabled={!!busy} onClick={() => arm === "rm" + p.id ? void act("rm", { action: "paymentdelete", payment: p.id }, "Payment removed.") : setArm("rm" + p.id)}><Icon name={arm === "rm" + p.id ? "check" : "x"} size={12} /></button></div>)}
      <div className="lrow2 bal"><span>Balance</span><span /><b style={bal > 0 && st.tone === "red" ? { color: "var(--bad)" } : undefined}>{dollars(bal)}</b><span /></div>
      {paying && <form className="payform" onSubmit={e => { e.preventDefault(); void act("pay", { action: "payment", amount: pAmt, method: pMethod, on: pOn, note: pNote }, Number(pAmt) >= bal ? `Paid in full. ${dollars(Number(pAmt))} recorded.` : `${dollars(Number(pAmt) || 0)} recorded. ${dollars(Math.max(0, bal - (Number(pAmt) || 0)))} still owed.`).then(r => { if (r) setPaying(false); }); }}>
        <label className="field"><span>Amount</span><span className="inwrap"><i>$</i><input inputMode="decimal" autoFocus value={pAmt} onChange={e => setPAmt(e.target.value.replace(/[^\d.]/g, ""))} /></span></label>
        <label className="field"><span>How</span><select value={pMethod} onChange={e => setPMethod(e.target.value)}>{PAY_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field"><span>Date</span><input type="date" value={pOn} onChange={e => setPOn(e.target.value)} /></label>
        <label className="field"><span>Note <em>check number, last 4</em></span><input value={pNote} maxLength={200} onChange={e => setPNote(e.target.value)} /></label>
        <div className="acts-row end" style={{ gridColumn: "1 / -1" }}><button type="button" className="btn ghost" onClick={() => setPaying(false)}>Cancel</button><button type="submit" className="btn ink" disabled={!!busy || !(Number(pAmt) > 0)}>{busy === "pay" ? <Spinner /> : "Record payment"}</button></div>
      </form>}
      <p className="fine">{payLink ? "Card payments land in your own account through your pay link. Record them here, with cash, checks and deposits, so the balance stays right." : "Record cash, checks and deposits here so the balance stays right."}</p>
    </section>}
    {inv.status === "sent" && <p className="fine">{inv.reminders_paused ? "Payment reminders are paused." : inv.reminders ? `${inv.reminders} of 3 payment reminders sent, each for the balance.` : "Up to 3 reminders after the due date, each for the balance."}</p>}
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
    <p className="fine" style={{ marginTop: -6 }}>Square, Stripe, PayPal or your own site. The invoice&rsquo;s Pay button opens it. Cinder never touches the money.</p>
    <div className="two">
      <label className="field"><span>Sales tax</span><span className="inwrap"><input inputMode="decimal" value={tax} onChange={e => setTax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><em>%</em></span></label>
      <label className="field"><span>Invoices are due</span><select value={daysDue} onChange={e => setDays(e.target.value)}><option value="0">On receipt</option><option value="7">In 7 days</option><option value="14">In 14 days</option><option value="30">In 30 days</option></select></label>
    </div>
  </Sheet>;
}

/** Money: what's owed and how late, what came in, every invoice with its balance, every payment. Quotes have their own tab. */
export function MoneyScreen({ d, go, wide, biz, project, api, toast, reload }: { d: Data; go: Go; wide: boolean; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void> }) {
  const list = d.invoices ?? [], pays = d.payments ?? [], today = todayIso();
  const [f, setF] = useState<"open" | "draft" | "paid" | "all">("open"), [view, setView] = useState<"invoices" | "payments">("invoices");
  const [picking, setPicking] = useState(false), [making, setMaking] = useState(""), [pq, setPq] = useState(""), [exp, setExp] = useState(false);
  // Who can be invoiced: won jobs without an invoice first, then everyone else on file.
  const board = d.board ?? [];
  const ready = board.filter(c => c.stage === "won" && !c.invoice && !c.pastCustomer);
  const others = (d.customers ?? []).filter(c => !ready.some(r => r.id === c.id)).map(c => ({ id: c.id, name: c.name || fmtPhone(c.phone), sub: c.line || c.address || fmtPhone(c.phone) }));
  const pickList = [...ready.map(c => ({ id: c.id, name: c.name || fmtPhone(c.phone), sub: `Won${c.value ? `, ${usd(c.value)}` : ""}${c.line ? `, ${c.line}` : ""}`, won: true })), ...others.map(o => ({ ...o, won: false }))]
    .filter(o => !pq.trim() || o.name.toLowerCase().includes(pq.trim().toLowerCase()));
  async function newInvoice(id: string) {
    setMaking(id);
    try { const r = await api<{ invoice?: { id: string } }>("/api/app/act", { p: project, thread: id, action: "invoice" }); await reload(); setPicking(false); if (r.invoice) go.invoice(r.invoice.id); toast("Invoice drafted. Check it, then text it."); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't start the invoice.", true); } finally { setMaking(""); }
  }
  const fresh = !list.length && !pays.length;
  const open = list.filter(i => i.status === "sent"), late = open.filter(i => overdue(i.status, i.due_on, today));
  const outstanding = open.reduce((a, i) => a + balanceOf(i), 0), lateAmt = late.reduce((a, i) => a + balanceOf(i), 0);
  const monthStart = today.slice(0, 8) + "01";
  const collected = pays.filter(p => p.paid_on >= monthStart).reduce((a, p) => a + p.amount, 0);
  const paidRecent = list.filter(i => i.status === "paid" && i.paid_at && i.sent_at && Date.parse(i.paid_at) > Date.now() - 90 * 86400000);
  const payDays = paidRecent.length ? Math.round(paidRecent.reduce((a, i) => a + (Date.parse(i.paid_at!) - Date.parse(i.sent_at!)) / 86400000, 0) / paidRecent.length) : null;
  // Aging: days past due, from the due date (QuickBooks' buckets).
  // Money in by week, last 8 weeks, for the sparkline.
  const weeklyIn = Array.from({ length: 8 }, (_, k) => { const end = Date.now() - (7 - k) * 7 * 86400000, start = end - 7 * 86400000; return pays.filter(p => { const t = Date.parse(p.paid_on + "T12:00:00"); return t > start && t <= end; }).reduce((a, p) => a + p.amount, 0); });
  const daysLate = (i: InvoiceRow) => i.due_on ? Math.floor((Date.parse(today + "T12:00:00") - Date.parse(i.due_on + "T12:00:00")) / 86400000) : 0;
  const buckets = [["Not yet due", (n: number) => n <= 0], ["1 to 30 days", (n: number) => n >= 1 && n <= 30], ["31 to 60", (n: number) => n > 30 && n <= 60], ["61 to 90", (n: number) => n > 60 && n <= 90], ["Over 90", (n: number) => n > 90]] as const;
  const aging = buckets.map(([l, t]) => ({ l, v: open.filter(i => t(daysLate(i))).reduce((a, i) => a + balanceOf(i), 0) }));
  const shown = f === "open" ? list.filter(i => i.status === "sent") : f === "draft" ? list.filter(i => i.status === "draft") : f === "paid" ? list.filter(i => i.status === "paid") : list;
  const counts = { open: open.length, draft: list.filter(i => i.status === "draft").length, paid: list.filter(i => i.status === "paid").length, all: list.length };
  return <>
    <PageHead title="Money" sub={fresh ? "No invoices yet. Here's how money flows." : outstanding ? `${usd(outstanding)} owed to you${late.length ? `, ${usd(lateAmt)} of it past due.` : ", none of it late."}` : "Nothing owed. Everything is paid up."}
      actions={<>
        <div className="menu-wrap"><button type="button" className="btn" aria-expanded={exp} onClick={() => setExp(x => !x)}><Icon name="upload" size={13} />Export</button>
          {exp && <div className="menu pop" role="menu" onMouseLeave={() => setExp(false)}>
            <a role="menuitem" href={`/api/app/export?p=${encodeURIComponent(project)}&what=invoices`}>Invoices, as CSV</a>
            <a role="menuitem" href={`/api/app/export?p=${encodeURIComponent(project)}&what=payments`}>Payments, as CSV</a>
            <a role="menuitem" href={`/api/app/export?p=${encodeURIComponent(project)}`}>Customers, as CSV</a>
            <small>Opens in Excel, Google Sheets or QuickBooks.</small></div>}</div>
        <button type="button" className="btn" onClick={go.billing}>Pay link and tax</button>
        <button type="button" className="btn ink" onClick={() => setPicking(true)}><Icon name="plus" size={14} />New invoice</button>
      </>} />
    <div className="dash money2">
      {!fresh && <Kpis items={[
        { label: "Outstanding", value: usd(outstanding), sub: `${open.length} ${open.length === 1 ? "invoice" : "invoices"} awaiting payment` },
        { label: "Past due", value: usd(lateAmt), sub: late.length ? `${late.length} ${late.length === 1 ? "invoice" : "invoices"}, reminders going out` : "None late", tone: late.length ? "down" : "" },
        { label: "Collected this month", value: usd(collected), sub: (() => { const k = pays.filter(p => p.paid_on >= monthStart).length; return `${k} ${k === 1 ? "payment" : "payments"} recorded`; })(), tone: collected ? "up" : "", spark: weeklyIn, sparkTone: "good" },
        { label: "Days to get paid", value: payDays == null ? "–" : String(payDays), sub: "average, last 90 days" },
      ]} />}
      {fresh && <Guide title="Get paid faster" sub="Invoices go out by text with a Pay button that opens your own payment page. Reminders follow up on their own until the balance is zero. Cinder never touches the money."
        steps={[
          { title: "Add your pay link", text: "Square, Stripe, PayPal or your own checkout page. It sits behind every Pay button.", done: biz.payLink, action: <button type="button" className="btn sm" onClick={go.billing}>Add pay link</button> },
          { title: "Win a job", text: "When a customer approves a quote, or you mark a job won, it's ready to bill.", done: board.some(c => c.stage === "won"), action: <button type="button" className="btn sm" onClick={() => go.tab("quotes")}>Open quotes</button> },
          { title: "Send the first invoice", text: "It pulls the lines from the quote. Check it, then text it.", action: <button type="button" className="btn sm ink" onClick={() => setPicking(true)}>New invoice</button> },
          { title: "Record what comes in", text: "Card, cash, check or a deposit. Part payments are fine; the balance updates everywhere." },
        ]}
        side={<MiniDoc kind="invoice" business={biz.business} href="/i/example" />} />}
      {!fresh && <>
      <section className="panel">
      {outstanding > 0 && <div className="aging panel-b" aria-label="Owed, by how late"><div className="aging-t"><b>Receivables</b><small>by days past due</small></div>
        <div className="aging-bar">{aging.map((a, k) => a.v > 0 ? <i key={a.l} className={"b" + k} style={{ flexGrow: a.v }} title={`${a.l}: ${usd(a.v)}`} /> : null)}</div>
        <dl>{aging.map((a, k) => <div key={a.l}><dt><i className={"b" + k} />{a.l}</dt><dd className={a.v ? "" : "faint"}>{usd(a.v)}</dd></div>)}</dl>
      </div>}
      <div className="list-tools panel-tools">
        <div className="seg" role="tablist" aria-label="Show"><button type="button" role="tab" aria-selected={view === "invoices"} className={view === "invoices" ? "on" : ""} onClick={() => setView("invoices")}>Invoices</button><button type="button" role="tab" aria-selected={view === "payments"} className={view === "payments" ? "on" : ""} onClick={() => setView("payments")}>Payments</button></div>
        {view === "invoices" && <div className="views" role="tablist" aria-label="Filter">{([["open", "Awaiting payment"], ["draft", "Drafts"], ["paid", "Paid"], ["all", "All"]] as const).map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}{counts[k] ? <em>{counts[k]}</em> : null}</button>)}</div>}
      </div>
      {view === "payments" ? (!pays.length ? <p className="fine" style={{ padding: "10px 0" }}>Payments you record on an invoice show here: card, cash, check, deposits.</p>
        : <table className="tbl"><colgroup><col style={{ width: 110 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 200 }} /><col style={{ width: 120 }} /></colgroup>
          <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>How</th><th className="right">Amount</th></tr></thead>
          <tbody>{pays.map(p => <tr key={p.id} tabIndex={0} onClick={() => go.invoice(p.invoice_id)} onKeyDown={e => { if (e.key === "Enter") go.invoice(p.invoice_id); }}>
            <td className="mut">{dateLabel(p.paid_on)}</td><td><b>{p.customer}</b></td><td className="mut">#{p.number}</td><td className="mut">{PAY_METHODS.find(m => m[0] === p.method)?.[1].split(",")[0]}{p.note ? `, ${p.note}` : ""}</td><td className="num"><b>{dollars(p.amount)}</b></td></tr>)}</tbody></table>)
      : !shown.length ? <p className="fine" style={{ padding: "10px 0" }}>{f === "open" ? "Nothing outstanding. Invoices start from a won job and pull the lines from the quote." : "No invoices here."}</p>
      : wide ? <table className="tbl inv-tbl">
        <colgroup><col style={{ width: 76 }} /><col style={{ width: 190 }} /><col /><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 170 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} /></colgroup>
        <thead><tr><th>Invoice</th><th>Customer</th><th>For</th><th>Issued</th><th>Due</th><th>Status</th><th className="right">Total</th><th className="right">Balance</th></tr></thead>
        <tbody>{shown.map(i => { const st = invoiceState(i), bal = balanceOf(i); return <tr key={i.id} tabIndex={0} onClick={() => go.invoice(i.id)} onKeyDown={e => { if (e.key === "Enter") go.invoice(i.id); }}>
          <td className="mut num-l">#{i.number}</td><td><b>{i.customer || fmtPhone(i.phone)}</b></td><td className="mut">{i.items[0]?.name || ""}</td>
          <td className="mut">{i.sent_at ? dateLabel(i.sent_at) : "–"}</td><td className={st.tone === "red" ? "bad-t" : "mut"}>{i.due_on ? dateLabel(i.due_on) : "–"}</td>
          <td><span className={"chipx " + chipFor(st.tone)}>{st.text}</span></td><td className="num mut">{dollars(i.total)}</td><td className="num"><b>{i.status === "void" ? "–" : dollars(bal)}</b></td>
        </tr>; })}</tbody></table>
      : shown.map(i => { const st = invoiceState(i); return <button key={i.id} type="button" className="jrow" onClick={() => go.invoice(i.id)}>
          <span style={{ minWidth: 0 }}><b>{i.customer || fmtPhone(i.phone)}</b><small>#{i.number}{i.due_on ? `, due ${dateLabel(i.due_on)}` : ""}</small></span>
          <span className="r"><b>{dollars(balanceOf(i) || i.total)}</b><em className={st.tone === "red" ? "red" : st.tone === "green" ? "green" : ""}>{st.text}</em></span></button>; })}
      </section>
      <div className="grid12">
        <section className="panel s7">
          <div className="panel-h"><h2>Latest payments</h2><small>{pays.length ? `${usd(pays.slice(0, 6).reduce((a, p) => a + p.amount, 0))} across the last ${Math.min(6, pays.length)}` : ""}</small><div className="r"><button type="button" className="link" onClick={() => setView("payments")}>All payments</button></div></div>
          <div className="panel-b flush">{pays.length ? pays.slice(0, 6).map(p => <button key={p.id} type="button" className="lv pay" onClick={() => go.invoice(p.invoice_id)}>
            <span className="ti ok"><Icon name="check" size={14} /></span><span className="lv-n"><b>{p.customer}</b><small>Invoice #{p.number}</small></span>
            <span className="lv-m">{PAY_METHODS.find(m => m[0] === p.method)?.[1].split(",")[0]}{p.note ? `, ${p.note}` : ""}</span><b className="num">{dollars(p.amount)}</b><time>{dateLabel(p.paid_on)}</time></button>)
            : <p className="empty-line" style={{ margin: "0 18px" }}>Record a payment on any invoice and it lands here: card, cash, check or a deposit.</p>}</div>
        </section>
        <section className="panel s5">
          <div className="panel-h"><h2>Who owes you</h2><small>by customer</small></div>
          <div className="panel-b">{(() => { const by = new Map<string, { name: string; owed: number; late: boolean; id: string }>(); for (const i of open) { const k = i.customer || i.phone; const e = by.get(k) ?? { name: i.customer || fmtPhone(i.phone), owed: 0, late: false, id: i.id }; e.owed += balanceOf(i); e.late ||= overdue(i.status, i.due_on, today); by.set(k, e); }
            const rows = [...by.values()].sort((a, b) => b.owed - a.owed), top = rows[0]?.owed || 1;
            return rows.length ? rows.slice(0, 6).map(r => <button key={r.id} type="button" className="pr" onClick={() => go.invoice(r.id)}><span className="pl">{r.name}</span><span className="pn">{r.late ? <span className="say bad">Late</span> : ""}</span><b>{usd(r.owed)}</b><i className={"pbar " + (r.late ? "late" : "quoted")}><span style={{ width: `${(r.owed / top) * 100}%` }} /></i></button>)
              : <div className="empty-art"><span><Icon name="check" size={18} /></span><b>Nobody owes you.</b><small>Every invoice is paid.</small></div>; })()}</div>
        </section>
      </div>
      </>}
    </div>
    {picking && <Sheet title="New invoice" sub="Who is it for?" onClose={() => setPicking(false)}>
      <label className="inwrap search" style={{ marginBottom: 8 }}><Icon name="search" size={14} /><input autoFocus value={pq} onChange={e => setPq(e.target.value)} placeholder="Search customers" aria-label="Search customers" /></label>
      {pickList.length ? <div className="pick">{pickList.slice(0, 40).map(o => <button key={o.id} type="button" className="row" disabled={!!making} onClick={() => void newInvoice(o.id)}>
        <Avatar name={o.name} size="sm" /><span style={{ minWidth: 0 }}><b>{o.name}</b><small>{o.sub}</small></span>{making === o.id ? <Spinner /> : o.won ? <span className="chipx good">Ready to bill</span> : <Icon name="fwd" size={13} className="faint" />}</button>)}</div>
        : <p className="fine">No customers yet. Add one from Jobs, or import your list.</p>}
    </Sheet>}
  </>;
}
