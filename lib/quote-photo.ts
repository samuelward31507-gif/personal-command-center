// Where a quote line's photo comes from: the owner's own job photo (through the quote's private link on the customer's
// page, or the signed-in photo route in the app), a photo just added in the demo (a data: URL), or one of the demo's
// drawn samples ("demo:cedar"). The samples are drawings, plainly not photos of real jobs.

type Look = { bg: string; ground: string; draw: (w: number, h: number) => string };

const posts = (n: number, w: number, top: number, bottom: number, fill: string, cap = false) =>
  Array.from({ length: n }, (_, i) => { const x = 28 + i * ((w - 56) / (n - 1));
    return `<rect x="${x - 7}" y="${top - 6}" width="14" height="${bottom - top + 6}" rx="2" fill="${fill}"/>${cap ? `<rect x="${x - 10}" y="${top - 12}" width="20" height="8" rx="2" fill="${fill}"/>` : ""}`; }).join("");

const pickets = (w: number, top: number, bottom: number, colors: string[], width = 13, gap = 1.5) => {
  let out = "", x = 24, i = 0;
  while (x < w - 24) { out += `<rect x="${x}" y="${top + (i % 3 === 1 ? 2 : 0)}" width="${width}" height="${bottom - top}" fill="${colors[i % colors.length]}"/>`; x += width + gap; i++; }
  return out;
};

const LOOKS: Record<string, Look> = {
  cedar: { bg: "#eef1f4", ground: "#9fb486", draw: (w, h) => pickets(w, 70, h - 46, ["#b07a4f", "#a86f45", "#ba8558"]) + `<rect x="20" y="96" width="${w - 40}" height="6" fill="#8d5b36" opacity=".55"/><rect x="20" y="${h - 90}" width="${w - 40}" height="6" fill="#8d5b36" opacity=".55"/>` },
  pine: { bg: "#eef1f4", ground: "#9fb486", draw: (w, h) => pickets(w, 74, h - 46, ["#d9b27c", "#d3aa72", "#ddb985"]) },
  "cedar-cap": { bg: "#eef1f4", ground: "#9fb486", draw: (w, h) => pickets(w, 78, h - 46, ["#b07a4f", "#a86f45", "#ba8558"]) + `<rect x="18" y="66" width="${w - 36}" height="10" rx="2" fill="#8d5b36"/><rect x="18" y="80" width="${w - 36}" height="4" fill="#7a4d2c"/>` },
  "vinyl-white": { bg: "#e9eef3", ground: "#9fb486", draw: (w, h) => `<rect x="24" y="72" width="${w - 48}" height="${h - 118}" fill="#fbfbfa" stroke="#d6d9dd"/>` + posts(5, w, 66, h - 46, "#f4f4f2", true).replace(/fill="#f4f4f2"/g, 'fill="#f4f4f2" stroke="#cfd3d8"') },
  "vinyl-lattice": { bg: "#e9eef3", ground: "#9fb486", draw: (w, h) => { let l = ""; for (let x = 24; x < w - 24; x += 14) l += `<line x1="${x}" y1="68" x2="${x + 22}" y2="96" stroke="#d6d9dd" stroke-width="3"/><line x1="${x + 22}" y1="68" x2="${x}" y2="96" stroke="#d6d9dd" stroke-width="3"/>`;
    return `<rect x="24" y="66" width="${w - 48}" height="32" fill="#fbfbfa"/>${l}<rect x="24" y="100" width="${w - 48}" height="${h - 146}" fill="#fbfbfa" stroke="#d6d9dd"/>` + posts(5, w, 60, h - 46, "#f4f4f2", true).replace(/fill="#f4f4f2"/g, 'fill="#f4f4f2" stroke="#cfd3d8"'); } },
  "vinyl-tan": { bg: "#e9eef3", ground: "#9fb486", draw: (w, h) => `<rect x="24" y="72" width="${w - 48}" height="${h - 118}" fill="#ddcaa6" stroke="#c4b08a"/>` + posts(5, w, 66, h - 46, "#d3bf98", true) },
  chain: { bg: "#eef1f4", ground: "#9fb486", draw: (w, h) => { let l = ""; for (let x = 10; x < w; x += 16) l += `<line x1="${x}" y1="80" x2="${x + (h - 126)}" y2="${h - 46}" stroke="#9aa1a8" stroke-width="1.6"/><line x1="${x}" y1="80" x2="${x - (h - 126)}" y2="${h - 46}" stroke="#9aa1a8" stroke-width="1.6"/>`;
    return `<clipPath id="ch"><rect x="24" y="80" width="${w - 48}" height="${h - 126}"/></clipPath><g clip-path="url(#ch)">${l}</g><rect x="20" y="76" width="${w - 40}" height="5" rx="2" fill="#8b9198"/>` + posts(5, w, 76, h - 46, "#7d838a"); } },
  ranch: { bg: "#eef1f4", ground: "#a7bd8a", draw: (w, h) => [110, 150, 190].map(y => `<rect x="18" y="${y}" width="${w - 36}" height="11" rx="2" fill="#6f4a2e"/>`).join("") + posts(5, w, 96, h - 46, "#5c3c24") },
  horizontal: { bg: "#eef1f4", ground: "#9fb486", draw: (w, h) => Array.from({ length: 13 }, (_, i) => `<rect x="24" y="${70 + i * 14}" width="${w - 48}" height="12" fill="${["#a86f45", "#b07a4f", "#9c6740"][i % 3]}"/>`).join("") + posts(4, w, 66, h - 46, "#3a3f45") },
};

/** One drawn sample, as a data URL. */
export function sampleFence(slug: string): string {
  const look = LOOKS[slug] ?? LOOKS.cedar, w = 480, h = 300;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${look.bg}"/><rect y="${h - 50}" width="${w}" height="50" fill="${look.ground}"/>${look.draw(w, h)}<text x="${w - 14}" y="${h - 16}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="12" fill="#ffffff" opacity=".9">Sample</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/** The src for a quote line's photo: on the customer's page pass their quote token, in the app leave it out. */
export function quotePhotoSrc(photo: string | undefined, token?: string): string {
  if (!photo) return "";
  if (photo.startsWith("data:")) return photo;
  if (photo.startsWith("demo:")) return sampleFence(photo.slice(5));
  return token ? `/api/q?token=${encodeURIComponent(token)}&photo=${photo}` : `/api/app/photo?id=${photo}`;
}
