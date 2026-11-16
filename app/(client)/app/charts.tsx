"use client";

// Small, exact charts drawn in SVG: no library, no animation for its own sake. They read the way the site's
// product window does: thin strokes, one ink series, one soft series, numbers in tabular figures.
import { useId } from "react";

/** A line with a soft fill under it, for a stat tile. `values` oldest first. */
export function Sparkline({ values, tone = "ink", height = 28 }: { values: number[]; tone?: "ink" | "good" | "ember" | "bad"; height?: number }) {
  const id = "sp" + useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = max - min || 1, n = values.length;
  const pts = values.map((v, i) => [(i / (n - 1)) * 100, 100 - ((v - min) / span) * 84 - 8] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return <svg className={"spark " + tone} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".16" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    <path d={`${d} L100,100 L0,100 Z`} fill={`url(#${id})`} />
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

/** Paired bars by period (leads and booked, say), with the axis labelled under every bar. */
export function Bars({ data, a, b, height = 168, fmt = (n: number) => String(n) }: { data: { label: string; a: number; b: number }[]; a: string; b: string; height?: number; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b)));
  const ticks = [max, Math.round(max / 2), 0];
  return <div className="bars-chart" style={{ height: height + 40 }}>
    <div className="bc-y">{ticks.map((t, i) => <span key={i}>{fmt(t)}</span>)}</div>
    <div className="bc-plot" style={{ height }}>
      {ticks.map((_, i) => <i key={i} className="bc-grid" style={{ top: `${(i / 2) * 100}%` }} />)}
      {data.map((d, i) => <div key={i} className="bc-col" title={`${d.label}: ${fmt(d.a)} ${a.toLowerCase()}, ${fmt(d.b)} ${b.toLowerCase()}`}>
        <span className="bc-bar a" style={{ height: `${(d.a / max) * 100}%` }} />
        <span className="bc-bar b" style={{ height: `${(d.b / max) * 100}%` }} />
        <small>{d.label}</small>
      </div>)}
    </div>
    <div className="bc-legend"><span><i className="a" />{a}</span><span><i className="b" />{b}</span></div>
  </div>;
}

/** A ring split into parts, with the total in the middle. Parts under 3% still show as a sliver. */
export function Donut({ parts, total, label, size = 132 }: { parts: { label: string; value: number; color: string }[]; total: string; label: string; size?: number }) {
  const sum = parts.reduce((a, p) => a + p.value, 0) || 1, r = 42, c = 2 * Math.PI * r;
  let off = 0;
  return <div className="donut" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--paper-2)" strokeWidth="11" />
      {parts.filter(p => p.value > 0).map(p => { const len = Math.max(c * 0.012, (p.value / sum) * c); const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="11" strokeDasharray={`${len - 1.2} ${c}`} strokeDashoffset={-off} transform="rotate(-90 50 50)" />; off += len; return el; })}
    </svg>
    <div className="donut-c"><b>{total}</b><small>{label}</small></div>
  </div>;
}

/** The site's stat box: tiles in one bordered row, a big figure, a line under it, a sparkline if there's a trend. */
export type Kpi = { label: string; value: string; sub?: string; tone?: "up" | "down" | "warn" | ""; spark?: number[]; sparkTone?: "ink" | "good" | "ember" | "bad"; onClick?: () => void; active?: boolean };
export function Kpis({ items }: { items: Kpi[] }) {
  return <div className="kpis" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map(k => { const inner = <>
      <span className="klab">{k.label}</span>
      <b className="kfig">{k.value}</b>
      {k.sub && <small className={"ksub " + (k.tone || "")}>{k.sub}</small>}
      {k.spark && k.spark.length > 1 && <span className="kspark"><Sparkline values={k.spark} tone={k.sparkTone ?? "ink"} /></span>}
    </>; return k.onClick ? <button key={k.label} type="button" className={"kpi" + (k.active ? " on" : "") + (k.spark && k.spark.length > 1 ? " sp" : "")} onClick={k.onClick}>{inner}</button> : <div key={k.label} className={"kpi" + (k.spark && k.spark.length > 1 ? " sp" : "")}>{inner}</div>; })}
  </div>;
}

/** A page's opening line in the site's two-tone style: the point in ink, the context in grey. */
export function PageHead({ title, sub, actions, kicker }: { title: string; sub?: string; actions?: React.ReactNode; kicker?: React.ReactNode }) {
  return <header className="ph">
    <div className="ph-t">{kicker && <div className="ph-k">{kicker}</div>}<h1><span>{title}</span>{sub && <> <em>{sub}</em></>}</h1></div>
    {actions && <div className="ph-a">{actions}</div>}
  </header>;
}

/** Soft, distinct tints for avatars, picked from the name so a person always gets the same one. */
const TINTS = [["#f3e3dc", "#9a4a2c"], ["#e1ecf6", "#2d5f8a"], ["#e4f1e8", "#2f7350"], ["#efe6f4", "#6b3f86"], ["#f6efd9", "#86651c"], ["#e3eef0", "#2f6b72"], ["#f4e2e6", "#8c3a4f"], ["#e8e8ee", "#4b4f63"]];
export function tintFor(name: string): [string, string] {
  let h = 0; for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length] as [string, string];
}
