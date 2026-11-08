"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Columns, LineChart, compactUsd } from "../../ui/charts";
import Owed, { type OwedData } from "./owed";

type Revenue = { id: string; title: string; revenue_type: string; amount: number; status: string; due_date: string | null; paid_at: string | null; notes: string; contact_name: string; deal_title: string; project_name: string; created_at?: string };
type Expense = { id: string; title: string; category: string; amount: number; expense_date: string; recurring: boolean; notes: string };
type Totals = { weightedSetup?: number; weightedMrr?: number; openDeals: number; openPipelineSetup: number; openPipelineMrr: number; dueNext30: number; recurringCosts: number; month: string; paidRevenue: number; setupRevenue: number; mrr: number; contractedMrr: number; arr: number; monthExpenses: number; monthNet: number; expected: number; overdue: number };
type Sum = { collected: number; spent: number; profit: number; taxSetAside: number; takeHome: number };
type Plan = { taxPct: number; month: Sum; year: Sum; mrr: number; forecast: { goal: number; goalBy: string; months: number; collected: number; projected: number; gap: number; perMonthNeeded: number; onTrack: boolean; pct: number } };

const MOVE_OUT_MRR = 6000;
const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n || 0)).toLocaleString("en-US");
const usdc = (n: number) => { const whole = Math.abs(n % 1) < 0.005; return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(n || 0); };
const localDay = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const monthKey = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const monthName = (key: string, long = false) => new Date(key + "-15T12:00:00").toLocaleDateString("en-US", { month: long ? "long" : "short" });
const dayLabel = (d: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const TYPE: Record<string, string> = { setup_fee: "Setup fee", monthly_retainer: "Retainer", usage: "Usage", one_time: "One-time", other: "Other" };
const CATEGORIES = ["software", "marketing", "contractor", "telecom", "hosting", "education", "equipment", "travel", "fees", "taxes", "other"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Last `count` month keys ending with the current month. */
function monthsBack(count: number) {
  const now = new Date(), out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return <span>No change</span>;
  if (!before) return <span className="u-up">New this month</span>;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return <span className={pct >= 0 ? "u-up" : "u-down"}>{pct >= 0 ? "Up" : "Down"} {Math.abs(pct)}% on last month</span>;
}

export default function MoneyPage() {
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [owed, setOwed] = useState<OwedData | null>(null);
  const [links, setLinks] = useState<{ contacts: any[]; deals: any[]; projects: any[] }>({ contacts: [], deals: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<6 | 12>(12);
  const [ledger, setLedger] = useState<"revenue" | "expenses">("revenue");
  const [adding, setAdding] = useState<null | "revenue" | "expense">(null);
  const [tick, setTick] = useState(0);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const rs = await Promise.all(["/api/finance", "/api/money-plan", "/api/contacts", "/api/deals", "/api/projects"].map(u => fetch(u, { cache: "no-store" })));
      const [f, p, c, d, pr] = await Promise.all(rs.map(r => r.json().catch(() => ({}))));
      if (!rs[0].ok) throw new Error(f.error || "Couldn't load your money.");
      setRevenue(f.revenue || []); setExpenses(f.expenses || []); setTotals(f.summary || null);
      if (rs[1].ok) setPlan(p);
      setLinks({ contacts: c.contacts || [], deals: d.deals || [], projects: pr.projects || [] });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your money."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load, tick]);
  const onOwed = useCallback((d: OwedData) => setOwed(d), []);

  const months = useMemo(() => monthsBack(range), [range]);
  const series = useMemo(() => {
    const inn = new Map(months.map(m => [m, 0])), out = new Map(months.map(m => [m, 0])), ret = new Map(months.map(m => [m, 0]));
    for (const r of revenue) {
      if (r.status === "paid" && r.paid_at) { const k = r.paid_at.slice(0, 7); if (inn.has(k)) inn.set(k, inn.get(k)! + r.amount); }
      if (r.revenue_type === "monthly_retainer" && r.status !== "cancelled") { const k = (r.paid_at || r.due_date || r.created_at || "").slice(0, 7); if (ret.has(k)) ret.set(k, ret.get(k)! + r.amount); }
    }
    for (const e of expenses) { const k = (e.expense_date || "").slice(0, 7); if (out.has(k)) out.set(k, out.get(k)! + e.amount); }
    const collected = months.map(m => inn.get(m)!), spent = months.map(m => out.get(m)!);
    return { collected, spent, profit: collected.map((v, i) => v - spent[i]), retainers: months.map(m => ret.get(m)!) };
  }, [revenue, expenses, months]);

  const thisMonth = months[months.length - 1];
  const collectedNow = series.collected[series.collected.length - 1] ?? 0, collectedBefore = series.collected[series.collected.length - 2] ?? 0;
  const spentNow = series.spent[series.spent.length - 1] ?? 0;
  const rangeIn = series.collected.reduce((a, b) => a + b, 0), rangeOut = series.spent.reduce((a, b) => a + b, 0);
  const mrr = totals?.contractedMrr ?? 0;
  const byCategory = useMemo(() => {
    const since = months[0] + "-01", m = new Map<string, number>();
    for (const e of expenses) if (e.expense_date >= since) m.set(e.category, (m.get(e.category) || 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, months]);
  const catMax = Math.max(1, ...byCategory.map(c => c[1]));

  async function togglePaid(r: Revenue) {
    const res = await fetch("/api/finance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: r.status === "paid" ? "expected" : "paid" }) });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Couldn't update that payment."); return; }
    setTick(t => t + 1);
  }
  async function remove(kind: "revenue" | "expense", id: string) {
    if (!window.confirm("Delete this record? This can't be undone.")) return;
    const res = await fetch(`/api/finance?id=${encodeURIComponent(id)}&kind=${kind}`, { method: "DELETE" });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Couldn't delete that record."); return; }
    setTick(t => t + 1);
  }

  const rank = (r: Revenue) => (r.status === "overdue" ? 0 : r.status === "expected" ? 1 : 2);
  const revSorted = useMemo(() => [...revenue].sort((a, b) => rank(a) - rank(b) || String(b.paid_at || b.due_date || "").localeCompare(String(a.paid_at || a.due_date || ""))), [revenue]);
  const empty = !loading && revenue.length === 0 && expenses.length === 0;
  const f = plan?.forecast, s = plan?.month;

  return <div className="u-page" role="region" aria-label="Money">
    <div className="u-head">
      <h1 className="u-title">Money</h1>
      <div className="u-head-actions">
        <div className="u-seg" role="group" aria-label="Range">{([6, 12] as const).map(n => <button key={n} type="button" aria-pressed={range === n} onClick={() => setRange(n)}>{n} months</button>)}</div>
        <button className="u-btn" onClick={() => setAdding("expense")}>Log expense</button>
        <button className="u-btn u-btn-go" onClick={() => setAdding("revenue")}>Record revenue</button>
      </div>
    </div>

    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 20 }}>{error}</p>}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Collected in {monthName(thisMonth, true)}</span><div className="u-fig-v">{loading ? "—" : usd(collectedNow)}</div><div className="u-fig-sub"><Delta now={collectedNow} before={collectedBefore} /></div></div>
      <div className="u-fig"><span className="u-fig-k">Monthly recurring</span><div className="u-fig-v">{loading ? "—" : usd(mrr)}<small>/mo</small></div><div className="u-meter"><i style={{ width: Math.min(100, (mrr / MOVE_OUT_MRR) * 100) + "%" }} /></div><div className="u-fig-sub"><b>{usd(Math.max(0, MOVE_OUT_MRR - mrr))}</b> to the {usd(MOVE_OUT_MRR)} move-out number</div></div>
      <div className="u-fig"><span className="u-fig-k">Profit in {monthName(thisMonth, true)}</span><div className="u-fig-v">{loading ? "—" : usd(collectedNow - spentNow)}</div><div className="u-fig-sub">after <b>{usd(spentNow)}</b> in costs</div></div>
      <div className="u-fig"><span className="u-fig-k">Owed to you</span><div className="u-fig-v">{owed ? usd(owed.totalOpen) : "—"}</div><div className="u-fig-sub">{owed?.totalOverdue ? <span style={{ color: "var(--u-ember-ink)" }}>{usd(owed.totalOverdue)} overdue</span> : owed?.totalOpen ? "Nothing overdue" : "All paid up"}</div></div>
    </div>

    <div className="u-split u-split-2 u-block">
      <section>
        <div className="u-h2-row">
          <h2 className="u-h2">Cash in and out</h2>
          <div className="u-legend"><span><i />Collected {usd(rangeIn)}</span><span><i className="is-2" />Costs {usd(rangeOut)}</span></div>
        </div>
        <LineChart labels={months.map(m => monthName(m))} series={[{ name: "Collected", values: series.collected }, { name: "Costs", values: series.spent, tone: "compare" }]} height={300} />
        {empty && <p className="u-note" style={{ marginTop: 10 }}>The lines fill in as you record payments and log costs.</p>}
      </section>

      <section>
        <div className="u-h2-row"><h2 className="u-h2">{monthName(thisMonth, true)}, after tax</h2><Link className="u-note" href="/crm/settings" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Tax rate {plan?.taxPct ?? 28}%</Link></div>
        <div className="u-rows">
          {([["Collected", s?.collected, ""], ["Costs", s?.spent, "−"], ["Profit", s?.profit, "="], [`Set aside for tax`, s?.taxSetAside, "−"]] as const).map(([k, v, op]) => <div key={k} className="u-row" style={{ minHeight: 46 }}>
            <span style={{ width: 14, color: "var(--u-faint)" }}>{op}</span><div className="u-row-main"><span style={{ fontSize: 13.5, color: "var(--u-soft)" }}>{k}</span></div><div className="u-row-end u-num" style={{ color: "var(--u-text)", fontSize: 15 }}>{v == null ? "—" : usd(v)}</div>
          </div>)}
          <div className="u-row" style={{ minHeight: 64, borderBottom: 0 }}>
            <span style={{ width: 14, color: "var(--u-faint)" }}>=</span><div className="u-row-main"><span style={{ fontSize: 13.5, color: "var(--u-text)" }}>Yours to keep</span></div>
            <div className="u-fig-v" style={{ fontSize: 30, color: "var(--u-ember)" }}>{s ? usd(s.takeHome) : "—"}</div>
          </div>
        </div>
        {f && <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--u-line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 13.5 }}>{usd(f.goal)} by {dayLabel(f.goalBy)}</span>
            <span className={"u-mark " + (f.onTrack ? "is-good" : "is-ember")}>{f.onTrack ? "On track" : "Behind"}</span>
          </div>
          <div className="u-meter" style={{ height: 4 }}><i style={{ width: f.pct + "%" }} /></div>
          <p className="u-note" style={{ marginTop: 10, lineHeight: 1.55 }}>{usd(f.collected)} collected this year{f.gap > 0 && f.months > 0 ? `. You need ${usd(f.perMonthNeeded)} a month for the next ${f.months} month${f.months === 1 ? "" : "s"}.` : "."}</p>
        </div>}
      </section>
    </div>

    <div className="u-split u-split-even u-block">
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Retainers billed</h2><span className="u-note">Goal line {usd(MOVE_OUT_MRR)}/mo</span></div>
        <Columns labels={months.map(m => monthName(m))} values={series.retainers} format={compactUsd} target={MOVE_OUT_MRR} height={210} />
      </section>
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Where costs go</h2><span className="u-note">Last {range} months</span></div>
        {byCategory.length === 0
          ? <p className="u-note" style={{ paddingTop: 8 }}>No costs logged in this range. Log software, ads and contractors so profit stays honest.</p>
          : <div className="u-rows">{byCategory.slice(0, 6).map(([c, v]) => <div key={c} className="u-row" style={{ minHeight: 44, gap: 16 }}>
            <span style={{ width: 96, fontSize: 13.5, color: "var(--u-soft)" }}>{cap(c)}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--u-line-soft)", overflow: "hidden" }}><div style={{ width: (v / catMax) * 100 + "%", height: "100%", background: "#4a4540", borderRadius: 3 }} /></div>
            <span className="u-row-end u-num" style={{ minWidth: 72, color: "var(--u-text)" }}>{usd(v)}</span>
          </div>)}</div>}
      </section>
    </div>

    <section className="u-block"><Owed onChange={() => setTick(t => t + 1)} onData={onOwed} /></section>

    {totals && <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">Coming from the pipeline</h2><Link className="u-btn u-btn-bare" href="/crm/pipeline">Open pipeline</Link></div>
      {totals.openDeals
        ? <div className="u-figs" style={{ marginBottom: 0 }}>
          <div className="u-fig"><span className="u-fig-k">Open deals</span><div className="u-fig-v" style={{ fontSize: 30 }}>{totals.openDeals}</div></div>
          <div className="u-fig"><span className="u-fig-k">If they all close</span><div className="u-fig-v" style={{ fontSize: 30 }}>{usd(totals.openPipelineSetup)}<small>+ {usd(totals.openPipelineMrr)}/mo</small></div></div>
          <div className="u-fig"><span className="u-fig-k">Weighted by likelihood</span><div className="u-fig-v" style={{ fontSize: 30 }}>{usd(totals.weightedSetup ?? 0)}<small>+ {usd(totals.weightedMrr ?? 0)}/mo</small></div></div>
        </div>
        : <p className="u-note">No open deals. Booked meetings become deals here.</p>}
    </section>}

    <section className="u-block">
      <div className="u-h2-row">
        <div className="u-seg" role="group" aria-label="Ledger">
          <button type="button" aria-pressed={ledger === "revenue"} onClick={() => setLedger("revenue")}>Revenue · {revenue.length}</button>
          <button type="button" aria-pressed={ledger === "expenses"} onClick={() => setLedger("expenses")}>Expenses · {expenses.length}</button>
        </div>
        <button className="u-btn u-btn-bare" onClick={() => setAdding(ledger === "revenue" ? "revenue" : "expense")}>{ledger === "revenue" ? "Record revenue" : "Log expense"}</button>
      </div>
      {loading ? <p className="u-note">Loading…</p> : ledger === "revenue"
        ? revenue.length === 0 ? <div className="u-void"><h2>No revenue yet</h2><p>Record a setup fee or retainer when a client signs. Paid records feed the charts above.</p><button className="u-btn u-btn-go" onClick={() => setAdding("revenue")}>Record revenue</button></div>
          : <div className="u-tablewrap"><table className="u-table"><thead><tr><th>Record</th><th>Type</th><th>Client</th><th>Date</th><th>Status</th><th className="is-num">Amount</th><th /></tr></thead><tbody>
            {revSorted.slice(0, all ? undefined : 12).map(r => <tr key={r.id}>
              <td className="is-strong">{r.title}</td><td>{TYPE[r.revenue_type] || r.revenue_type}</td><td>{r.contact_name || r.project_name || "—"}</td>
              <td>{r.status === "paid" ? dayLabel(r.paid_at) : dayLabel(r.due_date)}</td>
              <td><span className={"u-mark" + (r.status === "paid" ? " is-good" : r.status === "overdue" ? " is-ember" : "")}>{cap(r.status)}</span></td>
              <td className="is-num is-strong">{usdc(r.amount)}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button className="u-btn u-btn-bare" onClick={() => void togglePaid(r)}>{r.status === "paid" ? "Undo paid" : "Mark paid"}</button><button className="u-btn u-btn-bare" onClick={() => void remove("revenue", r.id)}>Delete</button></td>
            </tr>)}</tbody></table></div>
        : expenses.length === 0 ? <div className="u-void"><h2>No expenses yet</h2><p>Log what it costs to run Cinder: software, phone numbers, ads, contractors.</p><button className="u-btn u-btn-go" onClick={() => setAdding("expense")}>Log expense</button></div>
          : <div className="u-tablewrap"><table className="u-table"><thead><tr><th>Expense</th><th>Category</th><th>Date</th><th>Repeats</th><th className="is-num">Amount</th><th /></tr></thead><tbody>
            {expenses.slice(0, all ? undefined : 12).map(e => <tr key={e.id}><td className="is-strong">{e.title}</td><td>{cap(e.category)}</td><td>{dayLabel(e.expense_date)}</td><td>{e.recurring ? "Monthly" : "—"}</td><td className="is-num is-strong">{usdc(e.amount)}</td><td style={{ textAlign: "right" }}><button className="u-btn u-btn-bare" onClick={() => void remove("expense", e.id)}>Delete</button></td></tr>)}
          </tbody></table></div>}
      {!loading && (ledger === "revenue" ? revenue.length : expenses.length) > 12 && <button className="u-btn u-btn-bare" style={{ marginTop: 10 }} onClick={() => setAll(a => !a)}>{all ? "Show fewer" : `Show all ${ledger === "revenue" ? revenue.length : expenses.length}`}</button>}
    </section>

    {adding && <AddRecord kind={adding} links={links} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); setTick(t => t + 1); }} />}
  </div>;
}

