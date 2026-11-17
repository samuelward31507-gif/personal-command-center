"use client";

// Expenses and mileage: log one (with the receipt photo) from anywhere, see them on the Money screen, and on each job
// where they count toward what the job really cost.
import { useMemo, useState } from "react";
import { Icon, Sheet, Spinner, dateLabel, usd, type Api, type Toast } from "./parts";
import { shrink } from "./photos";
import { EXPENSE_CATS, byJob, catLabel, mileageRate, monthSummary, type Expense } from "@/lib/expenses";
import type { Data } from "./types";

/** Receipts are to the cent. */
const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function ExpenseSheet({ d, project, api, toast, reload, thread, onClose }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; thread?: string; onClose: () => void }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [f, setF] = useState({ kind: "expense" as "expense" | "mileage", amount: "", miles: "", vendor: "", category: "materials", spent_on: today, thread: thread ?? "", note: "" });
  const [receipt, setReceipt] = useState(""), [busy, setBusy] = useState(false);
  const rate = mileageRate(d.setup?.mileage_rate);
  const jobs = useMemo(() => (d.board ?? []).filter(c => !c.pastCustomer && c.stage !== "lost").slice(0, 200), [d.board]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ queued?: boolean }>("/api/app/act", { p: project, action: "expense", input: { ...f, thread: f.thread || null, receipt: receipt || undefined } });
      toast(r.queued ? "Saved on this phone. It goes out when you have signal." : f.kind === "mileage" ? "Mileage logged." : "Expense logged.");
      await reload(); onClose();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save it.", true); } finally { setBusy(false); }
  };
  const crew = d.role === "crew";
  return <Sheet title={f.kind === "mileage" ? "Log mileage" : "Log an expense"} onClose={onClose}
    foot={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn ink" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : null}Save</button></>}>
    <div className="seg" role="tablist" style={{ marginBottom: 12 }}>{(["expense", "mileage"] as const).map(k => <button key={k} type="button" role="tab" aria-selected={f.kind === k} className={f.kind === k ? "on" : ""} onClick={() => setF({ ...f, kind: k })}>{k === "expense" ? "Expense" : "Mileage"}</button>)}</div>
    {f.kind === "mileage"
      ? <label className="field"><span>Miles driven</span><input inputMode="decimal" value={f.miles} onChange={set("miles")} placeholder="24" autoFocus /><small className="mut">At ${rate.toFixed(2)} a mile{Number(f.miles) > 0 ? `: ${usd(Number(f.miles) * rate)}` : ""}.{crew ? "" : " Change the rate in Settings, Account."}</small></label>
      : <>
        <label className="field"><span>Amount</span><span className="inwrap"><i>$</i><input inputMode="decimal" value={f.amount} onChange={set("amount")} placeholder="0.00" autoFocus /></span></label>
        <div className="two">
          <label className="field"><span>Where</span><input value={f.vendor} onChange={set("vendor")} placeholder="Home Depot" /></label>
          <label className="field"><span>What for</span><select value={f.category} onChange={set("category")}>{EXPENSE_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
      </>}
    <div className="two">
      <label className="field"><span>Date</span><input type="date" value={f.spent_on} max={today} onChange={set("spent_on")} /></label>
      <label className="field"><span>Job</span><select value={f.thread} onChange={set("thread")}><option value="">Not for one job</option>{jobs.map(c => <option key={c.id} value={c.id}>{c.name}{c.line ? `, ${c.line.slice(0, 30)}` : ""}</option>)}</select></label>
    </div>
    <label className="field"><span>Note</span><input value={f.note} onChange={set("note")} placeholder={f.kind === "mileage" ? "Supply run and site visit" : "6 bags of concrete, 12 posts"} /></label>
    {f.kind === "expense" && <label className="field"><span>Receipt</span>
      <span className="acts-row">{receipt ? <><img src={receipt} alt="Receipt" style={{ height: 56, borderRadius: 6, boxShadow: "0 0 0 1px var(--hair-2)" }} /><button type="button" className="btn sm ghost" onClick={() => setReceipt("")}>Remove</button></>
        : <label className="btn sm"><Icon name="upload" size={13} />Take or pick a photo<input type="file" accept="image/*" capture="environment" hidden onChange={async e => { const file = e.target.files?.[0]; if (file) { try { setReceipt(await shrink(file)); } catch { toast("That photo didn't work.", true); } } }} /></label>}</span></label>}
  </Sheet>;
}

/** The Money screen's Expenses view: this month at a glance, then every entry. */
export function ExpensesView({ d, project, api, toast, reload, go }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: { record: (id: string) => void } }) {
  const list = useMemo(() => [...(d.expenses ?? [])].sort((a, b) => b.spent_on.localeCompare(a.spent_on)), [d.expenses]);
  const [adding, setAdding] = useState(false), [busy, setBusy] = useState("");
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const sum = monthSummary(list, month);
  const del = async (e: Expense) => { if (!confirm(`Delete ${e.kind === "mileage" ? `${e.miles} miles` : usd(e.amount)} from ${dateLabel(e.spent_on)}?`)) return; setBusy(e.id);
    try { await api("/api/app/act", { p: project, action: "expensedelete", entry: e.id }); toast("Deleted."); await reload(); } catch (x) { toast(x instanceof Error ? x.message : "Couldn't delete.", true); } finally { setBusy(""); } };
  return <>
    <div className="ex-top"><p className="fine" style={{ margin: 0 }}><b>{usd(sum.spent)}</b> spent this month{sum.miles ? `, ${sum.miles} miles` : ""}{sum.cats.length ? `. Most on ${catLabel(sum.cats[0].cat).toLowerCase()} (${usd(sum.cats[0].amount)}).` : "."}</p>
      <button type="button" className="btn sm ink" onClick={() => setAdding(true)}><Icon name="plus" size={13} />Log expense</button></div>
    {!list.length ? <p className="fine" style={{ padding: "10px 0" }}>Snap receipts here (or from a job) and they count toward that job&rsquo;s cost. Your crew can log them from the field too.</p>
      : <table className="tbl"><colgroup><col style={{ width: 110 }} /><col /><col style={{ width: 200 }} /><col style={{ width: 160 }} /><col style={{ width: 110 }} /><col style={{ width: 90 }} /></colgroup>
        <thead><tr><th>Date</th><th>What</th><th>Job</th><th>Category</th><th className="right">Amount</th><th /></tr></thead>
        <tbody>{list.map(e => <tr key={e.id} style={{ cursor: e.thread_id ? "pointer" : "default" }} onClick={e.thread_id ? () => go.record(e.thread_id!) : undefined}>
          <td className="mut">{dateLabel(e.spent_on)}</td>
          <td><b>{e.kind === "mileage" ? `${e.miles} miles` : e.vendor || catLabel(e.category)}</b>{e.note ? <span className="mut">, {e.note}</span> : null}</td>
          <td className="mut">{e.customer || "–"}</td><td className="mut">{catLabel(e.category)}</td><td className="num"><b>{cents(e.amount)}</b></td>
          <td className="right" onClick={x => x.stopPropagation()}>{e.receipt && <a className="btn ghost sm ic" href={`/api/app/receipt?p=${project}&id=${e.id}`} target="_blank" rel="noreferrer" title="Receipt" aria-label="Receipt"><Icon name="eye" size={13} /></a>}
            <button type="button" className="btn ghost sm ic" disabled={busy === e.id} onClick={() => void del(e)} title="Delete" aria-label="Delete"><Icon name="x" size={13} /></button></td></tr>)}</tbody></table>}
    {adding && <ExpenseSheet d={d} project={project} api={api} toast={toast} reload={reload} onClose={() => setAdding(false)} />}
  </>;
}

