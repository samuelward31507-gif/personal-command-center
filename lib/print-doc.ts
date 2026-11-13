// Print-ready HTML for the proposal and the agreement: the same look as the PDFs Cinder sends.
// Pure (no imports) so it can run in the browser and in node tests.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline Markdown: links (https only), bold, italics. Input is escaped first. */
function inline(s: string): string {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
}

/** The Markdown the proposal and agreement use: headings, paragraphs, lists, tables, rules. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { const n = Math.min(h[1].length, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^\s*\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(`<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const ul = /^\s*[-*]\s+/, ol = /^\s*\d+[.)]\s+/;
    if (ul.test(l) || ol.test(l)) {
      const tag = ol.test(l) ? "ol" : "ul", re = tag === "ol" ? ol : ul;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(re, ""))}</li>`); i++; }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*[-*]\s|\s*\d+[.)]\s|\s*---\s*$)/.test(lines[i])) { para.push(inline(lines[i].trim())); i++; }
    out.push(`<p>${para.join("<br>")}</p>`);
  }
  return out.join("\n");
}

const LOGO = `<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#121417"/><path d="M16 7c1.6 3.2 5.5 5.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.4 1.2-3.8 2.4-5 .2 1.7 1 2.8 2.1 3.2C14.4 12.4 15 9.6 16 7z" fill="#f2b33d"/></svg>`;

/** A full, self-printing page: letterhead, the document, and a footer on every printed page. */
export function printPage(o: { title: string; kind: string; business: string; md: string; autoPrint?: boolean }): string {
  const body = markdownToHtml(o.md);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(o.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet">
<style>
@page{size:letter;margin:.8in .85in .9in}
*{box-sizing:border-box}
html{background:#efeeeb}
body{margin:0;font:10.5pt/1.6 Inter,-apple-system,"Segoe UI",sans-serif;color:#1d2024;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:7in;margin:40px auto;background:#fff;padding:.8in .85in;box-shadow:0 1px 2px rgba(0,0,0,.06),0 8px 28px rgba(0,0,0,.06)}
.lh{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid #e4e2dd;margin-bottom:30px}
.lh b{display:flex;align-items:center;gap:9px;font-weight:600;font-size:10.5pt;letter-spacing:-.01em}
.lh span{color:#7a7f87;font-size:9pt}
h1{font:600 26pt/1.15 Newsreader,Georgia,serif;letter-spacing:-.015em;margin:0 0 6px}
h1+p{color:#5d636b;margin:0 0 26px}
h2{font:600 14.5pt/1.3 Newsreader,Georgia,serif;margin:28px 0 8px;padding-top:4px;break-after:avoid}
h3{font-weight:600;font-size:10.5pt;margin:20px 0 6px;break-after:avoid}
h4{font-weight:600;font-size:10pt;margin:16px 0 4px}
p{margin:0 0 10px}
ul,ol{margin:0 0 12px;padding-left:20px}li{margin:3px 0;padding-left:2px}li::marker{color:#9a9fa6}
strong{font-weight:600;color:#121417}
a{color:#121417;font-weight:600;text-decoration:underline;text-decoration-color:#f2b33d;text-decoration-thickness:2px;text-underline-offset:3px}
table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:10pt;break-inside:avoid}
th{text-align:left;font-weight:500;color:#7a7f87;font-size:8.5pt;border-bottom:1px solid #d9d6d0;padding:6px 10px 6px 0}
td{border-bottom:1px solid #eeece8;padding:9px 10px 9px 0;vertical-align:top}
hr{border:0;border-top:1px solid #e4e2dd;margin:24px 0}
.ft{margin-top:36px;padding-top:12px;border-top:1px solid #e4e2dd;color:#9a9fa6;font-size:8.5pt;display:flex;justify-content:space-between}
@media print{html{background:#fff}.sheet{margin:0;padding:0;box-shadow:none;max-width:none}}
</style></head><body><div class="sheet">
<div class="lh"><b>${LOGO}${esc(o.business)}</b><span>${esc(o.kind)}</span></div>
${body}
<div class="ft"><span>${esc(o.business)}</span><span>${esc(o.kind)} · Confidential</span></div>
</div>${o.autoPrint ? `<script>document.fonts.ready.then(()=>setTimeout(()=>print(),150))</script>` : ""}</body></html>`;
}
