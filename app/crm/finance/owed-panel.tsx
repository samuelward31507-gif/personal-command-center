"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./owed-panel.css";

type Item = { id: string; title: string; client: string; email: string; amount: number; dueDate: string | null; invoiceNumber: number | null; invoiceSentAt: string | null; remindedAt: string | null; url: string | null; next: string };
type Group = { bucket: string; label: string; total: number; items: Item[] };
type Data = { today: string; groups: Group[]; totalOpen: number; totalOverdue: number; notInvoiced: number; retainersToBill: number; paymentReady: boolean };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No date");

/** Who owes you: open money by urgency, with one-tap invoice links and reminder drafts. Nothing is sent or charged by Cinder. */
export default function OwedPanel({ onChange }: { onChange?: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [paying, setPaying] = useState<Item | null>(null);
  const [paidOn, setPaidOn] = useState("");

  const load = useCallback(() => fetch("/api/invoices", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setD).catch(() => setD(null)), []);
  useEffect(() => { void load(); }, [load]);
  const refresh = async () => { await load(); onChange?.(); };

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }

  /** Create (or reuse) the invoice link, copy it, and open a ready email in the owner's mail app. */
  async function send(it: Item, kind: "sent" | "reminded") {
    setBusy(it.id); setNote(null);
    try {
      const j = await post({ action: "invoice", id: it.id });
      await navigator.clipboard?.writeText(j.url).catch(() => {});
      if (j.draft) window.location.href = `mailto:${encodeURIComponent(j.email || "")}?subject=${encodeURIComponent(j.draft.subject)}&body=${encodeURIComponent(j.draft.body)}`;
      await post({ action: kind, id: it.id });
      setNote({ ok: true, text: `Invoice link copied and an email opened${j.email ? ` to ${j.email}` : " (no email on file: add the recipient)"}. Cinder didn't send anything.` });
      await refresh();
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't create the invoice." }); }
    finally { setBusy(null); }
  }

  async function copyLink(it: Item) {
    setBusy(it.id);
    try { const j = await post({ action: "invoice", id: it.id }); await navigator.clipboard?.writeText(j.url); setNote({ ok: true, text: "Invoice link copied." }); await load(); }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't copy the link." }); }
    finally { setBusy(null); }
  }

  async function markPaid() {
    if (!paying) return;
    setBusy(paying.id);
    try {
      const r = await fetch("/api/finance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: paying.id, status: "paid", paidAt: paidOn }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't mark it paid.");
      setNote({ ok: true, text: `${usd(paying.amount)} from ${paying.client || paying.title} marked paid.` }); setPaying(null); await refresh();
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't mark it paid." }); }
    finally { setBusy(null); }
  }

  async function billMonth() {
    setBusy("bill"); setNote(null);
    try { const j = await post({ action: "bill-month" }); setNote({ ok: true, text: j.created ? `${j.created} retainer invoice${j.created === 1 ? "" : "s"} added for this month. Send them below.` : "Nothing new to bill this month." }); await refresh(); }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't bill this month." }); }
    finally { setBusy(null); }
  }

  if (!d) return <section className="ow-card"><h2>Who owes you</h2><p className="ow-sub">Loading…</p></section>;
  return <section className="ow-card">
    <div className="ow-head">
      <div><h2>Who owes you</h2>
        <p className="ow-sub">{d.totalOpen ? <>{usd(d.totalOpen)} open{d.totalOverdue ? <> · <b className="ow-late">{usd(d.totalOverdue)} overdue</b></> : null}{d.notInvoiced ? ` · ${d.notInvoiced} not invoiced yet` : ""}</> : "Nobody owes you anything right now."}</p></div>
      {d.retainersToBill > 0 && <button className="ow-btn primary" disabled={busy === "bill"} onClick={() => void billMonth()}>{busy === "bill" ? "Billing…" : `Bill this month (${d.retainersToBill})`}</button>}
    </div>
    {!d.paymentReady && d.totalOpen > 0 && <p className="ow-warn">Invoices have no way to pay yet. Add your payment links in <Link href="/crm/settings">Settings</Link> (Offers and Getting paid).</p>}
    {note && <p className={note.ok ? "ow-note ok" : "ow-note bad"} role={note.ok ? "status" : "alert"}>{note.text}</p>}
    {d.groups.map(g => <div key={g.bucket} className="ow-group" data-urgent={g.bucket.startsWith("overdue") ? "1" : undefined}>
      <div className="ow-group-h"><span>{g.label}</span><span>{usd(g.total)}</span></div>
      {g.items.map(it => <div key={it.id} className="ow-row">
        <div className="ow-main"><strong>{it.client || it.title}</strong><small>{it.client ? cap(it.title.split(" — ").slice(1).join(" — ") || it.title) : ""}{it.invoiceNumber ? ` · INV-${it.invoiceNumber}` : ""} · {short(it.dueDate)}</small></div>
        <div className="ow-amt">{usd(it.amount)}</div>
        <div className="ow-next">{it.next === "Send the invoice" ? "" : it.next}</div>
        <div className="ow-acts">
          {!it.invoiceSentAt
            ? <button className="ow-btn primary" disabled={busy === it.id} onClick={() => void send(it, "sent")}>Send invoice</button>
            : <button className="ow-btn" disabled={busy === it.id} onClick={() => void send(it, "reminded")}>Remind</button>}
          <button className="ow-btn" disabled={busy === it.id} onClick={() => void copyLink(it)} title="Copy the invoice link">Link</button>
          {it.url && <a className="ow-btn" href={it.url} target="_blank" rel="noreferrer">View</a>}
          <button className="ow-btn" onClick={() => { setPaying(it); setPaidOn(d.today); }}>Paid</button>
        </div>
      </div>)}
    </div>)}
    {paying && <div className="ow-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) setPaying(null); }}>
      <div className="ow-dialog">
        <h3>Mark {usd(paying.amount)} paid?</h3>
        <p>Only do this once the money is in your account. A signed agreement or a promise to pay doesn&apos;t count.</p>
        <label>Date received<input type="date" value={paidOn} max={d.today} onChange={e => setPaidOn(e.target.value)} /></label>
        <div className="ow-dialog-acts"><button className="ow-btn" onClick={() => setPaying(null)}>Cancel</button><button className="ow-btn primary" disabled={!paidOn || busy === paying.id} onClick={() => void markPaid()}>Money received</button></div>
      </div>
    </div>}
  </section>;
}
