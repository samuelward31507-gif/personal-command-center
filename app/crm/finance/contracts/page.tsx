"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "../finance.css";

type Contract = { id: string; clientName: string; contractName: string; monthlyAmount: number; status: "active" | "paused" | "cancelled"; startDate: string; endDate: string; notes: string };
const cash = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

export default function RecurringContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");
  const [contractName, setContractName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editContractName, setEditContractName] = useState("");
  const [editMonthlyAmount, setEditMonthlyAmount] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/recurring-contracts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load contracts.");
      setContracts(data.contracts || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load contracts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/recurring-contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName, contractName, monthlyAmount: Number(monthlyAmount), startDate, endDate: endDate || null, notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save contract.");
      setClientName(""); setContractName(""); setMonthlyAmount(""); setStartDate(today()); setEndDate(""); setNotes("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save contract."); }
    finally { setSaving(false); }
  };
  const beginEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setEditClientName(contract.clientName);
    setEditContractName(contract.contractName);
    setEditMonthlyAmount(String(contract.monthlyAmount));
    setEditStartDate(contract.startDate);
    setEditEndDate(contract.endDate);
    setEditNotes(contract.notes);
    setError("");
  };
  const saveEdit = async (contractId: string) => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/recurring-contracts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contractId, clientName: editClientName, contractName: editContractName, monthlyAmount: Number(editMonthlyAmount), startDate: editStartDate, endDate: editEndDate || null, notes: editNotes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update contract.");
      setEditingId(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update contract."); }
    finally { setSaving(false); }
  };
  const updateStatus = async (contract: Contract) => {
    const status = contract.status === "active" ? "paused" : "active";
    try {
      const response = await fetch("/api/recurring-contracts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contract.id, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update contract.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update contract."); }
  };
  const cancelContract = async (contract: Contract) => {
    if (!window.confirm("Mark this contract cancelled? It will stop counting toward contracted MRR immediately. This does not notify the client or cancel an external agreement.")) return;
    setError("");
    try {
      const response = await fetch("/api/recurring-contracts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contract.id, status: "cancelled" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to cancel contract record.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to cancel contract record."); }
  };
  const remove = async (contract: Contract) => {
    if (!window.confirm("Delete this contract record? This does not cancel a real-world client agreement.")) return;
    try {
      const response = await fetch("/api/recurring-contracts?id=" + encodeURIComponent(contract.id), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete contract.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete contract."); }
  };
  const mrr = contracts.filter(c => c.status === "active" && c.startDate <= today() && (!c.endDate || c.endDate >= today())).reduce((sum, c) => sum + c.monthlyAmount, 0);
  return <main className="fin-shell">
    <header className="fin-header"><Link href="/crm/finance">← Revenue intelligence</Link><span>RECURRING CONTRACTS</span></header>
    <section className="fin-content">
      <div className="fin-top"><div><div className="fin-eyebrow">CONTRACTED REVENUE</div><h1>Recurring contracts<span>.</span></h1><p>Record the actual monthly amount agreed with each client. Only active contracts inside their effective dates count toward MRR.</p></div></div>
      {error && <div className="fin-error" role="alert">{error}</div>}
      <div className="fin-metrics"><article><small>CONTRACTED MONTHLY RECURRING REVENUE</small><strong>{loading ? "—" : cash(mrr)}</strong></article><article><small>ACTIVE CONTRACTS</small><strong>{loading ? "—" : contracts.filter(c => c.status === "active" && c.startDate <= today() && (!c.endDate || c.endDate >= today())).length}</strong></article></div>
      <section className="fin-form">
        <h2>Add recurring contract</h2>
        <div className="fin-form-grid">
          <label>Client / company<input value={clientName} onChange={e => setClientName(e.target.value)} maxLength={240} required /></label>
          <label>Contract / service<input value={contractName} onChange={e => setContractName(e.target.value)} placeholder="Monthly growth management" maxLength={240} required /></label>
          <label>Monthly amount ($)<input type="number" min="0" step="0.01" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} placeholder="1497.00" required /></label>
          <label>Start date<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required /></label>
          <label>End date (optional)<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          <label className="fin-wide">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Agreement context or renewal notes" /></label>
        </div>
        <button className="fin-primary" disabled={saving || !clientName.trim() || !contractName.trim() || monthlyAmount === "" || Number(monthlyAmount) < 0 || !startDate} onClick={() => void save()}>{saving ? "Saving…" : "Save contract"}</button>
      </section>
      <div className="fin-records">
        {loading ? <div className="fin-empty">Loading recurring contracts…</div> : contracts.length === 0 ? <div className="fin-empty"><strong>No contracts recorded yet.</strong><p>Add a signed, current client agreement to establish reliable MRR.</p></div> : contracts.map(contract => <article className="fin-record" key={contract.id}>
          {editingId === contract.id ? <div className="fin-wide">
            <div className="fin-form-grid">
              <label>Client / company<input value={editClientName} onChange={e => setEditClientName(e.target.value)} maxLength={240} /></label>
              <label>Contract / service<input value={editContractName} onChange={e => setEditContractName(e.target.value)} maxLength={240} /></label>
              <label>Monthly amount ($)<input type="number" min="0" step="0.01" value={editMonthlyAmount} onChange={e => setEditMonthlyAmount(e.target.value)} /></label>
              <label>Start date<input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} /></label>
              <label>End date (optional)<input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} /></label>
              <label className="fin-wide">Notes<textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></label>
            </div>
            <div className="fin-record-actions"><button disabled={saving || !editClientName.trim() || !editContractName.trim() || editMonthlyAmount === "" || !Number.isFinite(Number(editMonthlyAmount)) || Number(editMonthlyAmount) < 0 || !editStartDate || (!!editEndDate && editEndDate < editStartDate)} onClick={() => void saveEdit(contract.id)}>{saving ? "Saving…" : "Save changes"}</button><button disabled={saving} onClick={() => setEditingId(null)}>Cancel</button></div>
          </div> : <>
            <div className="fin-record-main"><strong>{contract.clientName} — {contract.contractName}</strong><small>{contract.startDate}{contract.endDate ? " to " + contract.endDate : " · no end date"}</small><small>{contract.notes || "No notes"}</small></div>
            <div className="fin-record-side"><strong>{cash(contract.monthlyAmount)}/mo</strong><span className={"fin-status status-" + contract.status}>{contract.status}</span></div>
            <div className="fin-record-actions"><button onClick={() => beginEdit(contract)}>Edit terms</button>{contract.status !== "cancelled" && <><button onClick={() => void updateStatus(contract)}>{contract.status === "active" ? "Pause" : "Activate"}</button><button onClick={() => void cancelContract(contract)}>Cancel contract</button></>}<button onClick={() => void remove(contract)}>Delete record</button></div>
          </>}
        </article>)}
      </div>
      <p className="fin-footnote">MRR is a management metric, not proof of payment. Keep this list aligned with signed agreements, start dates, pauses, cancellations, and end dates. Deleting a record here only deletes the workspace record; it does not cancel a client agreement.</p>
    </section>
  </main>;
}
