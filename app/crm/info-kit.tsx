"use client";
// "Send info" card on a contact: copy-ready messages, plus a place to log a reply they texted back.
// Nothing is sent from here. A logged STOP / unsubscribe reply marks the contact do not contact.
import { useState } from "react";
import { buildDraft, contactFirstName, watchLink, type DraftKind } from "@/lib/call-drafts";
import { infoText, pickDemoLink, nicheFor } from "@/lib/sms-templates";
import { useWorkspace } from "../use-workspace";

type Kind = "info_text" | "info_dm" | "info_email" | "info_email_time" | "followup_text" | "link";
const OPTIONS: { kind: Kind; label: string }[] = [
  { kind: "info_text", label: "Copy info text" },
  { kind: "followup_text", label: "Copy follow-up text (video)" },
  { kind: "info_dm", label: "Copy DM" },
  { kind: "info_email", label: "Copy email: more work" },
  { kind: "info_email_time", label: "Copy email: time back" },
  { kind: "link", label: "Copy video link" },
];
type Activity = { id: string; contact_id: string; channel: "call" | "text" | "note"; action: string; outcome: string; notes: string; sequence_step: number | null; occurred_at: string };

export default function InfoKit({ id, name, company, notes, onReply }: { id: string; name: string; company: string; notes: string; onReply?: (a: Activity) => void }) {
  const wsp = useWorkspace();
  const [copied, setCopied] = useState<Kind | null>(null);
  const [reply, setReply] = useState("");
  const [replyState, setReplyState] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const first = contactFirstName(name, company || "");
  const co = company || name;
  const link = watchLink(first, co);
  const input = { firstName: first, company: co, me: wsp.ownerFirstName || "Samuel", bookingLink: wsp.bookingLink || "https://cal.com/samuel-ward-saqpvb/15min" };

  async function copy(kind: Kind) {
    let text = link;
    if (kind === "info_text") text = infoText({ firstName: first, demoLink: pickDemoLink(nicheFor(company, notes), wsp.demoLink), niche: nicheFor(company, notes) });
    else if (kind !== "link") { const d = buildDraft(kind as DraftKind, input); text = d.subject ? `${d.subject}\n\n${d.body}` : d.body; }
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(c => (c === kind ? null : c)), 2000); } catch { setCopied(null); }
    // A copied text is about to be sent from your phone: log it so the dashboard knows info went out and starts the follow-ups.
    if (kind === "info_text" || kind === "followup_text") void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: id, direction: "outbound", body: text }) }).catch(() => {});
  }
  async function logReply() {
    if (!reply.trim() || saving) return;
    setSaving(true); setReplyState(null);
    try {
      const r = await fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: id, direction: "inbound", body: reply }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't log the reply.");
      if (d.activity) onReply?.(d.activity);
      setReply("");
      setReplyState({ ok: true, text: d.doNotContact ? "They replied STOP. Marked do not contact: no more drafts, outreach stopped, open reminders cancelled." : "Reply logged." });
    } catch (e) { setReplyState({ ok: false, text: e instanceof Error ? e.message : "Couldn't log the reply." }); }
    finally { setSaving(false); }
  }
  return (
    <div className="crm-detail-section">
      <h3>Send info</h3>
      <p className="crm-notes">For when they ask for more info. The text uses your info template. The DM and email include a 40-second video that opens with {first || "their"} name. Copy it and send it yourself.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 6, marginTop: 8 }}>
        {OPTIONS.map(o => (
          <button key={o.kind} type="button" className="crm-btn crm-btn-quiet" onClick={() => copy(o.kind)} style={{ justifyContent: "center", fontSize: 12.5, padding: "8px 10px" }}>
            {copied === o.kind ? "Copied ✓" : o.label}
          </button>
        ))}
      </div>
      <p className="crm-notes" style={{ marginTop: 8 }}><a href={link} target="_blank" rel="noreferrer">Preview their video ↗</a></p>
      <div style={{ marginTop: 12 }}>
        <label className="crm-notes" htmlFor={"reply-" + id} style={{ display: "block", marginBottom: 6 }}>They texted back? Paste their reply to log it.</label>
        <textarea id={"reply-" + id} value={reply} onChange={e => setReply(e.target.value)} maxLength={2000} rows={2} placeholder="Their reply…"
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid #34343b", background: "#1a1a1a", color: "#f4f4f5", font: "inherit", fontSize: 12.5, resize: "vertical" }} />
        <button type="button" className="crm-btn crm-btn-quiet" disabled={!reply.trim() || saving} onClick={() => void logReply()} style={{ marginTop: 6, fontSize: 12.5, padding: "8px 10px" }}>{saving ? "Logging…" : "Log reply"}</button>
        {replyState && <p className="crm-notes" role="status" style={{ marginTop: 6, color: replyState.ok ? "#e4e4e4" : "#fca5a5" }}>{replyState.text}</p>}
      </div>
    </div>
  );
}
