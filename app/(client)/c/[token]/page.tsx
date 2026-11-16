"use client";

// The page behind a change order link: extra work agreed mid-job, in the business's name. What's added, what it costs,
// and one button to approve it with their name. Approving adds it to the final invoice; nothing is charged here.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import "../../doc.css";
import { DocLines } from "../../doc-lines";

type CO = { business: string; owner: string; phone: string; customer: string; number: number; title: string; items: { name: string; qty: number; unit: string; price: number }[];
  tax_rate: number; total: number; note: string; sent: string; state: "open" | "approved" | "declined" | "closed"; answeredAt: string | null; signedBy: string; terms: string };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const day = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const Check = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export default function ChangeOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [v, setV] = useState<CO | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [fail, setFail] = useState(""), [signer, setSigner] = useState("");
  useEffect(() => {
    fetch("/api/c?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "This link isn't valid."); setV(j); })
      .catch(e => setErr(e instanceof Error ? e.message : "This link isn't valid."));
  }, [token]);
  async function answer(a: "approve" | "decline") {
    setBusy(true); setFail("");
    try {
      const r = await fetch("/api/c", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, answer: a, name: signer }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That didn't go through.");
      setV(x => x && { ...x, state: j.state, answeredAt: new Date().toISOString(), signedBy: signer });
    } catch (e) { setFail(e instanceof Error ? e.message : "That didn't go through."); } finally { setBusy(false); }
  }
  const biz = v?.business.replace(/\.+$/, "") || "";
  const who = v?.owner || biz;
  const sms = v?.phone ? `sms:${v.phone}` : "";

  return <main className="doc">
    {err ? <section className="doc-card doc-msg"><h1>This link isn&rsquo;t working</h1><p>{err}</p></section>
      : !v ? <section className="doc-card doc-load" aria-busy="true"><i className="skel" /><i className="skel" /><i className="skel" /></section>
      : <>
        <header className="doc-biz"><span className="doc-mono" aria-hidden="true">{biz.charAt(0)}</span><b>{v.business || "Change order"}</b></header>
        <section className="doc-card">
          <p className="doc-k">Change order #{v.number}{v.customer ? ` for ${v.customer}` : ""}, {day(v.sent)}</p>
          <p className="doc-amt">{usd(v.total)}<small className="doc-amt-sub"> added to your job</small></p>
          <p className="doc-line">{v.title}</p>
          <DocLines items={v.items} taxRate={v.tax_rate} total={v.total} />
          {v.note && <div className="doc-note"><h2>Details</h2><p>{v.note}</p></div>}
          {v.state === "approved" ? <div className="doc-done ok"><span><Check /></span><div><b>Approved{v.signedBy ? ` by ${v.signedBy}` : ""}. Thank you!</b><p>{who} has it. It&rsquo;s added to your final invoice.</p></div></div>
          : v.state === "declined" ? <div className="doc-done"><div><b>Got it. The job stays as quoted.</b><p>{who} has your answer. Questions? Text {sms ? <a href={sms}>this number</a> : "us"}.</p></div></div>
          : v.state === "closed" ? <div className="doc-done"><div><b>This change order is closed.</b><p>Text {sms ? <a href={sms}>{biz}</a> : biz} if you have questions.</p></div></div>
          : <div className="doc-acts">
              <label className="doc-sign"><span>Your name, to approve</span><input className="input" value={signer} onChange={e => setSigner(e.target.value)} placeholder="Carla Mendez" maxLength={80} autoComplete="name" /></label>
              <button type="button" className="btn ink lg" disabled={busy || signer.trim().length < 2} onClick={() => void answer("approve")}>{busy ? "Approving…" : `Approve ${usd(v.total)}`}</button>
              <p className="doc-fine">Approving adds this to your job and your final invoice. Nothing is charged here.</p>
              {sms && <a className="btn lg" href={sms}>Text a question</a>}
              <button type="button" className="link" style={{ alignSelf: "center", fontSize: 14 }} disabled={busy} onClick={() => void answer("decline")}>No thanks, keep the job as quoted</button>
            </div>}
          {fail && <p className="err" role="alert" style={{ textAlign: "center" }}>{fail}</p>}
        </section>
        {v.terms && <details className="doc-terms"><summary>Terms</summary><p>{v.terms}</p></details>}
        <p className="doc-foot">{v.business ? `Sent by ${v.business}` : ""}<button type="button" className="link doc-print" onClick={() => window.print()}>Print or save as PDF</button></p>
      </>}
  </main>;
}
