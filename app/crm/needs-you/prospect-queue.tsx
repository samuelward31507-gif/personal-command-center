"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type New = { id: string; company: string; instagram: string; facebook: string; website: string; report: string | null; views: number; research: string };
type Due = { id: string; company: string; followUp: number; instagram: string; facebook: string; website: string };
type Q = { sentToday: number; newToday: New[]; followUps: Due[]; stats: { messaged: number; replied: number } };
const NB = { background: "transparent" };
const href = (v: string) => (v.startsWith("http") ? v : `https://${v.replace(/^@/, "")}`);

/** Today's prospects to message yourself, with report links, plus follow-ups due. One tap logs what you did. */
export default function ProspectQueue() {
  const [q, setQ] = useState<Q | null>(null);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/prospect-queue", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(setQ).catch(() => {}); }, []);
  async function log(contactId: string, kind: string, channel: string) {
    setBusy(contactId + kind);
    const r = await fetch("/api/prospect-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, kind, channel }) });
    if (r.ok) setQ(await r.json());
    setBusy("");
  }
  async function copy(link: string) { try { await navigator.clipboard.writeText(link); setCopied(link); setTimeout(() => setCopied(""), 1500); } catch { window.prompt("Copy this link", link); } }
  if (!q || (!q.newToday.length && !q.followUps.length)) return null;
  const channel = (p: { instagram: string; facebook: string }) => (p.instagram ? "instagram" : p.facebook ? "facebook" : "other");
  const shown = open ? q.newToday : q.newToday.slice(0, 5);
  return <section className="td-pq" aria-label="Prospects to message">
    <div className="td-pq-head"><div className="td-label">Prospects to message</div>
      <span>{q.sentToday} sent today · {q.stats.messaged} messaged · {q.stats.replied} replied</span></div>
    {q.followUps.length > 0 && <ul className="td-pq-list">{q.followUps.map(p => <li key={p.id}>
      <div><Link href={`/crm?contact=${p.id}`}><strong>{p.company}</strong></Link><small>Follow-up {p.followUp} due</small></div>
      <div className="td-pq-links">{p.instagram && <a href={href(p.instagram)} target="_blank" rel="noreferrer">Instagram</a>}{p.facebook && <a href={href(p.facebook)} target="_blank" rel="noreferrer">Facebook</a>}</div>
      <div className="td-pq-acts"><button type="button" style={NB} disabled={!!busy} onClick={() => log(p.id, "follow_up_sent", channel(p))}>Sent follow-up</button><button type="button" style={NB} disabled={!!busy} onClick={() => log(p.id, "replied", channel(p))}>Replied</button><button type="button" style={NB} disabled={!!busy} onClick={() => log(p.id, "not_interested", channel(p))}>Not interested</button></div>
    </li>)}</ul>}
    {q.newToday.length > 0 && <ul className="td-pq-list">{shown.map(p => <li key={p.id}>
      <div><Link href={`/crm?contact=${p.id}`}><strong>{p.company}</strong></Link>{p.research && <small>{p.research}</small>}</div>
      <div className="td-pq-links">{p.instagram && <a href={href(p.instagram)} target="_blank" rel="noreferrer">Instagram</a>}{p.facebook && <a href={href(p.facebook)} target="_blank" rel="noreferrer">Facebook</a>}{p.website && <a href={href(p.website)} target="_blank" rel="noreferrer">Site</a>}
        {p.report && <button type="button" style={NB} onClick={() => copy(p.report!)}>{copied === p.report ? "Copied" : "Copy report link"}</button>}</div>
      <div className="td-pq-acts"><button type="button" style={NB} disabled={!!busy} onClick={() => log(p.id, "dm_sent", channel(p))}>{busy === p.id + "dm_sent" ? "…" : "Sent"}</button><button type="button" style={NB} disabled={!!busy} onClick={() => log(p.id, "not_interested", channel(p))}>Skip</button></div>
    </li>)}</ul>}
    {q.newToday.length > 5 && <button type="button" style={NB} className="td-pq-more" onClick={() => setOpen(!open)}>{open ? "Show fewer" : `Show all ${q.newToday.length}`}</button>}
  </section>;
}
