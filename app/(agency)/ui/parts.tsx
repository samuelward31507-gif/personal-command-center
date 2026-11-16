"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { domainOf, initialsOf, Logo, toneOf } from "./logo";

/** A person: a circle, initials in a tone fixed by their name. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const label = name || "?";
  return <span className="pt-av" data-tone={toneOf(label)} style={{ width: size, height: size, flexBasis: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">{initialsOf(label)}</span>;
}

/** A website as a small blue chip that opens it. */
export function DomainChip({ website }: { website?: string | null }) {
  const d = domainOf(website);
  if (!d) return null;
  return <a className="pt-domain" href={"https://" + d} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{d}</a>;
}

/** Marks a value Cinder wrote rather than you. The title says what it was based on. */
export function AiMark({ basis }: { basis?: string }) {
  return <span className="pt-ai" title={basis ? `Written by Cinder from ${basis}` : "Written by Cinder"} aria-label="Written by Cinder">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /></svg>AI
  </span>;
}

/** One sentence at the top of a record saying what to do next. */
export function Nudge({ children, action, onAction, tone = "plain" }: { children: ReactNode; action?: string; onAction?: () => void; tone?: "plain" | "warn" }) {
  return <div className={"pt-nudge" + (tone === "warn" ? " is-warn" : "")} role="note">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    <span>{children}</span>
    {action && onAction && <button type="button" className="pt-nudge-btn" onClick={onAction}>{action}</button>}
  </div>;
}

/** A drafted message waiting for a yes: who, what it says, and the three choices. */
export function DraftCard({ name, website, why, body, onSend, onSkip, href, sendLabel = "Send", active }: {
  name: string; website?: string; why: string; body?: string; onSend: () => void; onSkip?: () => void; href?: string; sendLabel?: string; active?: boolean;
}) {
  return <div className={"pt-draft" + (active ? " is-active" : "")}>
    <LogoOrAvatar name={name} website={website} size={28} />
    <div className="pt-draft-main">
      <div className="pt-draft-top">{href ? <Link href={href} className="pt-draft-who">{name}</Link> : <b className="pt-draft-who">{name}</b>}<span className="pt-draft-why">{why}</span></div>
      {body && <p className="pt-draft-body">{body}</p>}
    </div>
    <div className="pt-draft-acts">
      {onSkip && <button type="button" className="u-btn u-btn-bare" onClick={onSkip}>Skip</button>}
      <button type="button" className="u-btn u-btn-light" onClick={onSend}>{sendLabel}{active && <kbd>↵</kbd>}</button>
    </div>
  </div>;
}

/** Companies get their logo; people get a circle. */
export function LogoOrAvatar({ name, website, size = 24, person }: { name: string; website?: string | null; size?: number; person?: boolean }) {
  return person ? <Avatar name={name} size={size} /> : <Logo name={name} website={website} size={size} />;
}

/* ---------- Favorites: pinned records in the sidebar. Kept per browser, so no table is needed yet. ---------- */
export type Fav = { id: string; name: string; website?: string; href: string };
const FAV_KEY = "cinder.favorites.v1";
const readFavs = (): Fav[] => { try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(v) ? v.slice(0, 12) : []; } catch { return []; } };
export function useFavorites() {
  const [favs, setFavs] = useState<Fav[]>([]);
  useEffect(() => {
    setFavs(readFavs());
    const on = () => setFavs(readFavs());
    window.addEventListener("cinder:favorites", on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener("cinder:favorites", on); window.removeEventListener("storage", on); };
  }, []);
  const toggle = (f: Fav) => {
    const cur = readFavs();
    const next = cur.some(x => x.id === f.id) ? cur.filter(x => x.id !== f.id) : [...cur, f].slice(0, 12);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    setFavs(next);
    window.dispatchEvent(new Event("cinder:favorites"));
  };
  return { favs, toggle, has: (id: string) => favs.some(f => f.id === id) };
}

export function FavButton({ fav }: { fav: Fav }) {
  const { has, toggle } = useFavorites();
  const on = has(fav.id);
  return <button type="button" className={"pt-fav" + (on ? " is-on" : "")} aria-pressed={on} aria-label={on ? "Remove from favorites" : "Add to favorites"} title={on ? "Remove from favorites" : "Add to favorites"} onClick={() => toggle(fav)}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" /></svg>
  </button>;
}

/** Days between now and a date, as "today", "1 day", "9 days". */
export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
