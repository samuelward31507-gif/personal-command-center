// The Cinder brand: "Cinder" in Instrument Sans with the tip of the C broken off (lib/cinder-logo.ts),
// the C on its own as the small mark, and the ember on its own. The logo is always one colour.
import { useId } from "react";
import { usePublicBrand } from "./use-workspace";
import { ICON_C_TRANSFORM, LOGO_BODY_CLIP, LOGO_BODY_CLIP_SMALL, LOGO_C, LOGO_REST, LOGO_REST_X, LOGO_TIP_CLIP, LOGO_TIP_CLIP_SMALL, LOGO_TIP_SHIFT, LOGO_TIP_SHIFT_SMALL, LOGO_VIEWBOX } from "@/lib/cinder-logo";

export const CINDER_ON_NIGHT = "#ededed";
export const CINDER_EMBER_ON_NIGHT = "#F2431D";
/** In-app ink for the wordmark letters. The ember always keeps its colour. */
export const CINDER_MONO = "currentColor";


/** Small mark: the broken C on its own. `ring` colours it; `ember` is accepted for older callers and ignored (one colour). */
export function CinderMark({ className, ring = CINDER_ON_NIGHT, title }: { className?: string; ring?: string; ember?: string; title?: string }) {
  const id = "cm" + useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs><clipPath id={id + "b"}><polygon points={LOGO_BODY_CLIP_SMALL} /></clipPath><clipPath id={id + "t"}><polygon points={LOGO_TIP_CLIP_SMALL} /></clipPath></defs>
      <g transform={ICON_C_TRANSFORM} fill={ring}>
        <path clipPath={`url(#${id}b)`} d={LOGO_C} />
        <g transform={`translate(${LOGO_TIP_SHIFT_SMALL})`}><path clipPath={`url(#${id}t)`} d={LOGO_C} /></g>
      </g>
    </svg>
  );
}

/** The ember on its own (next to the greeting, loading states). Flat, one colour, like the logo. */
export function CinderEmber({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="#F2431D" />
    </svg>
  );
}

/** The wordmark, height-driven. `mono` takes the text colour; `ink` sets it outright; `small` widens the break for sizes under ~24px. */
export function CinderLogo({ className, title = "Cinder", mono = false, ink, small = false }: { className?: string; title?: string; mono?: boolean; ink?: string; small?: boolean }) {
  const id = "cw" + useId().replace(/:/g, "");
  const fill = ink ?? (mono ? CINDER_MONO : CINDER_ON_NIGHT);
  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} role="img" aria-label={title}>
      <defs><clipPath id={id + "b"}><polygon points={small ? LOGO_BODY_CLIP_SMALL : LOGO_BODY_CLIP} /></clipPath><clipPath id={id + "t"}><polygon points={small ? LOGO_TIP_CLIP_SMALL : LOGO_TIP_CLIP} /></clipPath></defs>
      <g fill={fill}>
        <path clipPath={`url(#${id}b)`} d={LOGO_C} />
        <g transform={`translate(${small ? LOGO_TIP_SHIFT_SMALL : LOGO_TIP_SHIFT})`}><path clipPath={`url(#${id}t)`} d={LOGO_C} /></g>
        <path transform={`translate(${LOGO_REST_X} 0)`} d={LOGO_REST} />
      </g>
    </svg>
  );
}

/** A workspace's own wordmark: their logo image, or their name set in the display face. Cinder when not white-labelled. */
export function BrandWordmark({ name, logoUrl, className, mono = false, ink, fallbackTitle, small = false }: { name: string; logoUrl?: string; className?: string; mono?: boolean; ink?: string; fallbackTitle?: string; small?: boolean }) {
  const custom = !!logoUrl || !/^cinder\b/i.test(name.trim());
  if (!custom) return <CinderLogo className={className} title={fallbackTitle ?? name} mono={mono} ink={ink} small={small} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (logoUrl) return <img src={logoUrl} alt={name} className={className} style={{ width: "auto", objectFit: "contain" }} />;
  return <span className={className} role="img" aria-label={name} style={{ display: "inline-flex", alignItems: "center", width: "auto", fontFamily: "var(--font-display), var(--font-geist-sans), sans-serif", fontStretch: "118%", fontVariationSettings: '"wdth" 118', fontWeight: 650, letterSpacing: "-0.01em", whiteSpace: "nowrap", color: ink ?? (mono ? CINDER_MONO : CINDER_ON_NIGHT), fontSize: "1.1em", lineHeight: 1 }}>{name}</span>;
}

/** Drop-in for CinderLogo on public pages: shows the workspace's own brand when it has one. */
export function BrandLogo({ className, title, mono = false, ink }: { className?: string; title?: string; mono?: boolean; ink?: string }) {
  const b = usePublicBrand();
  return <BrandWordmark name={b.businessName} logoUrl={b.logoUrl} className={className} mono={mono} ink={ink} fallbackTitle={title} />;
}
