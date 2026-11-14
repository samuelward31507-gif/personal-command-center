"use client";

// The page behind a quote link a customer gets by text. It's the owner's quote, in their business's name:
// the price, what it's for, and one button to approve it. Answering goes straight to the owner.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import "./quote.css";

type Q = { business: string; owner: string; phone: string; customer: string; amount: number | null; line: string; note: string; sent: string;
  state: "open" | "approved" | "declined" | "closed"; answeredAt: string | null };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
const day = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const Check = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export default function QuotePage() {
  const { token } = useParams<{ token: string }>();
  const [q, setQ] = useState<Q | null>(null), [err, setErr] = useState("");
  const [busy, setBusy] = useState(false), [no, setNo] = useState(false), [why, setWhy] = useState(""), [fail, setFail] = useState("");
  useEffect(() => {
    fetch("/api/q?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "This quote link isn't valid."); setQ(j); })
      .catch(e => setErr(e instanceof Error ? e.message : "This quote link isn't valid."));
  }, [token]);
  async function answer(a: "approve" | "decline") {
    setBusy(true); setFail("");
    try {
      const r = await fetch("/api/q", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, answer: a, reason: why }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That didn't go through.");
      setQ(x => x && { ...x, state: j.state, answeredAt: new Date().toISOString() });
    } catch (e) { setFail(e instanceof Error ? e.message : "That didn't go through."); } finally { setBusy(false); }
  }
  const biz = q?.business.replace(/\.+$/, "") || "";
  const sms = q?.phone ? `sms:${q.phone}` : "";
  const who = q?.owner || biz;

  return <main className="qp">
    {err ? <section className="qp-card qp-msg"><h1>This link isn&rsquo;t working</h1><p>{err}</p></section>
      : !q ? <section className="qp-card qp-load" aria-busy="true"><i /><i /><i /></section>
      : <>
        <header className="qp-biz"><span className="qp-mono" aria-hidden="true">{biz.charAt(0)}</span><b>{q.business || "Your quote"}</b></header>
        <section className="qp-card">
          <p className="qp-k">Quote{q.customer ? ` for ${q.customer}` : ""} · {day(q.sent)}</p>
          <p className="qp-amt">{q.amount ? usd(q.amount) : "Your quote"}</p>
          {q.line && <p className="qp-line">{q.line}</p>}
          {q.note && <div className="qp-note"><h2>What&rsquo;s included</h2><p>{q.note}</p></div>}

          {q.state === "approved" ? <div className="qp-done ok"><span><Check /></span><div><b>Approved. Thank you{q.customer ? `, ${q.customer}` : ""}!</b>
            <p>{who} has it and will text you to pick the install date.</p></div></div>
          : q.state === "declined" ? <div className="qp-done"><div><b>Got it. No hard feelings.</b><p>{who} has your answer. If anything changes, just text {sms ? <a href={sms}>this number</a> : "us"}.</p></div></div>
          : q.state === "closed" ? <div className="qp-done"><div><b>This quote is closed.</b><p>Text {sms ? <a href={sms}>{biz}</a> : biz} if you have questions.</p></div></div>
          : no ? <form className="qp-no" onSubmit={e => { e.preventDefault(); void answer("decline"); }}>
              <label htmlFor="why">Anything that would change your mind? <em>Optional</em></label>
              <textarea id="why" rows={3} value={why} onChange={e => setWhy(e.target.value)} placeholder="Price, timing, went with someone else…" maxLength={300} autoFocus />
              <div className="qp-row"><button type="button" className="qp-ghost" onClick={() => setNo(false)}>Back</button>
                <button type="submit" className="qp-dark" disabled={busy}>{busy ? "Sending…" : "Send my answer"}</button></div>
            </form>
          : <div className="qp-acts">
              <button type="button" className="qp-go" disabled={busy} onClick={() => void answer("approve")}>{busy ? "Approving…" : `Approve${q.amount ? ` ${usd(q.amount)}` : " quote"}`}</button>
              <p className="qp-fine">Approving tells {who} you&rsquo;re ready. Nothing is charged here.</p>
              {sms && <a className="qp-ask" href={sms}>Text a question</a>}
              <button type="button" className="qp-link" onClick={() => setNo(true)}>No thanks</button>
            </div>}
          {fail && <p className="qp-err" role="alert">{fail}</p>}
        </section>
        <p className="qp-foot">{q.business ? `Sent by ${q.business} with Cinder` : "Sent with Cinder"}</p>
      </>}
  </main>;
}
