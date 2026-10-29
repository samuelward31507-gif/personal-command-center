"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STAGE_LABELS, suggestOffer, type DealStage } from "@/lib/offers";

type Deal = { id: string; title: string; stage: DealStage; setupFee: number; monthlyFee: number; updatedAt: string };
const money = (n: number) => "$" + Number(n || 0).toLocaleString("en-US");

/** The contact's deals, each linking to its deal page, plus a one-tap "Start a deal". */
export default function ContactDeals({ contactId, name, company }: { contactId: string; name: string; company: string }) {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setDeals(null); setError("");
    // Contacts that only live in this browser have non-UUID ids and can't have deals yet.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contactId)) { setDeals([]); return; }
    fetch("/api/deals?contactId=" + encodeURIComponent(contactId), { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (active) setDeals(Array.isArray(d.deals) ? d.deals : []); })
      .catch(() => { if (active) { setDeals([]); setError("Couldn't load deals."); } });
    return () => { active = false; };
  }, [contactId]);

  async function start() {
    setBusy(true); setError("");
    try {
      const offer = suggestOffer(company, null);
      const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: `${company || name || "New deal"} — ${offer.label}`.slice(0, 240), contactId, serviceType: offer.serviceType,
        stage: "contacted", setupFee: offer.setupFee, monthlyFee: offer.monthlyFee, source: "contact record", notes: "" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.id) throw new Error(d.error || "Could not start the deal.");
      window.location.assign("/crm/deals/" + d.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start the deal."); setBusy(false); }
  }

  return <div className="crm-detail-section cd-deals">
    <h3>Deals</h3>
    {deals === null ? <p className="crm-notes">Loading deals…</p> : <>
      {deals.map(d => <Link key={d.id} href={`/crm/deals/${d.id}`} className={"cd-deal cd-" + d.stage}>
        <span className="cd-title">{d.title.split(" — ")[1] || d.title}</span>
        <span className="cd-stage">{STAGE_LABELS[d.stage] ?? d.stage}</span>
        <span className="cd-val">{money(d.setupFee)}{d.monthlyFee ? ` + ${money(d.monthlyFee)}/mo` : ""}</span>
        <span className="cd-go" aria-hidden>→</span>
      </Link>)}
      {!deals.length && !error && <p className="crm-notes">No deal yet.</p>}
      {error && <p className="crm-notes cd-err">{error}</p>}
      {/^[0-9a-f-]{36}$/i.test(contactId) && <button type="button" data-variant="primary" className="cd-start" disabled={busy} onClick={() => void start()}>{busy ? "Starting…" : deals.some(d => !["won", "lost"].includes(d.stage)) ? "+ Another deal" : "+ Start a deal"}</button>}
    </>}
    <style>{`
      .cd-deals .cd-deal{display:grid;grid-template-columns:minmax(0,1fr) auto auto 14px;gap:10px;align-items:center;padding:9px 11px;margin-top:6px;border:1px solid #232323;border-radius:10px;background:#141414;color:#e6e6e6!important;text-decoration:none!important;font-size:13px}
      .cd-deals .cd-deal:hover{border-color:#353535;background:#181818}
      .cd-deals .cd-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}
      .cd-deals .cd-stage{font-size:11.5px;padding:2px 8px;border-radius:999px;border:1px solid #2c2c2c;color:#a8a8a8}
      .cd-deals .cd-won .cd-stage{color:#9ee6b5;border-color:#234231}.cd-deals .cd-lost .cd-stage{color:#f2a5a5;border-color:#3a2424}.cd-deals .cd-proposal .cd-stage{color:#e7c2a8;border-color:#4a3a2f}
      .cd-deals .cd-val{color:#8f8f8f;font-size:12px;white-space:nowrap}.cd-deals .cd-go{color:#666}
      html body main button.cd-start{margin-top:8px;height:30px;padding:0 12px;border-radius:9px;border:1px solid #2a2a2a!important;background:#171717!important;color:#e0e0e0!important;font:inherit;font-size:12.5px;cursor:pointer}
      html body main button.cd-start:hover:not(:disabled){background:#1f1f1f!important;color:#fff!important}
      .cd-deals .cd-err{color:#f2a5a5!important}
    `}</style>
  </div>;
}
