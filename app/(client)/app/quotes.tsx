"use client";

// Quotes: every quote in one list, named by whose move it is, and a full-page editor. The editor is the form on the
// left and, on the right, exactly what the customer will see behind the link, updating as the owner types.
import { useMemo, useState } from "react";
import "../doc.css";
import { DocLines } from "../doc-lines";
import { chosen, dollars, totals, type Item } from "@/lib/billing";
import { QuoteOptions, hasOptions } from "../doc-lines";
import { draftItems, quoteText, type Card } from "@/lib/crm";
import { Avatar, Empty, Icon, Sheet, Spinner, ago, dateLabel, first, fmtPhone, usd, type Api, type Toast } from "./parts";
import { FieldIcon, Stg } from "./sources";
import { LineEditor } from "./money";
import { emailDoc } from "./crew";
import { Guide, Kpis, MiniDoc, PageHead } from "./charts";
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
const STG: Record<QStatus, string> = { draft: "turn", awaiting: "booked", opened: "quoted", changes: "turn", approved: "won", declined: "lost" };
const amountOf = (c: Card) => c.quote?.amount ?? c.value ?? 0;

type Filter = "open" | "draft" | "approved" | "declined" | "all";
export function QuotesScreen({ d, go, wide, biz }: { d: Data; go: Go; wide: boolean; biz: Biz }) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
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
    <PageHead title="Quotes" sub={open.length ? `${open.length} out, ${usd(open.reduce((a, r) => a + amountOf(r.c), 0))} waiting on a yes.` : "Nothing out right now."}
      actions={<button type="button" className="btn ink" onClick={() => setPicking(true)}><Icon name="plus" size={14} />New quote</button>} />
    <div className="dash quotes">
      {rows.length > 0 && <Kpis quiet items={[
        { label: "Your move", value: String(counts.draft + open.filter(r => r.s === "changes").length), sub: `${counts.draft} to send, ${open.filter(r => r.s === "changes").length} asked for changes`, tone: counts.draft ? "warn" : "", onClick: () => setF("draft"), active: f === "draft" },
        { label: "Approved, 30 days", value: usd(approved30.reduce((a, r) => a + amountOf(r.c), 0)), sub: `${approved30.length} ${approved30.length === 1 ? "job" : "jobs"}`, tone: approved30.length ? "up" : "", onClick: () => setF("approved"), active: f === "approved" },
        { label: "Approval rate, 90 days", value: rate == null ? "–" : `${rate}%`, sub: "approved of sent" },
      ]} />}
      {!rows.length && <Guide title="Quotes that close themselves" sub="Write the quote once. It goes out as a link the customer approves on their phone, then follows up on day 2, 5 and 10, and once a month after that, until they answer."
        steps={[
          { title: "Add your prices", text: "With a price book, every quote starts drafted from the job details, and leads get a ballpark by text.", done: !!biz.priceBook, action: <button type="button" className="btn sm" onClick={go.setup}>Add prices</button> },
          { title: "Book an estimate", text: "They get booked on their own. You can add one by hand from Jobs too.", done: (d.board ?? []).some(c => c.stage !== "new"), action: <button type="button" className="btn sm" onClick={() => go.tab("calendar")}>Calendar</button> },
          { title: "Write the first quote", text: "Lines, what's included and a deposit, with a live preview of what they'll see.", action: <button type="button" className="btn sm ink" onClick={() => setPicking(true)}>New quote</button> },
        ]}
        side={<MiniDoc kind="quote" business={biz.business} href="/q/example" />} />}
      {rows.length > 0 && <section className="panel">
      <div className="list-tools panel-tools">
        <div className="views" role="tablist" aria-label="Show">{([["open", "Open"], ["draft", "Drafts"], ["approved", "Approved"], ["declined", "Declined"], ["all", "All"]] as const).map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}{counts[k] ? <em>{counts[k]}</em> : null}</button>)}</div>
        <label className="inwrap search" style={{ marginLeft: "auto", width: 220 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search quotes" aria-label="Search quotes" /></label>
      </div>
      {!shown.length ? <Empty title={f === "open" ? "No quotes out" : "Nothing here"} text={f === "open" ? "Write one from an estimate. It goes out by text and gets followed up until they answer." : undefined} action={f === "open" ? <button type="button" className="btn ink" onClick={() => setPicking(true)}>New quote</button> : undefined} />
      : wide ? <table className="tbl q-tbl">
        <colgroup><col style={{ width: 40 }} /><col style={{ width: 210 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 260 }} /><col style={{ width: 96 }} /><col style={{ width: 110 }} /></colgroup>
        <thead><tr><th className="ck-col"><input type="checkbox" aria-label="Select all" checked={!!shown.length && shown.every(x => ticked.has(x.c.id))} onChange={e => setTicked(e.target.checked ? new Set(shown.map(x => x.c.id)) : new Set())} /></th>
          <th>Customer</th><th>Job</th><th>Status</th><th>Viewed</th><th className="right">Deposit</th><th className="right">Total</th></tr></thead>
        <tbody>{shown.map(({ c, s }) => <tr key={c.id} tabIndex={0} onClick={() => go.quote(c.id)} onKeyDown={e => { if (e.key === "Enter") go.quote(c.id); }}>
          <td className="ck-col" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${c.name || c.phone}`} checked={ticked.has(c.id)} onChange={() => setTicked(t => { const n = new Set(t); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} /></td>
          <td><span className="name"><Avatar name={c.name || c.phone} size="sm" /><b>{c.name || fmtPhone(c.phone)}</b></span></td>
          <td className={c.line ? "" : "faint"}>{line(c) || "No details yet"}</td>
          <td><Stg stage={STG[s]}>{Q_LABEL[s]}</Stg></td>
          <td className="mut">{c.quote?.views ? `${c.quote.views}x, ${ago(c.quote.lastViewed ?? c.quote.viewed)}` : c.quote?.viewed ? `Opened ${ago(c.quote.viewed)}` : c.quote?.linked ? "Not opened yet" : "Not sent"}{(s === "awaiting" || s === "opened") && c.quote?.steps ? `, ${c.quote.steps} follow-up${c.quote.steps === 1 ? "" : "s"}` : ""}</td>
          <td className="num mut">{c.quote?.deposit ? usd(c.quote.deposit) : "–"}</td>
          <td className="num"><b>{amountOf(c) ? dollars(amountOf(c)) : "–"}</b></td>
        </tr>)}</tbody>
        {ticked.size > 0 && (() => { const list = shown.filter(x => ticked.has(x.c.id)), sum = list.reduce((a, x) => a + (amountOf(x.c) || 0), 0);
          return <tfoot><tr><td /><td><b>{list.length}</b>selected</td><td /><td /><td /><td /><td className="num"><b>{dollars(sum)}</b>sum</td></tr></tfoot>; })()}</table>
      : <div>{shown.map(({ c, s }) => <button key={c.id} type="button" className="jrow" onClick={() => go.quote(c.id)}>
          <span style={{ minWidth: 0 }}><b>{c.name || fmtPhone(c.phone)}</b><small>{line(c) || "No details yet"}</small></span>
          <span className="r"><b>{amountOf(c) ? usd(amountOf(c)) : "–"}</b><em className={s === "changes" ? "red" : s === "approved" ? "green" : ""}>{Q_LABEL[s]}</em></span></button>)}</div>}
      </section>}
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
  const [qMore, setQMore] = useState(false);
  const [note, setNote] = useState(q?.note ?? ""), [deposit, setDeposit] = useState(q?.deposit ? String(q.deposit) : "");
  const [busy, setBusy] = useState(""), [losing, setLosing] = useState(false);
  if (!card) return <div className="pad"><button type="button" className="btn ghost" onClick={onBack}><Icon name="back" size={14} />Back</button><Empty title="That quote isn't here" text="It may have been moved. Open the customer from Jobs." /></div>;
  const clean = items.filter(i => i.name.trim() && i.qty > 0);
  const opts = hasOptions(clean), t = totals(opts ? chosen(clean, null) : clean, tax), dep = Math.round(Number(deposit.replace(/[^\d.]/g, "")) || 0);
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
  const mail = q?.url ? `mailto:${card.email ?? ""}?subject=${encodeURIComponent(`Your quote from ${biz.business}`)}&body=${encodeURIComponent(quoteText({ first: firstName, business: biz.business, amount: t.total, line: line(card), url: q.url }))}` : "";

  return <div className="qe">
    <header className="qe-h">
      <button type="button" className="btn ghost ic" onClick={onBack} aria-label="Back" title="Back (esc)"><Icon name="back" size={16} /></button>
      <div className="t"><h1>Quote for {card.name || fmtPhone(card.phone)}</h1><span><span className={"dot " + TONE[s]}>{Q_LABEL[s]}</span>{q?.viewed ? `, opened ${ago(q.viewed)}` : ""}{q?.linked && q.steps ? `, ${q.steps} of 4 follow-ups sent` : ""}</span></div>
      <div className="acts">
        <div className="menu-wrap qe-more"><button type="button" className="btn" aria-haspopup="menu" aria-expanded={qMore} onClick={() => setQMore(m => !m)}>More<Icon name="down" size={13} /></button>
          {qMore && <div className="menu pop" role="menu" onMouseLeave={() => setQMore(false)}>
            <button type="button" role="menuitem" onClick={() => { setQMore(false); go.record(card.id); }}>Customer</button>
            {!locked && <button type="button" role="menuitem" disabled={!!busy} onClick={() => { setQMore(false); void copy(); }}>Copy link</button>}
            {!locked && mail && <button type="button" role="menuitem" disabled={!!busy} onClick={async () => { setQMore(false); setBusy("email"); await emailDoc({ ready: d.emailReady, api, project, toast, reload, kind: "quote", thread: card.id, to: card.email, name: card.name, mailto: mail }); setBusy(""); }}>Email it</button>}
            {!locked && dirty && <button type="button" role="menuitem" disabled={!!busy} onClick={() => { setQMore(false); void save(false); }}>Save draft</button>}
          </div>}</div>
        <button type="button" className="btn qe-sec" onClick={() => go.record(card.id)}>Customer</button>
        {!locked && <button type="button" className="btn qe-sec" disabled={!!busy} onClick={() => void copy()}><Icon name="link" size={13} />Copy link</button>}
        {!locked && mail && <button type="button" className="btn qe-sec" disabled={!!busy} title={card.email ? `Email it to ${card.email}` : "Add their email on the customer first"} onClick={async () => { setBusy("email"); await emailDoc({ ready: d.emailReady, api, project, toast, reload, kind: "quote", thread: card.id, to: card.email, name: card.name, mailto: mail }); setBusy(""); }}>{busy === "email" ? <Spinner /> : <Icon name="send" size={13} />}Email</button>}
        {!locked && <button type="button" className="btn qe-sec" disabled={!!busy || !dirty} onClick={() => void save(false)}>{busy === "save" ? <Spinner /> : "Save draft"}</button>}
        {!locked && <button type="button" className="btn ink" disabled={!!busy || t.total <= 0} onClick={() => void save(true)}>{busy === "send" ? <Spinner /> : q?.linked && !dirty ? `Text it again` : `Text ${firstName} ${dollars(t.total)}`}</button>}
        {s === "approved" && <button type="button" className="btn ink" onClick={() => go.record(card.id, { view: "job" })}>Open the job</button>}
      </div>
    </header>
    <div className="qe-body">
      <div className="qe-form">
        {locked ? <p className="fine">{s === "approved" ? `${firstName} approved this quote. It's now a won job.` : `${firstName} passed on this quote${card.lostReason ? `: ${card.lostReason}` : ""}.`}</p> : null}
        <section><p className="sec">Line items{!locked && <TemplatePicker d={d} project={project} api={api} toast={toast} reload={reload} items={items} onUse={setItems} />}</p>{locked ? <DocLines items={clean} taxRate={tax} total={t.total} /> : <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} options />}</section>
        {!locked && <>
          <section><p className="sec">What&rsquo;s included<small>they&rsquo;ll see it</small></p>
            <textarea className="input" rows={3} style={{ height: "auto", padding: "6px 8px" }} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Tear-out and haul-away, steel posts set in concrete, two-year workmanship warranty" /></section>
          <section><p className="sec">Deposit<small>optional, paid through your own pay link after they approve</small></p>
            <div className="acts-row"><span className="inwrap" style={{ width: 160 }}><i>$</i><input inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="None" aria-label="Deposit" /></span>
              {[25, 33, 50].map(p => <button key={p} type="button" className="btn sm" disabled={t.total <= 0} onClick={() => setDeposit(String(Math.round(t.total * p / 100)))}>{p}%</button>)}</div>
            {dep > 0 && !biz.payLink && <p className="fine">Add your pay link in Money so they can pay it from the quote page.</p>}</section>
          {opts && <p className="fine">{firstName} picks one option and any add-ons on the quote page, and the total updates as they tap. The first option is the price on file until they choose.</p>}
          {!d.setup?.quote_terms && !d.setup?.warranty && <p className="fine"><button type="button" className="link" onClick={go.billing}>Add your warranty, terms and a financing link</button> once, and every quote shows them.</p>}
          <p className="fine">Follow-ups go out on day 2, 5 and 10, then once a month until they answer, and stop the moment they reply.</p>
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
            {clean.length > 0 && (opts ? <QuoteOptions items={clean} taxRate={tax} choice={{ tier: null, addons: [] }} /> : <DocLines items={clean} taxRate={tax} total={t.total} />)}
            {note.trim() && <div className="doc-note"><h2>What&rsquo;s included</h2><p>{note}</p></div>}
            {d.setup?.warranty && <div className="doc-note"><h2>Warranty</h2><p>{d.setup.warranty}</p></div>}
            {d.setup?.financing_link && <span className="doc-fin"><b>{d.setup.financing_note || "Pay over time"}</b><span>Your financing link</span></span>}
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

/** Saved quotes: start a quote from one, or keep this quote's lines as one. */
function TemplatePicker({ d, project, api, toast, reload, items, onUse }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; items: Item[]; onUse: (items: Item[]) => void }) {
  const list = (() => { try { const v = JSON.parse(d.setup?.quote_templates || "[]"); return Array.isArray(v) ? (v as { name: string; items: Item[] }[]) : []; } catch { return []; } })();
  const save = async () => {
    const name = prompt("Name this template", items[0]?.name?.slice(0, 40) || "Standard job"); if (!name || !name.trim()) return;
    const next = [...list.filter(t => t.name.toLowerCase() !== name.trim().toLowerCase()), { name: name.trim(), items }];
    try { await api("/api/app/act", { p: project, action: "setup", setup: { quote_templates: next } }); toast(`Saved "${name.trim()}". It's in the template list on every quote.`); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); }
  };
  return <span className="tpl-pick">
    {list.length > 0 && <select className="input sm" value="" aria-label="Start from a template" onChange={e => { const t = list.find(x => x.name === e.target.value); if (t && (items.length <= 1 || confirm(`Replace these lines with "${t.name}"?`))) onUse(t.items.map(x => ({ ...x }))); }}>
      <option value="">Start from a template</option>{list.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}</select>}
    {items.some(i => i.name.trim()) && <button type="button" className="link" onClick={() => void save()}>Save as template</button>}
  </span>;
}
