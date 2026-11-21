// The Cinder logo for the client side: "Cinder" with the tip of the C broken off, and the C on its own as the small
// mark. Same paths as the website and Sam's CRM (lib/cinder-logo.ts). One colour: it takes the current text colour.
import { useId } from "react";
import { ICON_C_TRANSFORM, LOGO_BODY_CLIP, LOGO_BODY_CLIP_SMALL, LOGO_C, LOGO_REST, LOGO_REST_X, LOGO_TIP_CLIP, LOGO_TIP_CLIP_SMALL, LOGO_TIP_SHIFT, LOGO_TIP_SHIFT_SMALL, LOGO_VIEWBOX } from "@/lib/cinder-logo";

export function Wordmark({ className, title = "Cinder", small = false }: { className?: string; title?: string; small?: boolean }) {
  const id = "w" + useId().replace(/:/g, "");
  return <svg viewBox={LOGO_VIEWBOX} className={className} role="img" aria-label={title}>
    <defs><clipPath id={id + "b"}><polygon points={small ? LOGO_BODY_CLIP_SMALL : LOGO_BODY_CLIP} /></clipPath><clipPath id={id + "t"}><polygon points={small ? LOGO_TIP_CLIP_SMALL : LOGO_TIP_CLIP} /></clipPath></defs>
    <g fill="currentColor">
      <path clipPath={`url(#${id}b)`} d={LOGO_C} />
      <g transform={`translate(${small ? LOGO_TIP_SHIFT_SMALL : LOGO_TIP_SHIFT})`}><path clipPath={`url(#${id}t)`} d={LOGO_C} /></g>
      <path transform={`translate(${LOGO_REST_X} 0)`} d={LOGO_REST} />
    </g>
  </svg>;
}

/** The broken C on its own. */
export function Mark({ className }: { className?: string }) {
  const id = "m" + useId().replace(/:/g, "");
  return <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <defs><clipPath id={id + "b"}><polygon points={LOGO_BODY_CLIP_SMALL} /></clipPath><clipPath id={id + "t"}><polygon points={LOGO_TIP_CLIP_SMALL} /></clipPath></defs>
    <g transform={ICON_C_TRANSFORM} fill="currentColor">
      <path clipPath={`url(#${id}b)`} d={LOGO_C} />
      <g transform={`translate(${LOGO_TIP_SHIFT_SMALL})`}><path clipPath={`url(#${id}t)`} d={LOGO_C} /></g>
    </g>
  </svg>;
}

/** The Cinder app icon: the white C on the Cinder orange tile. */
export function AppIcon({ className }: { className?: string }) {
  return <span className={className} style={{ display: "inline-grid", placeItems: "center", background: "#F2431D", color: "#fff", borderRadius: "28%" }} aria-hidden="true"><Mark className="ai-c" /></span>;
}
