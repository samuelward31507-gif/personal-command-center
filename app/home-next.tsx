"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { title: string; status: string; why: string; href: string };
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Three things worth a glance under the Home composer: your next move, money owed, and the open pipeline. */
export default function HomeNext() {
  const [queue, setQueue] = useState<{ count: number; overdue: number; top: Item | null } | null>(null);
  const [owed, setOwed] = useState<{ open: number; overdue: number } | null>(null);
  const [pipe, setPipe] = useState<{ deals: number; monthly: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
    const after = new Date(tomorrow); after.setDate(after.getDate() + 1);
    const q = new URLSearchParams({ today: key(now), dayEnd: tomorrow.toISOString(), windowEnd: after.toISOString() });
    fetch("/api/my-day?" + q, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      const items: Item[] = d?.items ?? [];
      setQueue({ count: items.length, overdue: items.filter(i => i.status === "overdue" || i.status === "blocked").length, top: items[0] ?? null });
    }).catch(() => setQueue({ count: 0, overdue: 0, top: null }));
    fetch("/api/invoices", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => setOwed({ open: d?.totalOpen ?? 0, overdue: d?.totalOverdue ?? 0 })).catch(() => setOwed({ open: 0, overdue: 0 }));
    fetch("/api/deals", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      const open = (d?.deals ?? []).filter((x: { stage: string }) => !["won", "lost"].includes(x.stage));
      setPipe({ deals: open.length, monthly: open.reduce((s: number, x: { monthlyFee: number }) => s + Number(x.monthlyFee || 0), 0) });
    }).catch(() => setPipe({ deals: 0, monthly: 0 }));
  }, []);

  const dash = "—";
  return <section className="hn-next" aria-label="Up next">
    <div className="hn-next-h"><span>Up next</span><Link href="/crm/needs-you">Open Today</Link></div>
    <div className="hn-grid">
      <Link className="hn-tile" href={queue?.top?.href || "/crm/needs-you"}>
        <span className="hn-tile-k">Next move</span>
        <span className="hn-tile-v">{queue ? queue.count : dash}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--d-muted)", marginLeft: 6 }}>in your queue</span></span>
        <span className={"hn-tile-s" + (queue?.top?.status === "overdue" ? " bad" : "")}>{queue?.top ? queue.top.title : queue ? "Nothing waiting. Book calls." : " "}</span>
      </Link>
      <Link className="hn-tile" href="/crm/finance">
        <span className="hn-tile-k">Owed to you</span>
        <span className="hn-tile-v">{owed ? usd(owed.open) : dash}</span>
        <span className={"hn-tile-s" + (owed?.overdue ? " bad" : "")}>{owed ? (owed.overdue ? `${usd(owed.overdue)} overdue` : owed.open ? "Nothing overdue" : "All paid up") : " "}</span>
      </Link>
      <Link className="hn-tile" href="/crm/pipeline">
        <span className="hn-tile-k">Open pipeline</span>
        <span className="hn-tile-v">{pipe ? `${usd(pipe.monthly)}/mo` : dash}</span>
        <span className="hn-tile-s">{pipe ? `${pipe.deals} open deal${pipe.deals === 1 ? "" : "s"}` : " "}</span>
      </Link>
    </div>
  </section>;
}
