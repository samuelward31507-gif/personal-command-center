"use client";
// One-page monthly report for a client: print to PDF, or copy the short text summary to send yourself.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "./report.css";

type Report = { client: string; period: string; label: string; rows: { label: string; value: string }[]; text: string };

export default function MonthlyReportPage() {
  const { id, period } = useParams<{ id: string; period: string }>();
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch(`/api/delivery?project=${encodeURIComponent(id)}&report=${encodeURIComponent(period)}`, { cache: "no-store" })
      .then(async res => { const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || "Couldn't load the report."); setR(d); })
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't load the report."));
  }, [id, period]);
  if (error) return <main className="mr-page"><p>{error}</p><Link href={`/crm/client-success/${id}`}>← Back to client</Link></main>;
  if (!r) return <main className="mr-page"><p>Loading report…</p></main>;
  return <main className="mr-page">
    <div className="mr-tools">
      <Link href={`/crm/client-success/${id}`}>← Back to client</Link>
      <span>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(r.text).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? "Copied ✓" : "Copy text summary"}</button>
        <button type="button" className="primary" onClick={() => window.print()}>Download PDF</button>
      </span>
    </div>
    <article className="mr-sheet">
      <header><small>Cinder Revenue Company · Monthly report</small><h1>{r.client}</h1><p>{r.label}</p></header>
      <table><tbody>{r.rows.map(x => <tr key={x.label}><th scope="row">{x.label}</th><td>{x.value}</td></tr>)}</tbody></table>
      <p className="mr-note">Estimated value = booked estimates × your average job value × your close rate. Booked estimates count only homeowners our system contacted.</p>
    </article>
    <section className="mr-text"><h2>Text summary</h2><p>{r.text}</p><small>Nothing is sent from Cinder. Copy it and send it with the PDF yourself.</small></section>
  </main>;
}