function AddRecord({ kind, links, onClose, onSaved }: { kind: "revenue" | "expense"; links: { contacts: any[]; deals: any[]; projects: any[] }; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(""), [amount, setAmount] = useState(""), [type, setType] = useState("monthly_retainer"), [status, setStatus] = useState("paid");
  const [due, setDue] = useState(""), [paidAt, setPaidAt] = useState(localDay()), [category, setCategory] = useState("software"), [date, setDate] = useState(localDay()), [recurring, setRecurring] = useState(false);
  const [contactId, setContactId] = useState(""), [dealId, setDealId] = useState(""), [notes, setNotes] = useState(""), [saving, setSaving] = useState(false), [err, setErr] = useState("");
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  async function save() {
    setSaving(true); setErr("");
    try {
      const body = kind === "revenue"
        ? { kind, title, amount: Number(amount), revenueType: type, status, dueDate: due, paidAt, notes, contactId: contactId || null, dealId: dealId || null }
        : { kind, title, amount: Number(amount), category, date, recurring, notes };
      const r = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save.");
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); setSaving(false); }
  }
  const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;
  return <div className="u-scrim" role="dialog" aria-modal="true" aria-label={kind === "revenue" ? "Record revenue" : "Log expense"} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="u-dialog" style={{ width: "min(520px, 100%)" }} onSubmit={e => { e.preventDefault(); void save(); }}>
      <h3>{kind === "revenue" ? "Record revenue" : "Log expense"}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <label className="u-lab">What is it<input className="u-field" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === "revenue" ? "Ridgeline Fence, setup fee" : "Twilio number"} /></label>
        <div style={grid}>
          <label className="u-lab">Amount<input className="u-field" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></label>
          {kind === "revenue"
            ? <label className="u-lab">Type<select className="u-field" value={type} onChange={e => setType(e.target.value)}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            : <label className="u-lab">Category<select className="u-field" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{cap(c)}</option>)}</select></label>}
        </div>
        {kind === "revenue" ? <>
          <div style={grid}>
            <label className="u-lab">Status<select className="u-field" value={status} onChange={e => setStatus(e.target.value)}><option value="paid">Paid</option><option value="expected">Expected</option></select></label>
            {status === "paid"
              ? <label className="u-lab">Received on<input className="u-field" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></label>
              : <label className="u-lab">Due on<input className="u-field" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>}
          </div>
          <div style={grid}>
            <label className="u-lab">Client<select className="u-field" value={contactId} onChange={e => setContactId(e.target.value)}><option value="">None</option>{links.contacts.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}</select></label>
            <label className="u-lab">Deal<select className="u-field" value={dealId} onChange={e => setDealId(e.target.value)}><option value="">None</option>{links.deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
          </div>
        </> : <div style={grid}>
          <label className="u-lab">Date<input className="u-field" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="u-lab" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 22 }}><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />Repeats monthly</label>
        </div>}
        <label className="u-lab">Notes<textarea className="u-field" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></label>
      </div>
      {err && <p className="u-flash is-bad" role="alert" style={{ marginTop: 14 }}>{err}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button type="button" className="u-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="u-btn u-btn-go" disabled={saving || !title.trim() || amount === "" || Number(amount) < 0}>{saving ? "Saving…" : kind === "revenue" ? "Save revenue" : "Save expense"}</button>
      </div>
    </form>
  </div>;
}
