"use client";
// Discovery fields + guarantee calculator + founding-offer price script for one contact.
// Shown in Call mode (Discovery tab) and on the contact page. Saves to /api/contacts/discovery.
import { useEffect, useState } from "react";
import { CRM_CHOICES, guaranteeCalc, priceScript, type Discovery, type GuaranteeCalc, type OfferSettings } from "@/lib/founding-offer";
import "./founding.css";

type Data = { discovery: Discovery; calc: GuaranteeCalc; offer: OfferSettings; used: number; left: number };
type Form = { oldLeads: string; newLeadsPerMonth: string; avgJobValue: string; closeRate: string; usesCrm: string; reviewLink: string };
const toForm = (d: Discovery): Form => ({ oldLeads: d.oldLeads?.toString() ?? "", newLeadsPerMonth: d.newLeadsPerMonth?.toString() ?? "", avgJobValue: d.avgJobValue?.toString() ?? "", closeRate: d.closeRate?.toString() ?? "", usesCrm: d.usesCrm ?? "", reviewLink: d.reviewLink ?? "" });
const numOrUndef = (s: string) => { const t = s.replace(/[$,%\s]/g, ""); return t === "" || !Number.isFinite(Number(t)) ? undefined : Number(t); };

export default function DiscoveryPanel({ contactId, compact = false }: { contactId: string; compact?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    setData(null); setForm(null); setNote(null);
    fetch("/api/contacts/discovery?id=" + encodeURIComponent(contactId), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Couldn't load discovery."); return d as Data; })
      .then(d => { if (!live) return; setData(d); const f = toForm(d.discovery); setForm(f); setSaved(JSON.stringify(f)); })
      .catch(e => live && setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't load discovery." }));
    return () => { live = false; };
  }, [contactId]);

  if (!data || !form) return <div className="fo"><h3>Discovery</h3><p className="fo-sub">{note?.text ?? "Loading…"}</p></div>;
  const live: Discovery = { oldLeads: numOrUndef(form.oldLeads), newLeadsPerMonth: numOrUndef(form.newLeadsPerMonth) };
  const calc = guaranteeCalc(live, data.offer); // updates as Sam types, before saving
  const dirty = JSON.stringify(form) !== saved;
  const set = (k: keyof Form, v: string) => { setForm({ ...form, [k]: v }); setNote(null); };

  async function save() {
    if (!form) return;
    setBusy(true); setNote(null);
    try {
      const discovery = { oldLeads: form.oldLeads, newLeadsPerMonth: form.newLeadsPerMonth, avgJobValue: form.avgJobValue, closeRate: form.closeRate, usesCrm: form.usesCrm, reviewLink: form.reviewLink };
      const r = await fetch("/api/contacts/discovery", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contactId, discovery }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      setData(d); const f = toForm(d.discovery); setForm(f); setSaved(JSON.stringify(f));
      setNote({ ok: true, text: "Saved." });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." }); }
    finally { setBusy(false); }
  }

  const field = (k: keyof Form, label: string, ph: string, mode: "numeric" | "decimal" | "url" = "numeric") =>
    <label className="fo-field"><span>{label}</span><input value={form[k]} inputMode={mode === "url" ? "url" : mode} placeholder={ph} onChange={e => set(k, e.target.value)} /></label>;

  return <div className="fo" aria-label="Discovery and guarantee">
    <h3>Discovery</h3>
    {!compact && <p className="fo-sub">Ask these on the call. The calculator decides whether to offer the 3-estimate guarantee.</p>}
    <div className="fo-grid">
      {field("oldLeads", "About how many old quotes/leads do you have?", "e.g. 300")}
      {field("newLeadsPerMonth", "New leads per month", "e.g. 30")}
      {field("avgJobValue", "Average job value ($)", "e.g. 6000")}
      {field("closeRate", "Close rate on estimates (%)", "e.g. 30", "decimal")}
      <label className="fo-field"><span>Uses a CRM</span><select value={form.usesCrm} onChange={e => set("usesCrm", e.target.value)}><option value="">Not asked yet</option>{CRM_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      {field("reviewLink", "Google review link", "https://g.page/r/…/review", "url")}
    </div>
    <div className={"fo-calc" + (calc.offer ? "" : " warn")} role="status">
      <b>{calc.text}</b>{" "}{calc.eligible ? "Guarantee eligible (150+ old leads)." : "Not eligible: under 150 old leads."}
      {calc.warning && <div style={{ marginTop: 4 }}>{calc.warning}</div>}
    </div>
    <div className="fo-chip">
      <p>&ldquo;{priceScript(data.offer)}&rdquo;</p>
      {data.offer.spotsTotal > 0 && <small>Spots left: {data.left} of {data.offer.spotsTotal}{data.left === 0 ? " — founding offer is full, quote the standard plan" : ""}</small>}
    </div>
    <div className="fo-row">
      <button type="button" className="fo-btn primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : dirty ? "Save discovery" : "Saved"}</button>
      {note && <span className={"fo-note " + (note.ok ? "ok" : "bad")} role="status" style={{ margin: 0 }}>{note.text}</span>}
    </div>
  </div>;
}
