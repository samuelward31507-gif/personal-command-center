"use client";

// The small parts every screen of the owner's app is built from, and the helpers they share.
// One icon set, one button, one sheet, one avatar: the same on the phone and on a desk.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { STAGE_LABEL, type Stage } from "@/lib/crm";

export type Api = <T>(path: string, body?: unknown) => Promise<T>;
export type Toast = (t: string, bad?: boolean) => void;

// ---------- Formatting ----------
export const fmtPhone = (p: string) => { const d = (p || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };
export const typePhone = (v: string) => { const d = v.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10); return d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d; };
export const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const short = (n: number) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : usd(n);
export const first = (s: string) => (s || "").trim().split(" ")[0] || "them";
export const initials = (s: string) => (s || "").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "#";
export const todayIso = () => new Date().toLocaleDateString("en-CA");
export const clock = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const dateLabel = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const dayKey = (d: string) => new Date(d).toDateString();
export function dayName(d: string): string {
  const x = new Date(d), t = new Date(), y = new Date(Date.now() - 86400000), tm = new Date(Date.now() + 86400000);
  return x.toDateString() === t.toDateString() ? "Today" : x.toDateString() === y.toDateString() ? "Yesterday" : x.toDateString() === tm.toDateString() ? "Tomorrow"
    : x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
/** "12m ago", "3h ago", "Yesterday", "Nov 6". */
export function ago(d: string | null | undefined): string {
  if (!d) return "";
  const m = Math.round((Date.now() - Date.parse(d)) / 60000);
  if (m < 1) return "now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.round(m / 60)}h ago`;
  if (m < 2880) return "Yesterday"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(":00", "");
export const secs = (n: number | null) => (n == null ? "–" : n < 60 ? `${n}s` : `${Math.round(n / 60)}m`);

// ---------- Icons: one stroke, one weight ----------
const P: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 20 12z" />,
  jobs: <><rect x="3.5" y="4" width="5" height="16" rx="1.5" /><rect x="9.5" y="4" width="5" height="11" rx="1.5" /><rect x="15.5" y="4" width="5" height="7" rx="1.5" /></>,
  cal: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 13.6A5.5 5.5 0 0 1 20.5 19" /></>,
  invoice: <><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" /><path d="M9.5 9h5M9.5 12.5h5" /></>,
  bars: <path d="M5 20V11M12 20V5M19 20v-7" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  quote: <><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5" /><path d="M14 3.5V8h4M9.5 13h5M9.5 16.5h3" /></>,
  dollar: <path d="M12 3v18M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.5 0-4 1.3-4 3s1.5 2.6 4 3 4 1.4 4 3.2-1.6 3.1-4.2 3.1c-2.2 0-3.8-.9-4.6-2.2" />,
  star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  fwd: <path d="M9 5l7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></>,
  send: <path d="M12 19V5M6 11l6-6 6 6" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.6" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2" /></>,
  ext: <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  car: <><path d="M5 16V11l2-4.5h10L19 11v5" /><path d="M3.5 16h17v2.5h-17zM5 11h14" /><circle cx="8" cy="13.5" r=".6" /><circle cx="16" cy="13.5" r=".6" /></>,
  alert: <><path d="M12 7v6M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></>,
  table: <path d="M4 7h16M4 12h16M4 17h16" />,
  ruler: <><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3M19 8v2" /></>,
  out: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  edit: <path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z" />,
  panel: <><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 4.5v15" /></>,
  sort: <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />,
  expand: <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />,
  updown: <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />,
};
export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{P[name]}</svg>;
}

// ---------- Avatar, stage chip ----------
/** Initials on a soft tint picked from the name, so the same person always looks the same. */
/** The example business: links to real files have nothing behind them. */
export const inDemo = () => { try { return sessionStorage.getItem("cinder-demo") === "1"; } catch { return false; } };

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" | "xl" }) {
  let h = 0; for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const t = AV_TINTS[h % AV_TINTS.length];
  return <span className={"av" + (size ? " " + size : "")} aria-hidden="true" style={{ background: t[0], color: t[1], borderColor: "transparent" }}>{initials(name)}</span>;
}
const AV_TINTS = [["#eef0f3", "#505967"]];
export function StageChip({ stage, small, text }: { stage: Stage | "late"; small?: boolean; text?: string }) {
  return <span className={`stage ${stage}${small ? " sm" : ""}`}><i />{text ?? (stage === "late" ? "Late" : STAGE_LABEL[stage])}</span>;
}

// ---------- Toast ----------
export function useToast() {
  const [t, setT] = useState<{ text: string; bad?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, bad = false) => { setT({ text, bad }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 3400); }, []);
  const node = t ? <div className={"toast" + (t.bad ? " bad" : "")} role="status"><Icon name="check" size={15} />{t.text}</div> : null;
  return { show, node };
}

// ---------- Sheet: a dialog from the bottom on a phone, centred on a desk ----------
export function Sheet({ title, sub, avatar, onClose, children, foot, wide }: { title: React.ReactNode; sub?: React.ReactNode; avatar?: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k); const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return <div className="scrim" onClick={onClose}>
    <div className="sheet" role="dialog" aria-modal="true" style={wide ? { maxWidth: 720 } : undefined} onClick={e => e.stopPropagation()}>
      <div className="hd">
        <div className="who">{avatar !== undefined && <Avatar name={avatar} size="lg" />}<span style={{ minWidth: 0 }}><b>{title}</b>{sub && <small>{sub}</small>}</span></div>
        <button type="button" className="btn ghost ic" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <div className="bd">{children}</div>
      {foot && <div className="ft">{foot}</div>}
    </div>
  </div>;
}

// ---------- A popover menu anchored to a chip ----------
export function Menu<T extends string>({ label, value, options, onPick, icon }: { label: string; value: T; options: readonly { key: T; label: string; count?: number }[]; onPick: (k: T) => void; icon?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("mousedown", h); return () => removeEventListener("mousedown", h); }, [open]);
  const cur = options.find(o => o.key === value);
  return <div ref={ref} style={{ position: "relative" }}>
    <button type="button" className={"chip" + (cur && options[0] && cur.key !== options[0].key ? " on" : "")} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      {icon && <Icon name={icon} size={14} />}{label} <b>{cur?.label ?? "Any"}</b><Icon name="down" size={14} /></button>
    {open && <div className="menu" role="listbox" style={{ top: "calc(100% + 6px)", left: 0 }}>
      {options.map(o => <button key={o.key} type="button" role="option" aria-selected={o.key === value} className={o.key === value ? "on" : ""} onClick={() => { onPick(o.key); setOpen(false); }}>
        {o.key === value ? <Icon name="check" size={14} /> : <span style={{ width: 14 }} />}{o.label}{o.count != null && <em>{o.count}</em>}</button>)}
    </div>}
  </div>;
}

export function Empty({ icon, title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty" style={{ paddingLeft: 16, paddingRight: 16 }}>{icon && <span className="ic"><Icon name={icon} size={18} /></span>}<b>{title}</b>{text && <p>{text}</p>}{action && <div style={{ marginTop: 10 }}>{action}</div>}</div>;
}

/** A button that asks once: first tap arms it, second tap does it. Disarms after four seconds. */
export function useArm() {
  const [arm, setArm] = useState("");
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(""), 4000); return () => clearTimeout(t); }, [arm]);
  return [arm, setArm] as const;
}

export function Spinner() { return <span className="spin" aria-label="Working" />; }
