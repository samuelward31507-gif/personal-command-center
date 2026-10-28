"use client";

import Link from "next/link";
import { useState } from "react";

type Audit = { id: string; title: string; companyName: string; content: string; sourceUrls: string[]; confidence: string };

export default function BusinessAuditPage() {
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);

  async function runAudit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setAudit(null);
    try {
      const response = await fetch("/api/business-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName, website, location, context }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The audit could not be completed.");
      setAudit(payload.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The audit could not be completed.");
    } finally { setBusy(false); }
  }

  const panelStyle: React.CSSProperties = { border: "1px solid #29292e", borderRadius: 14, background: "#141417", color: "#f4f4f5" };
  const mutedStyle: React.CSSProperties = { color: "#a1a1aa", lineHeight: 1.65 };

  return <main id="cinder-business-audit" style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 22px 60px", color: "#f4f4f5", background: "#0b0b0d", minHeight: "calc(100vh - 58px)" }}>
    <header style={{ marginBottom: 30 }}>
      <Link href="/crm/preparation" style={{ color: "#a1a1aa", fontSize: 13 }}>← Preparation</Link>
      <p style={{ marginTop: 26, fontSize: 10, letterSpacing: 2, color: "#d6a98c" }}>CINDER / PROSPECT INTELLIGENCE</p>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", letterSpacing: "-1.6px", margin: "8px 0", color: "#f4f4f5" }}>Business audit<span style={{ color: "#d6a98c" }}>.</span></h1>
      <p style={{ maxWidth: 720, ...mutedStyle }}>Investigate the whole business before deciding whether we should sell anything. The audit ranks evidence-backed opportunities, calls out unknowns, and can recommend no sale.</p>
    </header>

    <form onSubmit={runAudit} style={{ display: "grid", gap: 18, ...panelStyle, padding: "24px clamp(16px, 3vw, 26px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 16 }}>
        <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "#e4e4e7" }}>Business name <span style={{ color: "#d6a98c" }}>*</span>
          <input required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Horizon Pools" style={inputStyle}/>
        </label>
        <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "#e4e4e7" }}>Website
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" type="url" style={inputStyle}/>
        </label>
        <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "#e4e4e7" }}>Location / service area
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state or service area" style={inputStyle}/>
        </label>
      </div>
      <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "#e4e4e7" }}>Existing context <span style={{ color: "#8b8b95", fontWeight: 400 }}>(optional)</span>
        <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="What you already know, prior conversation, services they mentioned, CRM notes…" rows={4} maxLength={4000} style={{ ...inputStyle, resize: "vertical", fontWeight: 400, minHeight: 112 }}/>
      </label>
      <p style={{ margin: 0, fontSize: 12, color: "#92929c", lineHeight: 1.65 }}>Research uses public web sources. Private operating metrics remain unknown until verified with the owner. The generated report is saved to Preparation as a draft; it never sends outreach or changes pipeline records.</p>
      {error && <p role="alert" style={{ margin: 0, padding: 12, borderRadius: 8, color: "#ffb4a5", background: "#2a1716", border: "1px solid #63332b" }}>{error}</p>}
      <div><button type="submit" disabled={busy || !companyName.trim()} style={{ border: "1px solid #d6a98c", borderRadius: 8, background: busy ? "#3a3431" : "#d6a98c", color: "#171311", padding: "12px 17px", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>{busy ? "Researching business…" : "Run independent audit →"}</button></div>
    </form>

    {busy && <section aria-live="polite" style={{ marginTop: 18, ...panelStyle, padding: 20, color: "#a1a1aa" }}>Searching public sources and assessing opportunities across marketing, lead handling, sales, follow-up, customer experience, retention, operations, and competitive position. This may take up to a minute.</section>}
    {audit && <section style={{ marginTop: 24, ...panelStyle, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid #29292e", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div><p style={{ margin: "0 0 5px", fontSize: 10, letterSpacing: 1.5, color: "#d6a98c" }}>SAVED DRAFT · {audit.confidence.toUpperCase()} SOURCE CONFIDENCE</p><h2 style={{ margin: 0, fontSize: 21, color: "#f4f4f5" }}>{audit.title}</h2></div>
        <button type="button" onClick={() => navigator.clipboard.writeText(audit.content)} style={{ border: "1px solid #3a3a42", borderRadius: 8, background: "#1c1c21", color: "#f4f4f5", padding: "9px 12px", cursor: "pointer" }}>Copy report</button>
      </div>
      <article style={{ padding: 22, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.75, color: "#e4e4e7" }}>{audit.content}</article>
      {audit.sourceUrls.length > 0 && <div style={{ padding: "18px 22px", borderTop: "1px solid #29292e" }}><h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#f4f4f5" }}>Research sources ({audit.sourceUrls.length})</h3><ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 7 }}>{audit.sourceUrls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer" style={{ color: "#d6a98c", overflowWrap: "anywhere" }}>{url}</a></li>)}</ul></div>}
      <div style={{ padding: "0 22px 22px" }}><Link href="/crm/preparation" style={{ color: "#d6a98c" }}>Open saved preparation records →</Link></div>
    </section>}
  </main>;
}

const inputStyle: React.CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box", border: "1px solid #34343b", borderRadius: 8, padding: "12px 13px", background: "#141417", color: "#f4f4f5", font: "inherit", fontSize: 13, fontWeight: 400, outlineColor: "#d6a98c" };
