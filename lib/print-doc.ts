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
      // A list straight under a heading whose every item opens in bold reads as cards (the guarantees).
      const cards = tag === "ul" && items.length >= 2 && items.length <= 4 && /^<h2[^>]*>Our guarantees|^<h2[^>]*>[^<]*guarantee/i.test(out[out.length - 1] ?? "") && items.every(x => x.startsWith("<li><strong>"));
      out.push(cards ? `<div class="cards">${items.map(x => x.replace(/^<li><strong>(.*?):?<\/strong>\s*(.)/, (_m, t, c) => `<div class="cd"><b>${t.replace(/\.$/, "")}</b><span>${c.toUpperCase()}`).replace(/<\/li>$/, "</span></div>")).join("")}</div>` : `<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*[-*]\s|\s*\d+[.)]\s|\s*---\s*$)/.test(lines[i])) { para.push(inline(lines[i].trim())); i++; }
    out.push(`<p>${para.join("<br>")}</p>`);
  }
  return out.join("\n");
}


// New logo (Nov 2026): "Cinder" with the tip of the C broken off. Kept in sync with lib/cinder-logo.ts; inlined so this file stays import-free.
const P_LOGO_VIEWBOX = "-20 -790 3185 820";
const P_LOGO_C = "M391 10Q317 10 254.5 -17.5Q192 -45 146 -94.5Q100 -144 75 -211.5Q50 -279 50 -360Q50 -441 75 -508.5Q100 -576 145.5 -625.5Q191 -675 253.5 -702.5Q316 -730 390 -730Q471 -730 535.5 -697Q600 -664 641.5 -604Q683 -544 693 -464H611Q599 -553 540.5 -604.5Q482 -656 391 -656Q314 -656 256 -618.5Q198 -581 166 -514.5Q134 -448 134 -360Q134 -272 166 -205.5Q198 -139 256 -101.5Q314 -64 390 -64Q483 -64 542.5 -116Q602 -168 613 -256H695Q685 -176 643.5 -116Q602 -56 537.5 -23Q473 10 391 10Z";
const P_LOGO_REST = "M80 0V-510H160V0ZM74 -626V-720H166V-626Z M308 0V-510H383V-390H388V0ZM673 0V-334Q673 -392 644 -421Q615 -450 558 -450Q508 -450 469.5 -428Q431 -406 409.5 -367Q388 -328 388 -276L375 -397Q401 -454 454.5 -487Q508 -520 576 -520Q656 -520 704.5 -474.5Q753 -429 753 -355V0Z M1266 0V-119L1276 -116Q1257 -58 1206.5 -24Q1156 10 1086 10Q1017 10 965.5 -23Q914 -56 885.5 -115Q857 -174 857 -253Q857 -333 886 -393Q915 -453 967 -486Q1019 -519 1089 -519Q1161 -519 1210 -484Q1259 -449 1277 -385L1261 -383V-720H1341V0ZM1101 -60Q1178 -60 1221.5 -112.5Q1265 -165 1265 -256Q1265 -345 1221 -397Q1177 -449 1101 -449Q1025 -449 982 -397Q939 -345 939 -253Q939 -163 982 -111.5Q1025 -60 1101 -60Z M1698 10Q1625 10 1569 -24.5Q1513 -59 1481 -119Q1449 -179 1449 -257Q1449 -335 1480.5 -394.5Q1512 -454 1569 -487Q1626 -520 1700 -520Q1771 -520 1823.5 -489Q1876 -458 1904.5 -402Q1933 -346 1933 -270Q1933 -260 1932.5 -251Q1932 -242 1930 -231H1509V-298H1881L1855 -261Q1855 -353 1814.5 -402.5Q1774 -452 1700 -452Q1624 -452 1577.5 -399.5Q1531 -347 1531 -258Q1531 -167 1577.5 -112.5Q1624 -58 1702 -58Q1751 -58 1788 -79.5Q1825 -101 1842 -141H1918Q1893 -71 1834.5 -30.5Q1776 10 1698 10Z M2041 0V-510H2116V-380H2121V0ZM2121 -266 2108 -387Q2126 -452 2172 -486Q2218 -520 2278 -520Q2303 -520 2312 -516V-439Q2307 -441 2298 -441.5Q2289 -442 2276 -442Q2200 -442 2160.5 -396.5Q2121 -351 2121 -266Z";
const P_LOGO_REST_X = 789.0;
const P_LOGO_BODY_CLIP = "372.5,-360.0 3343.4,-777.0 372.5,2640.0 -2627.5,-360.0 372.0,-3360.0 1962.3,-2904.1";
const P_LOGO_TIP_CLIP = "372.5,-360.0 2219.5,-2724.0 2970.6,-1860.0 3343.3,-777.5";
const P_LOGO_TIP_SHIFT = "16 -16";
const P_LOGO_BODY_CLIP_SMALL = "372.5,-360.0 3343.4,-777.0 372.5,2640.0 -2627.5,-360.0 372.0,-3360.0 1780.9,-3008.8";
const P_LOGO_TIP_CLIP_SMALL = "372.5,-360.0 2300.9,-2658.1 2970.6,-1860.0 3343.3,-777.5";
const P_LOGO_TIP_SHIFT_SMALL = "32 -32";

/** The wordmark as inline SVG, one colour. ink = letter colour. */
let n = 0;
export function wordmark(ink = "#121417", height = 24): string {
  const id = "cw" + (++n);
  const small = height < 28;
  return `<svg viewBox="${P_LOGO_VIEWBOX}" height="${height}" style="height:${height}px;width:auto;display:block" role="img" aria-label="Cinder Revenue Company"><defs><clipPath id="${id}b"><polygon points="${small ? P_LOGO_BODY_CLIP_SMALL : P_LOGO_BODY_CLIP}"/></clipPath><clipPath id="${id}t"><polygon points="${small ? P_LOGO_TIP_CLIP_SMALL : P_LOGO_TIP_CLIP}"/></clipPath></defs><g fill="${ink}"><path clip-path="url(#${id}b)" d="${P_LOGO_C}"/><g transform="translate(${small ? P_LOGO_TIP_SHIFT_SMALL : P_LOGO_TIP_SHIFT})"><path clip-path="url(#${id}t)" d="${P_LOGO_C}"/></g><path transform="translate(${P_LOGO_REST_X} 0)" d="${P_LOGO_REST}"/></g></svg>`;
}

/** A self-printing branded page: dark cover band with the wordmark, the document, and a footer. Same look as the PDFs Cinder sends. */
export function printPage(o: { title: string; kind: string; business: string; md: string; autoPrint?: boolean; docNo?: string }): string {
  // The first H1 and the line under it become the cover band.
  const lines = o.md.replace(/\r/g, "").split("\n");
  const h = lines.findIndex(l => /^#\s+/.test(l));
  let title = o.title, sub = "";
  if (h >= 0) {
    title = lines[h].replace(/^#\s+/, "");
    const next = lines.slice(h + 1).findIndex(l => l.trim());
    const ni = next >= 0 ? h + 1 + next : -1;
    if (ni > 0 && !/^(#|\s*[-*|]|\s*\d+[.)])/.test(lines[ni])) { sub = lines[ni]; lines.splice(ni, 1); }
    lines.splice(h, 1);
  }
  const body = markdownToHtml(lines.join("\n"));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:letter;margin:.7in .8in .8in}
*{box-sizing:border-box}
html{background:#e8eaee}
body{margin:0;font:10.4pt/1.6 Inter,-apple-system,"Segoe UI",sans-serif;color:#2a2e34;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:8.5in;margin:32px auto;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05),0 12px 36px rgba(0,0,0,.08)}
.band{background:#121417;color:#f3f4f6;padding:.5in .6in .46in;position:relative;border-radius:14px;margin:.4in .4in 0}
.band::after{content:"";position:absolute;left:.6in;bottom:0;width:64px;height:4px;background:linear-gradient(90deg,#F7805F,#F2431D 55%,#C7310F)}
.band-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.62in}
.band-top span{font-size:8.5pt;letter-spacing:.04em;color:#9ea2a9}
.band h1{font:600 30pt/1.08 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.025em;margin:0 0 12px;color:#fff;max-width:5.6in}
.band p{margin:0;color:#b9bcc2;font-size:10.5pt}
.band p strong{color:#fff;font-weight:500}
.content{padding:.45in .8in .5in}
h2{font:600 15pt/1.25 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.015em;color:#121417;margin:30px 0 10px;break-after:avoid}
h2:first-child{margin-top:4px}
h3{font:600 11pt/1.3 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin:20px 0 6px;break-after:avoid}
h4{font-weight:600;font-size:10pt;margin:16px 0 4px;color:#121417}
p{margin:0 0 10px}
ul,ol{margin:0 0 14px;padding-left:20px}li{margin:4px 0;padding-left:3px}
ul li::marker{color:#F2431D}ol li::marker{color:#C7310F;font-weight:600}
strong{font-weight:600;color:#121417}
a{display:inline-block;background:#121417;color:#fff;font-weight:600;text-decoration:none;padding:7px 14px;border-radius:7px;margin:2px 0;font-size:10pt}
a::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#F2431D;margin-left:8px;vertical-align:middle}
table{width:100%;border-collapse:collapse;margin:8px 0 14px;break-inside:avoid;border:1px solid #e3e6ea;border-radius:10px;overflow:hidden}
th{text-align:left;font-weight:500;color:#80858d;font-size:8.6pt;background:#f6f7f9;padding:8px 14px}
td{border-top:1px solid #eef0f3;padding:12px 14px;vertical-align:top}
td strong{font:600 15pt "Inter Tight",Inter,sans-serif;letter-spacing:-.01em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));grid-auto-flow:column;gap:10px;margin:8px 0 16px;break-inside:avoid}
.cd{border:1px solid #e3e6ea;border-top:3px solid #F2431D;border-radius:10px;padding:14px 14px 13px;background:#fbfbfc}
.cd b{display:block;font:600 11pt/1.25 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin-bottom:6px}
.cd span{font-size:9.2pt;line-height:1.5;color:#4a5059}
hr{border:0;border-top:1px solid #e3e6ea;margin:24px 0}
.ft{margin:30px .8in 0;padding:14px 0 .45in;border-top:1px solid #e3e6ea;color:#9a9fa6;font-size:8.5pt;display:flex;justify-content:space-between;align-items:center}
@media print{html{background:#fff}.sheet{margin:0;box-shadow:none;max-width:none}.band{margin:0}.content{padding:.35in .05in 0}.ft{margin:30px 0 0;padding-bottom:0}}
</style></head><body><div class="sheet">
<header class="band"><div class="band-top">${wordmark("#f3f4f6", 26)}<span>${esc(o.kind)}${o.docNo ? " · No. " + esc(o.docNo) : ""}</span></div>
<h1>${inline(title)}</h1>${sub ? `<p>${inline(sub)}</p>` : ""}</header>
<main class="content">${body}</main>
<footer class="ft">${wordmark("#9a9fa6", 13)}<span>${esc(o.business)} · cinderrevenue.com</span></footer>
</div>${o.autoPrint ? `<script>document.fonts.ready.then(()=>setTimeout(()=>print(),200))</script>` : ""}</body></html>`;
}

