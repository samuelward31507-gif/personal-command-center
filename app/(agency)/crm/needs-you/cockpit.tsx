"use client";

import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 (or the last value) up to `to` once, over `ms`. Shows the final value at once when motion is reduced. */
export function useCountUp(to: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(to); from.current = to; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (to - a) * e));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

/** The ember gauge: today's dials against the target, as a 270° arc that warms as it fills. */
export function EmberGauge({ value, target, loading }: { value: number; target: number; loading?: boolean }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), reduced() ? 0 : 120); return () => clearTimeout(t); }, []);
  const n = useCountUp(loading ? 0 : value);
  const size = 236, sw = 12, r = (size - sw) / 2 - 6, c = 2 * Math.PI * r, arc = 0.75 * c;
  const p = Math.max(0, Math.min(1, value / Math.max(1, target)));
  const shown = drawn && !loading ? p : 0;
  // Where the arc ends, for the glowing tip.
  const ang = (135 + 270 * shown) * (Math.PI / 180), cx = size / 2 + r * Math.cos(ang), cy = size / 2 + r * Math.sin(ang);
  const hit = value >= target;
  return <div className={"cp-gauge" + (hit ? " is-hit" : "")} role="img" aria-label={`${value} of ${target} dials today`}>
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="cp-ember" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#e9a074" />
          <stop offset=".55" stopColor="#d0663f" />
          <stop offset="1" stopColor="#b8462a" />
        </linearGradient>
        <filter id="cp-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <circle className="cp-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={sw} strokeDasharray={`${arc} ${c}`} transform={`rotate(135 ${size / 2} ${size / 2})`} />
      {[0.25, 0.5, 0.75].map(f => { const a = (135 + 270 * f) * (Math.PI / 180); return <line key={f} className="cp-tick" x1={size / 2 + (r - sw) * Math.cos(a)} y1={size / 2 + (r - sw) * Math.sin(a)} x2={size / 2 + (r - sw - 5) * Math.cos(a)} y2={size / 2 + (r - sw - 5) * Math.sin(a)} />; })}
      <circle className="cp-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={sw} stroke="url(#cp-ember)" strokeDasharray={`${arc * shown} ${c}`} transform={`rotate(135 ${size / 2} ${size / 2})`} />
      {shown > 0.02 && <circle className="cp-tip" cx={cx} cy={cy} r={9} fill="#e07a4c" filter="url(#cp-glow)" />}
    </svg>
    <div className="cp-gauge-c">
      <b>{loading ? "—" : n}</b>
      <span>{hit ? "Target hit" : `of ${target} dials`}</span>
    </div>
  </div>;
}

/** Seven days of dials as slim bars against the target line. Today is the ember bar; a dot marks a day with a meeting booked. */
export function WeekStrip({ days, target }: { days: { date: string; calls: number; meetings: number }[]; target: number }) {
  const last = days.slice(-7);
  const max = Math.max(target * 1.08, ...last.map(d => d.calls));
  const today = last[last.length - 1]?.date;
  return <div className="cp-week" role="img" aria-label={"Dials, last 7 days: " + last.map(d => d.calls).join(", ")}>
    {last.map(d => {
      const dt = new Date(d.date + "T12:00:00");
      const h = Math.max(3, (d.calls / max) * 100);
      return <div key={d.date} className={"cp-day" + (d.date === today ? " is-today" : d.calls >= target ? " is-hit" : "")}>
        <div className="cp-bar-w"><i className="cp-target" style={{ bottom: (target / max) * 100 + "%" }} /><i className="cp-bar" style={{ height: h + "%" }} title={`${d.calls} dials`} /></div>
        <span className="cp-day-n">{d.calls || ""}</span>
        <span className="cp-day-l">{dt.toLocaleDateString("en-US", { weekday: "narrow" })}{d.meetings > 0 && <em aria-label="meeting booked" />}</span>
      </div>;
    })}
  </div>;
}
