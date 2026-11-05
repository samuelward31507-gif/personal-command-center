"use client";
// "Send info" card on a contact: copy-ready messages with their personal video link. Nothing is sent from here.
import { useState } from "react";
import { buildDraft, contactFirstName, watchLink, type DraftKind } from "@/lib/call-drafts";
import { useWorkspace } from "../use-workspace";

const OPTIONS: { kind: DraftKind | "link"; label: string }[] = [
  { kind: "info_text", label: "Copy text" },
  { kind: "info_dm", label: "Copy DM" },
  { kind: "info_email", label: "Copy email" },
  { kind: "link", label: "Copy video link" },
];

export default function InfoKit({ name, company }: { name: string; company: string }) {
  const wsp = useWorkspace();
  const [copied, setCopied] = useState<string | null>(null);
  const first = contactFirstName(name, company || "");
  const co = company || name;
  const link = watchLink(first, co);
  const input = { firstName: first, company: co, me: wsp.ownerFirstName || "Samuel", bookingLink: wsp.bookingLink || "https://cal.com/samuel-ward-saqpvb/15min" };
  async function copy(kind: DraftKind | "link") {
    let text = link;
    if (kind !== "link") { const d = buildDraft(kind, input); text = d.subject ? `${d.subject}\n\n${d.body}` : d.body; }
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(c => (c === kind ? null : c)), 2000); } catch { setCopied(null); }
  }
  return (
    <div className="crm-detail-section">
      <h3>Send info</h3>
      <p className="crm-notes">For when they ask for more info. Each message includes a 40-second video that opens with {first || "their"} name and shows the AI texting as {co}. Copy it and send it yourself.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 6, marginTop: 8 }}>
        {OPTIONS.map(o => (
          <button key={o.kind} type="button" className="crm-btn crm-btn-quiet" onClick={() => copy(o.kind)} style={{ justifyContent: "center", fontSize: 12.5, padding: "8px 10px" }}>
            {copied === o.kind ? "Copied ✓" : o.label}
          </button>
        ))}
      </div>
      <p className="crm-notes" style={{ marginTop: 8 }}><a href={link} target="_blank" rel="noreferrer">Preview their video ↗</a></p>
    </div>
  );
}
