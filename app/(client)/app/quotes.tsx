"use client";

// Quotes: every quote in one list, named by whose move it is, and a full-page editor. The editor is the form on the
// left and, on the right, exactly what the customer will see behind the link, updating as the owner types.
import { useMemo, useState } from "react";
import "../doc.css";
import { DocLines } from "../doc-lines";
import { dollars, totals, type Item } from "@/lib/billing";
import { draftItems, quoteText, type Card } from "@/lib/crm";
import { Avatar, Empty, Icon, Sheet, Spinner, ago, dateLabel, first, fmtPhone, usd, type Api, type Toast } from "./parts";
import { LineEditor } from "./money";
import { line, LostPicker } from "./jobs";
import type { Biz, Data, Go } from "./types";

export type QStatus = "draft" | "awaiting" | "opened" | "changes" | "approved" | "declined";
export const Q_LABEL: Record<QStatus, string> = { draft: "Draft", awaiting: "Awaiting response", opened: "Opened", changes: "Changes requested", approved: "Approved", declined: "Declined" };
/** Where a quote stands, in words that say whose move it is. */
export function quoteStatus(c: Card): QStatus | null {
  if (c.stage === "won" && (c.quote || c.value)) return "approved";
  if (c.stage === "lost" && c.quote) return "declined";
  if (c.stage !== "quoted" || !c.quote) return null;
  if (c.quote.status === "replied") return "changes";
  if (!c.quote.linked) return "draft";
  return c.quote.viewed ? "opened" : "awaiting";
}
const TONE: Record<QStatus, string> = { draft: "ember", awaiting: "", opened: "ink", changes: "bad", approved: "good", declined: "" };
const amountOf = (c: Card) => c.quote?.amount ?? c.value ?? 0;

