// The Cinder brand: the "cinder" wordmark (serif, with the ember as the dot of the i),
// the small mark (serif "c" with the ember), and the ember on its own.
import { useId } from "react";
import { usePublicBrand } from "./use-workspace";
import { EMBER_STOPS, MARK_EMBER, MARK_PATH, MARK_VIEWBOX, WORDMARK_EMBER, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/cinder-wordmark";

export const CINDER_ON_NIGHT = "#ededed";
export const CINDER_EMBER_ON_NIGHT = "#d97757";
/** In-app ink for the wordmark letters. The ember always keeps its colour. */
export const CINDER_MONO = "#ededed";

function EmberGradient({ id }: { id: string }) {
  return <radialGradient id={id} cx="38%" cy="34%" r="70%">{EMBER_STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</radialGradient>;
}

/** Small mark: the serif "c" with the ember. `ring` colours the c; `ember` overrides the ember (defaults to the glow). */
export function CinderMark({ className, ring = CINDER_ON_NIGHT, ember, title }: { className?: string; ring?: string; ember?: string; title?: string }) {
  const id = "cm" + useId().replace(/:/g, "");
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs><EmberGradient id={id} /></defs>
      <path fill={ring} d={MARK_PATH} />
      <circle cx={MARK_EMBER.cx} cy={MARK_EMBER.cy} r={MARK_EMBER.r} fill={ember && ember !== ring ? ember : `url(#${id})`} />
    </svg>
  );
}

/** The ember on its own (next to the greeting, loading states). */
export function CinderEmber({ className }: { className?: string }) {
  const id = "ce" + useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs><EmberGradient id={id} /></defs>
      <circle cx="32" cy="32" r="26" fill={`url(#${id})`} />
    </svg>
  );
}

/** The wordmark, height-driven. `mono` keeps the letters light on dark; `ink` sets them for light paper. */
export function CinderLogo({ className, title = "Cinder", mono = false, ink }: { className?: string; title?: string; mono?: boolean; ink?: string }) {
  const id = "cw" + useId().replace(/:/g, "");
  const fill = ink ?? (mono ? CINDER_MONO : CINDER_ON_NIGHT);
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} role="img" aria-label={title}>
      <defs><EmberGradient id={id} /></defs>
      <path fill={fill} d={WORDMARK_PATH} />
      <circle cx={WORDMARK_EMBER.cx} cy={WORDMARK_EMBER.cy} r={WORDMARK_EMBER.r} fill={`url(#${id})`} />
    </svg>
  );
}

/** A workspace's own wordmark: their logo image, or their name set in the display face. Cinder when not white-labelled. */
export function BrandWordmark({ name, logoUrl, className, mono = false, ink, fallbackTitle }: { name: string; logoUrl?: string; className?: string; mono?: boolean; ink?: string; fallbackTitle?: string }) {
  const custom = !!logoUrl || !/^cinder\b/i.test(name.trim());
  if (!custom) return <CinderLogo className={className} title={fallbackTitle ?? name} mono={mono} ink={ink} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (logoUrl) return <img src={logoUrl} alt={name} className={className} style={{ width: "auto", objectFit: "contain" }} />;
  return <span className={className} role="img" aria-label={name} style={{ display: "inline-flex", alignItems: "center", width: "auto", fontFamily: "var(--font-display), var(--font-geist-sans), sans-serif", fontStretch: "118%", fontVariationSettings: '"wdth" 118', fontWeight: 650, letterSpacing: "-0.01em", whiteSpace: "nowrap", color: ink ?? (mono ? CINDER_MONO : CINDER_ON_NIGHT), fontSize: "1.1em", lineHeight: 1 }}>{name}</span>;
}

/** Drop-in for CinderLogo on public pages: shows the workspace's own brand when it has one. */
export function BrandLogo({ className, title, mono = false, ink }: { className?: string; title?: string; mono?: boolean; ink?: string }) {
  const b = usePublicBrand();
  return <BrandWordmark name={b.businessName} logoUrl={b.logoUrl} className={className} mono={mono} ink={ink} fallbackTitle={title} />;
}