// ======================================================================================================
// Contract-grade documents. One renderer for every place a document appears: the CRM preview, the CRM
// print/PDF, the client's signing page and the PDFs sent by hand. The stored Markdown stays the source
// of truth (it is exactly what gets signed); this only lays it out.
// ======================================================================================================

/** Smart quotes, then escape, then bold, https links and highlighted [blanks]. */
function legalInline(s: string): string {
  const smart = s.replace(/(^|[\s(\[])"/g, "$1“").replace(/"/g, "”").replace(/(\w)'(\w)/g, "$1’$2").replace(/(\w)'/g, "$1’");
  return esc(smart)
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]\n]{1,80})\]/g, '<span class="blank">$1</span>');
}

export type SignatureMark = { name: string; title?: string; at?: string | null };
export type DocOptions = { no: string; business?: string; autoPrint?: boolean; signed?: { provider?: SignatureMark | null; client?: SignatureMark | null } };

const dateLong = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

/** What the agreement's own text says, for the cover page and the order summary. */
export function agreementFacts(md: string) {
  const pick = (re: RegExp) => re.exec(md)?.[1]?.trim() ?? "";
  const clientLine = pick(/\*\*Client:\*\*\s*(.+?)\s*\("Client"\)/);
  return {
    date: pick(/made on \*\*(.+?)\*\*/),
    provider: pick(/\*\*Provider:\*\*\s*(.+?)\s*\("Cinder"\)/),
    client: clientLine,
    company: clientLine.split(",")[0]?.trim() ?? "",
    owner: pick(/represented by ([^,]+),/),
    ownerTitle: pick(/represented by [^,]+,\s*([^(]+?)\s*\("Client"\)/) || "Owner",
    plan: pick(/the \*\*(.+?)\*\* system/),
    setup: pick(/- Setup fee: \*\*(.+?)\*\*/),
    monthly: pick(/- Monthly fee: \*\*(.+?)\*\*/),
    addon: /Reactivation (?:add-on|campaign): \*\*(.+?)\*\*/.exec(md)?.[1] ?? "",
    addonOnce: /Reactivation campaign: \*\*/.test(md),
    texts: pick(/up to \*\*([\d,]+) texts per month\*\*/),
    signer: pick(/## Signatures[\s\S]*?Name: (.+)/),
  };
}

const LEGAL_CSS = `
@page{size:letter;margin:.85in .9in .9in;
  @top-left{content:var(--run);font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:bottom;padding-bottom:10px}
  @top-right{content:"Confidential";font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:bottom;padding-bottom:10px}
  @bottom-left{content:"Initials:  Cinder ______   Client ______";font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:top;padding-top:10px}
  @bottom-right{content:"Page " counter(page) " of " counter(pages);font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:top;padding-top:10px}}
@page :first{@top-left{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#e6e8ec}
body{font:10.4pt/1.58 Newsreader,"Iowan Old Style",Georgia,serif;color:#1d2024;font-variation-settings:"opsz" 12}
.sans,h1,h2,h3,.k,th,.meta,.toc,.sig-k,.sig-l,.terms td,.terms th,.cover{font-family:Inter,-apple-system,"Segoe UI",sans-serif}
strong{font-weight:600;color:#121417}
.blank{font-family:Inter,sans-serif;font-size:.86em;color:#8a5a12;background:#fbefd6;border-bottom:1px dashed #d9a441;padding:0 3px;border-radius:2px}
a{color:#121417;text-decoration-color:#F2431D}
/* screen: sheets of paper on a grey desk */
.sheet{background:#fff;width:8.5in;margin:28px auto;padding:.85in .9in .9in;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08)}
@media print{html{background:#fff}.sheet{width:auto;margin:0;padding:0;box-shadow:none}.sheet+.sheet{break-before:page}}
/* cover */
@media screen and (max-width:900px){.sheet{width:auto;margin:10px;padding:.45in .4in}.cover{min-height:0;height:auto}}
.cover{min-height:11in;display:flex;flex-direction:column;position:relative}
@media print{.cover{min-height:0;height:9.2in;padding:0}}
.cover .rule{height:4px;width:72px;background:linear-gradient(90deg,#F7805F,#F2431D 55%,#C7310F);margin:1.5in 0 26px}
.cover .kind{font-size:10pt;font-weight:600;color:#C7310F;letter-spacing:.02em;margin-bottom:10px}
.cover h1{font:600 38pt/1.04 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.03em;color:#121417;max-width:6in}
.cover .between{margin-top:18px;font:400 13pt/1.45 Newsreader,Georgia,serif;color:#4a4f57;max-width:5.4in}
.cover .between b{color:#121417;font-weight:600}
.cover dl{margin-top:.55in;display:grid;grid-template-columns:repeat(4,auto);gap:6px 34px;justify-content:start;border-top:1px solid #e3e6ea;padding-top:16px}
.cover dt{font-size:7.6pt;font-weight:600;color:#80858d;letter-spacing:.04em}
.cover dd{font-size:10pt;color:#121417;font-weight:500}
.toc{margin-top:auto;font-size:8.8pt;color:#4a4f57;columns:2;column-gap:36px;border-top:1px solid #e3e6ea;padding-top:16px}
.toc p{display:flex;gap:8px;break-inside:avoid;padding:2px 0}
.toc p span:first-child{color:#C7310F;min-width:20px;font-weight:600}
.cover-foot{margin-top:22px;display:flex;justify-content:space-between;font-size:7.6pt;color:#9a9fa6}
/* summary */
.k{font-size:7.6pt;font-weight:600;letter-spacing:.05em;color:#C7310F}
h2.pg{font:600 17pt/1.2 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.015em;color:#121417;margin:4px 0 16px}
.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dadde2;border-radius:8px;overflow:hidden;margin-bottom:18px}
.party{padding:13px 16px;font-size:9.6pt;line-height:1.5}
.party+.party{border-left:1px solid #dadde2}
.party .k{margin-bottom:5px}
.party .pn{display:block;font:600 10.4pt/1.35 Inter,sans-serif;color:#121417;margin-bottom:2px}
.party .pe{color:#6b717a}
.party .pl{display:block}
.cover>svg{align-self:flex-start}
table{width:100%;border-collapse:collapse}
.terms{margin-bottom:8px}
.terms th,.terms td{text-align:left;vertical-align:top;padding:8px 12px;border-bottom:1px solid #e7e9ed;font-size:9.4pt}
.terms th{width:28%;font-weight:600;color:#4a4f57;background:#f6f7f9}
.terms tr:first-child th,.terms tr:first-child td{border-top:1px solid #dadde2}
.terms td b{font-weight:600;color:#121417}
.note{font-size:8.4pt;color:#6b717a;font-style:italic;margin-top:6px}
/* terms */
h2{font:600 11pt/1.3 Inter,sans-serif;color:#121417;margin:20px 0 7px;break-after:avoid;display:flex;gap:10px}
h2 .n{min-width:24px;color:#C7310F}
h3{font:600 9.6pt Inter,sans-serif;color:#121417;margin:14px 0 6px;break-after:avoid}
p{margin:0 0 7px;orphans:3;widows:3}
.cl{display:grid;grid-template-columns:34px 1fr;margin-bottom:6px}
.cl .n{font:500 8.8pt Inter,sans-serif;color:#80858d;padding-top:2px}
ul,ol{margin:0 0 9px 34px}li{margin-bottom:3px;padding-left:2px}
ul.alpha{list-style:none;margin-left:34px}
.grid{margin:6px 0 10px}
.grid th{font:600 7.8pt Inter,sans-serif;color:#4a4f57;background:#f6f7f9;border-top:1px solid #dadde2;border-bottom:1px solid #dadde2;padding:6px 10px;text-align:left}
.grid td{padding:7px 10px;border-bottom:1px solid #e7e9ed;font-size:9.6pt;vertical-align:top}
.grid .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
/* signatures */
.sig{break-inside:avoid;margin-top:8px}
.sig-intro{margin-bottom:22px}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-k{font-size:7.6pt;font-weight:600;letter-spacing:.05em;color:#C7310F;margin-bottom:2px}
.sig-who{font:600 10.4pt Inter,sans-serif;margin-bottom:22px}
.sig-line{border-bottom:1px solid #121417;height:40px;display:flex;align-items:flex-end;padding-bottom:3px}
.sig-line .ink{font:italic 500 17pt/1 Newsreader,Georgia,serif;color:#16233f}
.sig-l{font-size:7.4pt;color:#6b717a;margin:4px 0 14px}
.sig-val{border-bottom:1px solid #c8ccd2;min-height:22px;font-size:10pt;padding-top:3px}
.esign{margin-top:18px;padding:10px 14px;background:#f6f7f9;border-left:2px solid #F2431D;font:8.6pt/1.5 Inter,sans-serif;color:#4a4f57}
/* schedules */
.sched-head{padding-bottom:12px;border-bottom:3px solid #F2431D;margin-bottom:16px}
.sched-head h2{font:600 17pt/1.2 "Inter Tight","Inter Display",Inter,sans-serif;margin:4px 0 0;display:block}
`;

/** Markdown blocks of the agreement → numbered legal layout, split into sheets (terms, signatures, each schedule). */
function legalBody(md: string, sigHtml: string): string[] {
  const sheets: string[][] = [[]];
  const out = () => sheets[sheets.length - 1];
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  let mode: "pre" | "body" | "sig" | "sched" = "pre";
  for (const b of blocks) {
    if (/^# /.test(b)) continue;
    const h = /^## (.+)$/.exec(b);
    if (h) {
      const t = h[1];
      if (/^Signatures/i.test(t)) { mode = "sig"; sheets.push([`<p class="k">EXECUTION</p><h2 class="pg">Signatures</h2>`, sigHtml]); continue; }
      const sch = /^Schedule ([A-Z])\s*[—-]\s*(.+)$/.exec(t);
      if (sch) { mode = "sched"; sheets.push([`<div class="sched-head"><p class="k">SCHEDULE ${sch[1]}</p><h2>${esc(sch[2])}</h2></div>`]); continue; }
      const n = /^(\d+)\.\s+(.+)$/.exec(t);
      mode = "body";
      out().push(n ? `<h2><span class="n">${n[1]}.</span>${esc(n[2])}</h2>` : `<h2>${esc(t)}</h2>`);
      continue;
    }
    if (mode === "pre" || mode === "sig") continue;
    const lines = b.split("\n");
    if (lines.every(l => l.trim().startsWith("|"))) {
      const rows = lines.filter(l => !/^\|[\s|:-]+\|?$/.test(l.trim())).map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(x => x.trim()));
      const [hd, ...rs] = rows;
      out().push(`<table class="grid"><thead><tr>${hd.map((c, i) => `<th${i === hd.length - 1 && hd.length > 1 ? ' class="num"' : ""}>${legalInline(c)}</th>`).join("")}</tr></thead><tbody>${rs.map(r => `<tr>${r.map((c, i) => `<td${i === r.length - 1 && r.length > 1 ? ' class="num"' : ""}>${legalInline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (lines.every(l => /^- /.test(l))) {
      const alpha = lines.every(l => /^- \([a-z]\)/.test(l));
      out().push(`<ul${alpha ? ' class="alpha"' : ""}>${lines.map(l => `<li>${legalInline(l.slice(2))}</li>`).join("")}</ul>`);
      continue;
    }
    if (lines.every(l => /^\d+\. /.test(l))) {
      const start = /^(\d+)/.exec(lines[0])![1];
      out().push(`<ol start="${start}">${lines.map(l => `<li>${legalInline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`);
      continue;
    }
    if (lines.length > 1 && lines.slice(1).every(l => /^- /.test(l))) {
      out().push(`<p>${legalInline(lines[0])}</p><ul>${lines.slice(1).map(l => `<li>${legalInline(l.slice(2))}</li>`).join("")}</ul>`);
      continue;
    }
    const cl = /^(\d+\.\d+)\s+([\s\S]+)$/.exec(b);
    if (cl) { out().push(`<div class="cl"><span class="n">${cl[1]}</span><p>${legalInline(cl[2])}</p></div>`); continue; }
    if (/^\*\*[^*]+\*\*$/.test(b)) { out().push(`<h3>${legalInline(b.replace(/^\*\*|\*\*$/g, ""))}</h3>`); continue; }
    out().push(`<p>${legalInline(b)}</p>`);
  }
  return sheets.map(s => s.join("\n")).filter(Boolean);
}

/** "Name, entity, street, city, ST, email, phone, represented by X, Title" → tidy lines. */
function partyHtml(line: string): string {
  const [main, rep] = line.split(/,\s*represented by\s*/);
  const parts = main.split(/,\s*/);
  let name = parts.shift() ?? "";
  if (/^doing business as/i.test(parts[0] ?? "")) name += ", " + parts.shift();
  const email = parts.filter(x => /@/.test(x)), phone = parts.filter(x => /^\(?\d{3}\)?[\s.-]?\d{3}/.test(x));
  const entity = parts.filter(x => /corporation|llc|limited|company|partnership|proprietor|entity type/i.test(x) && !/@/.test(x));
  const addr = parts.filter(x => !email.includes(x) && !phone.includes(x) && !entity.includes(x));
  return [`<b class="pn">${legalInline(name)}</b>`, entity.length ? `<span class="pe">${legalInline(entity.join(", "))}</span>` : "",
    addr.length ? legalInline(addr.join(", ")) : "", [...email, ...phone].map(legalInline).join(" \u00b7 "),
    rep ? `<span class="pe">Signer: ${legalInline(rep)}</span>` : ""].filter(Boolean).map(x => x.startsWith("<b") ? x : `<span class="pl">${x}</span>`).join("");
}

/** The full service agreement as a contract-grade document: cover, order summary, terms, signature page, schedules. */
export function agreementDoc(md: string, o: DocOptions): string {
  const f = agreementFacts(md);
  const business = o.business || "Cinder Revenue Company";
  const sections = [...md.matchAll(/^## (\d+)\.\s+(.+)$/gm)].map(m => [m[1], m[2]]);
  const schedules = [...md.matchAll(/^## Schedule ([A-Z])\s*[—-]\s*(.+)$/gm)].map(m => [m[1], m[2]]);
  const sp = o.signed?.provider, sc = o.signed?.client;
  const sigSide = (k: string, who: string, s: SignatureMark | null | undefined, name: string, title: string) => `<div><p class="sig-k">${k}</p><p class="sig-who">${legalInline(who)}</p>
<div class="sig-line">${s ? `<span class="ink">${esc(s.name)}</span>` : ""}</div><p class="sig-l">Signature</p>
<div class="sig-val">${esc(s?.name || name)}</div><p class="sig-l">Printed name</p>
<div class="sig-val">${esc(s?.title || title)}</div><p class="sig-l">Title</p>
<div class="sig-val">${esc(dateLong(s?.at))}</div><p class="sig-l">Date</p></div>`;
  const sig = `<section class="sig"><p class="sig-intro">The parties have signed this Agreement, including its Schedules, as of the dates below. Electronic signatures count as originals.</p><div class="sig-grid">
${sigSide("PROVIDER", business, sp, f.signer || "Samuel Ward", "Owner")}
${sigSide("CLIENT", f.company || "Client", sc, f.owner && !/^\[/.test(f.owner) ? f.owner : "", f.ownerTitle)}</div>
${sp || sc ? `<p class="esign">Signed electronically. ${sp ? `${esc(sp.name)} for ${esc(business)}${sp.at ? `, ${esc(dateLong(sp.at))}` : ""}. ` : ""}${sc ? `${esc(sc.name)} for ${legalInline(f.company)}${sc.at ? `, ${esc(dateLong(sc.at))}` : ""}. ` : ""}The signer's name, time, IP address and browser are recorded with the exact text signed.</p>` : ""}</section>`;
  const terms = [
    ["Plan", `<b>${legalInline(f.plan)}</b>, as described in Schedule A`],
    ["Setup fee", `<b>${legalInline(f.setup)}</b>${f.addon && f.addonOnce ? `, plus the Reactivation campaign at ${legalInline(f.addon)}, one time` : ""}, due on signing (Section 2.1)`],
    ["Monthly fee", `<b>${legalInline(f.monthly)}</b> a month${f.addon && !f.addonOnce ? `, plus the Reactivation add-on at ${legalInline(f.addon)}` : ""}, starting the day the first Booked Appointment lands (Section 2.2)`],
    ["Term", "Month to month. No minimum term. Either party may cancel with 30 days’ notice (Section 4)"],
    ["Included usage", `${legalInline(f.texts || "")} texts a month; $30 per additional 1,000 (Section 7)`],
    ["Guarantees", /Booked-Appointment Guarantee/.test(md) && /Book & Close/.test(f.plan) ? "60-second first reply (8.1); Booked Appointments in the first 30 days (8.2); live within 21 business days or setup refunded (3)" : "60-second first reply (8.1); live within 21 business days or setup refunded (3)"],
    ["Governing law", "State of Colorado (Section 13.1)"],
  ];
  const cover = `<section class="sheet cover">
${wordmark("#121417", 30)}
<div class="rule"></div>
<p class="kind">Service Agreement</p>
<h1>${legalInline(f.plan || "Service Agreement")}</h1>
<p class="between">Between <b>${esc(business)}</b> and <b>${legalInline(f.company || "Client")}</b></p>
<dl><div><dt>AGREEMENT NO.</dt><dd>${esc(o.no)}</dd></div><div><dt>EFFECTIVE DATE</dt><dd>${legalInline(f.date)}</dd></div><div><dt>TERM</dt><dd>Month to month</dd></div><div><dt>GOVERNING LAW</dt><dd>Colorado</dd></div></dl>
<div class="toc">${sections.map(([n, t]) => `<p><span>${n}</span><span>${esc(t)}</span></p>`).join("")}<p><span>—</span><span>Signatures</span></p>${schedules.map(([l, t]) => `<p><span>${l}</span><span>Schedule ${l}: ${esc(t)}</span></p>`).join("")}</div>
<div class="cover-foot"><span>${esc(business)} · cinderrevenue.com</span><span>Confidential. Prepared for ${legalInline((f.company || "the Client").replace(/\.$/, ""))}.</span></div>
</section>`;
  const summary = `<section class="sheet"><p class="k">ORDER SUMMARY</p><h2 class="pg">The parties and key terms</h2>
<div class="parties"><div class="party"><p class="k">PROVIDER (“CINDER”)</p>${partyHtml(f.provider)}</div><div class="party"><p class="k">CLIENT</p>${partyHtml(f.client)}</div></div>
<table class="terms">${terms.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>
<p class="note">This summary is for convenience. If it differs from the terms that follow, the terms control.</p>
<p style="margin-top:18px">This Service Agreement (the “Agreement”) is made on <strong>${legalInline(f.date)}</strong> between the Provider and the Client named above, each a “party.”</p>
${legalBody(md, sig)[0] ?? ""}</section>`;
  const rest = legalBody(md, sig).slice(1).map(s => `<section class="sheet">${s}</section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(business)} Service Agreement ${esc(o.no)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,500&display=swap" rel="stylesheet">
<style>:root{--run:"${esc(business)} · Service Agreement No. ${esc(o.no)}"}${LEGAL_CSS}</style></head><body>
${cover}
${summary}
${rest}
${o.autoPrint ? `<script>document.fonts.ready.then(()=>setTimeout(()=>print(),200))</script>` : ""}</body></html>`;
}

/** A short, stable document number from a record id and date: CRC-SA-2026-1F3A. */
export function docNumber(prefix: "SA" | "P", id: string, iso?: string | null): string {
  const y = (iso ? new Date(iso) : new Date()).getFullYear();
  return `CRC-${prefix}-${y}-${id.replace(/[^0-9a-f]/gi, "").slice(0, 4).toUpperCase()}`;
}

const PROPOSAL_CSS = `
@page{size:letter;margin:.8in .85in .85in;
  @top-left{content:var(--run);font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:bottom;padding-bottom:10px}
  @bottom-right{content:"Page " counter(page) " of " counter(pages);font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:top;padding-top:10px}
  @bottom-left{content:"cinderrevenue.com";font:7.5pt Inter,sans-serif;color:#8a8f96;vertical-align:top;padding-top:10px}}
@page :first{margin:0;@top-left{content:none}@bottom-left{content:none}@bottom-right{content:none}}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#e6e8ec}
body{font:10.4pt/1.62 Inter,-apple-system,"Segoe UI",sans-serif;color:#2a2e34}
.sheet{background:#fff;width:8.5in;margin:28px auto;padding:.8in .85in .85in;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08)}
@media print{html{background:#fff}.sheet{width:auto;margin:0;padding:0;box-shadow:none}}
@media screen and (max-width:900px){.sheet{width:auto;margin:10px;padding:.45in .4in}.cover{height:auto;min-height:9in}}
.cover{background:#121417;color:#f3f4f6;height:11in;padding:.9in .9in .8in;display:flex;flex-direction:column;position:relative;overflow:hidden}
@media print{.cover{width:8.5in;height:11in;padding:.9in .9in .8in;break-after:page}}
.cover::before{content:"";position:absolute;right:-1.6in;top:-1.4in;width:5.2in;height:5.2in;border-radius:50%;background:radial-gradient(circle at 38% 34%,rgba(247,205,182,.22),rgba(217,119,87,.12) 45%,rgba(18,20,23,0) 70%)}
.cover>svg{align-self:flex-start;position:relative}
.cover .rule{height:4px;width:72px;background:linear-gradient(90deg,#F7805F,#F2431D 55%,#C7310F);margin:2.1in 0 26px}
.cover .kind{font-size:10pt;font-weight:600;color:#F7805F;margin-bottom:12px}
.cover h1{font:600 34pt/1.06 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.03em;color:#fff;max-width:6.2in}
.cover .plan{margin-top:16px;font-size:12pt;color:#b9bcc2}
.cover .plan b{color:#fff;font-weight:600}
.cover dl{margin-top:auto;display:grid;grid-template-columns:1.2fr 1.3fr 1.3fr .9fr;gap:6px 26px;border-top:1px solid #34373d;padding-top:18px}
.cover dt{font-size:7.4pt;font-weight:600;color:#8d9198;letter-spacing:.05em;margin-bottom:3px}
.cover dd{font-size:9.6pt;color:#f3f4f6;line-height:1.45}
h2{font:600 17pt/1.2 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.015em;color:#121417;margin:24px 0 10px;break-after:avoid;padding-top:14px;border-top:1px solid #e3e6ea}
.body>h2:first-child{margin-top:0;border-top:0;padding-top:0}

h3{font:600 11.4pt/1.3 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin:18px 0 6px;break-after:avoid}
p{margin:0 0 10px}
ul,ol{margin:0 0 14px;padding-left:20px}li{margin:4px 0;padding-left:3px}
ul li::marker{color:#F2431D}ol li::marker{color:#C7310F;font-weight:600}
strong{font-weight:600;color:#121417}
a{display:inline-block;background:#121417;color:#fff;font-weight:600;text-decoration:none;padding:7px 14px;border-radius:7px;margin:2px 0;font-size:10pt}
a::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#F2431D;margin-left:8px;vertical-align:middle}
table{width:100%;border-collapse:collapse;margin:8px 0 14px;break-inside:avoid;font-size:9.8pt}
th{text-align:left;font-weight:600;color:#80858d;font-size:8pt;border-bottom:1.5px solid #121417;padding:6px 14px 6px 0}
td{border-bottom:1px solid #e7e9ed;padding:7px 14px 7px 0;vertical-align:top}
td strong{font:600 14pt "Inter Tight",Inter,sans-serif;letter-spacing:-.01em}
.cards{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px;margin:8px 0 16px;break-inside:avoid}
.cd{border:1px solid #e3e6ea;border-top:3px solid #F2431D;border-radius:10px;padding:14px;background:#fbfbfc}
.cd b{display:block;font:600 11pt/1.25 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin-bottom:6px}
.cd span{font-size:9.2pt;line-height:1.5;color:#4a5059}
.accept{margin-top:30px;padding-top:16px;border-top:1px solid #e3e6ea;break-inside:avoid}
.accept h3{margin-top:0}
.accept .grid{display:grid;grid-template-columns:2fr 1.3fr 1fr;gap:26px;margin-top:26px}
.accept .ln{border-bottom:1px solid #121417;height:30px}
.accept .lb{font-size:7.6pt;color:#6b717a;margin-top:4px}
`;

/** A proposal as an agency would send it: dark cover, then the plan, investment, guarantees, timeline and acceptance. */
export function proposalDoc(md: string, o: { no: string; business?: string; preparedBy?: string; autoPrint?: boolean }): string {
  const business = o.business || "Cinder Revenue Company";
  const lines = md.replace(/\r/g, "").split("\n");
  const hi = lines.findIndex(l => /^#\s+/.test(l));
  const title = hi >= 0 ? lines[hi].replace(/^#\s+/, "") : "Proposal";
  const mi = lines.findIndex((l, i) => i > hi && /^Prepared for/.test(l));
  const meta = mi >= 0 ? lines[mi] : "";
  const rest = lines.filter((_, i) => i !== hi && i !== mi).join("\n");
  const who = /Prepared for \*\*(.+?)\*\*/.exec(meta)?.[1] ?? "";
  const plan = /Plan: \*\*(.+?)\*\*/.exec(meta)?.[1] ?? "";
  const date = meta.split(" · ")[1]?.trim() ?? "";
  const valid = (() => { const d = new Date(date); if (isNaN(+d)) return ""; d.setDate(d.getDate() + 14); return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); })();
  const [person, ...co] = who.split(", ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposal ${esc(o.no)}${co.length ? " for " + esc(co.join(", ")) : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@600&display=swap" rel="stylesheet">
<style>:root{--run:"${esc(business)} · Proposal No. ${esc(o.no)}${co.length ? " · " + esc(co.join(", ")) : ""}"}${PROPOSAL_CSS}</style></head><body>
<section class="sheet cover">${wordmark("#f3f4f6", 30)}<div class="rule"></div><p class="kind">Proposal</p><h1>${inline(title)}</h1>${plan ? `<p class="plan">Recommended plan: <b>${inline(plan)}</b></p>` : ""}
<dl><div><dt>PREPARED FOR</dt><dd>${inline(person || "")}${co.length ? "<br>" + inline(co.join(", ")) : ""}</dd></div><div><dt>PREPARED BY</dt><dd>${esc(o.preparedBy || "Samuel Ward")}<br>${esc(business)}</dd></div><div><dt>DATE</dt><dd>${inline(date)}${valid ? `<br><span style="color:#8d9198">Valid until ${esc(valid)}</span>` : ""}</dd></div><div><dt>PROPOSAL NO.</dt><dd>${esc(o.no)}</dd></div></dl></section>
<section class="sheet"><div class="body">${markdownToHtml(rest).replace("<h2>Your investment</h2>", '<h2 class="pb">Your investment</h2>')}</div>
<div class="accept"><h3>Acceptance</h3><p>Accepting this proposal means you'd like to start. Your service agreement follows, and the agreement's terms govern the work.</p>
<div class="grid"><div><div class="ln"></div><p class="lb">Signature</p></div><div><div class="ln"></div><p class="lb">Printed name</p></div><div><div class="ln"></div><p class="lb">Date</p></div></div></div></section>
${o.autoPrint ? `<script>document.fonts.ready.then(()=>setTimeout(()=>print(),200))</script>` : ""}</body></html>`;
}
