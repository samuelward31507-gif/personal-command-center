"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import "./approve.css";

type Msg = { key: string; label: string; body: string; status: "draft" | "approved" | "changes"; clientNote?: string };
type Doc = { client: string; from: { name: string; owner: string }; messages: Msg[]; approvedAt: string | null };
type Answer = { decision?: "approve" | "change"; note?: string };
const show = (s: string) => s.replace(/\{first\}/g, "[their first name]").replace(/\{time\}/g, "[time]");

/** Public message approval: the client reads every message the system will send and approves it or asks for a change. */
export default function ApprovePage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [result, setResult] = useState<{ allApproved: boolean; changes: number } | null>(null);

  useEffect(() => {
    fetch("/api/approve?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "This link isn't valid."); setDoc(d);
        setAnswers(Object.fromEntries((d.messages as Msg[]).filter(m => m.status === "approved").map(m => [m.key, { decision: "approve" as const }]))); })
      .catch(e => setError(e instanceof Error ? e.message : "This link isn't valid."));
  }, [token]);

  const set = (k: string, a: Answer) => setAnswers(p => ({ ...p, [k]: { ...p[k], ...a } }));
  const decided = doc ? doc.messages.filter(m => answers[m.key]?.decision).length : 0;

  async function submit() {
    setState("sending"); setError("");
    try {
      const r = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, answers }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      setResult(d); setState("done");
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setState("idle"); }
  }

  return <div className="ap-page">
    <header className="ap-top"><BrandLogo mono className="ap-logo" title={doc?.from.name ?? "Approval"} /></header>
    <div className="ap-main">
      {!doc ? <p className="ap-muted">{error || "Loading…"}</p>
      : state === "done" && result ? <div className="ap-done">
          <h1>{result.allApproved ? "Thank you. Everything is approved." : "Thanks. We'll make those changes."}</h1>
          <p>{result.allApproved ? `${doc.from.owner} will finish testing and let you know the day it goes live.` : `${doc.from.owner} will update ${result.changes === 1 ? "that message" : "those messages"} and send them back for a final look.`}</p>
        </div>
      : <>
        <h1>Approve your messages</h1>
        <p className="ap-lead">These are the texts your new system will send to people who contact {doc.client}. Nothing goes live until you approve each one. Bracketed words are filled in automatically.</p>
        <ol className="ap-list">{doc.messages.map(m => {
          const a = answers[m.key] ?? {};
          return <li key={m.key} className={a.decision ? "is-" + a.decision : ""}>
            <h2>{m.label}</h2>
            <div className="ap-bubble">{show(m.body)}</div>
            <div className="ap-acts" role="group" aria-label={"Decision for " + m.label}>
              <button type="button" aria-pressed={a.decision === "approve"} onClick={() => set(m.key, { decision: "approve" })}>Approve</button>
              <button type="button" aria-pressed={a.decision === "change"} onClick={() => set(m.key, { decision: "change" })}>Request a change</button>
            </div>
            {a.decision === "change" && <textarea rows={2} placeholder="What should it say instead?" value={a.note ?? ""} onChange={e => set(m.key, { note: e.target.value })} />}
          </li>;
        })}</ol>
        <div className="ap-sign">
          <label>Your name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
          {error && <p className="ap-err" role="alert">{error}</p>}
          <button type="button" className="ap-submit" disabled={state === "sending" || decided < doc.messages.length || !name.trim()} onClick={submit}>
            {state === "sending" ? "Sending…" : decided < doc.messages.length ? `Decide on all ${doc.messages.length} messages` : "Send my answers"}</button>
          <p className="ap-fine">Your name and the time are recorded as your approval.</p>
        </div>
      </>}
    </div>
  </div>;
}
