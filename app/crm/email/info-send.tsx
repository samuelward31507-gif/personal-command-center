"use client";

// Send the info email to someone you just talked to: find them, type the address (the receptionist gave you),
// pick More work or Time back, and it goes out from your Gmail with their name, company and demo video filled in.
import { useMemo, useState } from "react";
import { buildDraft, contactFirstName, INFO_EMAIL_STYLES } from "@/lib/call-drafts";
import { useWorkspace } from "../../use-workspace";

type C = { id: string; name: string; company: string; email: string };
type Style = "info_email" | "info_email_time";

export default function InfoSend({ contacts, connected, onSent }: { contacts: C[]; connected: boolean; onSent?: (id: string, email: string) => void }) {
  const ws = useWorkspace();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<C | null>(null);
  const [to, setTo] = useState("");
  const [style, setStyle] = useState<Style>("info_email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2 || pick) return [];
    return contacts.filter(c => `${c.company} ${c.name}`.toLowerCase().includes(t)).slice(0, 6);
  }, [q, pick, contacts]);
  const draft = pick ? buildDraft(style, { firstName: contactFirstName(pick.name, pick.company), company: pick.company || pick.name, me: ws.ownerFirstName || "Samuel", bookingLink: ws.bookingLink || "https://cinderrevenue.com/book" }) : null;

  async function send() {
    if (!pick || !draft || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: pick.id, step: "info", subject: draft.subject, body: draft.body, email: to.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send it.");
      onSent?.(pick.id, to.trim().toLowerCase());
      setMsg({ ok: true, text: `Sent "${draft.subject}" to ${to.trim()}.` });
      setPick(null); setQ(""); setTo("");
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't send it." }); }
    finally { setBusy(false); }
  }

  return <section className="u-sheet em-info" aria-label="Send an info email">
    <div className="u-h2-row"><h2 className="u-h2">Send an info email</h2><span className="u-note">For someone you just talked to. Goes out from your Gmail.</span></div>
    {!connected && <p className="u-note">Connect Gmail above to send from here.</p>}
    <div className="em-info-row">
      {pick
        ? <div className="em-info-pick"><b>{pick.company || pick.name}</b><button type="button" className="u-btn u-btn-bare" onClick={() => { setPick(null); setMsg(null); }}>Change</button></div>
        : <div className="em-info-search">
            <input className="u-field" placeholder="Who? Type their company or name" value={q} onChange={e => { setQ(e.target.value); setMsg(null); }} aria-label="Find the contact" />
            {matches.length > 0 && <ul className="em-info-list">{matches.map(c => <li key={c.id}><button type="button" onClick={() => { setPick(c); setTo(c.email || ""); }}>{c.company || c.name}{c.company && c.name && c.name !== c.company ? <small> · {c.name}</small> : null}</button></li>)}</ul>}
          </div>}
      <input className="u-field" type="email" placeholder="Their email" value={to} onChange={e => setTo(e.target.value)} aria-label="Their email" />
      <select className="u-field" value={style} onChange={e => setStyle(e.target.value as Style)} aria-label="Which email">
        {INFO_EMAIL_STYLES.map(o => <option key={o.kind} value={o.kind}>{o.label}</option>)}
      </select>
      <button type="button" className="u-btn u-btn-light" disabled={!connected || !pick || !to.trim() || busy} onClick={() => void send()}>{busy ? "Sending…" : "Send email"}</button>
    </div>
    {draft && <details className="em-info-preview"><summary>Preview: {draft.subject}</summary><pre>{draft.body}</pre></details>}
    {msg && <p className={"u-flash" + (msg.ok ? "" : " is-bad")} role="status">{msg.text}</p>}
  </section>;
}
