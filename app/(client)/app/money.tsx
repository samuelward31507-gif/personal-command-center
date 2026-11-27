"use client";

// Money: every invoice, what's owed and late, the quotes still out, and what Cinder brought in. Numbers lives
// here as the right-hand pane. The invoice sheet is where lines are edited, texted and marked paid.
import { useId, useState } from "react";
import { chosen, dollars, lineTotal, overdue, tiersOf, totals, type Item } from "@/lib/billing";
import { PAY_METHODS, type CardInvoice, type Payment } from "@/lib/crm";
import { DEPOSIT_NOTE } from "@/lib/billing";
import { AreaChart, C } from "./v5-charts";
import { Avatar, Icon, Sheet, Spinner, ago, dateLabel, fmtPhone, short, todayIso, useArm, usd, type Api, type Toast, inDemo } from "./parts";
import { Guide, Kpis, MiniDoc, PageHead } from "./charts";
import type { Biz, Data, Go, InvoiceRow } from "./types";
import { emailDoc } from "./crew";
import { CatalogPicker, asLine, useCatalog } from "./catalog";
import { ExpensesView } from "./expenses";
import { FieldIcon } from "./sources";
import { Av, Blank, Head, Section, Stats, Tag } from "./kit";

/**
 * Editable quote or invoice lines: what, how many, the unit price. Totals are worked out, never typed. On a quote (options)
 * a line can also be one of the options the customer picks from (Good, Better, Best) or an add-on they can tick.
 */
