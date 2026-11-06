"use client";
// Founding offer settings (one record): name, prices, founding spots and the guarantee calculator rates.
import { useEffect, useState } from "react";
import type { OfferSettings } from "@/lib/founding-offer";
import "./workspace-card.css";

type Data = { offer: OfferSettings; used: number; left: number; script: string };
const pct = (n: number) => String(Math.round(n * 1000) / 10);

export function OfferCard() {
  const [d, setD] = useState<Data | null>(null);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const toForm = (o: OfferSettings) => ({ offerName: o.offerName, setupFee: String(o.setupFee), standardSetup: String(o.standardSetup), monthly: String(o.monthly), spotsTotal: String(o.spotsTotal), minOldLeads: String(o.minOldLeads), oldReply: pct(o.rates.oldReply), oldBook: pct(o.rates.oldBook), newReply: pct(o.rates.newReply), newBook: pct(o.rates.newBook) });

  useEffect(() => {
    fetch("/api/offer", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then((x: Data | null) => {
      if (!x) throw new Error(); setD(x); const f = toForm(x.offer); setForm(f); setSaved(JSON.stringify(f));
    }).catch(() => setNote({ ok: false, text: "Couldn't load the offer settings." }));
  }, []);
  if (!d || !form) return <section className="ws-card"><h2>Founding offer</h2><p className="ws-sub">{note?.text ?? "Loading…"}</p></section>;
  const dirty = JSON.stringify(form) !== saved;
  const set = (k: string, v: string) => { setForm({ ...form, [k]: v }); setNote(null); };

  async function save() {
    if (!form) return;
    setBusy(true); setNote(null);
    try {
      const offer = { offerName: form.offerName, setupFee: form.setupFee, standardSetup: form.standardSetup, monthly: form.monthly, spotsTotal: form.spotsTotal, minOldLeads: form.minOldLeads,
        rates: { oldReply: Number(form.oldReply) / 100, oldBook: Number(form.oldBook) / 100, newReply: Number(form.newReply) / 100, newBook: Number(form.newBook) / 100 } };
      const r = await fetch("/api/offer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "Couldn't save.");
      setD(x); const f = toForm(x.offer); setForm(f); setSaved(JSON.stringify(f));
      setNote({ ok: true, text: "Saved. Call mode and the guarantee calculator use these now." });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." }); }
    finally { setBusy(false); }
  }
  const f = (k: string, label: string, help?: string, prefix?: string) => <label className="ws-field"><span>{label}</span>
    {prefix ? <div className="ws-money"><i>{prefix}</i><input value={form[k]} inputMode="numeric" onChange={e => set(k, e.target.value)} /></div> : <input value={form[k]} inputMode="decimal" onChange={e => set(k, e.target.value)} />}
    {help && <small>{help}</small>}</label>;

  return <section className="ws-card">
    <div className="ws-head">
      <div><h2>Founding offer</h2><p className="ws-sub">{d.used} of {d.offer.spotsTotal} founding spots used · {d.left} left. Used counts founding clients that are signed and not cancelled.</p></div>
      <button className="ws-save" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
    </div>
    {note && <p className={"ws-note " + (note.ok ? "ok" : "bad")} role="status">{note.text}</p>}
    <h3>Offer</h3>
    <div className="ws-grid three">
      <label className="ws-field wide"><span>Offer name</span><input value={form.offerName} onChange={e => set("offerName", e.target.value)} /></label>
      {f("setupFee", "Founding setup fee", undefined, "$")}
      {f("standardSetup", "Standard setup (shown struck through)", undefined, "$")}
      {f("monthly", "Monthly", "Starts after the first booked estimate.", "$")}
      {f("spotsTotal", "Founding spots total")}
      {f("minOldLeads", "Old leads needed for the guarantee")}
    </div>
    <h3>Guarantee calculator rates</h3>
    <p className="ws-sub">Expected booked estimates = old leads × reply % × book % + new leads × reply % × book %. Safe to guarantee is half of that. Update these after client #1.</p>
    <div className="ws-grid">
      {f("oldReply", "Old leads: reply rate (%)")}
      {f("oldBook", "Old leads: replies that book (%)")}
      {f("newReply", "New leads: reply rate (%)")}
      {f("newBook", "New leads: replies that book (%)")}
    </div>
    <h3>Price answer in Call mode</h3>
    <p className="ws-sub" style={{ color: "#e4e4e4" }}>&ldquo;{d.script}&rdquo;</p>
  </section>;
}
