// The Cinder logo (slash C, r11): mark only, a heavy geometric C cut by one long blade-shaped slash.
// Paths are copied verbatim from the logo kit (mark.svg, mark-small.svg); never redraw or restyle them.
// Rules (LOGO-USAGE.md): master at 64px and up, the small variant at 48px and below, nothing under 16px;
// ink #1c1d1f on light, #f5f5f3 on dark; clear space 25% of the mark's height; no tile, outline, glow or gradient.
export const MARK_INK = "#1c1d1f";
export const MARK_ON_DARK = "#f5f5f3";
export const MARK_VIEWBOX = "151.04 168.00 791.63 703.15";
export const MARK_PATH = "M316.37,648.06 C291.89,602.83 278.00,551.04 278.00,496.00 C278.00,319.27 421.27,176.00 598.00,176.00 C663.18,176.00 723.81,195.49 774.38,228.95 L774.36,228.98 L751.94,267.81 C717.65,250.65 678.95,241.00 638.00,241.00 C497.17,241.00 383.00,355.17 383.00,496.00 C383.00,523.78 387.44,550.53 395.66,575.57 C367.10,600.45 340.63,624.68 316.37,648.06 Z M159.04,860.85 C223.30,733.17 510.90,463.12 932.74,211.64 L934.67,213.93 C589.39,509.53 325.03,744.41 160.96,863.15 Z M817.60,677.03 L764.25,769.43 L764.20,769.51 C715.76,799.01 658.86,816.00 598.00,816.00 C507.95,816.00 426.59,778.80 368.44,718.94 C391.88,699.72 416.19,679.51 441.35,658.35 C488.13,714.94 558.85,751.00 638.00,751.00 C708.05,751.00 771.51,722.75 817.60,677.03 Z";
export const MARK_SMALL_VIEWBOX = "220.36 168.00 671.10 656.00";
export const MARK_SMALL_PATH = "M298.10,607.86 C285.10,573.04 278.00,535.35 278.00,496.00 C278.00,319.27 421.27,176.00 598.00,176.00 C663.18,176.00 723.81,195.49 774.38,228.95 L774.36,228.98 L745.33,279.26 C736.00,284.06 726.77,288.89 717.65,293.74 C689.71,281.06 658.68,274.00 626.00,274.00 C503.39,274.00 404.00,373.39 404.00,496.00 C404.00,498.40 404.04,500.79 404.11,503.17 C362.90,538.59 327.51,573.72 298.10,607.86 Z M228.36,785.51 C257.66,652.57 490.20,426.12 864.18,252.00 L883.46,274.98 C598.63,516.59 384.45,713.28 247.64,808.49 Z M818.29,607.02 L848.08,624.22 L764.25,769.43 L764.20,769.51 C715.76,799.01 658.86,816.00 598.00,816.00 C517.94,816.00 444.74,786.60 388.62,738.00 C417.82,715.23 448.38,690.40 480.41,663.59 C519.38,697.48 570.30,718.00 626.00,718.00 C708.16,718.00 779.90,673.36 818.29,607.02 Z";
/** Square frame around the small mark (the favicon's), for icons that need a 1:1 box. */
export const MARK_SMALL_SQUARE_VIEWBOX = "215.26 155.35 681.30 681.30";

/** The mark as an SVG string, for HTML that can't use React (printed documents, emails). Small variant at 48px and below. */
export function markSvg(height: number, color: string = MARK_INK, label = "Cinder"): string {
  const small = height <= 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${small ? MARK_SMALL_VIEWBOX : MARK_VIEWBOX}" height="${height}" style="height:${height}px;width:auto;display:block" role="img" aria-label="${label}"><path d="${small ? MARK_SMALL_PATH : MARK_PATH}" fill="${color}"/></svg>`;
}
