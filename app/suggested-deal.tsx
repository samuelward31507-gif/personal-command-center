"use client";

import { useState } from "react";

export type SuggestedDealData = {
  contactId: string; title: string; serviceType: string; setupFee: number; monthlyFee: number; stage: string; offerLabel: string;
};

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/** One-tap deal creation after an "Interested" / "Meeting booked" call with no open deal. */
export default function SuggestedDeal({ deal, onDone }: { deal: SuggestedDealData; onDone?: () => void }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "dismissed">("idle");
  const [error, setError] = useState("");
  if (state === "dismissed") return null;
  if (state === "done") return <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#86efac" }}>Deal created in your pipeline · <a href="/crm/pipeline" style={{ color: "#d6a98c" }}>Open pipeline →</a></p>;

  async function create() {
    setState("saving"); setError("");
    try {
      const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: deal.title, contactId: deal.contactId, serviceType: deal.serviceType, stage: deal.stage,
        setupFee: deal.setupFee, monthlyFee: deal.monthlyFee, source: "call outcome",
      }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Could not create the deal.");
      setState("done"); onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the deal."); setState("idle");
    }
  }

  return <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid #4a3a2f", background: "#1b1714", borderRadius: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <div style={{ flex: "1 1 220px", fontSize: 12.5, color: "#e4e4e7", lineHeight: 1.5 }}>
      <strong style={{ color: "#f4f4f5" }}>No deal yet.</strong> Create “{deal.title}” at {money(deal.setupFee)} setup + {money(deal.monthlyFee)}/mo
      <span style={{ color: "#9a9aa4" }}> · stage: {deal.stage.replaceAll("_", " ")} · list price, edit anytime</span>
    </div>
    <button type="button" onClick={() => void create()} disabled={state === "saving"} style={{ border: "1px solid #d6a98c", background: "#d6a98c", color: "#171311", borderRadius: 8, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{state === "saving" ? "Creating…" : "Create deal"}</button>
    <button type="button" onClick={() => setState("dismissed")} style={{ border: 0, background: "transparent", color: "#9a9aa4", fontSize: 12.5, cursor: "pointer" }}>Not now</button>
    {error && <p role="alert" style={{ flexBasis: "100%", margin: 0, fontSize: 12, color: "#fca5a5" }}>{error}</p>}
  </div>;
}
