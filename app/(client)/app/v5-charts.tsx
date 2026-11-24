"use client";
// Charts for the Nov 24 design (build brief Part 2.5): one accent per chart, everything else grey, monotone curves
// that never overshoot, horizontal gridlines only, no axis lines, a tooltip that sits beside the data, never on it.
import React, { useId, useMemo, useState } from "react";

export const C = { accent: "#f2431d", grey: "#c4c8cf", light: "#f9a48f", grid: "rgba(18,20,23,.06)", base: "rgba(18,20,23,.14)", label: "#666c76" };

/** A round axis top: 1, 2, 2.5, 5 or 10 times a power of ten, at or above the largest value. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Monotone cubic (Fritsch–Carlson) path through the points: a running total never seems to dip. */
export function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return "";
  if (n < 3) return "M" + pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" L");
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  t[n - 1] = m[n - 2];
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(2)},${(pts[i][1] + h * t[i]).toFixed(2)} ${(pts[i + 1][0] - h).toFixed(2)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(2)} ${pts[i + 1][0].toFixed(2)},${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
}

const money = (v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;

export type Series = { key: string; label: string; values: number[]; color: string; fill?: boolean };
/**
 * Area chart: the first series is the accent with a fill, the rest are grey lines. Hover (or arrow keys) moves a
 * crosshair; the tooltip shows every series for that day plus an optional note, beside the column.
 */
export function AreaChart({ series, labels, height = 168, format = (v: number) => "$" + Math.round(v).toLocaleString("en-US"), axis = money, note, summary, initial }: {
  series: Series[]; labels: string[]; height?: number; format?: (v: number) => string; axis?: (v: number) => string;
  note?: (i: number) => { text: string; value?: string } | null; summary: string; initial?: number;
}) {
  const id = useId().replace(/:/g, "");
  const W = 724, left = 44, right = 8, top = 8, bottom = 26, ph = height - top - bottom;
  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  const x = (i: number) => left + (n < 2 ? 0 : (i / (n - 1)) * (W - left - right));
  const y = (v: number) => top + ph - (v / max) * ph;
  const [hover, setHover] = useState<number | null>(initial ?? null);
  const ticks = [1, 2, 3, 4].map(k => (max * k) / 4);
  const xl = useMemo(() => { const step = Math.max(1, Math.round((n - 1) / 4)); const out: number[] = []; for (let i = 0; i < n; i += step) out.push(i); if (out[out.length - 1] !== n - 1) { if (n - 1 - out[out.length - 1] < step / 2) out.pop(); out.push(n - 1); } return out; }, [n]);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - left) / (W - left - right)) * (n - 1)))));
  };
  const h = hover;
  const tipLeft = h == null ? 0 : x(h) > W * 0.55 ? x(h) - 262 : x(h) + 14;
  const nt = h != null && note ? note(h) : null;
  return <div className="v5-chart" style={{ position: "relative" }}>
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={summary} tabIndex={0} style={{ display: "block", overflow: "visible" }}
      onPointerMove={onMove} onPointerLeave={() => setHover(initial ?? null)}
      onKeyDown={e => { if (e.key === "ArrowRight") setHover(i => Math.min(n - 1, (i ?? -1) + 1)); else if (e.key === "ArrowLeft") setHover(i => Math.max(0, (i ?? n) - 1)); }}>
      <defs>{series.filter(s => s.fill).map(s => <linearGradient key={s.key} id={`g${id}${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".22" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
      {ticks.map(t => <g key={t}><line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={C.grid} /><text x={left - 10} y={y(t) + 3.5} textAnchor="end" fontSize="11" fill={C.label} className="tn">{axis(t)}</text></g>)}
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke={C.base} />
      {xl.map(i => <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill={C.label}>{labels[i]}</text>)}
      {h != null && <line x1={x(h)} x2={x(h)} y1={top} y2={y(0)} stroke="rgba(18,20,23,.22)" />}
      {[...series].reverse().map(s => {
        const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
        const d = monotonePath(pts);
        return <g key={s.key}>
          {s.fill && <path d={`${d} L${x(n - 1).toFixed(2)},${y(0).toFixed(2)} L${x(0).toFixed(2)},${y(0).toFixed(2)} Z`} fill={`url(#g${id}${s.key})`} />}
          <path d={d} fill="none" stroke={s.color} strokeWidth={s.fill ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" />
          {h != null && <circle cx={x(h)} cy={y(s.values[h] ?? 0)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />}
        </g>;
      })}
    </svg>
    {h != null && <div className="v5-tip" style={{ left: `${(tipLeft / W) * 100}%`, top: 0 }} role="status">
      <div className="v5-lab v5-tip-h">{labels[h]}</div>
      {series.map(s => <div key={s.key} className="v5-tip-r"><i style={{ background: s.color }} /><span>{s.label}</span><b>{format(s.values[h] ?? 0)}</b></div>)}
      {nt && <div className="v5-tip-r"><i style={{ background: "transparent" }} /><span>{nt.text}</span><b>{nt.value ?? ""}</b></div>}
    </div>}
  </div>;
}

/** One bar split into parts (accent for the one that matters, greys for the rest), 2px gaps, round ends. */
export function StackBar({ parts, height = 8, label }: { parts: { key: string; value: number; color: string }[]; height?: number; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.filter(p => p.value > 0);
  return <div className="v5-stack" style={{ height }} role="img" aria-label={label}>
    {total === 0 ? <i style={{ flex: 1, background: "var(--bg2)" }} /> : shown.map(p => <i key={p.key} style={{ flex: p.value, background: p.color }} />)}
  </div>;
}

/** Small-count rates as dots: one square per lead or quote, the counted ones in the accent. */
export function UnitDots({ of, on, label }: { of: number; on: number; label: string }) {
  return <div className="v5-units" role="img" aria-label={label}>{Array.from({ length: Math.min(of, 200) }, (_, i) => <b key={i} className={i < on ? "on" : ""} />)}</div>;
}

/** A sparkline: no axes, gradient under it, a dot on the latest value. */
export function Sparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const mx = Math.max(...values), mn = Math.min(...values), span = mx - mn || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - mn) / span) * (height - 6)] as [number, number]);
  const d = monotonePath(pts), [lx, ly] = pts[pts.length - 1];
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
    <defs><linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity=".2" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
    <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#s${id})`} /><path d={d} fill="none" stroke={C.accent} strokeWidth="1.75" strokeLinecap="round" />
    <circle cx={lx} cy={ly} r="2.5" fill={C.accent} />
  </svg>;
}
