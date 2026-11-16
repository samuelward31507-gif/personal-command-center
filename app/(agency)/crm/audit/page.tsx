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
        const list: Contact[] = Array.isArray(payload.contacts) ? payload.contacts : [];
        if (!cancelled) setContacts(list);
        // Deep link from the Home command bar: /crm/audit?contact=<id> pre-fills that contact.
        const wanted = new URLSearchParams(window.location.search).get("contact");
        const hit = wanted ? list.find(c => c.id === wanted) : null;
        if (!cancelled && hit) {
          setSelectedContactId(hit.id); setCompanyName((hit.company || hit.name || "").trim()); setWebsite(hit.website || ""); setLocation(hit.location || "");
          setContext([hit.name ? `CRM contact: ${hit.name}` : "", hit.role ? `Role: ${hit.role}` : "", hit.phone ? `Phone: ${hit.phone}` : "", hit.notes ? `Existing CRM notes: ${hit.notes}` : ""].filter(Boolean).join("\n"));
        }
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

  const panelStyle: React.CSSProperties = { border: "1px solid #e7e7e4", borderRadius: 14, background: "var(--u-sheet)", color: "var(--u-text)" };
  const mutedStyle: React.CSSProperties = { color: "#515862", lineHeight: 1.65 };

  return <main id="cinder-business-audit" className="u-page">
    <div className="u-head">
      <h1 className="u-title"><Link href="/crm/preparation" className="u-dim" style={{ fontWeight: 500 }}>Research</Link><span className="u-dim">/</span>Business audit</h1>
    </div>
    <div style={{ maxWidth: 880, paddingTop: 20 }}>
    <p className="u-note" style={{ maxWidth: 680, fontSize: 14, lineHeight: "21px" }}>Research the whole business before you pitch anything. The audit ranks what it can back up, lists what it can&apos;t know, and will say walk away when there&apos;s no fit.</p>

    <form onSubmit={runAudit} className="u-sheet u-sheet-pad" style={{ display: "grid", gap: 16, marginTop: 16 }}>
      <label className="u-lab" htmlFor="audit-contact">Start from a prospect
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
          <select id="audit-contact" className="u-field" value={selectedContactId} onChange={e => importContact(e.target.value)} disabled={contactsLoading || contacts.length === 0}>
            <option value="">{contactsLoading ? "Loading prospects…" : contacts.length ? "Choose a prospect" : "No prospects yet"}</option>
            {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.company ? `${contact.company}, ${contact.name}` : contact.name}</option>)}
          </select>
          <button type="button" className="u-btn" disabled={!selectedContactId} onClick={() => importContact(selectedContactId)}>Fill in</button>
        </div>
        <span className="u-quiet" style={{ fontSize: 12.5, fontWeight: 400 }}>Brings in their company, website, location and notes. You can edit them before running.</span>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12 }}>
        <label className="u-lab">Business name
          <input className="u-field" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Horizon Pools" />
        </label>
        <label className="u-lab">Website
          <input className="u-field" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Leave blank to find it" type="text" inputMode="url" autoComplete="url" />
        </label>
        <label className="u-lab">Location
          <input className="u-field" value={location} onChange={e => setLocation(e.target.value)} placeholder="City and state" />
        </label>
      </div>
      <label className="u-lab">Notes <span className="u-quiet" style={{ fontWeight: 400 }}>Optional</span>
        <textarea className="u-field" value={context} onChange={e => setContext(e.target.value)} placeholder="What you already know about them" rows={4} maxLength={4000} />
      </label>
      {error && <p role="alert" className="u-flash is-bad">{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="u-btn u-btn-light" disabled={busy || !companyName.trim()}>{busy ? "Researching…" : "Run audit"}</button>
        <span className="u-quiet" style={{ fontSize: 12.5, fontWeight: 400 }}>Uses public sources only. Nothing is sent to the business.</span>
      </div>
    </form>
    </div>

    {busy && <p aria-live="polite" className="u-flash" style={{ marginTop: 16, maxWidth: 880 }}>Searching their website, reviews and listings. This can take up to a minute.</p>}
    {audit?.reused && <p role="status" className="u-flash" style={{ marginTop: 16, maxWidth: 880 }}>
      This business was audited in the last 10 minutes, so this is the saved report.{" "}
      <button type="button" className="u-btn u-btn-bare" onClick={() => void runAudit(null, true)} disabled={busy}>Run it again</button>
    </p>}
    {audit && <AuditReport audit={audit} />}
  </main>;
}

const inputStyle: React.CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box", border: "1px solid #dcddda", borderRadius: 8, padding: "12px 13px", background: "var(--u-sheet)", color: "var(--u-text)", font: "inherit", fontSize: 13, fontWeight: 400, outlineColor: "#353a41" };
