"use client";

// The kit: the few parts every rebuilt screen is made of, after Attio. A header with views, sections, list rows,
// tags, tinted avatars, a row of figures, empty states and properties you click to change. Styles in kit.css.
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Icon, initials } from "./parts";

/** The views under the place you're in (Jobs: Open, Won, Customers, Quotes), and the phone's way to More. Set by the shell. */
export type View = { k: string; l: string; n?: number; on: boolean; go: () => void };
export const ShellCtx = createContext<{ views?: View[]; onMore?: () => void; me?: string }>({});

const TINTS: [string, string][] = [["#fde8e1", "#a8452a"], ["#e1edfb", "#2c5d93"], ["#e2f3e8", "#2b7049"], ["#efe7fb", "#6740a8"], ["#fbf0d6", "#89631a"], ["#def1f2", "#2a6b73"], ["#fbe4ea", "#933a55"], ["#ebebf0", "#4a4e62"]];
export function tint(name: string): [string, string] { let h = 0; for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; }

export function Av({ name, size, sq }: { name: string; size?: "sm" | "lg" | "xl"; sq?: boolean }) {
  const [bg, fg] = tint(name);
  return <span className={"k-av" + (size ? " " + size : "") + (sq ? " sq" : "")} aria-hidden="true" style={{ background: bg, color: fg }}>{initials(name)}</span>;
}

export type Tone = "" | "red" | "amber" | "green" | "blue" | "violet" | "acc" | "line";
export function Tag({ tone = "", dot, children, title }: { tone?: Tone; dot?: boolean; children: React.ReactNode; title?: string }) {
  return <span className={"k-tag" + (tone ? " " + tone : "") + (dot ? " k-dot" : "")} title={title}>{children}</span>;
}

/** The page's top bar: icon and title, one grey line, the actions; the place's views underneath. */
export function Head({ title, sub, actions, icon, back, views: own, noViews }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; icon?: string; back?: () => void; views?: View[]; noViews?: boolean }) {
  const ctx = useContext(ShellCtx);
  const views = noViews ? undefined : own ?? ctx.views;
  return <header className="k-head">
    <div className="k-head-row">
      <div className="k-head-t">
        {back && <button type="button" className="k-btn ghost ic k-back" onClick={back} aria-label="Back"><Icon name="back" size={16} /></button>}
        {icon && !back && <span className="k-head-ic" aria-hidden="true"><Icon name={icon} size={14} /></span>}
        <h1 className="k-title">{title}</h1>
      </div>
      {!back && ctx.onMore && <button type="button" className="k-me" onClick={ctx.onMore} aria-label="Settings and more"><Av name={ctx.me || "Me"} /></button>}
      {sub && <p className="k-head-sub">{sub}</p>}
      <div className="k-head-acts">{actions}</div>
    </div>
    {views && views.length > 1 && <nav className="k-views" aria-label="Views">
      {views.map(v => <button key={v.k} type="button" className="k-view" aria-current={v.on ? "page" : undefined} onClick={v.go}>{v.l}{v.n ? <em>{v.n}</em> : null}</button>)}
    </nav>}
  </header>;
}

export function Section({ title, sub, aside, children, boxed = true, label }: { title?: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; boxed?: boolean; label?: string }) {
  return <section className="k-sec" aria-label={label ?? (typeof title === "string" ? title : undefined)}>
    {(title || aside) && <div className="k-sec-h">{title && <h2>{title}</h2>}{sub && <small>{sub}</small>}{aside && <div className="k-sec-a">{aside}</div>}</div>}
    {boxed ? <div className="k-box">{children}</div> : children}
  </section>;
}

