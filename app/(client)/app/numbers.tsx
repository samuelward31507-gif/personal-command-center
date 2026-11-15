"use client";

// Numbers: what Cinder's leads turned into. Figures first, then leads and bookings week by week, then which
// lead source paid for the jobs. Black, white and greys; green only means won.
import React from "react";
import { money, sourceReport } from "@/lib/crm";
import { Empty, Icon, secs, short, usd } from "./parts";
import type { Data } from "./types";

export function NumbersScreen({ d }: { d: Data }) {
  const L = d.live;
  const sources = sourceReport((d.board ?? []).filter(c => c.source !== "owner" || c.stage !== "new")).filter(r => r.source !== "other" || r.won > 0);
  const earners = sources.filter(r => r.won > 0), quiet = sources.filter(r => r.won === 0);
  const srcMax = Math.max(1, ...earners.map(r => r.wonValue));
  const pts = L.weeks.slice(-12), n = pts.length, max = Math.max(1, ...pts.map(w => w.leads));
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100), y = (v: number) => 100 - (v / max) * 86 - 6;
  const line = (key: "leads" | "booked") => pts.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(w[key]).toFixed(2)}`).join(" ");
  const rate = L.leads ? Math.round((L.booked / L.leads) * 100) : 0;
  return <>
    <header className="ph"><h1>Numbers</h1><span className="sub">Last 30 days · {L.answered} of {L.leads} leads answered</span></header>
    {L.leads === 0 ? <Empty icon="bars" title="No numbers yet" text="They start with your first lead." /> : <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <div className="stats">
        <div className="stat"><span>Won from Cinder leads</span><b>{usd(L.wonValue)}</b><small className={L.won ? "up" : ""}>{L.won} {L.won === 1 ? "job" : "jobs"} after follow-up</small></div>
        <div className="stat"><span>Open quotes</span><b>{short(L.chasingValue)}</b><small>{L.chasing} being chased</small></div>
        <div className="stat"><span>Estimates booked</span><b>{L.booked}</b><small>{rate}% of leads</small></div>
        <div className="stat"><span>First reply</span><b>{secs(L.replySec)}</b><small>Day or night</small></div>
      </div>
      <div className="today"><div className="cols" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <section className="card">
          <div className="hd"><h2>Every week</h2><small>Leads and booked estimates, last {n} weeks</small></div>
          {n > 1 ? <>
            <div className="spark" style={{ margin: "12px 16px 0" }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Leads and booked estimates over the last ${n} weeks`}>
                <defs><linearGradient id="nx-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16181d" stopOpacity=".08" /><stop offset="1" stopColor="#16181d" stopOpacity="0" /></linearGradient></defs>
                <path d={`${line("leads")} L100,100 L0,100 Z`} fill="url(#nx-fill)" />
                <path d={line("leads")} fill="none" stroke="#8a9098" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                <path d={line("booked")} fill="none" stroke="#16181d" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="legend"><span><i className="b" />Leads</span><span><i />Booked</span><span style={{ marginLeft: "auto" }}>This week: <b className="t-em">{pts[n - 1].leads}</b> leads · <b className="t-em">{pts[n - 1].booked}</b> booked</span></div>
          </> : <div className="bd fine">The chart starts after the second week.</div>}
        </section>
        <section className="card">
          <div className="hd"><h2>Where your jobs come from</h2><small>Last 4 months, from the board itself</small></div>
          {earners.length ? <div style={{ padding: "6px 0 8px" }}>{earners.map(r => <div key={r.source} className="bar" style={{ padding: "7px 16px" }}><span style={{ width: 110 }}>{r.label}</span><i><b style={{ width: `${Math.max(3, (r.wonValue / srcMax) * 100)}%` }} /></i><em style={{ width: 150, textAlign: "right" }}>{r.wonValue ? money(r.wonValue) : `${r.won} won`} <span className="mut" style={{ fontWeight: 400 }}>· {r.leads} {r.leads === 1 ? "lead" : "leads"}{r.leads >= 3 ? ` · ${Math.round((r.won / r.leads) * 100)}%` : ""}</span></em></div>)}</div>
            : <div className="bd fine">No jobs won yet. Once a job is won, this shows which source paid for it.</div>}
          {quiet.length > 0 && <div className="bd fine" style={{ paddingTop: 0 }}>{earners.length ? "No wins yet from " : "Leads from "}{quiet.map((r, k) => <React.Fragment key={r.source}>{k ? ", " : ""}<span className="t-em">{r.label}</span> ({r.leads})</React.Fragment>)}.</div>}
        </section>
        {(L.revived > 0 || L.reviews > 0) && <section className="card"><div className="hd"><h2>Also</h2></div>
          {L.revived > 0 && <div className="row"><span className="ic"><Icon name="bolt" size={14} /></span><span><b>{L.revived} old {L.revived === 1 ? "lead" : "leads"} replied</b><small>from the revive campaign</small></span></div>}
          {L.reviews > 0 && <div className="row"><span className="ic ok"><Icon name="star" size={14} /></span><span><b>{L.reviews} review {L.reviews === 1 ? "request" : "requests"}</b><small>sent after finished jobs</small></span></div>}
        </section>}
      </div></div>
    </div>}
  </>;
}