type Filter = "open" | "draft" | "approved" | "declined" | "all";
export function QuotesScreen({ d, go, wide }: { d: Data; go: Go; wide: boolean }) {
  const [f, setF] = useState<Filter>("open"), [picking, setPicking] = useState(false), [q, setQ] = useState("");
  const rows = useMemo(() => (d.board ?? []).map(c => ({ c, s: quoteStatus(c) })).filter((r): r is { c: Card; s: QStatus } => !!r.s)
    .sort((a, b) => order(a.s) - order(b.s) || b.c.at.localeCompare(a.c.at)), [d.board]);
  const open = rows.filter(r => r.s === "draft" || r.s === "awaiting" || r.s === "opened" || r.s === "changes");
  const month = Date.now() - 30 * 86400000;
  const approved30 = rows.filter(r => r.s === "approved" && Date.parse(r.c.stageAt ?? r.c.at) > month);
  const sent90 = rows.filter(r => r.s !== "draft" && Date.parse(r.c.stageAt ?? r.c.at) > Date.now() - 90 * 86400000);
  const rate = sent90.length ? Math.round((sent90.filter(r => r.s === "approved").length / sent90.length) * 100) : null;
  const shown = (f === "open" ? open : f === "all" ? rows : rows.filter(r => r.s === f)).filter(r => !q.trim() || r.c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const counts: Record<Filter, number> = { open: open.length, draft: rows.filter(r => r.s === "draft").length, approved: rows.filter(r => r.s === "approved").length, declined: rows.filter(r => r.s === "declined").length, all: rows.length };
  const cand = (d.board ?? []).filter(c => (c.stage === "new" || c.stage === "booked") && !c.pastCustomer);

  return <>
    <header className="tb"><h1 className="h1">Quotes</h1><span className="sub">{open.length ? `${open.length} open, ${usd(open.reduce((a, r) => a + amountOf(r.c), 0))}` : "Nothing out"}</span>
      <div className="acts"><button type="button" className="btn ink" onClick={() => setPicking(true)}><Icon name="plus" size={14} />New quote</button></div></header>
    <div className="pad quotes">
      <div className="figs4">
        <div><span>Open</span><b>{usd(open.reduce((a, r) => a + amountOf(r.c), 0))}</b><small>{open.length} {open.length === 1 ? "quote" : "quotes"}, Cinder follows up</small></div>
        <div><span>Your move</span><b>{counts.draft + open.filter(r => r.s === "changes").length}</b><small>{counts.draft} to send, {open.filter(r => r.s === "changes").length} asked for changes</small></div>
        <div><span>Approved, 30 days</span><b>{usd(approved30.reduce((a, r) => a + amountOf(r.c), 0))}</b><small>{approved30.length} {approved30.length === 1 ? "job" : "jobs"}</small></div>
        <div><span>Approval rate, 90 days</span><b>{rate == null ? "–" : `${rate}%`}</b><small>approved of sent</small></div>
      </div>
      <div className="list-tools">
        <div className="views" role="tablist" aria-label="Show">{([["open", "Open"], ["draft", "Drafts"], ["approved", "Approved"], ["declined", "Declined"], ["all", "All"]] as const).map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}{counts[k] ? <em>{counts[k]}</em> : null}</button>)}</div>
        <label className="inwrap search" style={{ marginLeft: "auto", width: 220 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search quotes" aria-label="Search quotes" /></label>
      </div>
      {!shown.length ? <Empty title={f === "open" ? "No quotes out" : "Nothing here"} text={f === "open" ? "Write one from an estimate. Cinder texts it and follows up until they answer." : undefined} action={f === "open" ? <button type="button" className="btn ink" onClick={() => setPicking(true)}>New quote</button> : undefined} />
      : wide ? <table className="tbl q-tbl">
        <colgroup><col style={{ width: 210 }} /><col /><col style={{ width: 170 }} /><col style={{ width: 210 }} /><col style={{ width: 100 }} /><col style={{ width: 110 }} /></colgroup>
        <thead><tr><th>Customer</th><th>Job</th><th>Status</th><th>Updated</th><th className="right">Deposit</th><th className="right">Amount</th></tr></thead>
        <tbody>{shown.map(({ c, s }) => <tr key={c.id} tabIndex={0} onClick={() => go.quote(c.id)} onKeyDown={e => { if (e.key === "Enter") go.quote(c.id); }}>
          <td><span className="name"><Avatar name={c.name || c.phone} size="sm" /><b>{c.name || fmtPhone(c.phone)}</b></span></td>
          <td className={c.line ? "" : "faint"}>{line(c) || "No details yet"}</td>
          <td><span className={"dot " + TONE[s]}>{Q_LABEL[s]}</span></td>
          <td className="mut">{s === "opened" && c.quote?.viewed ? `Opened ${ago(c.quote.viewed)}` : ago(c.stageAt ?? c.at)}{(s === "awaiting" || s === "opened") && c.quote?.steps ? `, ${c.quote.steps} of 4 follow-ups` : ""}</td>
          <td className="num mut">{c.quote?.deposit ? usd(c.quote.deposit) : "–"}</td>
          <td className="num"><b>{amountOf(c) ? dollars(amountOf(c)) : "–"}</b></td>
        </tr>)}</tbody></table>
      : <div>{shown.map(({ c, s }) => <button key={c.id} type="button" className="jrow" onClick={() => go.quote(c.id)}>
          <span style={{ minWidth: 0 }}><b>{c.name || fmtPhone(c.phone)}</b><small>{line(c) || "No details yet"}</small></span>
          <span className="r"><b>{amountOf(c) ? usd(amountOf(c)) : "–"}</b><em className={s === "changes" ? "red" : s === "approved" ? "green" : ""}>{Q_LABEL[s]}</em></span></button>)}</div>}
    </div>
    {picking && <Sheet title="New quote" sub="Who is it for?" onClose={() => setPicking(false)}>
      {cand.length ? <div className="pick">{cand.map(c => <button key={c.id} type="button" className="row" onClick={() => { setPicking(false); go.quote(c.id); }}>
        <Avatar name={c.name || c.phone} size="sm" /><span style={{ minWidth: 0 }}><b>{c.name || fmtPhone(c.phone)}</b><small>{[line(c), c.next ? `estimate ${dateLabel(c.next)}` : ""].filter(Boolean).join(", ") || "No details yet"}</small></span><Icon name="fwd" size={13} className="faint" /></button>)}</div>
        : <p className="fine">Quotes start from a lead or a booked estimate. Add the customer first.</p>}
      <button type="button" className="btn" onClick={() => { setPicking(false); go.addLead(); }}><Icon name="plus" size={13} />Someone new</button>
    </Sheet>}
  </>;
}
const order = (s: QStatus) => ({ changes: 0, draft: 1, opened: 2, awaiting: 3, approved: 4, declined: 5 })[s];

/** The quote, full page: lines, what's included, a deposit; the customer's view beside it; send, copy, email. */
export function QuoteEditor({ id, d, biz, project, api, toast, reload, go, onBack }: { id: string; d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; onBack: () => void }) {
  const card = (d.board ?? []).find(c => c.id === id) ?? null;
  const q = card?.quote ?? null;
  // A quote saved as just an amount (by text, QUOTE 4200) opens as that amount; a new one starts from the price book.
  const [items, setItems] = useState<Item[]>(() => q?.items?.length ? q.items : q?.amount ? [{ name: card ? line(card) || "The job" : "The job", qty: 1, unit: "", price: q.amount }] : card ? draftItems(biz.trade, card.details, biz.priceBook) : []);
  const [tax, setTax] = useState<number>(() => q?.items?.length ? q.tax : Number(biz.taxRate) || 0);
  const [note, setNote] = useState(q?.note ?? ""), [deposit, setDeposit] = useState(q?.deposit ? String(q.deposit) : "");
  const [busy, setBusy] = useState(""), [losing, setLosing] = useState(false);
  if (!card) return <div className="pad"><button type="button" className="btn ghost" onClick={onBack}><Icon name="back" size={14} />Back</button><Empty title="That quote isn't here" text="It may have been moved. Open the customer from Jobs." /></div>;
  const clean = items.filter(i => i.name.trim() && i.qty > 0);
  const t = totals(clean, tax), dep = Math.round(Number(deposit.replace(/[^\d.]/g, "")) || 0);
  const s = quoteStatus(card) ?? "draft";
  const saved = JSON.stringify({ items: q?.items ?? [], tax: q?.tax ?? 0, note: q?.note ?? "", dep: q?.deposit ?? 0 });
  const dirty = !q || JSON.stringify({ items: clean, tax, note, dep }) !== saved;
  const firstName = first(card.name);
  const locked = s === "approved" || s === "declined";

  async function save(send: boolean) {
    if (t.total <= 0) { toast("Add a line with a price first.", true); return null; }
    if (dep > t.total) { toast("The deposit can't be more than the quote.", true); return null; }
    setBusy(send ? "send" : "save");
    try {
      const body = card!.stage === "quoted" ? { action: "quotelines", items: clean, tax, note, deposit: dep || null, send } : { action: "stage", stage: "quoted", amount: String(t.total), items: clean, tax, note, deposit: dep || null, link: send };
      const r = await api<{ sent?: boolean; warn?: string; link?: string }>("/api/app/act", { p: project, thread: card!.id, ...body });
      toast(send ? (r.sent ? `Quote texted to ${firstName}: ${dollars(t.total)}.` : r.warn || "Saved.") : `Saved: ${dollars(t.total)}. Not sent yet.`, send && !r.sent);
      await reload(); return r;
    } catch (e) { toast(e instanceof Error ? e.message : "That didn't save.", true); return null; } finally { setBusy(""); }
  }
  async function copy() {
    let url = q?.url ?? null;
    if (dirty || !url) { if (!(await save(false))) return; const r = await api<{ link?: string }>("/api/app/act", { p: project, thread: card!.id, action: "quotelink", send: false, note }).catch(() => null); url = r?.link ?? url; }
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast("Quote link copied."); } catch { prompt("Copy the quote link:", url); }
  }
  async function lose(reason: string) {
    setBusy("lost");
    try { await api("/api/app/act", { p: project, thread: card!.id, action: "stage", stage: "lost", reason }); toast(`Marked lost, ${reason.toLowerCase()}.`); setLosing(false); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); } finally { setBusy(""); }
  }
  const mail = card.email && q?.url ? `mailto:${card.email}?subject=${encodeURIComponent(`Your quote from ${biz.business}`)}&body=${encodeURIComponent(quoteText({ first: firstName, business: biz.business, amount: t.total, line: line(card), url: q.url }))}` : "";

  return <div className="qe">
    <header className="qe-h">
      <button type="button" className="btn ghost ic" onClick={onBack} aria-label="Back" title="Back (esc)"><Icon name="back" size={16} /></button>
      <div className="t"><h1>Quote for {card.name || fmtPhone(card.phone)}</h1><span><span className={"dot " + TONE[s]}>{Q_LABEL[s]}</span>{q?.viewed ? `, opened ${ago(q.viewed)}` : ""}{q?.linked && q.steps ? `, ${q.steps} of 4 follow-ups sent` : ""}</span></div>
      <div className="acts">
        <button type="button" className="btn" onClick={() => go.record(card.id)}>Customer</button>
        {!locked && <button type="button" className="btn" disabled={!!busy} onClick={() => void copy()}><Icon name="link" size={13} />Copy link</button>}
        {!locked && mail && <a className="btn" href={mail}><Icon name="send" size={13} />Email</a>}
        {!locked && <button type="button" className="btn" disabled={!!busy || !dirty} onClick={() => void save(false)}>{busy === "save" ? <Spinner /> : "Save draft"}</button>}
        {!locked && <button type="button" className="btn ink" disabled={!!busy || t.total <= 0} onClick={() => void save(true)}>{busy === "send" ? <Spinner /> : q?.linked && !dirty ? `Text it again` : `Text ${firstName} ${dollars(t.total)}`}</button>}
        {s === "approved" && <button type="button" className="btn ink" onClick={() => go.record(card.id, { view: "job" })}>Open the job</button>}
      </div>
    </header>
    <div className="qe-body">
      <div className="qe-form">
        {locked ? <p className="fine">{s === "approved" ? `${firstName} approved this quote. It's now a won job.` : `${firstName} passed on this quote${card.lostReason ? `: ${card.lostReason}` : ""}.`}</p> : null}
        <section><p className="sec">Line items</p>{locked ? <DocLines items={clean} taxRate={tax} total={t.total} /> : <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />}</section>
        {!locked && <>
          <section><p className="sec">What&rsquo;s included<small>they&rsquo;ll see it</small></p>
            <textarea className="input" rows={3} style={{ height: "auto", padding: "6px 8px" }} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Tear-out and haul-away, steel posts set in concrete, two-year workmanship warranty" /></section>
          <section><p className="sec">Deposit<small>optional, paid through your own pay link after they approve</small></p>
            <div className="acts-row"><span className="inwrap" style={{ width: 160 }}><i>$</i><input inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="None" aria-label="Deposit" /></span>
              {[25, 33, 50].map(p => <button key={p} type="button" className="btn sm" disabled={t.total <= 0} onClick={() => setDeposit(String(Math.round(t.total * p / 100)))}>{p}%</button>)}</div>
            {dep > 0 && !biz.payLink && <p className="fine">Add your pay link in Money so they can pay it from the quote page.</p>}</section>
          <p className="fine">After you text it, Cinder follows up on day 2, 5, 10 and 21, and stops the moment they reply or approve.</p>
          {card.stage === "quoted" && <div className="acts-row"><button type="button" className="btn ghost sm" onClick={() => go.record(card.id, { ask: "won" })}>Mark won</button><button type="button" className="btn ghost sm" onClick={() => setLosing(true)}>Mark lost</button></div>}
        </>}
      </div>
      <aside className="qe-prev" aria-label="What the customer sees">
        <p className="sec">What {firstName} sees</p>
        <div className="qe-phone"><div className="doc">
          <header className="doc-biz"><span className="doc-mono" aria-hidden="true">{biz.business.charAt(0)}</span><b>{biz.business}</b></header>
          <section className="doc-card">
            <p className="doc-k">Quote for {firstName}, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            <p className="doc-amt">{t.total ? dollars(t.total) : "$0"}</p>
            {card.line && <p className="doc-line">{line(card)}</p>}
            {clean.length > 0 && <DocLines items={clean} taxRate={tax} total={t.total} />}
            {note.trim() && <div className="doc-note"><h2>What&rsquo;s included</h2><p>{note}</p></div>}
            <div className="doc-acts">
              <span className="btn ink lg" aria-disabled="true">Approve {t.total ? dollars(t.total) : ""}</span>
              {dep > 0 && <p className="doc-fine">A {dollars(dep)} deposit holds the install date, paid on {biz.business}&rsquo;s own payment page.</p>}
            </div>
          </section>
        </div></div>
      </aside>
    </div>
    {losing && <LostPicker name={card.name || fmtPhone(card.phone)} busy={busy === "lost"} onClose={() => setLosing(false)} onPick={r => void lose(r)} />}
  </div>;
}
