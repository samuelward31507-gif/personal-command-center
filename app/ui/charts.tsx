"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/* Hand-drawn SVG charts for the Cinder UI. Drawn at the container's real pixel width
   (no viewBox scaling), so type and strokes stay crisp at every size. */

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el); setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round max up to a friendly number and return evenly spaced ticks from 0. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const ticks: number[] = []; for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export const compactUsd = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return s + "$" + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return s + "$" + Math.round(a);
};

export type Series = { name: string; values: number[]; tone?: "main" | "compare" };

/** Line chart: one ember series (with a soft fill), optional dashed comparison, hover readout. */
export function LineChart({ labels, series, height = 260, format = compactUsd, target, targetLabel }: {
  labels: string[]; series: Series[]; height?: number; format?: (n: number) => string; target?: number; targetLabel?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const padL = 52, padR = 12, padT = 14, padB = 30;
  const n = labels.length;
  const max = Math.max(1, target ?? 0, ...series.flatMap(s => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = w - padL - padR, ih = height - padT - padB;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => padT + ih - (Math.max(0, v) / top) * ih;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const main = series.find(s => (s.tone ?? "main") === "main") ?? series[0];
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - padL) / Math.max(1, iw)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  return <div ref={ref} style={{ position: "relative" }}>
    <svg className="u-chart" width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img"
      aria-label={series.map(s => `${s.name}: ${s.values.map((v, i) => `${labels[i]} ${format(v)}`).join(", ")}`).join(". ")}>
      <defs><linearGradient id={`u-fade-${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a1f" stopOpacity=".10" /><stop offset="1" stopColor="#ff6a1f" stopOpacity="0" /></linearGradient></defs>
      <g className="u-grid">{ticks.map(t => <g key={t}><line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} /><text x={padL - 10} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>)}</g>
      {labels.map((l, i) => i % every === 0 || i === n - 1 ? <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{l}</text> : null)}
      {target != null && target > 0 && <g><line className="u-target" x1={padL} x2={w - padR} y1={y(target)} y2={y(target)} />{targetLabel && <text x={w - padR} y={y(target) - 6} textAnchor="end" style={{ fill: "#8f8880" }}>{targetLabel}</text>}</g>}
      {main && n > 1 && <path d={`${path(main.values)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#u-fade-${gid})`} />}
      {series.map(s => <path key={s.name} d={path(s.values)} className={(s.tone ?? "main") === "main" ? "u-series" : "u-series-2"} />)}
      {main && n > 0 && hover == null && <circle cx={x(n - 1)} cy={y(main.values[n - 1])} r={3.5} fill="#ff6a1f" />}
      {hover != null && <g>
        <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#3a3633" />
        {series.map(s => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={(s.tone ?? "main") === "main" ? "#ff6a1f" : "#8f8880"} stroke="#131211" strokeWidth={2} />)}
      </g>}
    </svg>
    {hover != null && <div style={{ position: "absolute", top: 0, left: Math.min(Math.max(x(hover) + 12, 0), w - 180), pointerEvents: "none", minWidth: 150, padding: "9px 11px", borderRadius: 9, background: "#22201e", border: "1px solid #34312d", boxShadow: "0 12px 30px -10px rgba(0,0,0,.6)", fontSize: 12.5, color: "#c4bdb4" }}>
      <div style={{ color: "#f3efe9", fontWeight: 600, marginBottom: 5 }}>{labels[hover]}</div>
      {series.map(s => <div key={s.name} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}><span><i style={{ display: "inline-block", width: 8, height: 2, marginRight: 6, verticalAlign: "middle", background: (s.tone ?? "main") === "main" ? "#ff6a1f" : "#8f8880" }} />{s.name}</span><b style={{ color: "#f3efe9", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{format(s.values[hover])}</b></div>)}
    </div>}
  </div>;
}

/** Column chart: neutral bars, the highlighted one in ember, optional dashed target. */
export function Columns({ labels, values, height = 200, format = (n: number) => String(Math.round(n)), target, highlight, marks }: {
  labels: string[]; values: number[]; height?: number; format?: (n: number) => string; target?: number; highlight?: number; marks?: boolean[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 36, padR = 6, padT = 12, padB = 26;
  const n = values.length;
  const ticks = niceTicks(Math.max(1, target ?? 0, ...values), 3);
  const top = ticks[ticks.length - 1];
  const iw = w - padL - padR, ih = height - padT - padB;
  const slot = iw / Math.max(1, n), bw = Math.max(4, Math.min(28, slot * 0.58));
  const y = (v: number) => padT + ih - (Math.max(0, v) / top) * ih;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 44))));
  return <div ref={ref} style={{ position: "relative" }}>
    <svg className="u-chart" width={w} height={height} role="img" aria-label={values.map((v, i) => `${labels[i]} ${format(v)}`).join(", ")} onPointerLeave={() => setHover(null)}>
      <g className="u-grid">{ticks.map(t => <g key={t}><line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} /><text x={padL - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>)}</g>
      {values.map((v, i) => { const cx = padL + slot * i + slot / 2; return <g key={i} onPointerEnter={() => setHover(i)}>
        <rect x={cx - slot / 2} y={padT} width={slot} height={ih} fill="transparent" />
        <rect className={"u-bar" + (i === (highlight ?? n - 1) ? " is-on" : "")} x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(v > 0 ? 2 : 0, padT + ih - y(v))} rx={3} style={hover === i ? { opacity: .85 } : undefined} />
        {marks?.[i] && <circle cx={cx} cy={padT + ih + 6} r={2.5} fill="#ff6a1f" />}
        {(i % every === 0 || i === n - 1) && <text x={cx} y={height - 6} textAnchor="middle">{labels[i]}</text>}
      </g>; })}
      {target != null && target > 0 && <line className="u-target" x1={padL} x2={w - padR} y1={y(target)} y2={y(target)} />}
    </svg>
    {hover != null && <div style={{ position: "absolute", top: Math.max(0, y(values[hover]) - 34), left: Math.min(padL + slot * hover + slot / 2 - 40, w - 110), pointerEvents: "none", padding: "5px 9px", borderRadius: 7, background: "#22201e", border: "1px solid #34312d", fontSize: 12, color: "#f3efe9", whiteSpace: "nowrap" }}>{labels[hover]} · <b style={{ fontWeight: 600 }}>{format(values[hover])}</b></div>}
  </div>;
}

/** Tiny trend line for a figure. */
export function Spark({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  const d = useMemo(() => {
    if (values.length < 2) return "";
    const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
    return values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join("");
  }, [values, width, height]);
  return <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}><path d={d} fill="none" stroke="#ff6a1f" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
