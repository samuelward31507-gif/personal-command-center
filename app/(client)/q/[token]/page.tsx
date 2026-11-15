"use client";

// The page behind a quote link a customer gets by text. It's the owner's quote, in their business's name:
// the price, what it's for, and one button to approve it. Answering goes straight to the owner.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import "../../doc.css";
import { DocLines } from "../../doc-lines";

type Q = { business: string; owner: string; phone: string; customer: string; amount: number | null; line: string; note: string; sent: string;
  items?: { name: string; qty: number; unit: string; price: number }[]; tax_rate?: number;
  state: "open" | "approved" | "declined" | "closed"; answeredAt: string | null; deposit?: number | null; payLink?: string };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
const day = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const Check = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

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

  return <main className="doc">
    {err ? <section className="doc-card doc-msg"><h1>This link isn&rsquo;t working</h1><p>{err}</p></section>
      : !q ? <section className="doc-card doc-load" aria-busy="true"><i className="skel" /><i className="skel" /><i className="skel" /></section>
      : <>
        <header className="doc-biz"><span className="doc-mono" aria-hidden="true">{biz.charAt(0)}</span><b>{q.business || "Your quote"}</b></header>
        <section className="doc-card">
          <p className="doc-k">Quote{q.customer ? ` for ${q.customer}` : ""}, {day(q.sent)}</p>
          <p className="doc-amt">{q.amount ? usd(q.amount) : "Your quote"}</p>
          {q.line && <p className="doc-line">{q.line.replace(/s·s/g, ", ")}</p>}
          {q.items && q.items.length > 0 && <DocLines items={q.items} taxRate={q.tax_rate ?? 0} total={q.amount ?? 0} />}
          {q.note && <div className="doc-note"><h2>What&rsquo;s included</h2><p>{q.note}</p></div>}

          {q.state === "approved" ? <div className="doc-done ok"><span><Check /></span><div><b>Approved. Thank you{q.customer ? `, ${q.customer}` : ""}!</b>
            <p>{who} has it and will text you to pick the install date.</p>
            {q.deposit ? <p style={{ marginTop: 8 }}>A deposit of <strong>{usd(q.deposit)}</strong> holds your date.{q.payLink ? "" : ` ${who} will text you how to pay it.`}</p> : null}
            {q.deposit && q.payLink ? <a className="btn ink lg" style={{ marginTop: 10, display: "inline-flex" }} href={q.payLink} target="_blank" rel="noreferrer">Pay the {usd(q.deposit)} deposit</a> : null}</div></div>
          : q.state === "declined" ? <div className="doc-done"><div><b>Got it. No hard feelings.</b><p>{who} has your answer. If anything changes, just text {sms ? <a href={sms}>this number</a> : "us"}.</p></div></div>
          : q.state === "closed" ? <div className="doc-done"><div><b>This quote is closed.</b><p>Text {sms ? <a href={sms}>{biz}</a> : biz} if you have questions.</p></div></div>
          : no ? <form className="doc-no" onSubmit={e => { e.preventDefault(); void answer("decline"); }}>
              <label htmlFor="why">Anything that would change your mind? <em>Optional</em></label>
              <textarea id="why" className="input" style={{ height: "auto", padding: 10 }} rows={3} value={why} onChange={e => setWhy(e.target.value)} placeholder="Price, timing, went with someone else…" maxLength={300} autoFocus />
              <div className="acts-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}><button type="button" className="btn lg" onClick={() => setNo(false)}>Back</button>
                <button type="submit" className="btn ink lg" disabled={busy}>{busy ? "Sending…" : "Send my answer"}</button></div>
            </form>
          : <div className="doc-acts">
              <button type="button" className="btn ink lg" disabled={busy} onClick={() => void answer("approve")}>{busy ? "Approving…" : `Approve${q.amount ? ` ${usd(q.amount)}` : " quote"}`}</button>
              <p className="doc-fine">Approving tells {who} you&rsquo;re ready. Nothing is charged here.{q.deposit ? ` A ${usd(q.deposit)} deposit holds your install date, paid on ${biz}'s own payment page after you approve.` : ""}</p>
              {sms && <a className="btn lg" href={sms}>Text a question</a>}
              <button type="button" className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => setNo(true)}>No thanks</button>
            </div>}
          {fail && <p className="err" role="alert" style={{ textAlign: "center" }}>{fail}</p>}
        </section>
        <p className="doc-foot">{q.business ? `Sent by ${q.business} with Cinder` : "Sent with Cinder"}</p>
      </>}
  </main>;
}
