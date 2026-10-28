"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuditReport } from "./audit-report";

type Contact = {
  id: string; name: string; company?: string; role?: string; email?: string; phone?: string;
  website?: string; location?: string; notes?: string; source?: string; instagram?: string; facebook?: string;
};
type Audit = { reused?: boolean; createdAt?: string; id: string; title: string; companyName: string; content: string; sourceUrls: string[]; confidence: string; officialWebsite?: string | null; websiteStatus?: string; candidates?: string[]; fitDecision?: string | null; nextCrmAction?: string; futureUpsells?: string[]; incomplete?: boolean };

export default function BusinessAuditPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadContacts() {
      try {
        const response = await fetch("/api/contacts", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load CRM contacts.");
        if (!cancelled) setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load CRM contacts.");
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }
    void loadContacts();
    return () => { cancelled = true; };
  }, []);

  function importContact(id: string) {
    setSelectedContactId(id);
    const contact = contacts.find(item => item.id === id);
    if (!contact) return;
    setCompanyName((contact.company || contact.name || "").trim());
    setWebsite(contact.website || "");
    setLocation(contact.location || "");
    const details = [
      contact.name ? `CRM contact: ${contact.name}` : "",
      contact.role ? `Role: ${contact.role}` : "",
      contact.email ? `Email: ${contact.email}` : "",
      contact.phone ? `Phone: ${contact.phone}` : "",
      contact.source ? `Lead source: ${contact.source}` : "",
      contact.instagram ? `Instagram: ${contact.instagram}` : "",
      contact.facebook ? `Facebook: ${contact.facebook}` : "",
      contact.notes ? `Existing CRM notes: ${contact.notes}` : "",
    ].filter(Boolean).join("\n");
    setContext(details);
    setError("");
  }

  async function runAudit(event: React.FormEvent<HTMLFormElement> | null, force = false) {
    event?.preventDefault();
    setBusy(true); setError(""); setAudit(null);
    try {
      const response = await fetch("/api/business-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName, website, location, context, contactId: selectedContactId || null, force }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The audit could not be completed.");
      setAudit(payload.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The audit could not be completed.");
    } finally { setBusy(false); }
  }

  const panelStyle: React.CSSProperties = { border: "1px solid var(--c-line-strong)", borderRadius: 14, background: "var(--c-primary)", color: "var(--c-on-primary)" };
  const mutedStyle: React.CSSProperties = { color: "var(--c-muted)", lineHeight: 1.65 };

  return <main id="cinder-business-audit" style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 22px 60px", color: "var(--c-on-primary)", background: "var(--c-primary)", minHeight: "calc(100vh - 58px)" }}>
    <header style={{ marginBottom: 30 }}>
      <Link href="/crm/preparation" style={{ color: "var(--c-muted)", fontSize: 13 }}>← Preparation</Link>
      <p style={{ marginTop: 26, fontSize: 10, letterSpacing: 2, color: "var(--c-accent)" }}>CINDER / PROSPECT INTELLIGENCE</p>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", letterSpacing: "-1.6px", margin: "8px 0", color: "var(--c-text)" }}>Business audit<span style={{ color: "var(--c-accent)" }}>.</span></h1>
      <p style={{ maxWidth: 720, ...mutedStyle }}>Investigate the whole business before deciding whether we should sell anything. The audit ranks evidence-backed opportunities, calls out unknowns, and can recommend no sale.</p>
    </header>

    <form onSubmit={runAudit} style={{ display: "grid", gap: 18, ...panelStyle, padding: "24px clamp(16px, 3vw, 26px)" }}>
      <section style={{ display: "grid", gap: 9, padding: 15, border: "1px solid var(--c-line-strong)", borderRadius: 10, background: "var(--c-surface)" }}>
        <label htmlFor="audit-contact" style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text)" }}>Import from your CRM</label>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
          <select id="audit-contact" value={selectedContactId} onChange={e => importContact(e.target.value)} disabled={contactsLoading || contacts.length === 0} style={inputStyle}>
            <option value="">{contactsLoading ? "Loading your contacts…" : contacts.length ? "Choose an existing contact…" : "No CRM contacts found"}</option>
            {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.company ? `${contact.company} — ${contact.name}` : contact.name}</option>)}
          </select>
          <button type="button" disabled={!selectedContactId} onClick={() => importContact(selectedContactId)} style={{ border: "1px solid var(--c-line-strong)", borderRadius: 8, background: "var(--c-primary)", color: "var(--c-on-primary)", padding: "11px 13px", fontWeight: 600, cursor: selectedContactId ? "pointer" : "not-allowed", opacity: selectedContactId ? 1 : .55 }}>Import contact</button>
        </div>
        <p style={{ margin: 0, fontSize: 12, ...mutedStyle }}>Pulls the contact’s company, website, location, and saved notes into the audit. You can review or edit them before researching.</p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 16 }}>
        <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>Business name <span style={{ color: "var(--c-accent)" }}>*</span>
          <input required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Horizon Pools" style={inputStyle}/>
        </label>
        <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>Website
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="acme.com — leave blank to auto-discover" type="text" inputMode="url" autoComplete="url" style={inputStyle}/>
        </label>
        <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>Location / service area
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state or service area" style={inputStyle}/>
        </label>
      </div>
      <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>Existing context <span style={{ color: "var(--c-muted)", fontWeight: 400 }}>(optional)</span>
        <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="Imported CRM notes and contact details appear here…" rows={4} maxLength={4000} style={{ ...inputStyle, resize: "vertical", fontWeight: 400, minHeight: 112 }}/>
      </label>
      <p style={{ margin: 0, fontSize: 12, color: "var(--c-muted)", lineHeight: 1.65 }}>Research uses public web sources. Private operating metrics remain unknown until verified with the owner. The report is saved against the imported contact when one is selected; no outreach is sent.</p>
      {error && <p role="alert" style={{ margin: 0, padding: 12, borderRadius: 8, color: "var(--c-accent)", background: "var(--c-danger-bg)", border: "1px solid var(--c-danger-line)" }}>{error}</p>}
      <div><button type="submit" disabled={busy || !companyName.trim()} style={{ border: "1px solid var(--c-accent-line)", borderRadius: 8, background: busy ? "var(--c-surface-3)" : "var(--c-accent)", color: busy ? "var(--c-muted)" : "var(--c-on-accent)", padding: "12px 17px", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>{busy ? "Researching business…" : "Run independent audit →"}</button></div>
    </form>

    {busy && <section aria-live="polite" style={{ marginTop: 18, ...panelStyle, padding: 20, color: "var(--c-muted)" }}>Searching public sources and assessing opportunities across marketing, lead handling, sales, follow-up, customer experience, retention, operations, and competitive position. This may take up to a minute.</section>}
    {audit?.reused && <p role="status" style={{ marginTop: 18, padding: "10px 14px", border: "1px solid var(--c-line-strong)", borderRadius: 10, background: "var(--c-surface)", color: "var(--c-text-2)", fontSize: 13 }}>
      This business was audited in the last 10 minutes, so this is the saved report (no new research was run or charged).{" "}
      <button type="button" onClick={() => void runAudit(null, true)} disabled={busy} style={{ border: 0, background: "transparent", color: "var(--c-accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Run a fresh audit</button>
    </p>}
    {audit && <AuditReport audit={audit} />}
  </main>;
}

const inputStyle: React.CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box", border: "1px solid var(--c-line-strong)", borderRadius: 8, padding: "12px 13px", background: "var(--c-primary)", color: "var(--c-on-primary)", font: "inherit", fontSize: 13, fontWeight: 400, outlineColor: "var(--c-accent-line)" };