const TIER_NAMES = ["Good", "Better", "Best"];
export function LineEditor({ items, setItems, tax, setTax, options }: { items: Item[]; setItems: (f: (x: Item[]) => Item[]) => void; tax: number; setTax: (n: number) => void; options?: boolean }) {
  const valid = items.filter(i => i.name.trim() && i.qty > 0);
  const tiers = tiersOf(items), addons = valid.filter(i => i.opt);
  // The price list: typing a saved name fills its unit and price; "From price list" adds a saved line.
  const { items: cat } = useCatalog(), listId = useId();
  const named = (k: number, name: string) => { const hit = cat.find(c => c.name.toLowerCase() === name.trim().toLowerCase()); set(k, hit && !items[k].price ? { name: hit.name, unit: hit.unit, price: hit.price } : { name }); };
  const t = totals(tiers.length || addons.length ? chosen(valid, null) : valid, tax);
  const set = (k: number, patch: Partial<Item>) => setItems(xs => xs.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  const n = (v: string) => { const x = Number(v.replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };
  const nextName = () => [...TIER_NAMES, "Option 4", "Option 5"].find(x => !tiers.includes(x)) ?? "Another option";
  const mode = (i: Item) => i.opt ? "opt" : i.tier ? "t:" + i.tier : "inc";
  const setMode = (k: number, v: string) => set(k, v === "opt" ? { opt: true, tier: undefined } : v === "new" ? { tier: nextName(), opt: undefined } : v.startsWith("t:") ? { tier: v.slice(2), opt: undefined } : { tier: undefined, opt: undefined });
  const rename = (from: string, to: string) => { const name = to.replace(/[\u0000-\u001f]/g, "").slice(0, 40); if (!name.trim() || (name !== from && tiers.includes(name))) return; setItems(xs => xs.map(x => (x.tier === from ? { ...x, tier: name } : x))); };
  const offer = () => setItems(xs => {
    if (tiersOf(xs).length) return [...xs, { name: "", qty: 1, unit: "", price: 0, tier: nextName() }];
    const base = xs.filter(x => !x.opt), rest = xs.filter(x => x.opt);
    if (!base.length) return [...xs, ...TIER_NAMES.map(tier => ({ name: "", qty: 1, unit: "", price: 0, tier }))];
    return [...TIER_NAMES.flatMap(tier => base.map(x => ({ ...x, tier }))), ...rest];
  });
  return <div className={"le" + (options ? " opts" : "")}>
    {options && tiers.length > 0 && <div className="le-tiers"><span>Options they pick from</span>{tiers.map(tr => <input key={tr} className="input" aria-label={`Rename ${tr}`} defaultValue={tr} onBlur={e => { if (e.target.value !== tr) rename(tr, e.target.value); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />)}</div>}
    <ul>{items.map((i, k) => <li key={k} className={"lrow" + (i.opt ? " is-opt" : i.tier ? " is-tier" : "")}>
      {cat.length ? <input className="input le-what" aria-label="What" value={i.name} placeholder="What it is, or pick from your price list" list={listId} onChange={e => named(k, e.target.value)} />
        : <textarea className="input le-what" aria-label="What" rows={1} value={i.name} placeholder="What it is" onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} onChange={e => named(k, e.target.value.replace(/\n/g, " "))} />}
      <span className="nums">
        {options && (tiers.length > 0 || i.opt || addons.length > 0) && <select className="lmode" aria-label="Which option" value={mode(i)} onChange={e => setMode(k, e.target.value)}>
          <option value="inc">{tiers.length ? "Every option" : "Included"}</option>
          {tiers.map(tr => <option key={tr} value={"t:" + tr}>{tr}</option>)}
          <option value="new">New option</option>
          <option value="opt">Add-on</option>
        </select>}
        <label className="inwrap"><input aria-label="Quantity" inputMode="decimal" value={i.qty || ""} placeholder="1" onChange={e => set(k, { qty: n(e.target.value) })} />{i.unit && <em>{i.unit}</em>}</label>
        <span className="x" aria-hidden="true">×</span>
        <label className="inwrap"><i>$</i><input aria-label="Price each" inputMode="decimal" value={i.price || ""} placeholder="0" onChange={e => set(k, { price: n(e.target.value) })} /></label>
        <b className="t">{i.opt ? "+" : ""}{dollars(lineTotal(i))}</b>
        <button type="button" className="btn ghost sm ic" aria-label={`Remove ${i.name || "line"}`} onClick={() => setItems(xs => xs.filter((_, j) => j !== k))}><Icon name="x" size={13} /></button>
      </span>
    </li>)}</ul>
    {cat.length > 0 && <datalist id={listId}>{cat.map(c => <option key={c.name} value={c.name}>{dollars(c.price)}{c.unit ? ` per ${c.unit}` : ""}</option>)}</datalist>}
    <div className="acts-row">
      <CatalogPicker onPick={c => setItems(xs => [...xs.filter(x => x.name.trim() || x.price), { ...asLine(c), ...(tiersOf(xs).length ? { tier: tiersOf(xs)[0] } : {}) }])} />
      <button type="button" className="btn sm add" onClick={() => setItems(xs => [...xs, { name: "", qty: 1, unit: "", price: 0, ...(tiersOf(xs).length ? { tier: tiersOf(xs)[0] } : {}) }])}><Icon name="plus" size={13} />Add a line</button>
      {options && <button type="button" className="btn sm ghost" onClick={offer} title="Let them pick between versions of the job">{tiers.length ? "Add an option" : "Offer good, better, best"}</button>}
      {options && <button type="button" className="btn sm ghost" onClick={() => setItems(xs => [...xs, { name: "", qty: 1, unit: "", price: 0, opt: true }])} title="Extras they can tick, like a gate or stain">Add an add-on</button>}
    </div>
    <dl>
      {tiers.length > 0 ? tiers.map((tr, k) => { const x = totals(chosen(valid, { tier: tr, addons: [] }), tax); return <div key={tr} className={k === 0 ? "tot" : ""}><dt>{tr}{k === 0 ? <small> shown first</small> : null}</dt><dd>{dollars(x.total)}</dd></div>; })
        : <div><dt>Subtotal</dt><dd>{dollars(t.subtotal)}</dd></div>}
      {addons.length > 0 && <div><dt>Add-ons, if they tick them all</dt><dd>+{dollars(totals(addons, tax).total)}</dd></div>}
      <div><dt>Tax<label className="tax"><input aria-label="Tax percent" inputMode="decimal" value={tax || ""} placeholder="0" onChange={e => setTax(Math.min(20, n(e.target.value)))} />%</label></dt><dd>{dollars(t.tax)}</dd></div>
      {!tiers.length && <div className="tot"><dt>Total</dt><dd>{dollars(t.total)}</dd></div>}
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
const chipFor = (tone: string) => tone === "green" ? "good" : tone === "red" ? "bad" : "";
const dotFor = (tone: string) => tone === "green" ? "good" : tone === "red" ? "bad" : tone === "amber" ? "ember" : tone === "blue" ? "ink" : "";

/** One invoice: lines, due date, note; send it, copy the link, mark it paid. */
export function InvoiceSheet({ inv, customer, email, emailReady, payments = [], project, api, toast, reload, payLink, onClose, onSetup }: { inv: CardInvoice; customer: string; email?: string; emailReady?: boolean; payments?: Payment[]; project: string; api: Api; toast: Toast; reload: () => Promise<void>; payLink: boolean; onClose: () => void; onSetup: () => void }) {
  const [items, setItems] = useState<Item[]>(inv.items), [tax, setTax] = useState(inv.tax_rate), [note, setNote] = useState(inv.note), [due, setDue] = useState(inv.due_on ?? "");
  const [busy, setBusy] = useState(""), [arm, setArm] = useArm(), [more, setMore] = useState(false);
  const bal = balanceOf(inv), mine = payments.filter(p => p.invoice_id === inv.id);
  const refunded = Math.round(-mine.filter(p => p.refund).reduce((a, p) => a + p.amount, 0) * 100) / 100, canRefund = Math.round((inv.total - bal - refunded) * 100) / 100;
  const [refunding, setRefunding] = useState(false);
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
      {/* Three things in view: the second action, Save when there's an edit, the main one. The rest sit in More, Void last and apart. */}
      {(inv.status !== "void" && canRefund > 0 && !refunding && !paying) || inv.status === "sent" || !locked ? <div className="menu-wrap">
        <button type="button" className="btn" aria-expanded={more} aria-haspopup="menu" disabled={!!busy} onClick={() => setMore(m => !m)}>More<Icon name="down" size={13} /></button>
        {more && <div className="menu pop up" role="menu" onMouseLeave={() => setMore(false)}>
          {inv.status !== "void" && canRefund > 0 && !refunding && !paying && <button type="button" role="menuitem" onClick={() => { setMore(false); setPAmt(String(canRefund)); setPMethod("card"); setPNote(""); setRefunding(true); }}>Refund</button>}
          {inv.status === "sent" && <button type="button" role="menuitem" onClick={() => { setMore(false); void act("pause", { action: "invoiceset", what: inv.reminders_paused ? "resume" : "pause" }, inv.reminders_paused ? "Reminders back on." : "Reminders paused."); }}>{inv.reminders_paused ? "Resume reminders" : "Pause reminders"}</button>}
          {!locked && <button type="button" role="menuitem" onClick={() => { setMore(false); void copy(); }}>Copy link</button>}
          {!locked && inv.url && <button type="button" role="menuitem" title={email ? `Email it to ${email}` : "Add their email on the customer first"} onClick={async () => { setMore(false); setBusy("email"); await emailDoc({ ready: emailReady, api, project, toast, reload, kind: "invoice", invoice: inv.id, to: email, name: customer, mailto: `mailto:${email ?? ""}?subject=${encodeURIComponent(`Invoice #${inv.number}`)}&body=${encodeURIComponent(`Hi ${first}, here's your invoice for ${dollars(bal)}${inv.due_on ? `, due ${dateLabel(inv.due_on)}` : ""}. You can see it and pay here: ${inv.url}`)}` }); setBusy(""); }}>Email it</button>}
          {!locked && <><hr /><button type="button" role="menuitem" className="danger" onClick={() => { if (arm === "void") { setMore(false); void act("void", { action: "invoiceset", what: "void" }, "Invoice voided.", true); } else setArm("void"); }}>{arm === "void" ? "Tap again to void this invoice" : "Void invoice"}</button></>}
        </div>}
      </div> : null}
      <span style={{ flex: 1 }} />
      {!locked && dirty && <button type="button" className="btn" disabled={!!busy} onClick={() => void save()}>{busy === "save" ? <Spinner /> : "Save"}</button>}
      {inv.status === "paid" ? <button type="button" className="btn" disabled={!!busy} onClick={() => void act("unpaid", { action: "invoiceset", what: "unpaid" }, "Marked unpaid.")}>Mark unpaid</button>
        : !locked && !paying && <button type="button" className="btn" disabled={!!busy} onClick={() => { setPAmt(String(bal)); setPaying(true); }}>Record payment</button>}
      {!locked && <button type="button" className="btn ink" disabled={!!busy} onClick={() => void send()}>{busy === "send" || busy === "email" ? <Spinner /> : inv.status === "sent" ? "Text it again" : `Text ${first}`}</button>}
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
      {mine.map(p => <div key={p.id} className="lrow2"><span>{dateLabel(p.paid_on)}</span><span className="mut">{p.refund ? "Refund, " : ""}{PAY_METHODS.find(m => m[0] === p.method)?.[1].split(",")[0] ?? "Other"}{p.note ? `, ${p.note}` : ""}</span><b>{p.refund ? `−${dollars(-p.amount)}` : dollars(p.amount)}</b>
        <button type="button" className="btn ghost sm ic" aria-label={p.refund ? "Remove this refund" : "Remove this payment"} title="Remove" disabled={!!busy} onClick={() => arm === "rm" + p.id ? void act("rm", { action: p.refund ? "refunddelete" : "paymentdelete", payment: p.id }, p.refund ? "Refund removed." : "Payment removed.") : setArm("rm" + p.id)}><Icon name={arm === "rm" + p.id ? "check" : "x"} size={12} /></button></div>)}
      {refunded > 0 && <div className="lrow2"><span>Kept</span><span className="mut">after {dollars(refunded)} refunded</span><b>{dollars(inv.total - bal - refunded)}</b><span /></div>}
      {refunding && <form className="payform" onSubmit={e => { e.preventDefault(); void act("refund", { action: "refund", amount: pAmt, method: pMethod, on: pOn, note: pNote }, `Refund of ${dollars(Number(pAmt) || 0)} recorded.`).then(r => { if (r) setRefunding(false); }); }}>
        <label className="field"><span>Refund amount <em>up to {dollars(canRefund)}</em></span><span className="inwrap"><i>$</i><input inputMode="decimal" autoFocus value={pAmt} onChange={e => setPAmt(e.target.value.replace(/[^\d.]/g, ""))} /></span></label>
        <label className="field"><span>How it went back</span><select value={pMethod} onChange={e => setPMethod(e.target.value)}>{PAY_METHODS.map(([k, l]) => <option key={k} value={k}>{k === "card" ? "Card, through your processor" : l}</option>)}</select></label>
        <label className="field"><span>Date</span><input type="date" value={pOn} onChange={e => setPOn(e.target.value)} /></label>
        <label className="field"><span>Why <em>for your records</em></span><input value={pNote} maxLength={200} onChange={e => setPNote(e.target.value)} placeholder="Gate canceled" /></label>
        <p className="fine" style={{ gridColumn: "1 / -1" }}>Send the money back from your own account first (Square, Stripe, cash, check). This records it, lowers what the invoice charged, and takes it off collected. It doesn&rsquo;t go to QuickBooks, so add it there too.</p>
        <div className="acts-row end" style={{ gridColumn: "1 / -1" }}><button type="button" className="btn ghost" onClick={() => setRefunding(false)}>Cancel</button><button type="submit" className="btn ink" disabled={!!busy || !(Number(pAmt) > 0) || Number(pAmt) > canRefund + 0.005}>{busy === "refund" ? <Spinner /> : "Record refund"}</button></div>
      </form>}
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
    {inv.status === "sent" && <p className="fine">{inv.reminders_paused ? "Payment reminders are paused." : inv.reminders ? `${inv.reminders} of 3 payment reminders sent, each for the balance.` : "Up to 3 reminders after the due date, each for the balance."}{!inv.reminders_paused && email ? " By text, and by email when they got the invoice by email or can't be texted." : ""}</p>}
  </Sheet>;
}

/** Payments settings: the owner's own pay link, sales tax and how long invoices give. */
export function BillingSettings({ setup, project, api, toast, reload, onClose }: { setup: Record<string, string>; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [link, setLink] = useState(setup.pay_link || ""), [tax, setTax] = useState(setup.tax_rate || ""), [daysDue, setDays] = useState(setup.invoice_days || "7"), [busy, setBusy] = useState(false);
  const [rop, setRop] = useState(setup.review_on_paid !== "no"), [rate, setRate] = useState(setup.labor_rate || "");
  const [lateFee, setLateFee] = useState(setup.late_fee || ""), [lateDays, setLateDays] = useState(setup.late_fee_days || "15"), [qValid, setQValid] = useState(setup.quote_valid_days || "0");
  const [fin, setFin] = useState(setup.financing_link || ""), [finNote, setFinNote] = useState(setup.financing_note || ""), [warranty, setWarranty] = useState(setup.warranty || ""), [terms, setTerms] = useState(setup.quote_terms || "");
  return <Sheet onClose={onClose} title="Invoices and payments" sub="Used on every quote and invoice" wide
    foot={<button type="button" className="btn ink" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api("/api/app/act", { p: project, action: "setup", setup: { quote_valid_days: qValid, late_fee: lateFee, late_fee_days: lateDays, pay_link: link, tax_rate: tax || "0", invoice_days: daysDue, financing_link: fin.trim() && !/^https?:\/\//.test(fin.trim()) ? "https://" + fin.trim() : fin.trim(), financing_note: finNote, warranty, quote_terms: terms, review_on_paid: rop ? "yes" : "no", labor_rate: rate } }); toast("Saved."); await reload(); onClose(); }
      catch (e) { toast(e instanceof Error ? e.message : "Couldn't save.", true); } finally { setBusy(false); }
    }}>{busy ? <Spinner /> : "Save"}</button>}>
    <label className="field"><span>Your pay link</span><input inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="square.link/u/yourbusiness" /></label>
    <p className="fine" style={{ marginTop: -6 }}>Square, Stripe, PayPal or your own site. The invoice&rsquo;s Pay button opens it. The money never passes through this app.</p>
    <div className="two">
      <label className="field"><span>Sales tax</span><span className="inwrap"><input inputMode="decimal" value={tax} onChange={e => setTax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><em>%</em></span></label>
      <label className="field"><span>Invoices are due</span><select value={daysDue} onChange={e => setDays(e.target.value)}><option value="0">On receipt</option><option value="7">In 7 days</option><option value="14">In 14 days</option><option value="30">In 30 days</option></select></label>
    </div>
    <div className="two">
      <label className="field"><span>Late fee <em>optional</em></span><input value={lateFee} onChange={e => setLateFee(e.target.value.replace(/[^\d.%$]/g, ""))} placeholder="5% or 25" /></label>
      <label className="field"><span>Added after</span><select value={lateDays} onChange={e => setLateDays(e.target.value)}>{["7", "15", "30", "45", "60"].map(n => <option key={n} value={n}>{n} days past due</option>)}</select></label>
    </div>
    <p className="fine" style={{ marginTop: -6 }}>Added once, as its own line, and the customer sees it on the invoice. Leave it blank for none. Some states cap late fees; check yours.</p>
    <p className="sec" style={{ marginTop: 10 }}>On every quote</p>
    <div className="two">
      <label className="field"><span>Financing link <em>optional</em></span><input inputMode="url" value={fin} onChange={e => setFin(e.target.value)} placeholder="Your Hearth, Wisetack or GreenSky page" /></label>
      <label className="field"><span>What it says</span><input value={finNote} maxLength={160} onChange={e => setFinNote(e.target.value)} placeholder="Pay over time. See your rate in 30 seconds." /><small className="fine">It shows on every quote, big or small, so leave out a monthly dollar figure.</small></label>
    </div>
    <p className="fine" style={{ marginTop: -6 }}>Customers who can pay monthly say yes to the bigger option more often. The lender handles the application and pays you.</p>
    <label className="field"><span>Warranty <em>shown on the quote</em></span><input value={warranty} maxLength={300} onChange={e => setWarranty(e.target.value)} placeholder="Two years on workmanship. Materials carry the maker&rsquo;s warranty." /></label>
    <label className="field"><span>Quotes are good for</span><select value={qValid} onChange={e => setQValid(e.target.value)}>{[["0", "No end date"], ["14", "14 days"], ["30", "30 days"], ["45", "45 days"], ["60", "60 days"], ["90", "90 days"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label className="field"><span>Terms <em>they agree to when they approve</em></span><textarea rows={4} value={terms} maxLength={1200} onChange={e => setTerms(e.target.value)} placeholder="Prices hold for 30 days. The deposit comes off the final invoice. The balance is due when the job is done." /></label>
    <p className="sec" style={{ marginTop: 10 }}>After the job</p>
    <label className={"toggle" + (setup.has_review_link === "yes" ? "" : " off")}><input type="checkbox" checked={rop && setup.has_review_link === "yes"} disabled={setup.has_review_link !== "yes"} onChange={e => setRop(e.target.checked)} /><i /><span><b>Ask for a Google review once an invoice is paid in full</b><small>{setup.has_review_link === "yes" ? "One text, a couple of hours after the money comes in, inside texting hours. Once per customer, ever." : "Needs your Google review link (Settings, Account)."}</small></span></label>
    <label className="field" style={{ maxWidth: 260 }}><span>Your own hourly labor cost <em>for clocked hours</em></span><span className="inwrap"><i>$</i><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ""))} placeholder="45" /><em>/hr</em></span></label>
    <p className="fine" style={{ marginTop: -6 }}>Crew rates are on each person in Settings, Account. Clocked hours times the rate becomes the job&rsquo;s labor cost when you tap Use as labor.</p>
  </Sheet>;
}

/** Money: what's owed and how late, what came in, every invoice with its balance, every payment. Quotes have their own tab. */
export function MoneyScreen({ d, go, wide, biz, project, api, toast, reload }: { d: Data; go: Go; wide: boolean; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void> }) {
  // Batch: won jobs with a price and no invoice, and drafts waiting to go.
  const [batch, setBatch] = useState<"" | "bill" | "send">(""), [armSend, setArmSend] = useState(false);
  const toBill = (d.board ?? []).filter(c => c.stage === "won" && !c.pastCustomer && !c.invoice && (c.value ?? c.quote?.amount ?? 0) > 0);
  const drafts = (d.invoices ?? []).filter(i => i.status === "draft" && i.total > 0);
  const billAll = async () => {
    // Drafts only: nothing goes to a customer until they're sent, so no confirm step.
    setBatch("bill"); let made = 0;
    for (const c of toBill) { try { await api("/api/app/act", { p: project, thread: c.id, action: "invoice" }); made++; } catch { /* the next one still goes */ } }
    await reload(); setBatch(""); toast(`${made} ${made === 1 ? "invoice" : "invoices"} drafted. Check them under Drafts, then send.`);
  };
  const sendAll = async () => {
    // Texts go out, so the first tap arms the button and the second sends.
    if (!armSend) { setArmSend(true); window.setTimeout(() => setArmSend(false), 5000); return; }
    setArmSend(false); setBatch("send"); let sent = 0, held = 0;
    for (const i of drafts) { try { const r = await api<{ sent?: boolean }>("/api/app/act", { p: project, invoice: i.id, action: "invoicesend" }); if (r.sent) sent++; else held++; } catch { held++; } }
    await reload(); setBatch(""); toast(`${sent} sent.${held ? ` ${held} couldn't go by text (opted out, outside texting hours, or no number); they're marked sent, copy their links.` : ""}`, held > 0 && !sent);
  };
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const list = d.invoices ?? [], pays = d.payments ?? [], today = todayIso();
  const [f, setF] = useState<"open" | "draft" | "paid" | "all">("open"), [view, setView] = useState<"invoices" | "payments" | "expenses">("invoices");
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
  const D = 86400000, days = Array.from({ length: 30 }, (_, k) => new Date(Date.parse(today + "T12:00:00") - (29 - k) * D).toLocaleDateString("en-CA"));
  const in30 = pays.filter(p => p.paid_on >= days[0] && p.paid_on <= today), prev = pays.filter(p => p.paid_on < days[0] && p.paid_on >= new Date(Date.parse(days[0] + "T12:00:00") - 30 * D).toLocaleDateString("en-CA"));
  const col = in30.reduce((a, p) => a + p.amount, 0), colPrev = prev.reduce((a, p) => a + p.amount, 0), run = days.map(dd => in30.filter(p => p.paid_on <= dd).reduce((a, p) => a + p.amount, 0));
  const deps = list.filter(i => i.status === "paid" && i.note === DEPOSIT_NOTE && (board.find(c => c.id === i.thread_id)?.invoice == null));
  const depSum = deps.reduce((a, i) => a + i.total, 0);
  const exps = (d.expenses ?? []).filter(x => x.spent_on >= monthStart && x.spent_on <= today), spent = Math.round(exps.reduce((a, x) => a + x.amount, 0) * 100) / 100;
  const cats = new Map<string, number>(); for (const x of exps) cats.set(x.category, Math.round(((cats.get(x.category) ?? 0) + x.amount) * 100) / 100);
  const CAT: Record<string, string> = { materials: "Materials", dump: "Dump and disposal", fuel: "Fuel", vehicle: "Vehicle", tools: "Tools", subs: "Subcontractors", other: "Other" };
  const catRows = [...cats].sort((a, b) => b[1] - a[1]), catMax = Math.max(1, ...catRows.map(c => c[1]));
  const lastPay = [...in30].sort((a, b) => a.paid_on.localeCompare(b.paid_on)).at(-1);
  const owers = (() => { const by = new Map<string, { name: string; owed: number; late: boolean; id: string }>(); for (const i of open) { const k = i.customer || i.phone; const e = by.get(k) ?? { name: i.customer || fmtPhone(i.phone), owed: 0, late: false, id: i.id }; e.owed += balanceOf(i); e.late ||= overdue(i.status, i.due_on, today); by.set(k, e); } return [...by.values()].sort((a, b) => b.owed - a.owed); })();
  const AGE_C = ["var(--k-t4)", "var(--k-amber)", "var(--k-red)", "var(--k-red-ink)", "#8f2226"];
  const method = (m: string) => PAY_METHODS.find(x => x[0] === m)?.[1].split(",")[0] ?? "";
  return <div className="k-page">
    <Head title="Money" icon="dollar" sub={fresh ? "No invoices yet" : outstanding ? `${usd(outstanding)} owed to you${late.length ? `, ${usd(lateAmt)} past due` : ", none late"}` : "Nothing owed. Everything is paid"} actions={<>
      <div className="k-menu-wrap"><button type="button" className="k-btn" aria-expanded={exp} onClick={() => setExp(x => !x)}><Icon name="upload" size={13} />Export</button>
        {exp && <div className="k-pop" role="menu" onMouseLeave={() => setExp(false)}>
          <a role="menuitem" onClick={e => { if (inDemo()) { e.preventDefault(); toast("The example business has nothing to export. Your own export downloads a real file."); } }} href={`/api/app/export?p=${encodeURIComponent(project)}&what=invoices`}>Invoices, as CSV</a>
          <a role="menuitem" onClick={e => { if (inDemo()) { e.preventDefault(); toast("The example business has nothing to export. Your own export downloads a real file."); } }} href={`/api/app/export?p=${encodeURIComponent(project)}&what=payments`}>Payments, as CSV</a>
          <a role="menuitem" onClick={e => { if (inDemo()) { e.preventDefault(); toast("The example business has nothing to export. Your own export downloads a real file."); } }} href={`/api/app/export?p=${encodeURIComponent(project)}`}>Customers, as CSV</a>
          <small>Opens in Excel, Google Sheets or QuickBooks.</small></div>}</div>
      <PriceListButton />
      <button type="button" className="k-btn" onClick={go.billing}>Pay link and tax</button>
      {toBill.length > 0 && <button type="button" className="k-btn" disabled={!!batch} onClick={() => void billAll()} title="A draft for each won job that has a price and no invoice yet">{batch === "bill" ? <Spinner /> : null}Bill {toBill.length} finished {toBill.length === 1 ? "job" : "jobs"}</button>}
      {drafts.length > 1 && <button type="button" className={"k-btn" + (armSend ? " pri" : "")} disabled={!!batch} onClick={() => void sendAll()}>{batch === "send" ? <Spinner /> : null}{armSend ? `Tap again to text ${drafts.length} customers` : `Send ${drafts.length} drafts`}</button>}
      <button type="button" className="k-btn pri" onClick={() => setPicking(true)}><Icon name="plus" size={14} />New invoice</button>
    </>} />
    <div className="k-body">
      {fresh && <Guide title="Get paid faster" sub="Invoices go out by text with a Pay button that opens your own payment page. Reminders follow up on their own until the balance is zero. The money never passes through this app."
        steps={[
          { title: "Add your pay link", text: "Square, Stripe, PayPal or your own checkout page. It sits behind every Pay button.", done: biz.payLink, action: <button type="button" className="btn sm" onClick={go.billing}>Add pay link</button> },
          { title: "Win a job", text: "When a customer approves a quote, or you mark a job won, it's ready to bill.", done: board.some(c => c.stage === "won"), action: <button type="button" className="btn sm" onClick={() => go.tab("quotes")}>Open quotes</button> },
          { title: "Send the first invoice", text: "It pulls the lines from the quote. Check it, then text it.", action: <button type="button" className="btn sm ink" onClick={() => setPicking(true)}>New invoice</button> },
          { title: "Record what comes in", text: "Card, cash, check or a deposit. Part payments are fine; the balance updates everywhere." },
        ]}
        side={<MiniDoc kind="invoice" business={biz.business} href="/i/example" />} />}
      {!fresh && <>
      <Stats items={[
        { label: "Owed to you", value: usd(outstanding), sub: lateAmt ? `${usd(lateAmt)} past due` : "None of it late", red: lateAmt > 0, go: () => setF("open") },
        { label: "Collected, 30 days", value: usd(col), delta: colPrev > 0 ? Math.round(((col - colPrev) / colPrev) * 100) : null, sub: `${in30.length} ${in30.length === 1 ? "payment" : "payments"}, deposits included`, spark: run },
        { label: "Deposits held", value: usd(depSum), sub: deps.length ? deps.map(i => `${i.customer.split(" ")[0]} ${usd(i.total)}`).join(", ") : "None right now" },
        { label: "Spent this month", value: dollars(spent), sub: `${exps.length} ${exps.length === 1 ? "expense" : "expenses"}`, go: () => setView("expenses") },
      ]} />

      <section className="k-sec" aria-label="Invoices">
        <div className="k-sec-h"><div className="k-seg" role="tablist" aria-label="Show">{(["invoices", "payments", "expenses"] as const).map(k => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}>{k === "invoices" ? "Invoices" : k === "payments" ? "Payments" : "Expenses"}</button>)}</div>
          {view === "invoices" && <div className="k-sec-a k-chips" role="tablist" aria-label="Filter">{([["open", "Awaiting payment"], ["draft", "Drafts"], ["paid", "Paid"], ["all", "All"]] as const).map(([k, l]) =>
            <button key={k} type="button" role="tab" aria-selected={f === k} className={"k-chip" + (f === k ? " on" : "")} onClick={() => setF(k)}>{l}{counts[k] ? <em>{counts[k]}</em> : null}</button>)}</div>}</div>
        <div className="k-box">
        {view === "invoices" && outstanding > 0 && <div className="k-aging" aria-label="Owed, by how late">
          <div className="k-aging-bar">{aging.map((a, k) => a.v > 0 ? <i key={a.l} style={{ flexGrow: a.v, background: AGE_C[k] }} title={`${a.l}: ${usd(a.v)}`} /> : null)}</div>
          <dl>{aging.map((a, k) => <div key={a.l}><dt><i style={{ background: AGE_C[k] }} />{a.l}</dt><dd className={a.v ? "" : "k-faint"}>{usd(a.v)}</dd></div>)}</dl>
        </div>}
        {view === "expenses" ? <div style={{ padding: "4px 16px 12px" }}><ExpensesView d={d} project={project} api={api} toast={toast} reload={reload} go={go} /></div>
        : view === "payments" ? (!pays.length ? <Blank icon="check" title="No payments yet" text="Payments you record on an invoice show here: card, cash, check, deposits." />
          : <div className="k-tbl-wrap"><table className="k-tbl flat"><colgroup><col style={{ width: 110 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 220 }} /><col style={{ width: 120 }} /></colgroup>
            <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>How</th><th className="r">Amount</th></tr></thead>
            <tbody>{pays.map(p => <tr key={p.id} tabIndex={0} onClick={() => go.invoice(p.invoice_id)} onKeyDown={e => { if (e.key === "Enter") go.invoice(p.invoice_id); }}>
              <td className="k-mut">{dateLabel(p.paid_on)}</td><td><span className="k-cell-name"><Av name={p.customer} size="sm" /><b>{p.customer}</b></span></td><td className="k-mut">#{p.number}</td><td className="k-mut">{p.refund ? "Refund, " : ""}{method(p.method)}{p.note ? `, ${p.note}` : ""}</td><td className="r k-num"><b>{p.refund ? `−${dollars(-p.amount)}` : dollars(p.amount)}</b></td></tr>)}</tbody></table></div>)
        : !shown.length ? <Blank icon="invoice" title={f === "open" ? "Nothing outstanding" : "No invoices here"} text={f === "open" ? "Invoices start from a won job and pull the lines from the quote." : undefined} />
        : wide ? <div className="k-tbl-wrap"><table className="k-tbl flat">
          <colgroup><col style={{ width: 44 }} /><col style={{ width: 80 }} /><col style={{ width: 200 }} /><col /><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 170 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} /></colgroup>
          <thead><tr><th className="ck"><input type="checkbox" aria-label="Select all" checked={!!shown.length && shown.every(i => ticked.has(i.id))} onChange={e => setTicked(e.target.checked ? new Set(shown.map(i => i.id)) : new Set())} /></th>
            <th>Invoice</th><th>Customer</th><th>For</th><th>Issued</th><th>Due</th><th>Status</th><th className="r">Total</th><th className="r">Balance</th></tr></thead>
          <tbody>{shown.map(i => { const st = invoiceState(i), bal = balanceOf(i); return <tr key={i.id} tabIndex={0} onClick={() => go.invoice(i.id)} onKeyDown={e => { if (e.key === "Enter") go.invoice(i.id); }}>
            <td className="ck" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select invoice ${i.number}`} checked={ticked.has(i.id)} onChange={() => setTicked(t => { const n = new Set(t); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} /></td>
            <td className="k-mut k-num">#{i.number}</td><td><span className="k-cell-name"><Av name={i.customer || "?"} size="sm" /><b>{i.customer || fmtPhone(i.phone)}</b></span></td><td className="k-mut">{i.items[0]?.name || ""}</td>
            <td className="k-mut">{i.sent_at ? dateLabel(i.sent_at) : "–"}</td><td className={st.tone === "red" ? "k-red-t" : "k-mut"}>{i.due_on ? dateLabel(i.due_on) : "–"}</td>
            <td><Tag tone={st.tone}>{st.text}</Tag></td><td className="r k-num k-mut">{dollars(i.total)}</td><td className="r k-num"><b>{i.status === "void" ? "–" : dollars(bal)}</b></td>
          </tr>; })}</tbody>
          {ticked.size > 0 && (() => { const sel = shown.filter(i => ticked.has(i.id)), tot = sel.filter(i => i.status !== "void").reduce((a, i) => a + i.total, 0), bal = sel.reduce((a, i) => a + balanceOf(i), 0);
            return <tfoot><tr><td /><td colSpan={2}><b>{sel.length}</b> selected</td><td /><td /><td /><td /><td className="r"><b>{dollars(tot)}</b></td><td className="r"><b>{dollars(bal)}</b></td></tr></tfoot>; })()}</table></div>
        : <div className="k-list">{shown.map(i => { const st = invoiceState(i); return <button key={i.id} type="button" className="k-row" onClick={() => go.invoice(i.id)}>
            <Av name={i.customer || "?"} />
            <span className="k-row-m"><span className="k-row-t"><b>{i.customer || fmtPhone(i.phone)}</b></span><span className="k-row-s">#{i.number}{i.due_on ? `, due ${dateLabel(i.due_on)}` : ""}</span></span>
            <span className="k-row-r" style={{ flexDirection: "column", alignItems: "flex-end", gap: 5 }}><span className="k-row-v">{dollars(balanceOf(i) || i.total)}</span><Tag tone={st.tone}>{st.text}</Tag></span></button>; })}</div>}
        </div>
      </section>

      <div className="k-grid2">
        <Section title="Money in, last 30 days" sub="running total">
          <div className="k-chart" style={{ borderTop: 0 }}><AreaChart labels={days.map(dd => new Date(dd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }))} series={[{ key: "in", label: "So far", values: run, color: C.accent, fill: true }]}
            initial={lastPay ? days.indexOf(lastPay.paid_on) : undefined} note={i => { const p = in30.find(x => x.paid_on === days[i]); return p ? { text: `${p.customer}, ${method(p.method).toLowerCase()}`, value: usd(p.amount) } : null; }}
            summary={`${usd(col)} collected in the last 30 days.`} /></div>
        </Section>
        <Section title="Expenses this month" aside={<span className="k-row-v">{dollars(spent)}</span>}>
          {catRows.length ? <div className="k-bars">{catRows.map(([k, v]) => <div key={k} className="k-bar-row"><span>{CAT[k] ?? k}</span><span className="k-bar-t"><i style={{ width: `${(v / catMax) * 100}%` }} /></span><b className="k-num">{dollars(v)}</b></div>)}</div>
            : <Blank icon="invoice" title="Nothing logged this month" text="Log materials, fuel and dump fees on a job and they add up here." />}
        </Section>
      </div>

      <div className="k-grid2">
        <Section title="Latest payments" sub={pays.length ? `${usd(pays.slice(0, 6).reduce((a, p) => a + p.amount, 0))} across the last ${Math.min(6, pays.length)}` : undefined} aside={pays.length > 0 ? <button type="button" className="k-btn ghost sm" onClick={() => setView("payments")}>All payments</button> : undefined}>
          {pays.length ? <div className="k-list">{pays.slice(0, 6).map(p => <button key={p.id} type="button" className="k-row" onClick={() => go.invoice(p.invoice_id)}>
            <Av name={p.customer} />
            <span className="k-row-m"><span className="k-row-t"><b>{p.customer}</b>{p.refund && <Tag>Refund</Tag>}</span><span className="k-row-s">#{p.number} · {method(p.method)}{p.note ? `, ${p.note}` : ""} · {dateLabel(p.paid_on)}</span></span>
            <span className="k-row-r"><span className={"k-row-v" + (p.refund ? "" : " k-green-t")}>{p.refund ? "" : "+"}{dollars(p.amount)}</span></span></button>)}</div>
            : <Blank icon="check" title="No payments yet" text="Record a payment on any invoice and it lands here: card, cash, check or a deposit." />}
        </Section>
        <Section title="Who owes you" sub="by customer">
          {owers.length ? <div className="k-list">{owers.slice(0, 6).map(r => <button key={r.id} type="button" className="k-row" onClick={() => go.invoice(r.id)}>
            <Av name={r.name} />
            <span className="k-row-m"><span className="k-row-t"><b>{r.name}</b>{r.late && <Tag tone="red">Late</Tag>}</span><span className="k-bar-t" style={{ marginTop: 4 }}><i style={{ width: `${(r.owed / (owers[0]?.owed || 1)) * 100}%`, background: r.late ? "var(--k-red)" : "var(--k-t4)" }} /></span></span>
            <span className="k-row-r"><span className="k-row-v">{usd(r.owed)}</span></span></button>)}</div>
            : <Blank icon="check" title="Nobody owes you" text="Every invoice is paid." />}
        </Section>
      </div>
      </>}
    </div>
    {picking && <Sheet title="New invoice" sub="Who is it for?" onClose={() => setPicking(false)}>
      <label className="inwrap search" style={{ marginBottom: 8 }}><Icon name="search" size={14} /><input autoFocus value={pq} onChange={e => setPq(e.target.value)} placeholder="Search customers" aria-label="Search customers" /></label>
      {pickList.length ? <div className="pick">{pickList.slice(0, 40).map(o => <button key={o.id} type="button" className="row" disabled={!!making} onClick={() => void newInvoice(o.id)}>
        <Avatar name={o.name} size="sm" /><span style={{ minWidth: 0 }}><b>{o.name}</b><small>{o.sub}</small></span>{making === o.id ? <Spinner /> : o.won ? <span className="chipx good">Ready to bill</span> : <Icon name="fwd" size={13} className="faint" />}</button>)}</div>
        : <p className="fine">No customers yet. Add one from Jobs, or import your list.</p>}
    </Sheet>}
  </div>;
}

function PriceListButton() { const { items, edit } = useCatalog(); return <button type="button" className="k-btn" onClick={edit}>Price list{items.length ? <span className="k-count">{items.length}</span> : null}</button>; }
