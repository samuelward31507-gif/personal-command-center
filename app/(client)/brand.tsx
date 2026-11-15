// The Cinder wordmark and mark for the client side, drawn from the shared paths. Letters take the current text colour
// so one component works on paper and on ink; the ember always keeps its glow.
import { useId } from "react";
import { EMBER_STOPS, MARK_EMBER, MARK_PATH, MARK_VIEWBOX, WORDMARK_EMBER, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/cinder-wordmark";

function Ember({ id }: { id: string }) {
  return <radialGradient id={id} cx="38%" cy="34%" r="70%">{EMBER_STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</radialGradient>;
}

export function Wordmark({ className, title = "Cinder" }: { className?: string; title?: string }) {
  const id = "w" + useId().replace(/:/g, "");
  return <svg viewBox={WORDMARK_VIEWBOX} className={className} role="img" aria-label={title}>
    <defs><Ember id={id} /></defs>
    <path fill="currentColor" d={WORDMARK_PATH} />
    <circle cx={WORDMARK_EMBER.cx} cy={WORDMARK_EMBER.cy} r={WORDMARK_EMBER.r} fill={`url(#${id})`} />
  </svg>;
}

export function Mark({ className }: { className?: string }) {
  const id = "m" + useId().replace(/:/g, "");
  return <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
    <defs><Ember id={id} /></defs>
    <path fill="currentColor" d={MARK_PATH} />
    <circle cx={MARK_EMBER.cx} cy={MARK_EMBER.cy} r={MARK_EMBER.r} fill={`url(#${id})`} />
  </svg>;
}

export function EmberDot({ className }: { className?: string }) {
  const id = "e" + useId().replace(/:/g, "");
  return <svg viewBox="0 0 64 64" className={className} aria-hidden="true"><defs><Ember id={id} /></defs><circle cx="32" cy="32" r="26" fill={`url(#${id})`} /></svg>;
}
