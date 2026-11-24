// The Cinder logo for the client side: the slash-C mark (lib/cinder-mark.ts), mark only, one colour.
// The small variant is used here (every place is 48px or under). The client's own sidebar shows their
// business, not Cinder (white-label); Cinder's mark appears only on the sign-in and setup screens.
import { MARK_INK, MARK_SMALL_PATH, MARK_SMALL_VIEWBOX } from "@/lib/cinder-mark";

/** Where the wordmark used to be: the mark on its own (there is no wordmark). Height-driven, ink by default. */
export function Wordmark({ className, title = "Cinder" }: { className?: string; title?: string; small?: boolean }) {
  return <svg viewBox={MARK_SMALL_VIEWBOX} className={className} role="img" aria-label={title}><path d={MARK_SMALL_PATH} fill={MARK_INK} /></svg>;
}

/** The mark, decorative. */
export function Mark({ className }: { className?: string }) {
  return <svg viewBox={MARK_SMALL_VIEWBOX} className={className} aria-hidden="true"><path d={MARK_SMALL_PATH} fill={MARK_INK} /></svg>;
}
