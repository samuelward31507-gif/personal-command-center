"use client";

import { useEffect, useState } from "react";
import type { WorkspaceSettings } from "@/lib/workspace";
import "./workspace-card.css";

const ZONES = ["America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];

type Field = { key: keyof WorkspaceSettings; label: string; help?: string; type?: string; wide?: boolean };
const IDENTITY: Field[] = [
  { key: "businessName", label: "Business name", help: "What clients see: signing, kickoff, reports, the sidebar." },
  { key: "shortName", label: "Name on calls", help: "What you say on the phone: “It's Samuel with …”." },
  { key: "ownerFirstName", label: "Your first name" },
  { key: "ownerFullName", label: "Your full name", help: "Signs agreements." },
  { key: "legalName", label: "Legal name on agreements", wide: true },
  { key: "address", label: "Business address", wide: true },
  { key: "contactEmail", label: "Contact email", type: "email", help: "Printed on agreements." },
  { key: "niche", label: "Who you sell to", help: "Used in the Sunday review: “send 20 DMs to …”." },
  { key: "bookingLink", label: "Booking link", type: "url", help: "Where prospects book a call. Used on prospect reports." },
];

const money = (n: number) => String(n);

export function WorkspaceCard() {
  const [w, setW] = useState<WorkspaceSettings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/workspace", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.settings) { setW(d.settings); setSaved(JSON.stringify(d.settings)); }
    }).catch(() => setNote({ ok: false, text: "Couldn't load settings." }));
  }, []);

  if (!w) return <section className="ws-card"><h2>Workspace</h2><p className="ws-sub">{note?.text ?? "Loading…"}</p></section>;

  const dirty = JSON.stringify(w) !== saved;
  const set = <K extends keyof WorkspaceSettings>(k: K, v: WorkspaceSettings[K]) => { setW({ ...w, [k]: v }); setNote(null); };
  const setTier = (t: "tier1" | "tier2", k: "label" | "setupFee" | "monthlyFee" | "setupLink" | "monthlyLink", v: string) => {
    const text = k === "label" || k === "setupLink" || k === "monthlyLink";
    setW({ ...w, [t]: { ...w[t], [k]: text ? v : (v.replace(/[^\d]/g, "") === "" ? 0 : Number(v.replace(/[^\d]/g, ""))) } }); setNote(null);
  };

  async function save() {
    setBusy(true); setNote(null);
    try {
      const r = await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: w }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      setW(d.settings); setSaved(JSON.stringify(d.settings));
      setNote({ ok: true, text: "Saved. New deals, agreements and the scoreboard use these now." });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." }); }
    finally { setBusy(false); }
  }

  return <section className="ws-card">
    <div className="ws-head">
      <div><h2>Workspace</h2><p className="ws-sub">Your business details, prices and goal. Change them here instead of in code.</p></div>
      <button className="ws-save" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
    </div>
    {note && <p className={note.ok ? "ws-note ok" : "ws-note bad"} role={note.ok ? "status" : "alert"}>{note.text}</p>}

    <h3>Business</h3>
    <div className="ws-grid">
      {IDENTITY.map(f => <label key={f.key} className={f.wide ? "ws-field wide" : "ws-field"}>
        <span>{f.label}</span>
        <input type={f.type ?? "text"} value={String(w[f.key] ?? "")} onChange={e => set(f.key, e.target.value as never)} />
        {f.help && <small>{f.help}</small>}
      </label>)}
      <label className="ws-field">
        <span>Time zone</span>
        <select value={w.timezone} onChange={e => set("timezone", e.target.value)}>
          {(ZONES.includes(w.timezone) ? ZONES : [w.timezone, ...ZONES]).map(z => <option key={z} value={z}>{z.replace("America/", "").replace("Pacific/", "").replace("_", " ")}</option>)}
        </select>
        <small>Sets &ldquo;today&rdquo;, agreement dates and when overnight jobs count the day.</small>
      </label>
    </div>

    <h3>Offers</h3>
    <p className="ws-sub">New deals start at these prices. Existing deals keep the price they were created with.</p>
    <div className="ws-tiers">
      {(["tier1", "tier2"] as const).map(t => <div key={t} className="ws-tier">
        <label className="ws-field"><span>{t === "tier1" ? "Tier 1 name" : "Tier 2 name"}</span><input value={w[t].label} onChange={e => setTier(t, "label", e.target.value)} /></label>
        <div className="ws-pair">
          <label className="ws-field"><span>Setup</span><div className="ws-money"><i>$</i><input inputMode="numeric" value={money(w[t].setupFee)} onChange={e => setTier(t, "setupFee", e.target.value)} /></div></label>
          <label className="ws-field"><span>Monthly</span><div className="ws-money"><i>$</i><input inputMode="numeric" value={money(w[t].monthlyFee)} onChange={e => setTier(t, "monthlyFee", e.target.value)} /></div></label>
        </div>
        <label className="ws-field"><span>Setup payment link</span><input type="url" placeholder="https://buy.stripe.com/…" value={w[t].setupLink} onChange={e => setTier(t, "setupLink", e.target.value)} /></label>
        <label className="ws-field"><span>Monthly payment link</span><input type="url" placeholder="https://buy.stripe.com/…" value={w[t].monthlyLink} onChange={e => setTier(t, "monthlyLink", e.target.value)} /></label>
      </div>)}
    </div>

    <h3>Getting paid</h3>
    <p className="ws-sub">Each invoice shows the matching tier link from Offers (setup or monthly) when its amount matches that tier&apos;s price. Anything else (custom prices, other services) uses the fallback below. Cinder never takes payments or checks them: you mark invoices paid when the money lands.</p>
    <div className="ws-grid">
      <label className="ws-field wide"><span>Fallback payment link</span><input type="url" placeholder="Optional" value={w.paymentLink} onChange={e => set("paymentLink", e.target.value)} /><small>For invoices that don&apos;t match a tier price. Leave blank to show only the instructions below.</small></label>
      <label className="ws-field wide"><span>Other ways to pay</span><textarea rows={3} value={w.paymentInstructions} onChange={e => set("paymentInstructions", e.target.value)} placeholder="e.g. Zelle to you@email.com, or ask for ACH details." /><small>Don&apos;t put full bank account numbers here. The invoice page is reachable by anyone with its link.</small></label>
    </div>

    <h3>Goal</h3>
    <div className="ws-grid three">
      <label className="ws-field"><span>Revenue goal</span><div className="ws-money"><i>$</i><input inputMode="numeric" value={money(w.goalAmount)} onChange={e => set("goalAmount", Number(e.target.value.replace(/[^\d]/g, "") || 0))} /></div><small>Cash collected counts. Won deals don&apos;t.</small></label>
      <label className="ws-field"><span>By</span><input type="date" value={w.goalBy} onChange={e => set("goalBy", e.target.value)} /></label>
      <label className="ws-field"><span>Daily call target</span><input inputMode="numeric" value={String(w.dailyCallTarget)} onChange={e => set("dailyCallTarget", Number(e.target.value.replace(/[^\d]/g, "") || 0))} /></label>
    </div>
  </section>;
}
