"use client";

// The page behind an invoice link a customer gets by text. The owner's invoice, in his business's name: the lines,
// the total, when it's due and one button to pay through his own payment page. Cinder never takes the money.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import "../../doc.css";
import { DocLines } from "../../doc-lines";

type Inv = { business: string; owner: string; phone: string; customer: string; number: number; items: { name: string; qty: number; unit: string; price: number }[];
  tax_rate: number; total: number; note: string; due_on: string | null; issued: string; status: "open" | "paid" | "void"; pay_link: string; claimed: boolean; address: string };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [v, setV] = useState<Inv | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [said, setSaid] = useState(false);
  useEffect(() => {
    fetch("/api/inv?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "This invoice link isn't valid."); setV(j); setSaid(!!j.claimed); })
      .catch(e => setErr(e instanceof Error ? e.message : "This invoice link isn't valid."));
  }, [token]);
  async function claim() {
    setBusy(true);
    try { const r = await fetch("/api/inv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); if (r.ok) setSaid(true); } finally { setBusy(false); }
  }
  const today = new Date().toLocaleDateString("en-CA");
  const late = v?.status === "open" && !!v.due_on && v.due_on < today;
  const sms = v?.phone ? `sms:${v.phone}` : "";
  const who = v?.owner || v?.business || "";

  return <main className="doc">
    {err ? <section className="doc-card doc-msg"><h1>This link isn&rsquo;t working</h1><p>{err}</p></section>
      : !v ? <section className="doc-card doc-load" aria-busy="true"><i className="skel" /><i className="skel" /><i className="skel" /></section>
      : <>
        <header className="doc-biz"><span className="doc-mono" aria-hidden="true">{(v.business || "I").charAt(0)}</span><b>{v.business || "Invoice"}</b></header>
        <section className="doc-card">
          <div className="doc-top">
            <p className="doc-k">Invoice #{v.number}{v.customer ? ` for ${v.customer}` : ""}</p>
            <span className={"stage " + (v.status === "paid" ? "won" : late ? "late" : v.status === "void" ? "lost" : "booked")}><i />{v.status === "paid" ? "Paid" : v.status === "void" ? "Canceled" : late ? "Past due" : "Open"}</span>
          </div>
          <p className="doc-amt">{usd(v.total)}</p>
          <p className="doc-meta"><span>Issued <b>{day(v.issued)}</b></span>{v.due_on && v.status === "open" && <span>Due <b>{day(v.due_on)}</b></span>}</p>
          {v.address && <p className="doc-line">{v.address}</p>}
          <DocLines items={v.items} taxRate={v.tax_rate} total={v.total} />
          {v.note && <div className="doc-note"><h2>Note</h2><p>{v.note}</p></div>}

          {v.status === "paid" ? <div className="doc-done ok"><span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <div><b>Paid. Thank you!</b><p>This invoice is settled. Keep this page as your receipt.</p></div></div>
            : v.status === "void" ? <div className="doc-done"><div><b>This invoice was canceled.</b><p>Nothing is owed on it. Text {sms ? <a href={sms}>{v.business}</a> : v.business} with any questions.</p></div></div>
            : <div className="doc-acts">
              {v.pay_link ? <a className="btn ink lg" href={v.pay_link} target="_blank" rel="noopener noreferrer">Pay {usd(v.total)}</a>
                : <p className="doc-fine">{who} will tell you how to pay. Reply to the text with any questions.</p>}
              {v.pay_link && <p className="doc-fine">Opens {v.business || "the business"}&rsquo;s secure payment page.</p>}
              {sms && <a className="btn lg" href={sms}>Text a question</a>}
              {said ? <p className="doc-fine" role="status">Thanks. {who} will confirm your payment.</p>
                : <button type="button" className="link" style={{ alignSelf: "center", fontSize: 14 }} disabled={busy} onClick={() => void claim()}>I&rsquo;ve already paid</button>}
            </div>}
        </section>
        <p className="doc-foot">{v.business ? `Sent by ${v.business} with Cinder` : "Sent with Cinder"}</p>
      </>}
  </main>;
}
