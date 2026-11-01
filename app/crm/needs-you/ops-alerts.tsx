"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Alert = { level: "urgent" | "soon" | "info"; kind: string; text: string; href: string };

/** Operations items that need you today: guarantee clocks, approvals, deadlines, billing, reports, report opens, renewals. */
export default function OpsAlerts() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  useEffect(() => { fetch("/api/ops-alerts", { cache: "no-store" }).then(r => (r.ok ? r.json() : { alerts: [] })).then(d => setAlerts(d.alerts ?? [])).catch(() => setAlerts([])); }, []);
  if (!alerts || !alerts.length) return null;
  return <section className="td-ops" aria-label="Business alerts">
    <div className="td-label">Running the business</div>
    <ul>{alerts.slice(0, 8).map((a, i) => <li key={i} className={"is-" + a.level}><i aria-hidden="true" /><Link href={a.href}>{a.text}</Link></li>)}</ul>
    {alerts.length > 8 && <p className="td-muted">{alerts.length - 8} more in Operations and on each client.</p>}
  </section>;
}
