"use client";

// The customer's own page, behind one private link: everything they have with the business in one place. Quotes to approve,
// what they owe and a Pay button (the owner's own pay link), change orders, what's coming up, after photos, the sign-off.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import "../../doc.css";

type P = { business: string; owner: string; phone: string; customer: string; payLink: string; address: string;
  quotes: { amount: number | null; status: "open" | "approved" | "declined" | "closed"; sent: string; url: string | null }[];
  invoices: { number: number; total: number; balance: number; status: string; due_on: string | null; url: string | null; issued: string }[];
  changeOrders: { number: number; title: string; total: number; status: string; url: string | null }[];
  coming: { kind: "estimate" | "install" | "visit"; date: string; time: string | null; what: string }[];
  photos: string[]; signoff: { signed_by: string; at: string } | null };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const day = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`; };
const QS: Record<string, string> = { open: "Waiting on you", approved: "Approved", declined: "Declined", closed: "Closed" };

export default function CustomerPage() {
  const { token } = useParams<{ token: string }>();
  const [p, setP] = useState<P | null>(null), [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/p?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "This link isn't valid."); setP(j); })
      .catch(e => setErr(e instanceof Error ? e.message : "This link isn't valid."));
  }, [token]);
  const biz = p?.business.replace(/\.+$/, "") || "";
  const owed = p ? p.invoices.reduce((a, i) => a + i.balance, 0) : 0;
  const open = p ? p.invoices.filter(i => i.balance > 0) : [];
  const waiting = p ? [...p.quotes.filter(q => q.status === "open" && q.url), ...p.changeOrders.filter(c => c.status === "sent" && c.url)].length : 0;
  const sms = p?.phone ? `sms:${p.phone}` : "", tel = p?.phone ? `tel:${p.phone}` : "";

  return <main className="doc portal">
    {err ? <section className="doc-card doc-msg"><h1>This link isn&rsquo;t working</h1><p>{err}</p></section>
      : !p ? <section className="doc-card doc-load" aria-busy="true"><i className="skel" /><i className="skel" /><i className="skel" /></section>
      : <>
        <header className="doc-biz"><span className="doc-mono" aria-hidden="true">{biz.charAt(0)}</span><b>{p.business}</b></header>
        <section className="doc-card">
          <p className="doc-k">{p.customer ? `Hi ${p.customer}` : "Your page"}{p.address ? `, ${p.address}` : ""}</p>
          <p className="doc-amt">{owed > 0 ? usd(owed) : waiting ? `${waiting} to look at` : "All set"}<small className="doc-amt-sub">{owed > 0 ? " still owed" : waiting ? " waiting on your answer" : " nothing owed, nothing waiting"}</small></p>
          {owed > 0 && open.length === 1 && open[0].url && <a className="btn ink lg" href={open[0].url}>See invoice #{open[0].number} and pay</a>}
          <div className="doc-acts" style={{ marginTop: 10 }}>{sms && <a className="btn lg" href={sms}>Text {p.owner || biz}</a>}{tel && <a className="btn lg" href={tel}>Call</a>}</div>
        </section>

        {p.coming.length > 0 && <section className="doc-card"><h2 className="doc-h">Coming up</h2>
          <ul className="doc-list">{p.coming.map((c, k) => <li key={k}><span><b>{c.what}</b><small>{c.kind === "estimate" ? "Estimate" : c.kind === "install" ? "Install" : "Service visit"}</small></span><em>{day(c.date)}{c.time ? `, ${clock(c.time)}` : ""}</em></li>)}</ul></section>}

        {(p.quotes.length > 0 || p.changeOrders.length > 0) && <section className="doc-card"><h2 className="doc-h">Quotes and changes</h2>
          <ul className="doc-list">
            {p.quotes.map((q, k) => <li key={"q" + k}><span><b>Quote{q.amount ? `, ${usd(q.amount)}` : ""}</b><small className={q.status === "open" ? "warn" : ""}>{QS[q.status]}{q.sent ? `, sent ${day(q.sent)}` : ""}</small></span>{q.url && <a className="btn sm" href={q.url}>{q.status === "open" ? "Look it over" : "View"}</a>}</li>)}
            {p.changeOrders.map(c => <li key={"c" + c.number}><span><b>Change order #{c.number}, {usd(c.total)}</b><small className={c.status === "sent" ? "warn" : ""}>{c.title}. {c.status === "sent" ? "Waiting on you" : c.status === "approved" ? "Approved" : "Declined"}</small></span>{c.url && <a className="btn sm" href={c.url}>{c.status === "sent" ? "Look it over" : "View"}</a>}</li>)}
          </ul></section>}

        {p.invoices.length > 0 && <section className="doc-card"><h2 className="doc-h">Invoices</h2>
          <ul className="doc-list">{p.invoices.map(i => <li key={i.number}><span><b>#{i.number}, {usd(i.total)}</b><small className={i.balance > 0 && i.due_on && i.due_on < new Date().toLocaleDateString("en-CA") ? "bad" : ""}>{i.balance > 0 ? `${usd(i.balance)} owed${i.due_on ? `, due ${day(i.due_on)}` : ""}` : "Paid, thank you"}</small></span>{i.url && <a className={"btn sm" + (i.balance > 0 ? " ink" : "")} href={i.url}>{i.balance > 0 ? "Pay" : "Receipt"}</a>}</li>)}</ul></section>}

        {(p.photos.length > 0 || p.signoff) && <section className="doc-card"><h2 className="doc-h">Your finished job</h2>
          {p.photos.length > 0 && <div className="doc-photos">{p.photos.map(id => <a key={id} href={`/api/p?token=${encodeURIComponent(token)}&photo=${id}`} target="_blank" rel="noreferrer"><img src={`/api/p?token=${encodeURIComponent(token)}&photo=${id}`} alt="After photo" loading="lazy" /></a>)}</div>}
          {p.signoff && <p className="doc-fine" style={{ marginTop: 10 }}>Signed off by {p.signoff.signed_by} on {day(p.signoff.at)}.</p>}</section>}

        <p className="doc-foot">{p.business ? `${p.business}. ` : ""}This page is private to you.</p>
      </>}
  </main>;
}
