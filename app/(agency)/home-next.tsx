"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { title: string; status: string; why: string; href: string };
type Owed = { id: string; client: string; title: string; amount: number; dueDate: string | null; url: string | null };
type Proj = { id: string; name: string; clientName: string; contactName: string; status: string; milestoneCount: number; doneMilestones: number };
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "Pick up where you left off": three cards with a small live preview, like recent work in Claude. */
export default function HomeNext() {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [owed, setOwed] = useState<{ total: number; overdue: number; items: Owed[] } | null>(null);
  const [proj, setProj] = useState<Proj[] | null>(null);

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
    const after = new Date(tomorrow); after.setDate(after.getDate() + 1);
    const q = new URLSearchParams({ today: key(now), dayEnd: tomorrow.toISOString(), windowEnd: after.toISOString() });
    fetch("/api/my-day?" + q, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => setQueue(d?.items ?? [])).catch(() => setQueue([]));
    fetch("/api/invoices", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => setOwed({
      total: d?.totalOpen ?? 0, overdue: d?.totalOverdue ?? 0,
      items: (d?.groups ?? []).flatMap((g: { items: Owed[] }) => g.items),
    })).catch(() => setOwed({ total: 0, overdue: 0, items: [] }));
    fetch("/api/projects", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => setProj((d?.projects ?? []).filter((p: Proj) => !["completed", "cancelled"].includes(p.status)))).catch(() => setProj([]));
  }, []);

  const top = queue?.[0];
  const firstOwed = owed?.items?.[0];
  const client = proj?.[0];
  const clientName = client ? client.clientName || client.contactName || client.name : "";

  return <section className="hn-next" aria-label="Pick up where you left off">
    <div className="hn-next-h"><span>Pick up where you left off</span><Link href="/crm/needs-you">View all</Link></div>
    <div className="hn-grid">
      <Link className="hn-card" href={top?.href || "/crm/needs-you"}>
        <div className="hn-thumb">
          <b>Today · {queue ? queue.length : "…"} to do</b>
          {(queue ?? []).slice(0, 4).map((q, i) => <span key={i} className={q.status === "overdue" ? "late" : ""}>{q.title}</span>)}
          {queue && !queue.length && <span>Nothing waiting</span>}
        </div>
        <div className="hn-t">{top ? top.title : "Your queue is clear"}</div>
        <div className="hn-s">{top ? top.why : "Book more calls"}</div>
      </Link>
      <Link className="hn-card" href="/crm/finance">
        <div className="hn-thumb">
          <b>Owed · {owed ? usd(owed.total) : "…"}</b>
          {(owed?.items ?? []).slice(0, 3).map(o => <span key={o.id} className="hn-money"><em>{o.client || o.title}</em><i>{usd(o.amount)}</i></span>)}
          {owed && !owed.items.length && <span>All paid up</span>}
        </div>
        <div className="hn-t">{firstOwed ? `${firstOwed.client || "A client"} owes ${usd(firstOwed.amount)}` : "Nobody owes you"}</div>
        <div className={"hn-s" + (owed?.overdue ? " late" : "")}>{owed?.overdue ? `${usd(owed.overdue)} overdue` : "Nothing overdue"}</div>
      </Link>
      <Link className="hn-card" href={client ? `/crm/client-success/${client.id}` : "/crm/client-success"}>
        <div className="hn-thumb">
          <b>{clientName || "Clients"}</b>
          {client ? <>
            <span className="hn-bar"><i style={{ width: `${client.milestoneCount ? Math.round(client.doneMilestones / client.milestoneCount * 100) : 0}%` }} /></span>
            <span>{client.doneMilestones} of {client.milestoneCount} delivery steps done</span>
            <span>Status · {client.status.replace(/_/g, " ")}</span>
          </> : <span>No clients yet</span>}
        </div>
        <div className="hn-t">{client ? clientName : "Win your first client"}</div>
        <div className="hn-s">{client ? (proj && proj.length > 1 ? `+ ${proj.length - 1} more client${proj.length > 2 ? "s" : ""}` : "Open the client page") : "Signed deals show up here"}</div>
      </Link>
    </div>
  </section>;
}
