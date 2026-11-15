"use client";

// Money: every invoice, what's owed and late, the quotes still out, and what Cinder brought in. Numbers lives
// here as the right-hand pane. The invoice sheet is where lines are edited, texted and marked paid.
import { useState } from "react";
import { dollars, lineTotal, overdue, totals, type Item } from "@/lib/billing";
import type { CardInvoice } from "@/lib/crm";
import { Icon, Sheet, Spinner, ago, dateLabel, fmtPhone, short, todayIso, useArm, usd, type Api, type Toast } from "./parts";
import { line } from "./jobs";
import type { Data, Go, InvoiceRow } from "./types";

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

export function invoiceState(i: CardInvoice): { text: string; tone: "" | "green" | "blue" | "amber" | "red" } {
  if (i.status === "paid") return { text: `Paid${i.paid_at ? " " + dateLabel(i.paid_at) : ""}`, tone: "green" };
  if (i.status === "void") return { text: "Voided", tone: "" };
  if (i.status === "draft") return { text: "Draft", tone: "" };
  if (i.paid_claimed_at) return { text: "Says they paid", tone: "amber" };
  if (overdue(i.status, i.due_on, todayIso())) return { text: "Past due", tone: "red" };
  return { text: i.viewed_at ? "Opened" : "Sent", tone: "blue" };
}
const dotFor = (tone: string) => tone === "green" ? "good" : tone === "red" ? "bad" : tone === "amber" ? "ember" : tone === "blue" ? "ink" : "";

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
  return <Sheet onClose={onClose} title={`Invoice #${inv.number}`} sub={<>{customer}, <span className={"dot " + dotFor(st.tone)} style={{ display: "inline-flex" }}>{st.text}</span></>}
    foot={<>
      {inv.status === "paid" ? <button type="button" className="btn" disabled={!!busy} onClick={() => void act("unpaid", { action: "invoiceset", what: "unpaid" }, "Marked unpaid.")}>Mark unpaid</button>
        : !locked && <button type="button" className="btn ok" disabled={!!busy} onClick={() => void act("paid", { action: "invoiceset", what: "paid" }, `Paid. ${dollars(inv.total)} recorded.`, true)}>Mark paid</button>}
      {inv.status === "sent" && <button type="button" className="btn" disabled={!!busy} onClick={() => void act("pause", { action: "invoiceset", what: inv.reminders_paused ? "resume" : "pause" }, inv.reminders_paused ? "Reminders back on." : "Reminders paused.")}>{inv.reminders_paused ? "Resume reminders" : "Pause reminders"}</button>}
      {!locked && <button type="button" className="btn danger" disabled={!!busy} onClick={() => arm === "void" ? void act("void", { action: "invoiceset", what: "void" }, "Invoice voided.", true) : setArm("void")}>{arm === "void" ? "Tap again to void" : "Void"}</button>}
      <span style={{ flex: 1 }} />
      {!locked && dirty && <button type="button" className="btn" disabled={!!busy} onClick={() => void save()}>Save</button>}
      {!locked && <button type="button" className="btn" disabled={!!busy} onClick={() => void copy()}>Copy link</button>}
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
    <p className="fine" style={{ marginTop: -6 }}>Square, Stripe, PayPal or your own site. The invoice&rsquo;s Pay button opens it. Cinder never touches the money.</p>
    <div className="two">
      <label className="field"><span>Sales tax</span><span className="inwrap"><input inputMode="decimal" value={tax} onChange={e => setTax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><em>%</em></span></label>
      <label className="field"><span>Invoices are due</span><select value={daysDue} onChange={e => setDays(e.target.value)}><option value="0">On receipt</option><option value="7">In 7 days</option><option value="14">In 14 days</option><option value="30">In 30 days</option></select></label>
    </div>
  </Sheet>;
}

/** Money: what is owed, collected, quoted and won, then the invoices and the quotes as tables. */
export function MoneyScreen({ d, go, wide }: { d: Data; go: Go; wide: boolean }) {
  const list = d.invoices ?? [], today = todayIso(), L = d.live;
  const [f, setF] = useState<"open" | "paid" | "all">("open");
  const out = list.filter(i => i.status === "sent"), late = out.filter(i => overdue(i.status, i.due_on, today));
  const paid30 = list.filter(i => i.status === "paid" && i.paid_at && Date.parse(i.paid_at) > Date.now() - 30 * 86400000).reduce((a, i) => a + i.total, 0);
  const shown = f === "open" ? list.filter(i => i.status === "sent" || i.status === "draft") : f === "paid" ? list.filter(i => i.status === "paid") : list;
  const quotes = (d.board ?? []).filter(c => c.stage === "quoted" && (c.quote?.amount || c.value)).sort((a, b) => b.at.localeCompare(a.at));
  const owed = out.reduce((a, i) => a + i.total, 0);
  const quoteState = (c: typeof quotes[number]) => c.quote?.status === "replied" ? ["They replied", "bad"] : c.quote?.viewed ? [`Opened ${ago(c.quote.viewed)}`, "ink"] : c.quote?.linked ? [c.quote.steps ? `Follow-up ${c.quote.steps} of 4 sent` : "Sent, follow-up in 2 days", ""] : ["Not sent yet", "ember"];
  const views = <div className="views" role="tablist" aria-label="Show">{([["open", "Open", list.filter(i => i.status === "sent" || i.status === "draft").length], ["paid", "Paid", list.filter(i => i.status === "paid").length], ["all", "All", list.length]] as const).map(([k, l, n]) =>
    <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}<em>{n}</em></button>)}</div>;
  return <>
    <header className="tb"><h1 className="h1">Money</h1><span className="sub">Invoices and quotes</span>
      <div className="acts"><button type="button" className="btn ghost" onClick={() => go.tab("numbers")}>Reports</button><button type="button" className="btn" onClick={go.billing}>Pay link and tax</button></div></header>
    <div className="pad money-page">
      <div className="stats">
        <div className="stat"><span>Owed to you</span><b style={late.length ? { color: "var(--bad)" } : undefined}>{usd(owed)}</b><small className={late.length ? "down" : ""}>{late.length ? `${late.length} ${late.length === 1 ? "invoice" : "invoices"} past due` : out.length ? `${out.length} out, none late` : "All paid up"}</small></div>
        <div className="stat"><span>Collected, 30 days</span><b>{usd(paid30)}</b><small>through your pay link</small></div>
        <div className="stat"><span>Quoted, waiting</span><b>{usd(L.chasingValue)}</b><small>{L.chasing ? `${L.chasing} ${L.chasing === 1 ? "quote" : "quotes"}, Cinder following up` : "No quotes out"}</small></div>
        <div className="stat"><span>Won, 30 days</span><b>{usd(L.wonValue)}</b><small>{L.won ? `${L.won} ${L.won === 1 ? "job" : "jobs"} from Cinder leads` : "No wins yet"}</small></div>
      </div>

      <section className="card">
        <div className="hd"><h2>Invoices</h2>{views}<small style={{ marginLeft: "auto" }}>{shown.length} {shown.length === 1 ? "invoice" : "invoices"}</small></div>
        {!shown.length ? <p className="fine" style={{ padding: "6px 0" }}>{f === "open" ? "Nothing outstanding. Invoices are created from a won job and pull the lines from the quote." : "No invoices yet."}</p>
        : wide ? <table className="tbl flush" style={{ tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 70 }} /><col style={{ width: 180 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 100 }} /></colgroup>
          <thead><tr><th>Invoice</th><th>Customer</th><th>For</th><th>Sent</th><th>Status</th><th>Due</th><th className="right">Amount</th></tr></thead>
          <tbody>{shown.map(i => { const st = invoiceState(i), name = i.customer || fmtPhone(i.phone); return <tr key={i.id} tabIndex={0} onClick={() => go.invoice(i.id)} onKeyDown={e => { if (e.key === "Enter") go.invoice(i.id); }}>
            <td className="mut">#{i.number}</td><td><b>{name}</b></td><td className="mut">{i.items[0]?.name || ""}</td><td className="mut">{i.sent_at ? dateLabel(i.sent_at) : "Not sent"}</td>
            <td><span className={"dot " + dotFor(st.tone)}>{st.text}</span></td><td className={st.tone === "red" ? "" : "mut"} style={st.tone === "red" ? { color: "var(--bad)" } : undefined}>{i.due_on ? dateLabel(i.due_on) : "–"}</td><td className="num">{dollars(i.total)}</td>
          </tr>; })}</tbody></table>
        : shown.map(i => { const st = invoiceState(i), name = i.customer || fmtPhone(i.phone); return <button key={i.id} type="button" className="jrow" style={{ padding: 0 }} onClick={() => go.invoice(i.id)}>
          <span style={{ minWidth: 0 }}><b>{name}</b><small>#{i.number}{i.due_on ? `, due ${dateLabel(i.due_on)}` : ""}</small></span>
          <span className="r"><b>{dollars(i.total)}</b><em className={st.tone === "red" ? "red" : st.tone === "green" ? "green" : ""}>{st.text}</em></span></button>; })}
      </section>

      <section className="card">
        <div className="hd"><h2>Quotes</h2><small>{quotes.length ? `${quotes.length} out, ${short(L.chasingValue)} waiting on an answer` : "none out"}</small><button type="button" className="link" onClick={() => go.tab("jobs")}>Jobs</button></div>
        {!quotes.length ? <p className="fine" style={{ padding: "6px 0" }}>Quotes you send from a job show here until they are won or lost.</p>
        : wide ? <table className="tbl flush" style={{ tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 180 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 200 }} /><col style={{ width: 100 }} /></colgroup>
          <thead><tr><th>Customer</th><th>Job</th><th>Sent</th><th>Status</th><th className="right">Amount</th></tr></thead>
          <tbody>{quotes.map(c => { const [t, tone] = quoteState(c); return <tr key={c.id} tabIndex={0} onClick={() => go.record(c.id)} onKeyDown={e => { if (e.key === "Enter") go.record(c.id); }}>
            <td><b>{c.name}</b></td><td className="mut">{line(c)}</td><td className="mut">{ago(c.at)}</td><td><span className={"dot " + tone}>{t}</span></td><td className="num">{dollars(c.quote?.amount ?? c.value ?? 0)}</td>
          </tr>; })}</tbody></table>
        : quotes.map(c => { const [t, tone] = quoteState(c); return <button key={c.id} type="button" className="jrow" style={{ padding: 0 }} onClick={() => go.record(c.id)}>
          <span style={{ minWidth: 0 }}><b>{c.name}</b><small>{line(c)}</small></span><span className="r"><b>{dollars(c.quote?.amount ?? c.value ?? 0)}</b><em className={tone === "bad" ? "red" : ""}>{t}</em></span></button>; })}
      </section>
    </div>
  </>;
}