/** On a job: what's been spent on it, and one tap to count it as the job's materials cost. Crew only log. */
export function JobExpenses({ d, thread, project, api, toast, reload, materials, onUse }: { d: Data; thread: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; materials: number; onUse?: (amount: number) => void }) {
  const [adding, setAdding] = useState(false);
  const crew = d.role === "crew";
  const mine = (d.expenses ?? []).filter(e => e.thread_id === thread), total = byJob(mine).get(thread) ?? 0;
  return <section className="card"><div className="hd"><h2>Expenses</h2>{!crew && total > 0 && <small style={{ marginLeft: "auto" }}>{cents(total)}</small>}</div>
    {!crew && mine.slice(0, 8).map(e => <div key={e.id} className="money"><span>{e.kind === "mileage" ? `${e.miles} miles` : e.vendor || catLabel(e.category)} <small className="mut">{dateLabel(e.spent_on)}</small></span><b>{cents(e.amount)}</b></div>)}
    {!crew && !mine.length && <p className="fine">Receipts and mileage for this job land here and count toward its cost.</p>}
    {crew && <p className="fine">Snap a receipt for this job. The owner sees it with the job&rsquo;s costs.</p>}
    <div className="acts-row end" style={{ marginTop: 6 }}>
      {!crew && onUse && total > 0 && Math.abs(total - materials) > 0.009 && <button type="button" className="btn sm" onClick={() => onUse(total)}>Use {usd(total)} as materials</button>}
      <button type="button" className="btn sm" onClick={() => setAdding(true)}><Icon name="plus" size={13} />Log expense</button>
    </div>
    {adding && <ExpenseSheet d={d} project={project} api={api} toast={toast} reload={reload} thread={thread} onClose={() => setAdding(false)} />}
  </section>;
}
