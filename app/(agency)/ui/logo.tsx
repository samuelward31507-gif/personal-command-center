"use client";

import { useState } from "react";

/** The domain behind a website field, or "" if there isn't a usable one. */
export function domainOf(website?: string | null): string {
  const w = (website || "").trim();
  if (!w) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : "https://" + w);
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    return h.includes(".") && !/(facebook|instagram|linkedin|google|yelp|angi|homeadvisor|thumbtack|nextdoor)\./.test(h) ? h : "";
  } catch { return ""; }
}

const TONES = 6;
export const toneOf = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % TONES; };
export const initialsOf = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

/**
 * A company's logo, from its website's icon. Falls back to a tinted monogram when there is no website,
 * the icon is missing, or it's only the generic placeholder (very small images).
 */
export function Logo({ name, website, size = 28 }: { name: string; website?: string | null; size?: number }) {
  const domain = domainOf(website);
  const [failed, setFailed] = useState(false);
  const label = name || domain || "?";
  const style = { width: size, height: size, flexBasis: size, fontSize: Math.round(size * 0.36) };
  if (domain && !failed) {
    return <span className="lg-logo" style={style} aria-hidden="true">
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onLoad={e => { if ((e.currentTarget.naturalWidth || 0) <= 16) setFailed(true); }} onError={() => setFailed(true)} />
    </span>;
  }
  return <span className="lg-mono" data-tone={toneOf(label)} style={style} aria-hidden="true">{initialsOf(label)}</span>;
}

/** Soft, color-coded status pill, like a CRM select option. The color follows the word, so it's stable everywhere. */
const STATUS_TONE: Record<string, string> = {
  lead: "blue", new: "blue", "new prospect": "blue", prospect: "violet", qualified: "violet", contacted: "sky",
  interested: "amber", "meeting booked": "amber", "demo / call held": "orange", "meeting held": "orange", proposal: "orange", negotiation: "pink",
  customer: "green", client: "green", won: "green", active: "green", live: "green",
  lost: "grey", "not interested": "grey", "not a fit": "grey", "do not contact": "red", churned: "red", "at risk": "red", nurture: "teal", paused: "grey",
};
export function toneForStatus(status: string): string {
  return STATUS_TONE[(status || "").trim().toLowerCase()] || "grey";
}
export function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className="lg-pill" data-tone={tone}>{children}</span>;
}
