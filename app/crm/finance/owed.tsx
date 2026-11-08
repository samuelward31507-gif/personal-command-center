"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; title: string; client: string; email: string; amount: number; dueDate: string | null; invoiceNumber: number | null; invoiceSentAt: string | null; remindedAt: string | null; url: string | null; next: string };
type Group = { bucket: string; label: string; total: number; items: Item[] };
export type OwedData = { today: string; groups: Group[]; totalOpen: number; totalOverdue: number; notInvoiced: number; retainersToBill: number; paymentReady: boolean };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
const short = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No due date");

/** Who owes you, by urgency. Invoice links and reminder emails open in your own mail app; Cinder never sends or charges. */
export default function Owed({ onChange, onData }: { onChange?: () => void; onData?: (d: OwedData) => void }) {
  const [d, setD] = useState<OwedData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [paying, setPaying] = useState<Item | null>(null);
  const [paidOn, setPaidOn] = useState("");
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => fetch("/api/invoices", { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("load"); return r.json(); })
    .then((j: OwedData) => { setD(j); onData?.(j); setFailed(false); })
    .catch(() => { setD(null); setFailed(true); }), [onData]);
  useEffect(() => { void load(); }, [load]);
  const refresh = async () => { await load(); onChange?.(); };

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }
  async function send(it: Item, kind: "sent" | "reminded") {
    setBusy(it.id); setNote(null);
    try {
      const j = await post({ action: "invoice", id: it.id });
      await navigator.clipboard?.writeText(j.url).catch(() => {});
      if (j.draft) window.location.href = `mailto:${encodeURIComponent(j.email || "")}?subject=${encodeURIComponent(j.draft.subject)}&body=${encodeURIComponent(j.draft.body)}`;
      await post({ action: kind, id: it.id });
      setNote({ ok: true, text: `Invoice link copied and an email opened${j.email ? ` to ${j.email}` : " (no email on file, add the recipient)"}. Nothing was sent by Cinder.` });
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
    try { const j = await post({ action: "bill-month" }); setNote({ ok: true, text: j.created ? `${j.created} retainer invoice${j.created === 1 ? "" : "s"} added for this month.` : "Nothing new to bill this month." }); await refresh(); }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't bill this month." }); }
    finally { setBusy(null); }
  }

  const head = <div className="u-h2-row">
    <h2 className="u-h2">Who owes you</h2>
    {d && d.retainersToBill > 0 && <button className="u-btn u-btn-go" disabled={busy === "bill"} onClick={() => void billMonth()}>{busy === "bill" ? "Billing…" : `Bill this month's retainers (${d.retainersToBill})`}</button>}
  </div>;

  if (!d) return <div>{head}{failed
    ? <p className="u-note" role="alert">Couldn&apos;t load what you&apos;re owed. <button type="button" className="u-btn u-btn-bare" onClick={() => void load()}>Try again</button></p>
    : <p className="u-note" role="status">Loading…</p>}</div>;

  return <div>
    {head}
    {!d.paymentReady && d.totalOpen > 0 && <p className="u-flash" style={{ marginBottom: 12 }}>Invoices have no way to pay yet. Add your payment links in&nbsp;<Link href="/crm/settings" style={{ textDecoration: "underline" }}>Settings</Link>.</p>}
    {note && <p className={"u-flash" + (note.ok ? "" : " is-bad")} role={note.ok ? "status" : "alert"} style={{ marginBottom: 12 }}>{note.text}</p>}
    {d.groups.length === 0
      ? <div className="u-rows"><div className="u-row"><div className="u-row-main"><strong>Nobody owes you anything right now.</strong><span>Invoices you send show up here until they&apos;re paid.</span></div></div></div>
      : d.groups.map(g => <div key={g.bucket} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 8px", fontSize: 12.5, color: g.bucket.startsWith("overdue") ? "var(--u-ember-ink)" : "var(--u-muted)" }}><span>{g.label}</span><span className="u-num">{usd(g.total)}</span></div>
        <div className="u-rows">{g.items.map(it => <div key={it.id} className="u-row">
          <span className={"u-dot" + (g.bucket.startsWith("overdue") ? " is-ember" : "")} />
          <div className="u-row-main"><strong>{it.client || it.title}</strong><span>{it.invoiceNumber ? `INV-${it.invoiceNumber} · ` : ""}{short(it.dueDate)}{it.next && it.next !== "Send the invoice" ? ` · ${it.next}` : ""}</span></div>
          <div className="u-row-end u-num" style={{ color: "var(--u-text)", fontSize: 15, minWidth: 90 }}>{usd(it.amount)}</div>
          <div className="u-row-acts" style={{ display: "flex", gap: 6 }}>
            {!it.invoiceSentAt
              ? <button className="u-btn u-btn-light" disabled={busy === it.id} onClick={() => void send(it, "sent")}>Send invoice</button>
              : <button className="u-btn" disabled={busy === it.id} onClick={() => void send(it, "reminded")}>Remind</button>}
            <button className="u-btn u-btn-bare" disabled={busy === it.id} onClick={() => void copyLink(it)}>Copy link</button>
            <button className="u-btn" onClick={() => { setPaying(it); setPaidOn(d.today); }}>Mark paid</button>
          </div>
        </div>)}</div>
      </div>)}
    {paying && <div className="u-scrim" role="dialog" aria-modal="true" aria-label="Mark paid" onMouseDown={e => { if (e.target === e.currentTarget) setPaying(null); }}>
      <div className="u-dialog">
        <h3>Mark {usd(paying.amount)} paid?</h3>
        <p className="u-note" style={{ marginBottom: 16 }}>Only once the money is in your account. A signed agreement or a promise to pay doesn&apos;t count.</p>
        <label className="u-lab">Date received<input className="u-field" type="date" value={paidOn} max={d.today} onChange={e => setPaidOn(e.target.value)} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button className="u-btn" onClick={() => setPaying(null)}>Cancel</button><button className="u-btn u-btn-go" disabled={!paidOn || busy === paying.id} onClick={() => void markPaid()}>Money received</button></div>
      </div>
    </div>}
  </div>;
}
