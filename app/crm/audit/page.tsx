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

  return <main style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 22px 60px", color: "#252522" }}>
    <header style={{ marginBottom: 30 }}>
      <Link href="/crm/preparation" style={{ color: "#777", fontSize: 13 }}>← Preparation</Link>
      <p style={{ marginTop: 26, fontSize: 10, letterSpacing: 2, color: "#a95335" }}>CINDER / PROSPECT INTELLIGENCE</p>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", letterSpacing: "-1.6px", margin: "8px 0" }}>Business audit<span style={{ color: "#bd5a36" }}>.</span></h1>
      <p style={{ maxWidth: 720, color: "#777", lineHeight: 1.65 }}>Investigate the whole business before deciding whether we should sell anything. The audit ranks evidence-backed opportunities, calls out unknowns, and can recommend no sale.</p>
    </header>

    <form onSubmit={runAudit} style={{ display: "grid", gap: 16, border: "1px solid #e9e7e2", borderRadius: 14, padding: 22, background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Business name *
          <input required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Horizon Pools" style={inputStyle}/>
        </label>
        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Website
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" type="url" style={inputStyle}/>
        </label>
        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Location / service area
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state or service area" style={inputStyle}/>
        </label>
      </div>
      <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Existing context (optional)
        <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="What you already know, prior conversation, services they mentioned, CRM notes…" rows={3} maxLength={4000} style={{ ...inputStyle, resize: "vertical", fontWeight: 400 }}/>
      </label>
      <p style={{ margin: 0, fontSize: 12, color: "#777", lineHeight: 1.6 }}>Research uses public web sources. Private operating metrics remain unknown until verified with the owner. The generated report is saved to Preparation as a draft; it never sends outreach or changes pipeline records.</p>
      {error && <p role="alert" style={{ margin: 0, padding: 12, borderRadius: 8, color: "#8d3224", background: "#fff1ed" }}>{error}</p>}
      <div><button type="submit" disabled={busy || !companyName.trim()} style={{ border: 0, borderRadius: 9, background: busy ? "#777" : "#292925", color: "#fff", padding: "12px 18px", fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>{busy ? "Researching business…" : "Run independent audit →"}</button></div>
    </form>

    {busy && <section aria-live="polite" style={{ marginTop: 18, border: "1px solid #e9e7e2", borderRadius: 12, padding: 20, color: "#777" }}>Searching public sources and assessing opportunities across marketing, lead handling, sales, follow-up, customer experience, retention, operations, and competitive position. This may take up to a minute.</section>}
    {audit && <section style={{ marginTop: 24, border: "1px solid #e9e7e2", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid #eeece7", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div><p style={{ margin: "0 0 5px", fontSize: 10, letterSpacing: 1.5, color: "#a95335" }}>SAVED DRAFT · {audit.confidence.toUpperCase()} SOURCE CONFIDENCE</p><h2 style={{ margin: 0, fontSize: 21 }}>{audit.title}</h2></div>
        <button type="button" onClick={() => navigator.clipboard.writeText(audit.content)} style={{ border: "1px solid #dedbd5", borderRadius: 8, background: "#fff", padding: "9px 12px", cursor: "pointer" }}>Copy report</button>
      </div>
      <article style={{ padding: "22px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.75 }}>{audit.content}</article>
      {audit.sourceUrls.length > 0 && <div style={{ padding: "18px 22px", borderTop: "1px solid #eeece7" }}><h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Research sources ({audit.sourceUrls.length})</h3><ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 7 }}>{audit.sourceUrls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer" style={{ color: "#a95335", overflowWrap: "anywhere" }}>{url}</a></li>)}</ul></div>}
      <div style={{ padding: "0 22px 22px" }}><Link href="/crm/preparation" style={{ color: "#a95335" }}>Open saved preparation records →</Link></div>
    </section>}
  </main>;
}

const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #dedbd5", borderRadius: 8, padding: "11px 12px", background: "#fff", color: "#292925", font: "inherit", fontWeight: 400 };
