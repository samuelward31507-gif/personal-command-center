"use client";

// Mission-control pieces for the client app: a telemetry readout, the revenue panel with its flight chart,
// and the count-up that runs once when a number first appears. Monochrome on purpose: black, white and
// greys carry everything; green only means "live" or "won".
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts up to the target once, the first time it's shown. Later changes jump straight to the new value. */
export function useCountUp(target: number, ms = 1100): number {
  const [v, setV] = useState(() => (reduced() ? target : 0));
  const done = useRef(false);
  useEffect(() => {
    if (done.current || reduced()) { setV(target); return; }
    done.current = true;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(target * (1 - Math.pow(1 - p, 4))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export type Reading = { k: string; v: React.ReactNode; live?: boolean };
/** One line of readouts, the way a launch broadcast shows altitude and speed. Scrolls sideways on a phone. */
export function Telemetry({ items, label = "Telemetry" }: { items: Reading[]; label?: string }) {
  return <dl className="sx-tel" aria-label={label}>{items.map(r => <div key={r.k} className={r.live ? "live" : ""}>
    <dt>{r.live && <i aria-hidden="true" />}{r.k}</dt><dd>{r.v}</dd></div>)}</dl>;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const short = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K` : usd(n);

/**
 * The revenue panel: what Cinder's leads turned into, counted up once, over a flight chart of leads and booked
 * estimates week by week. The last week is the live point.
 */
export function Mission({ wonValue, won, chasingValue, weeks, replySec, answered, leads, booked }: {
  wonValue: number; won: number; chasingValue: number; weeks: { week: string; leads: number; booked: number }[];
  replySec: number | null; answered: number; leads: number; booked: number;
}) {
  const shown = useCountUp(wonValue);
  const pts = weeks.slice(-12);
  const max = Math.max(1, ...pts.map(w => w.leads));
  const n = pts.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 86 - 6;
  const line = (key: "leads" | "booked") => pts.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(w[key]).toFixed(2)}`).join(" ");
  const area = n > 1 ? `${line("leads")} L100,100 L0,100 Z` : "";
  const last = pts[n - 1];
  const rate = leads ? Math.round((booked / leads) * 100) : 0;
  return <section className="sx-mission" aria-label="What Cinder brought in">
    <div className="sx-mission-top">
      <p className="sx-k">Won from Cinder leads</p>
      <p className="sx-live"><i aria-hidden="true" />Live</p>
    </div>
    <p className="sx-big" aria-label={usd(wonValue)}>{usd(shown)}</p>
    <dl className="sx-mission-stats">
      <div><dt>Jobs won</dt><dd>{won}</dd></div>
      <div><dt>Open quotes</dt><dd>{short(chasingValue)}</dd></div>
      <div><dt>First reply</dt><dd>{replySec == null ? "–" : replySec < 60 ? `${replySec}s` : `${Math.round(replySec / 60)}m`}</dd></div>
      <div><dt>Answered</dt><dd>{answered}<small>/{leads}</small></dd></div>
      <div><dt>Booked</dt><dd>{rate}<small>%</small></dd></div>
    </dl>
    {n > 1 && <figure className="sx-flight" aria-label={`Leads and booked estimates over the last ${n} weeks`}>
      <div className="sx-flight-plot">
        <i className="sx-grid" aria-hidden="true"><b /><b /><b /></i>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="sx-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
          <path d={area} fill="url(#sx-fill)" />
          <path className="sx-l1" d={line("leads")} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path className="sx-l2" d={line("booked")} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map((w, i) => <span key={w.week} className={"sx-dot" + (i === n - 1 ? " now" : "")} style={{ left: `${x(i)}%`, top: `${y(w.booked)}%` }} aria-hidden="true" />)}
        {last && <span className="sx-readout" style={{ left: `${x(n - 1)}%`, top: `${y(last.leads)}%` }}><b>{last.leads}</b> leads · <b>{last.booked}</b> booked</span>}
      </div>
      <figcaption><span><i className="a" />Leads</span><span><i className="b" />Booked</span><span className="sx-k">Last {n} weeks</span></figcaption>
    </figure>}
  </section>;
}

export type Stage = { key: string; label: string; count: number; value: number };
/**
 * The pipeline as a flight path: each stage a node on one line, how many made it to the next stage on the
 * line between them. Lost sits off the path. The path draws itself in once.
 */
export function Trajectory({ stages, lost, onPick }: { stages: Stage[]; lost: number; onPick?: (key: string) => void }) {
  // How many reached each stage: everyone at that stage or any later one.
  const reached = stages.map((_, i) => stages.slice(i).reduce((a, s) => a + s.count, 0));
  return <div className="sx-traj" role="list" aria-label="Pipeline">
    {stages.map((s, i) => {
      const pct = i > 0 && reached[i - 1] ? Math.round((reached[i] / reached[i - 1]) * 100) : null;
      return <button key={s.key} type="button" role="listitem" className={"sx-node" + (s.count ? " on" : "") + (i === stages.length - 1 ? " end" : "")} onClick={() => onPick?.(s.key)}>
        {pct != null && <span className="sx-pct" aria-label={`${pct}% reached ${s.label}`}>{pct}%</span>}
        <i className="sx-pin" aria-hidden="true" />
        <span className="sx-k">{s.label}</span>
        <b>{s.count}</b>
        <small>{s.value ? short(s.value) : "–"}</small>
      </button>;
    })}
    <span className="sx-lost"><span className="sx-k">Lost</span><b>{lost}</b></span>
  </div>;
}
