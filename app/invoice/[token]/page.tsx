"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CinderLogo } from "../../cinder-brand";
import "./invoice.css";

type Doc = {
  number: string; issued: string | null; due: string | null; status: "paid" | "open"; paidOn: string | null;
  item: string; amount: number;
  to: { company: string; person: string; email: string };
  from: { name: string; legalName: string; address: string; email: string };
  pay: { link: string; instructions: string };
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");

/** Public invoice behind a private link. Payment happens on the owner's own payment page; Cinder never takes money. */
export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/invoice?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "This invoice link isn't valid."); setDoc(d); })
      .catch(e => setError(e instanceof Error ? e.message : "This invoice link isn't valid."));
  }, [token]);

  const late = doc && doc.status === "open" && doc.due && doc.due < new Date().toISOString().slice(0, 10);
  return <div className="iv-page">
    <header className="iv-top"><CinderLogo mono className="iv-logo" title={doc?.from.name ?? "Invoice"} />
      {doc && <button className="iv-print" onClick={() => window.print()}>Download PDF</button>}</header>
    <main className="iv-main">
      {error ? <div className="iv-msg"><h1>Invoice not available</h1><p>{error}</p></div>
        : !doc ? <p className="iv-muted">Loading invoice…</p>
        : <article className="iv-sheet">
          <div className="iv-head">
            <div><h1>Invoice</h1><p className="iv-num">{doc.number}</p></div>
            <span className={"iv-status " + (doc.status === "paid" ? "paid" : late ? "late" : "open")}>{doc.status === "paid" ? `Paid ${fmt(doc.paidOn)}` : late ? "Past due" : `Due ${fmt(doc.due)}`}</span>
          </div>
          <div className="iv-parties">
            <div><small>From</small><strong>{doc.from.name}</strong>{doc.from.legalName !== doc.from.name && <span>{doc.from.legalName}</span>}{doc.from.address && <span>{doc.from.address}</span>}{doc.from.email && <span>{doc.from.email}</span>}</div>
            <div><small>Bill to</small><strong>{doc.to.company || doc.to.person || "Client"}</strong>{doc.to.company && doc.to.person && <span>{doc.to.person}</span>}{doc.to.email && <span>{doc.to.email}</span>}</div>
            <div><small>Issued</small><span>{fmt(doc.issued)}</span><small className="iv-gap">Due</small><span>{fmt(doc.due)}</span></div>
          </div>
          <table className="iv-lines"><thead><tr><th>Description</th><th>Amount</th></tr></thead>
            <tbody><tr><td>{doc.item}</td><td>{usd(doc.amount)}</td></tr></tbody>
            <tfoot><tr><td>Total due</td><td>{doc.status === "paid" ? usd(0) : usd(doc.amount)}</td></tr></tfoot></table>
          {doc.status === "open" && <section className="iv-pay">
            <h2>How to pay</h2>
            {doc.pay.link && <a className="iv-paybtn" href={doc.pay.link} target="_blank" rel="noopener noreferrer">Pay {usd(doc.amount)}</a>}
            {doc.pay.instructions && <p className="iv-instr">{doc.pay.instructions}</p>}
            {!doc.pay.link && !doc.pay.instructions && <p className="iv-instr">Reply to the email this invoice came with and we&apos;ll send payment details.</p>}
            <p className="iv-fine">Please include {doc.number} with your payment.</p>
          </section>}
          {doc.status === "paid" && <p className="iv-thanks">Thank you. This invoice is paid.</p>}
        </article>}
    </main>
  </div>;
}
