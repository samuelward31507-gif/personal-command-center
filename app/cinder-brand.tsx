// The Cinder mark and wordmark, from the Cinder website's brand artwork (night tones).
import { CINDER_MARK_EMBER, CINDER_MARK_RING, CINDER_MARK_VIEWBOX, CINDER_WORDMARK, CINDER_WORDMARK_WIDTH } from "@/lib/cinder-brand-paths";

export const CINDER_ON_NIGHT = "#f2f0ea";
export const CINDER_EMBER_ON_NIGHT = "#e58c63";

/** The "C" whose stroke swells as it turns, led by a small ember. */
export function CinderMark({ className, ring = CINDER_ON_NIGHT, ember = CINDER_EMBER_ON_NIGHT, title }: { className?: string; ring?: string; ember?: string; title?: string }) {
  return (
    <svg viewBox={CINDER_MARK_VIEWBOX} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path fill={ring} d={CINDER_MARK_RING} />
      <path fill={ember} d={CINDER_MARK_EMBER} />
    </svg>
  );
}

/** Mark + CINDER wordmark, height-driven. */
export function CinderLogo({ className, title = "Cinder" }: { className?: string; title?: string }) {
  const width = 56 + CINDER_WORDMARK_WIDTH + 1;
  return (
    <svg viewBox={`0 0 ${width} 48`} className={className} role="img" aria-label={title}>
      <path fill={CINDER_ON_NIGHT} d={CINDER_MARK_RING} />
      <path fill={CINDER_EMBER_ON_NIGHT} d={CINDER_MARK_EMBER} />
      <path fill={CINDER_ON_NIGHT} transform="translate(56 14)" d={CINDER_WORDMARK} />
    </svg>
  );
}
