"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Alert = { level: "urgent" | "soon" | "info"; kind: string; text: string; href: string };

/** Operations items that need you today: guarantee clocks, approvals, deadlines, billing, reports, report opens, renewals. */
export default function OpsAlerts() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { fetch("/api/ops-alerts", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setAlerts(d.alerts ?? [])).catch(() => setFailed(true)); }, []);
  if (failed) return <p role="alert" style={{ color: "#a32014", fontSize: 13.5, margin: "0 0 12px" }}>Couldn&apos;t check client and compliance alerts. Refresh to try again.</p>;
  if (!alerts || !alerts.length) return null;
  return <section className="td-ops" aria-label="Business alerts">
    <div className="td-label">Running the business</div>
    <ul>{alerts.slice(0, 8).map((a, i) => <li key={i} className={"is-" + a.level}><i aria-hidden="true" /><Link href={a.href}>{a.text}</Link></li>)}</ul>
    {alerts.length > 8 && <p className="td-muted">{alerts.length - 8} more in Operations and on each client.</p>}
  </section>;
}
