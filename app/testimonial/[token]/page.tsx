"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CinderLogo } from "../../cinder-brand";
import "../../approve/[token]/approve.css";

/** Public testimonial form: a client says what changed, and whether it may be shared. */
export default function TestimonialPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<{ client: string; firstName: string; from: { name: string; owner: string }; done: boolean } | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ quote: "", result: "", name: "", role: "Owner", company: "", permission: true });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  useEffect(() => {
    fetch("/api/testimonial?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "This link isn't valid."); setD(j); setF(x => ({ ...x, company: j.client, name: j.firstName })); })
      .catch(e => setError(e instanceof Error ? e.message : "This link isn't valid."));
  }, [token]);
  async function send() {
    setState("sending"); setError("");
    try {
      const r = await fetch("/api/testimonial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...f }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      setState("done");
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setState("idle"); }
  }
  return <div className="ap-page">
    <header className="ap-top"><CinderLogo mono className="ap-logo" title={d?.from.name ?? "Testimonial"} /></header>
    <div className="ap-main">
      {!d ? <p className="ap-muted">{error || "Loading…"}</p>
      : state === "done" || d.done ? <div className="ap-done"><h1>Thank you.</h1><p>{d.from.owner} really appreciates it.</p></div>
      : <>
        <h1>How&apos;s it going?</h1>
        <p className="ap-lead">A couple of sentences about what changed since the system went live helps other {d.client ? "business owners" : "owners"} decide. Takes two minutes.</p>
        <div className="ap-sign" style={{ marginTop: 28 }}>
          <label>What changed for you?<textarea rows={4} value={f.quote} onChange={e => setF({ ...f, quote: e.target.value })} placeholder="e.g. We used to miss half our after-hours calls. Now every lead gets a text back and we book estimates while we're on jobs." /></label>
          <label>Any number you&apos;ve noticed? (optional)<input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="e.g. 9 more estimates booked last month" /></label>
          <label>Your name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <label>Your role<input value={f.role} onChange={e => setF({ ...f, role: e.target.value })} /></label>
          <label>Business<input value={f.company} onChange={e => setF({ ...f, company: e.target.value })} /></label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}><input type="checkbox" style={{ width: 18, height: 18, marginTop: 2 }} checked={f.permission} onChange={e => setF({ ...f, permission: e.target.checked })} />
            <span>{d.from.name} may share this with my name and business on their website and social media.</span></label>
          {error && <p className="ap-err" role="alert">{error}</p>}
          <button type="button" className="ap-submit" disabled={state === "sending"} onClick={send}>{state === "sending" ? "Sending…" : "Send"}</button>
        </div>
      </>}
    </div>
  </div>;
}