export type Stat = { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: number | null; red?: boolean; go?: () => void; spark?: number[] };
export function Stats({ items }: { items: Stat[] }) {
  return <div className="k-stats" style={{ "--n": items.length } as React.CSSProperties}>
    {items.map(s => { const inner = <>
      <span className="k-stat-l">{s.label}</span>
      <span className="k-stat-v">{s.value}{s.delta != null && <span className={"k-delta" + (s.delta > 0 ? "" : " down")}>{s.delta > 0 ? "+" : ""}{s.delta}%</span>}</span>
      {s.sub && <span className={"k-stat-s" + (s.red ? " red" : "")}>{s.sub}</span>}
      {s.spark && s.spark.some(v => v) && <Spark values={s.spark} />}
    </>;
    return s.go ? <button key={s.label} type="button" className="k-stat" onClick={s.go}>{inner}</button> : <div key={s.label} className="k-stat">{inner}</div>; })}
  </div>;
}

/** A small running line, ink, filled 6%: the shape of the month at a glance. */
export function Spark({ values }: { values: number[] }) {
  const w = 200, h = 26, mx = Math.max(...values), mn = Math.min(0, ...values), span = mx - mn || 1;
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 2 - ((v - mn) / span) * (h - 4)]);
  const d = "M" + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L");
  return <svg className="k-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="var(--k-acc)" opacity=".08" /><path d={d} fill="none" stroke="var(--k-acc)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
  </svg>;
}

export function Blank({ icon, title, text, action, fill }: { icon?: string; title: string; text?: React.ReactNode; action?: React.ReactNode; fill?: boolean }) {
  return <div className={"k-empty" + (fill ? " fill" : "")}>{icon && <span className="k-empty-ic"><Icon name={icon} size={18} /></span>}<b>{title}</b>{text && <p>{text}</p>}{action && <div className="k-empty-a">{action}</div>}</div>;
}

/** A property you click to change, the way Attio does it: Enter or leaving the field saves, Esc puts it back. */
export function Prop({ label, icon, value, shown, placeholder = "Add", onSave, type = "text", options, multiline, readOnly }: {
  label: string; icon?: string; value: string; shown?: React.ReactNode; placeholder?: string; onSave?: (v: string) => Promise<void> | void;
  type?: "text" | "number" | "date" | "time" | "tel" | "email"; options?: { v: string; l: string }[]; multiline?: boolean; readOnly?: boolean;
}) {
  const [edit, setEdit] = useState(false), [v, setV] = useState(value), [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  useEffect(() => { if (!edit) setV(value); }, [value, edit]);
  useEffect(() => { if (edit) { ref.current?.focus(); if (ref.current && "select" in ref.current && !options && type === "text") ref.current.select(); } }, [edit, options, type]);
  const save = async (next = v) => { setEdit(false); if (next === value || !onSave) return; setBusy(true); try { await onSave(next); } catch { setV(value); } finally { setBusy(false); } };
  const keys = (e: React.KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setV(value); setEdit(false); } else if (e.key === "Enter" && !(multiline && e.shiftKey)) { e.preventDefault(); void save(); } };
  const can = !!onSave && !readOnly;
  return <div className="k-prop">
    <span className="k-prop-l">{icon && <Icon name={icon} size={14} />}{label}</span>
    {edit ? (options
      ? <select ref={ref} className="k-prop-in" value={v} aria-label={label} onChange={e => { setV(e.target.value); void save(e.target.value); }} onBlur={() => setEdit(false)} onKeyDown={keys}>{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
      : multiline ? <textarea ref={ref} className="k-prop-in" value={v} aria-label={label} onChange={e => setV(e.target.value)} onBlur={() => void save()} onKeyDown={keys} />
      : <input ref={ref} className="k-prop-in" type={type} inputMode={type === "number" ? "decimal" : undefined} value={v} aria-label={label} onChange={e => setV(e.target.value)} onBlur={() => void save()} onKeyDown={keys} />)
      : can ? <button type="button" className={"k-prop-v" + (value ? "" : " k-pv-empty") + (busy ? " k-pv-saving" : "")} onClick={() => setEdit(true)} aria-label={`${label}: ${value || "empty"}. Change`}>{value ? shown ?? value : placeholder}</button>
      : <span className={"k-prop-v" + (value || shown ? "" : " k-pv-empty")}>{shown ?? (value || "–")}</span>}
  </div>;
}
