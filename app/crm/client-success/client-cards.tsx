"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type P = { id: string; name: string; clientName: string; contactName: string; status: string; monthlyValue: number; milestoneCount: number; doneMilestones: number };
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Every signed client, one tap to their client page. */
export default function ClientCards() {
  const [list, setList] = useState<P[] | null>(null);
  useEffect(() => { fetch("/api/projects", { cache: "no-store" }).then(r => r.ok ? r.json() : { projects: [] }).then(d => setList((d.projects ?? []).filter((p: P) => p.status !== "cancelled"))).catch(() => setList([])); }, []);
  if (!list) return null;
  return <section style={{ margin: "22px 0 8px" }}>
    <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Your clients</h2>
    {list.length === 0 ? <p style={{ color: "#9e9e9e", fontSize: 13.5, margin: 0 }}>No clients yet. Each won deal shows up here with its own page.</p> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {list.map(p => <Link key={p.id} href={`/crm/client-success/${p.id}`} style={{ display: "grid", gap: 4, padding: "13px 15px", borderRadius: 14, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#e6e6e6", textDecoration: "none" }}>
          <strong style={{ fontSize: 14 }}>{p.clientName || p.contactName || p.name}</strong>
          <span style={{ fontSize: 12.5, color: "#9e9e9e" }}>{p.status.replace(/_/g, " ")} · {p.milestoneCount ? `${p.doneMilestones}/${p.milestoneCount} steps` : "no plan"}{p.monthlyValue ? ` · ${usd(p.monthlyValue)}/mo` : ""}</span>
        </Link>)}
      </div>}
  </section>;
}
