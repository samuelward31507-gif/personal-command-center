"use client";

// Reports: what Cinder's leads turned into. Figures, leads and bookings week by week, and a table of where the
// jobs came from.
import { sourceReport } from "@/lib/crm";
import { secs, usd } from "./parts";
import type { Data, Go } from "./types";

export function ReportsScreen({ d, go }: { d: Data; go: Go }) {
  const L = d.live;
  const sources = sourceReport((d.board ?? []).filter(c => c.source !== "owner" || c.stage !== "new")).filter(r => r.source !== "other" || r.won > 0);
  const pts = L.weeks.slice(-12), n = pts.length, max = Math.max(1, ...pts.map(w => w.leads));
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100), y = (v: number) => 100 - (v / max) * 86 - 6;
  const line = (key: "leads" | "booked") => pts.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(w[key]).toFixed(2)}`).join(" ");
  const rate = L.leads ? Math.round((L.booked / L.leads) * 100) : 0;
  const totalWon = sources.reduce((a, r) => a + r.wonValue, 0);
  return <>
    <header className="tb"><h1 className="h1">Reports</h1><span className="sub">Last 30 days, and the last {n} weeks</span><div className="acts"><button type="button" className="btn ghost" onClick={() => go.tab("invoices")}>Money</button></div></header>
    {L.leads === 0 ? <div className="pad"><p className="fine">Reports start with your first lead.</p></div> : <div className="pad reports">
      <div className="stats">
        <div className="stat"><span>Leads answered</span><b>{L.answered}<small> of {L.leads}</small></b><small>{L.replySec != null ? `First reply in ${secs(L.replySec)}` : "Every one, day or night"}</small></div>
        <div className="stat"><span>Estimates booked</span><b>{L.booked}</b><small>{rate}% of leads</small></div>
        <div className="stat"><span>Won from Cinder leads</span><b>{usd(L.wonValue)}</b><small>{L.won} {L.won === 1 ? "job" : "jobs"}</small></div>
        <div className="stat"><span>Quotes being chased</span><b>{L.chasing}</b><small>{usd(L.chasingValue)} open</small></div>
      </div>
      <div className="rep-cols">
        <section className="card">
          <div className="hd"><h2>Leads and bookings</h2><small>each week</small></div>
          {n > 1 ? <>
            <div className="spark" style={{ height: 180 }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Leads and booked estimates over the last ${n} weeks`}>
                <defs><linearGradient id="rp-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#121417" stopOpacity=".07" /><stop offset="1" stopColor="#121417" stopOpacity="0" /></linearGradient></defs>
                <path d={`${line("leads")} L100,100 L0,100 Z`} fill="url(#rp-fill)" />
                <path d={line("leads")} fill="none" stroke="#8a8f98" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                <path d={line("booked")} fill="none" stroke="#121417" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="legend"><span><i className="b" />Leads</span><span><i />Booked</span><span style={{ marginLeft: "auto" }}>This week <b className="t-em">{pts[n - 1].leads}</b> leads, <b className="t-em">{pts[n - 1].booked}</b> booked</span></div>
            <table className="tbl flush" style={{ marginTop: 6 }}><thead><tr><th>Week</th><th className="right">Leads</th><th className="right">Booked</th><th className="right">Rate</th></tr></thead>
              <tbody>{[...pts].reverse().slice(0, 8).map((w, i) => <tr key={w.week} style={{ cursor: "default" }}><td className="mut">{i === 0 ? "This week" : i === 1 ? "Last week" : `${i} weeks ago`}</td><td className="num">{w.leads}</td><td className="num">{w.booked}</td><td className="num mut">{w.leads ? `${Math.round((w.booked / w.leads) * 100)}%` : "–"}</td></tr>)}</tbody></table>
          </> : <p className="fine">The chart starts after the second week.</p>}
        </section>
        <section className="card">
          <div className="hd"><h2>Where the jobs came from</h2><small>last 4 months</small></div>
          {sources.length ? <table className="tbl flush"><thead><tr><th>Source</th><th className="right">Leads</th><th className="right">Estimates</th><th className="right">Won</th><th className="right">Value</th><th className="right">Share</th></tr></thead>
            <tbody>{sources.map(r => <tr key={r.source} style={{ cursor: "default" }}><td><b>{r.label}</b></td><td className="num">{r.leads}</td><td className="num">{r.booked}</td><td className="num">{r.won || <span className="faint">–</span>}</td><td className="num">{r.wonValue ? usd(r.wonValue) : <span className="faint">–</span>}</td><td className="num mut">{r.wonValue && totalWon ? `${Math.round((r.wonValue / totalWon) * 100)}%` : "–"}</td></tr>)}</tbody></table>
            : <p className="fine">Once leads come in, this shows which source pays.</p>}
          {(L.revived > 0 || L.reviews > 0) && <div style={{ marginTop: 12 }}>
            {L.revived > 0 && <div className="money"><span>Old leads revived by the win-back texts</span><b>{L.revived}</b></div>}
            {L.reviews > 0 && <div className="money"><span>Review requests sent after finished jobs</span><b>{L.reviews}</b></div>}
          </div>}
        </section>
      </div>
    </div>}
  </>;
}
