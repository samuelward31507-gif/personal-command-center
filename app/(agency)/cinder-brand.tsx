// The Cinder brand: the slash-C mark (lib/cinder-mark.ts). Mark only, no wordmark, one colour:
// ink on light, #f5f5f3 on dark. The small variant is for 48px and below; the master for 64px and up.
import { usePublicBrand } from "./use-workspace";
import { MARK_INK, MARK_ON_DARK, MARK_PATH, MARK_SMALL_PATH, MARK_SMALL_VIEWBOX, MARK_VIEWBOX } from "@/lib/cinder-mark";

export const CINDER_ON_NIGHT = MARK_ON_DARK;
export const CINDER_EMBER_ON_NIGHT = "#F2431D";
/** The mark takes the surrounding text colour (set it to ink on light surfaces). */
export const CINDER_MONO = "currentColor";

/** The mark. `ring` is its colour; `ember` is accepted for older callers and ignored. `large` switches to the master (64px and up). */
export function CinderMark({ className, ring = MARK_INK, title, large = false }: { className?: string; ring?: string; ember?: string; title?: string; large?: boolean }) {
  return (
    <svg viewBox={large ? MARK_VIEWBOX : MARK_SMALL_VIEWBOX} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d={large ? MARK_PATH : MARK_SMALL_PATH} fill={ring} />
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

/** Cinder's logo where a wordmark used to be: the mark on its own (there is no wordmark). Height-driven. */
export function CinderLogo({ className, title = "Cinder", mono = false, ink, small = true }: { className?: string; title?: string; mono?: boolean; ink?: string; small?: boolean }) {
  return <CinderMark className={className} title={title} ring={ink ?? (mono ? CINDER_MONO : MARK_INK)} large={!small} />;
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
