"use client";

// Where a lead came from, as a small mark on every row, and the value chips whose colors mean one thing everywhere:
// green booked, paid or won; amber waiting; red overdue or lost; grey neutral; blue, violet and teal for categories.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./parts";
import { sourceLabel } from "./types";

export type Tone = "grey" | "blue" | "sky" | "violet" | "pink" | "red" | "orange" | "amber" | "green" | "teal";
/** A stage: a 6px dot in the grey ramp and the word. Darker as the job gets closer to paid. */
export const Stg = ({ stage, children }: { stage: string; children: React.ReactNode }) => <span className={"stg " + stage}><i aria-hidden="true" />{children}</span>;
export const Chip = ({ tone = "grey", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) => <span className={"vc " + tone} title={title}>{children}</span>;

const MARKS: Record<string, { t: string; tone: Tone; icon?: string }> = {
  google: { t: "G", tone: "blue" }, angi: { t: "An", tone: "red" }, thumbtack: { t: "Tt", tone: "sky" }, facebook: { t: "f", tone: "blue" }, yelp: { t: "Y", tone: "red" },
  nextdoor: { t: "N", tone: "green" }, homeadvisor: { t: "HA", tone: "orange" }, referral: { t: "R", tone: "violet" }, "web form": { t: "W", tone: "teal" }, "web chat": { t: "", tone: "teal", icon: "chat" },
  "booking page": { t: "", tone: "violet", icon: "cal" }, missed_call: { t: "", tone: "amber", icon: "phone" }, text: { t: "", tone: "grey", icon: "chat" }, owner: { t: "", tone: "grey", icon: "user" },
  import: { t: "", tone: "grey", icon: "upload" }, zapier: { t: "Z", tone: "orange" }, rehash: { t: "", tone: "pink", icon: "bolt" }, quote: { t: "Q", tone: "grey" }, review: { t: "", tone: "amber", icon: "star" },
};
/** The source's mark: a letter or an icon on its tone, with the source's name for screen readers and on hover. */
export function SourceMark({ source, size = 22 }: { source: string; size?: number }) {
  const m = MARKS[source] ?? { t: (sourceLabel(source)[0] ?? "?").toUpperCase(), tone: "grey" as Tone };
  return <span className={"srcm " + m.tone} style={{ width: size, height: size }} title={sourceLabel(source)} aria-label={sourceLabel(source)} role="img">{m.icon ? <Icon name={m.icon} size={Math.round(size * 0.55)} /> : m.t}</span>;
}
export const secText = (s: number | null | undefined) => s == null ? "" : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;

/** A figure that counts up once, the first time it's shown. Nothing moves for people who asked for less motion. */
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString("en-US"), ms = 900 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const still = () => typeof matchMedia === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(() => still() ? value : 0), [done, setDone] = useState(() => still()), ran = useRef(false);
  useEffect(() => {
    if (ran.current || done) return; ran.current = true;
    const t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); setShown(value * e); if (p < 1) raf = requestAnimationFrame(step); else setDone(true); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value, ms, done]);
  return <>{format(done ? value : shown)}</>;
}

/** The 14px grey line icon that sits before a column header or a record field. */
export const FieldIcon = ({ name }: { name: string }) => <span className="fi" aria-hidden="true"><Icon name={name} size={14} /></span>;
const FIELD_ICON: Record<string, string> = { Length: "ruler", Material: "jobs", Height: "ruler", Gates: "jobs", HOA: "users", Address: "pin", Source: "link", "Job value": "dollar", Estimate: "cal", Install: "cal", Vehicle: "car", Service: "jobs", Rooms: "home", Job: "jobs", Size: "ruler" };
export const fieldIconFor = (label: string) => FIELD_ICON[label] ?? "edit";
