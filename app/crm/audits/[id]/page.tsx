"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuditReport, type AuditView } from "../../audit/audit-report";

type Artifact = { id: string; title: string; content: string; sourceUrls: string[]; confidence: string; contactId: string | null; dealId: string | null; company: string; contactName: string; createdAt: string; type: string };

/** One saved business audit, in the same structured layout as a fresh audit. */
export default function AuditViewPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<Artifact | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/research-artifacts?id=${id}`, { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see this audit." : d.error || "Could not load this audit."); const x = (d.artifacts ?? [])[0]; if (!x) throw new Error("Audit not found."); setA(x); })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load this audit."));
  }, [id]);
  if (error) return <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px" }}><p style={{ color: "#f2a5a5" }}>{error}</p><Link href="/crm/preparation">← Preparation</Link></main>;
  if (!a) return <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px" }}><p style={{ color: "#737373" }}>Loading audit…</p></main>;
  const view: AuditView = { id: a.id, title: a.title, companyName: a.company || a.title.replace(/^Business audit — /, ""), content: a.content, sourceUrls: a.sourceUrls, confidence: a.confidence, createdAt: a.createdAt };
  return <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 24px 60px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <Link href="/crm/preparation" style={{ color: "#8f8f8f", fontSize: 13, textDecoration: "none" }}>← Preparation</Link>
      <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
        {a.contactId && <Link href={`/crm?contact=${a.contactId}`} style={{ color: "#d0d0d0", textDecoration: "none" }}>Contact record</Link>}
        {a.dealId && <Link href={`/crm/deals/${a.dealId}`} style={{ color: "#d0d0d0", textDecoration: "none" }}>Deal</Link>}
        {a.contactId && <Link href={`/crm/audit?contact=${a.contactId}`} style={{ color: "#d0d0d0", textDecoration: "none" }}>Run a fresh audit</Link>}
      </div>
    </div>
    <AuditReport audit={view} />
  </main>;
}
