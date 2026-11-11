"use client";

// Messages with this client: what they wrote from their portal, and your replies (they see them in the portal).
import { useCallback, useEffect, useState } from "react";

type Msg = { id: string; author: "client" | "owner"; body: string; created_at: string };
const when = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function MessagesPanel({ projectId }: { projectId: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [portal, setPortal] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch("/api/client-messages?project=" + projectId, { cache: "no-store" }).then(r => r.json()).then(j => { if (j.error) setErr(j.error); else { setMsgs(j.messages); setPortal(j.portal); } }).catch(() => setErr("Couldn't load messages.")), [projectId]);
  useEffect(() => { void load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  async function send() {
    if (!draft.trim()) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/client-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: projectId, body: draft }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Couldn't send that."); return; }
    setDraft(""); await load();
  }
  return <section className="op-card mp">
    <div className="mp-head"><h2>Messages</h2><span>{portal ? <>They write from <a href={portal} target="_blank" rel="noreferrer">their portal</a>; your replies show there.</> : "Messages show once their portal link exists (setup sheet)."}</span></div>
    {msgs && msgs.length > 0 ? <ol className="mp-list">{msgs.map(m => <li key={m.id} className={m.author === "owner" ? "me" : "them"}><p>{m.body}</p><small>{m.author === "owner" ? "You" : "Client"} · {when(m.created_at)}</small></li>)}</ol>
      : <p className="op-hint">{msgs ? "No messages yet. When they write from their portal you get an email, and it shows here." : "Loading…"}</p>}
    {err && <p className="op-note bad">{err}</p>}
    <form className="mp-form" onSubmit={e => { e.preventDefault(); void send(); }}>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="Reply: a build update, a question, what's next…" aria-label="Reply" />
      <button type="submit" className="op-primary" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send"}</button>
    </form>
  </section>;
}
