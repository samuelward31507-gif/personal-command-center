"use client";

// Numbers: what Cinder's leads turned into, as a pane beside Money. Leads and bookings week by week, then
// which source paid for the jobs.
import React from "react";
import { sourceReport } from "@/lib/crm";
import { secs, usd } from "./parts";
import type { Data } from "./types";

export function NumbersPanel({ d }: { d: Data }) {
  const L = d.live;
  const sources = sourceReport((d.board ?? []).filter(c => c.source !== "owner" || c.stage !== "new")).filter(r => r.source !== "other" || r.won > 0);
  const earners = sources.filter(r => r.won > 0), quiet = sources.filter(r => r.won === 0);
  const srcMax = Math.max(1, ...earners.map(r => r.wonValue));
  const pts = L.weeks.slice(-12), n = pts.length, max = Math.max(1, ...pts.map(w => w.leads));
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100), y = (v: number) => 100 - (v / max) * 86 - 6;
  const line = (key: "leads" | "booked") => pts.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(w[key]).toFixed(2)}`).join(" ");
  const rate = L.leads ? Math.round((L.booked / L.leads) * 100) : 0;
  if (L.leads === 0) return <section className="card" style={{ paddingTop: 0 }}><div className="hd"><h2>Numbers</h2></div><p className="fine">They start with your first lead.</p></section>;
  return <>
    <section className="card" style={{ paddingTop: 0 }}>
      <div className="hd"><h2>Last 30 days</h2></div>
      <div className="money"><span>Leads answered</span><b>{L.answered} of {L.leads}</b></div>
      <div className="money"><span>Estimates booked</span><b>{L.booked}, {rate}%</b></div>
      <div className="money"><span>First reply</span><b>{secs(L.replySec)}</b></div>
      <div className="money"><span>Won from Cinder leads</span><b>{usd(L.wonValue)}, {L.won} {L.won === 1 ? "job" : "jobs"}</b></div>
      {L.revived > 0 && <div className="money"><span>Old leads revived</span><b>{L.revived}</b></div>}
      {L.reviews > 0 && <div className="money"><span>Review requests sent</span><b>{L.reviews}</b></div>}
    </section>
    <section className="card">
      <div className="hd"><h2>Every week</h2><small>leads and bookings, last {n} weeks</small></div>
      {n > 1 ? <>
        <div className="spark">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Leads and booked estimates over the last ${n} weeks`}>
            <defs><linearGradient id="nx-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#121417" stopOpacity=".07" /><stop offset="1" stopColor="#121417" stopOpacity="0" /></linearGradient></defs>
            <path d={`${line("leads")} L100,100 L0,100 Z`} fill="url(#nx-fill)" />
            <path d={line("leads")} fill="none" stroke="#8a8f98" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={line("booked")} fill="none" stroke="#121417" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="legend"><span><i className="b" />Leads</span><span><i />Booked</span><span style={{ marginLeft: "auto" }}>This week <b className="t-em">{pts[n - 1].leads}</b> and <b className="t-em">{pts[n - 1].booked}</b></span></div>
      </> : <p className="fine">The chart starts after the second week.</p>}
    </section>
    <section className="card">
      <div className="hd"><h2>Where the jobs came from</h2><small>last 4 months</small></div>
      {earners.length ? earners.map(r => <div key={r.source} className="bar"><span>{r.label}</span><i><b style={{ width: `${Math.max(3, (r.wonValue / srcMax) * 100)}%` }} /></i><em>{usd(r.wonValue)}</em></div>)
        : <p className="fine">No jobs won yet. Once one is, this shows which source paid for it.</p>}
      {quiet.length > 0 && <p className="fine" style={{ marginTop: 6 }}>{earners.length ? "No wins yet from " : "Leads from "}{quiet.map((r, k) => <React.Fragment key={r.source}>{k ? ", " : ""}{r.label} ({r.leads})</React.Fragment>)}.</p>}
    </section>
  </>;
}
