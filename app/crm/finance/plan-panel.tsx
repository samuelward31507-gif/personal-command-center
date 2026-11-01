"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./plan-panel.css";

type Sum = { collected: number; spent: number; profit: number; taxSetAside: number; takeHome: number };
type Plan = {
  taxPct: number; month: Sum; year: Sum; mrr: number;
  forecast: { goal: number; goalBy: string; months: number; collected: number; projected: number; gap: number; perMonthNeeded: number; onTrack: boolean; pct: number };
  clients: { projectId: string; name: string; monthly: number; state: string; label: string; lastPaidAt: string | null }[];
};
const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Profit after expenses, the tax set-aside, the goal forecast and who's paid this month. */
export default function PlanPanel({ refresh }: { refresh: number }) {
  const [p, setP] = useState<Plan | null>(null);
  const [period, setPeriod] = useState<"month" | "year">("month");
  useEffect(() => { fetch("/api/money-plan", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(setP).catch(() => {}); }, [refresh]);
  if (!p) return null;
  const s = p[period], f = p.forecast;
  return <section className="mp-card">
    <div className="mp-head"><h2>Profit and taxes</h2>
      <div className="mp-seg" role="group" aria-label="Period">{(["month", "year"] as const).map(k => <button key={k} type="button" aria-pressed={period === k} style={{ background: period === k ? "#2c2c2c" : "transparent" }} onClick={() => setPeriod(k)}>{k === "month" ? "This month" : "This year"}</button>)}</div></div>
    <div className="mp-flow">
      <div><small>Collected</small><b>{usd(s.collected)}</b></div><i>−</i>
      <div><small>Expenses</small><b>{usd(s.spent)}</b></div><i>=</i>
      <div><small>Profit</small><b>{usd(s.profit)}</b></div><i>−</i>
      <div><small>Set aside for taxes ({p.taxPct}%)</small><b>{usd(s.taxSetAside)}</b></div><i>=</i>
      <div className="mp-take"><small>Yours to keep</small><b>{usd(s.takeHome)}</b></div>
    </div>
    <p className="mp-fine">Move {usd(s.taxSetAside)} to tax savings. The percentage is in <Link href="/crm/settings">Settings</Link>; ask your CPA for yours.</p>

    <div className="mp-goal">
      <div className="mp-goal-h"><b>{usd(f.goal)} by {fmt(f.goalBy)}</b><span className={f.onTrack ? "ok" : "bad"}>{f.onTrack ? "On track" : "Behind"}</span></div>
      <div className="mp-bar"><i style={{ width: f.pct + "%" }} /></div>
      <p>{usd(f.collected)} collected this year. At today&apos;s {usd(p.mrr)}/mo in live retainers you&apos;d reach about {usd(f.projected)}. {f.gap > 0 && f.months > 0 ? `To hit the goal you need ${usd(f.perMonthNeeded)} a month for the next ${f.months} month${f.months === 1 ? "" : "s"}.` : ""}</p>
    </div>

    {p.clients.length > 0 && <div className="mp-clients"><h3>Retainers this month</h3>
      <ul>{p.clients.map(c => <li key={c.projectId}><Link href={`/crm/client-success/${c.projectId}`}>{c.name}</Link><span>{usd(c.monthly)}/mo</span><em className={"is-" + c.state}>{c.label}</em></li>)}</ul></div>}
  </section>;
}
