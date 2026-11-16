// The business's own look: its logo top left and its color as the one accent. The color must read on white (WCAG AA,
// 4.5:1 for text); when the owner's color doesn't, it's darkened step by step, keeping its hue, until it does.
export const hexOk = (v: unknown): string | null => { const s = String(v ?? "").trim().toLowerCase(); const m = s.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/); if (!m) return null; const h = m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1]; return "#" + h; };
export const rgbOf = (hex: string): [number, number, number] => { const h = hex.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]; };
const hexOf = (r: number, g: number, b: number) => "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export const luminance = (hex: string) => { const [r, g, b] = rgbOf(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
/** Contrast ratio of a color against white. */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);
/** The color, darkened as little as needed to reach 4.5:1 on white. */
export function readableAccent(hex: string, min = 4.5): string {
  let [r, g, b] = rgbOf(hex);
  for (let i = 0; i < 60 && contrastOnWhite(hexOf(r, g, b)) < min; i++) { r *= 0.94; g *= 0.94; b *= 0.94; }
  return hexOf(r, g, b);
}
/** The logo's color: the most common strong, not-too-light, not-too-dark color in its pixels (RGBA bytes). */
export function dominantColor(px: Uint8ClampedArray | number[]): string | null {
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), sat = max ? (max - min) / max : 0;
    if (sat < 0.25 || max < 40 || (max > 240 && sat < 0.35)) continue;
    const k = `${r >> 5},${g >> 5},${b >> 5}`, bin = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b; bins.set(k, bin);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  return top ? hexOf(top.r / top.n, top.g / top.n, top.b / top.n) : null;
}
/** A logo stored with the business: a small PNG, JPEG or WebP as a data URL. */
export const cleanLogo = (v: unknown): string => { const s = String(v ?? ""); return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 160_000 ? s : ""; };
