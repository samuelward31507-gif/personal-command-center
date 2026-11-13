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
      out.push(cards ? `<div class="cards">${items.map(x => x.replace(/^<li><strong>(.*?):?<\/strong>\s*(.)/, (_m, t, c) => `<div class="cd"><b>${t}</b><span>${c.toUpperCase()}`).replace(/<\/li>$/, "</span></div>")).join("")}</div>` : `<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*[-*]\s|\s*\d+[.)]\s|\s*---\s*$)/.test(lines[i])) { para.push(inline(lines[i].trim())); i++; }
    out.push(`<p>${para.join("<br>")}</p>`);
  }
  return out.join("\n");
}

export const WORDMARK_PATH = "M576.9998372457922 -933.9968668669462Q669.9331542961299 -933.9968668669462 726.2997395806015 -913.8968668691814Q782.666324865073 -893.7968668714166 808.1329304967076 -862.930230723694Q833.5995361283422 -832.0635945759714 833.5995361283422 -799.1303304135799Q833.5995361283422 -767.9969238378108 820.0994588173926 -744.5968546643853Q806.599381506443 -721.1967854909599 782.8992716427892 -708.4967346284539Q759.1991617791355 -695.7966837659478 728.7991170175374 -695.7966837659478Q705.4652587808669 -695.7966837659478 682.8650390543044 -711.7299296148121Q660.2648193277419 -727.6631754636765 637.5648356042802 -751.0963846910745Q614.8648518808186 -774.5295939184725 590.3983642514795 -798.0627929735929Q565.9318766221404 -821.5959920287132 538.6654602009803 -837.5292378775775Q511.3990437798202 -853.4624837264419 480.2659667953849 -853.4624837264419Q424.2665649354458 -853.4624837264419 375.96691283397377 -820.329465739429Q327.66726073250175 -787.1964477524161 298.00074258446693 -717.2970662396401Q268.3342244364321 -647.3976847268641 268.3342244364321 -537.5986043214798Q268.3342244364321 -402.59954019263387 307.10081786103547 -311.6666829343885Q345.8674112856388 -220.73382567614317 418.233848053962 -175.06730142608285Q490.6002848222852 -129.40077717602253 591.3331095315516 -129.40077717602253Q656.3993896432221 -129.40077717602253 715.032279457897 -154.03379312716424Q773.6651692725718 -178.66680907830596 825.5319335907698 -229.53291828930378L849.9990152977407 -202.59886880591512Q794.332291662693 -122.66600748151541 737.3322611432523 -73.09955444000661Q680.3322306238115 -23.53310139849782 618.2656087167561 -0.76648966409266Q556.1989868097007 22.0001220703125 485.0658813454211 22.0001220703125Q362.9991617836058 22.0001220703125 269.13261311873794 -35.19985351525247Q175.26606445387006 -92.39982910081744 122.26619466207922 -194.9994974769652Q69.26632487028837 -297.59916585311294 69.26632487028837 -433.7315714545548Q69.26632487028837 -538.2645060271025 104.53292643278837 -629.1642456110567Q139.79952799528837 -720.0639851950109 205.89947102963924 -788.4638265036047Q271.9994140639901 -856.8636678121984 365.8994873072952 -895.4302673395723Q459.7995605506003 -933.9968668669462 576.9998372457922 -933.9968668669462Z M1227.201509591192 -936.9299764074385 1222.001277655363 -752.9297810830176V-77.80071614682674L1361.9342569895089 -34.733597818762064V0.0H880.399963375181V-34.733597818762064L1019.4662516266108 -78.00071614608169V-730.3961385302246Q1007.7328572571278 -742.7297078669071 985.8995544407517 -757.8297607637942Q964.0662516243756 -772.9298136606812 936.532995602116 -788.996411152184Q908.9997395798564 -805.0630086436868 878.799812823534 -819.2628540173173V-848.529931653291L1206.867390934378 -936.9299764074385Z M1723.2013346217573 -741.1298543475568V-76.46726074069738L1859.8006754405797 -34.733597818762064V0.0H1381.6000203415751V-34.733597818762064L1520.666308593005 -78.00071614608169V-721.3291300646961Q1503.1328409798443 -739.9295532442629 1472.1661539692432 -759.1962544936687Q1441.199466958642 -778.4629557430744 1379.8665242493153 -806.4624552540481V-832.5294840633869L1679.3997436314821 -936.9299764074385H1698.666975889355ZM1986.6656534820795 -34.733597818762064 2123.531640622765 -76.46726074069738V-602.6637898869812Q2123.531640622765 -657.8633545041084 2102.565118405968 -695.8297139611095Q2081.598596189171 -733.7960734181106 2039.7322285939008 -753.3292460255325Q1997.8658609986305 -772.8624186329544 1934.8663777597249 -772.8624186329544Q1862.8000650927424 -772.8624186329544 1800.0338154975325 -749.3291483707726Q1737.2675659023225 -725.7958781085908 1703.3345987796783 -693.5291015841067L1673.4673665165901 -723.5961751565337Q1736.86705320701 -786.1297200731933 1788.3335957713425 -827.0298502780497Q1839.800138335675 -867.9299804829061 1885.0001424048096 -891.0967224240303Q1930.2001464739442 -914.2634643651545 1975.1335693225265 -923.7968322839588Q2020.0669921711087 -933.3302002027631 2070.33372393623 -933.3302002027631Q2201.4000691585243 -933.3302002027631 2263.7333679050207 -854.9968261774629Q2326.066666651517 -776.6634521521628 2326.066666651517 -610.3301595002413V-78.00071614608169L2466.399662259966 -34.733597818762064V0.0H1986.6656534820795Z M3190.7975789420307 -660.529931627214Q3190.7975789420307 -745.9962320886552 3134.564864093438 -801.5626831036061Q3078.332149244845 -857.129134118557 2977.9326578713953 -857.129134118557Q2895.2000203356147 -857.129134118557 2836.5671488326043 -813.162805179134Q2777.934277329594 -769.196476239711 2747.5345173999667 -683.8970153834671Q2717.1347574703395 -598.5975545272231 2717.1347574703395 -473.8648518919945Q2717.1347574703395 -352.46552328020334 2749.4679300785065 -271.4992960654199Q2781.8011026866734 -190.53306885063648 2841.834000637755 -150.36661783978343Q2901.866898588836 -110.20016682893038 2985.6660766527057 -110.20016682893038Q3055.9986857026815 -110.20016682893038 3120.2315938267857 -132.89987996406853Q3184.46450195089 -155.5995930992067 3243.9974324554205 -206.66550700366497L3247.9971272833645 -147.86411539837718Q3182.2638549879193 -96.79814046621323 3132.7973612528294 -63.46526896581054Q3083.3308675177395 -30.13239746540785 3043.131095379591 -11.532678226009011Q3002.9313232414424 7.067041013389826 2967.2315694149584 14.533581541851163Q2931.5318155884743 22.0001220703125 2894.5320027656853 22.0001220703125Q2768.0654947906733 22.0001220703125 2679.232401529327 -32.56638183631003Q2590.399308267981 -87.13288574293256 2543.8995056152344 -184.73258463665843Q2497.399702962488 -282.3322835303843 2497.399702962488 -410.0651611350477Q2497.399702962488 -534.7981852255762 2537.0997375492007 -631.9645568896085Q2576.7997721359134 -729.1309285536408 2646.766402181238 -796.4640279188752Q2716.7330322265625 -863.7971272841096 2808.232808429748 -898.8969970755279Q2899.732584632933 -933.9968668669462 3003.4654134064913 -933.9968668669462Q3056.531941726804 -933.9968668669462 3107.965039057657 -925.8635437060148Q3159.3981363885105 -917.7302205450833 3212.1313517205417 -900.7969177290797Q3264.864567052573 -883.8636149130762 3320.131506342441 -855.8636149130762L3190.7975789420307 -817.9970540478826V-1244.1972168050706Q3178.130851238966 -1257.3975179120898 3156.031022137031 -1272.0642456114292Q3133.931193035096 -1286.7309733107686 3106.264668783173 -1301.8643046058714Q3078.59814453125 -1316.9976359009743 3048.2646891251206 -1331.1976887956262V-1355.3981648758054L3386.73208007589 -1442.6654663085938H3404.665983069688L3393.332604970783 -1267.997668452561V-138.26798501610756Q3402.8659871332347 -129.6011474505067 3419.165873201564 -119.96774697862566Q3435.465759269893 -110.33434650674462 3454.9656127858907 -100.70100503601134Q3474.4654663018882 -91.06766356527805 3493.9320312440395 -83.16769204847515Q3513.398596186191 -75.26772053167224 3530.1986694298685 -70.66771646216512V-41.00072834268212L3224.1320027671754 22.333300780504942H3204.998132325709L3190.7975789420307 -131.13378091529012Z M4002.06552734226 -933.9968668669462Q4107.732373043895 -933.9968668669462 4184.199080400169 -889.0634399466217Q4260.665787756443 -844.1300130262971 4305.499117020518 -758.2632283587009Q4350.332446284592 -672.3964436911047 4360.199145503342 -549.1297200582922H3726.066475417465L3727.1331583596766 -618.9302327521145L4248.33212890476 -635.7307942770422L4155.664469406009 -590.8638549856842Q4148.7312581427395 -678.6633300818503 4127.898103844374 -738.3963989298791Q4107.064949546009 -798.1294677779078 4070.898506673053 -828.7960367891937Q4034.7320638000965 -859.4626058004797 3979.932340491563 -859.4626058004797Q3914.2663614861667 -859.4626058004797 3865.233447259292 -821.9963256884366Q3816.2005330324173 -784.5300455763936 3789.1673889067024 -708.5971984881908Q3762.1342447809875 -632.6643513999879 3762.1342447809875 -516.9312906898558Q3762.1342447809875 -389.59919433295727 3803.8674804586917 -303.26647338457406Q3845.600716136396 -216.93375243619084 3922.333782950416 -173.1672648061067Q3999.0668497644365 -129.40077717602253 4104.332991529256 -129.40077717602253Q4148.732718907297 -129.40077717602253 4190.199055986479 -140.26729328930378Q4231.665393065661 -151.13380940258503 4270.9985127765685 -173.6002115830779Q4310.331632487476 -196.06661376357079 4345.865047197789 -230.19958495348692L4370.73208007589 -202.99884438887239Q4314.932238768786 -125.53289387747645 4256.865627033636 -75.63308919221163Q4198.799015298486 -25.733284506946802 4134.232366941869 -1.866581218317151Q4069.6657185852528 22.0001220703125 3994.3324503563344 22.0001220703125Q3868.5324422195554 22.0001220703125 3770.99925333634 -35.89987996406853Q3673.466064453125 -93.79988199844956 3617.9995340984315 -197.99959513358772Q3562.533003743738 -302.1993082687259 3562.533003743738 -441.3317911811173Q3562.533003743738 -575.5980387404561 3614.399558512494 -687.5643453001976Q3666.26611328125 -799.5306518599391 3764.732590738684 -866.7637593634427Q3863.199068196118 -933.9968668669462 4002.06552734226 -933.9968668669462Z M5054.400585904717 -927.6633707731962Q5107.000972460955 -927.6633707731962 5132.46765133366 -899.9965108279139Q5157.934330206364 -872.3296508826315 5157.934330206364 -828.329569503665Q5157.934330206364 -773.5292561873794 5123.20078731887 -741.0958964098245Q5088.4672444313765 -708.6625366322696 5035.600520804524 -708.6625366322696Q5007.600166801363 -708.6625366322696 4983.766770400107 -716.4292704369873Q4959.933373998851 -724.1960042417049 4935.166748024523 -731.6960673108697Q4910.400122050196 -739.1961303800344 4879.266768373549 -739.1961303800344Q4854.333569318056 -739.1961303800344 4828.366965722293 -731.9628967363387Q4802.400362126529 -724.729663092643 4777.700431300327 -711.363136805594Q4753.000500474125 -697.9966105185449 4731.200642887503 -678.996769208461L4716.200170882046 -720.7302368246019Q4780.199723284692 -780.7964355535805 4830.466300429776 -820.5963338278234Q4880.732877574861 -860.3962321020663 4920.766369597986 -883.9629984591156Q4960.799861621112 -907.529764816165 4993.466786669567 -917.5965677946806Q5026.133711718023 -927.6633707731962 5054.400585904717 -927.6633707731962ZM4756.201334621757 -744.4631876684725V-79.06748047098517L4906.600854486227 -34.733597818762064V0.0H4414.600020341575V-34.733597818762064L4553.666308593005 -78.00071614608169V-721.3291300646961Q4539.99958088994 -735.6627441607416 4520.699568681419 -748.1961487028748Q4501.3995564728975 -760.729553245008 4474.832967117429 -775.0627950243652Q4448.26637776196 -789.3960368037224 4412.999869789928 -806.4624552540481V-832.5294840633869L4726.933593731374 -936.9299764074385H4746.200825989246Z";

/** The wordmark as inline SVG. ink = letter colour; the ember dot keeps the brand orange. */
let n = 0;
export function wordmark(ink = "#121417", height = 24): string {
  const id = "emb" + (++n);
  return `<svg viewBox="0 -1460 5174 1500" height="${height}" style="height:${height}px;width:auto;display:block" role="img" aria-label="Cinder Revenue Company"><defs><radialGradient id="${id}" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#f7cdb6"/><stop offset=".55" stop-color="#d97757"/><stop offset="1" stop-color="#b8583b"/></radialGradient></defs><path fill="${ink}" d="${WORDMARK_PATH}"/><circle cx="1135" cy="-1196" r="158" fill="url(#${id})"/></svg>`;
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
html{background:#e9e8e4}
body{margin:0;font:10.4pt/1.6 Inter,-apple-system,"Segoe UI",sans-serif;color:#2a2e34;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:8.5in;margin:32px auto;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05),0 12px 36px rgba(0,0,0,.08)}
.band{background:#121417;color:#f3f1ec;padding:.5in .6in .46in;position:relative;border-radius:14px;margin:.4in .4in 0}
.band::after{content:"";position:absolute;left:.6in;bottom:0;width:64px;height:4px;background:linear-gradient(90deg,#f0a07a,#d97757 55%,#b8583b)}
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
ul li::marker{color:#d97757}ol li::marker{color:#b8583b;font-weight:600}
strong{font-weight:600;color:#121417}
a{display:inline-block;background:#121417;color:#fff;font-weight:600;text-decoration:none;padding:7px 14px;border-radius:7px;margin:2px 0;font-size:10pt}
a::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#d97757;margin-left:8px;vertical-align:middle}
table{width:100%;border-collapse:collapse;margin:8px 0 14px;break-inside:avoid;border:1px solid #e4e2dd;border-radius:10px;overflow:hidden}
th{text-align:left;font-weight:500;color:#80858d;font-size:8.6pt;background:#f6f6f4;padding:8px 14px}
td{border-top:1px solid #eeece8;padding:12px 14px;vertical-align:top}
td strong{font:600 15pt "Inter Tight",Inter,sans-serif;letter-spacing:-.01em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));grid-auto-flow:column;gap:10px;margin:8px 0 16px;break-inside:avoid}
.cd{border:1px solid #e4e2dd;border-top:3px solid #d97757;border-radius:10px;padding:14px 14px 13px;background:#fcfcfa}
.cd b{display:block;font:600 11pt/1.25 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin-bottom:6px}
.cd span{font-size:9.2pt;line-height:1.5;color:#4a5059}
hr{border:0;border-top:1px solid #e4e2dd;margin:24px 0}
.ft{margin:30px .8in 0;padding:14px 0 .45in;border-top:1px solid #e4e2dd;color:#9a9fa6;font-size:8.5pt;display:flex;justify-content:space-between;align-items:center}
@media print{html{background:#fff}.sheet{margin:0;box-shadow:none;max-width:none}.band{margin:0}.content{padding:.35in .05in 0}.ft{margin:30px 0 0;padding-bottom:0}}
</style></head><body><div class="sheet">
<header class="band"><div class="band-top">${wordmark("#f3f1ec", 26)}<span>${esc(o.kind)}${o.docNo ? " · No. " + esc(o.docNo) : ""}</span></div>
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
    addon: /Reactivation add-on: \*\*(.+?)\*\*/.exec(md)?.[1] ?? "",
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
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#e7e6e2}
body{font:10.4pt/1.58 Newsreader,"Iowan Old Style",Georgia,serif;color:#1d2024;font-variation-settings:"opsz" 12}
.sans,h1,h2,h3,.k,th,.meta,.toc,.sig-k,.sig-l,.terms td,.terms th,.cover{font-family:Inter,-apple-system,"Segoe UI",sans-serif}
strong{font-weight:600;color:#121417}
.blank{font-family:Inter,sans-serif;font-size:.86em;color:#8a5a12;background:#fbefd6;border-bottom:1px dashed #d9a441;padding:0 3px;border-radius:2px}
a{color:#121417;text-decoration-color:#d97757}
/* screen: sheets of paper on a grey desk */
.sheet{background:#fff;width:8.5in;margin:28px auto;padding:.85in .9in .9in;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08)}
@media print{html{background:#fff}.sheet{width:auto;margin:0;padding:0;box-shadow:none}.sheet+.sheet{break-before:page}}
/* cover */
@media screen and (max-width:900px){.sheet{width:auto;margin:10px;padding:.45in .4in}.cover{min-height:0;height:auto}}
.cover{min-height:11in;display:flex;flex-direction:column;position:relative}
@media print{.cover{min-height:0;height:9.2in;padding:0}}
.cover .rule{height:4px;width:72px;background:linear-gradient(90deg,#f0a07a,#d97757 55%,#b8583b);margin:1.5in 0 26px}
.cover .kind{font-size:10pt;font-weight:600;color:#b8583b;letter-spacing:.02em;margin-bottom:10px}
.cover h1{font:600 38pt/1.04 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.03em;color:#121417;max-width:6in}
.cover .between{margin-top:18px;font:400 13pt/1.45 Newsreader,Georgia,serif;color:#4a4f57;max-width:5.4in}
.cover .between b{color:#121417;font-weight:600}
.cover dl{margin-top:.55in;display:grid;grid-template-columns:repeat(4,auto);gap:6px 34px;justify-content:start;border-top:1px solid #e4e2dd;padding-top:16px}
.cover dt{font-size:7.6pt;font-weight:600;color:#80858d;letter-spacing:.04em}
.cover dd{font-size:10pt;color:#121417;font-weight:500}
.toc{margin-top:auto;font-size:8.8pt;color:#4a4f57;columns:2;column-gap:36px;border-top:1px solid #e4e2dd;padding-top:16px}
.toc p{display:flex;gap:8px;break-inside:avoid;padding:2px 0}
.toc p span:first-child{color:#b8583b;min-width:20px;font-weight:600}
.cover-foot{margin-top:22px;display:flex;justify-content:space-between;font-size:7.6pt;color:#9a9fa6}
/* summary */
.k{font-size:7.6pt;font-weight:600;letter-spacing:.05em;color:#b8583b}
h2.pg{font:600 17pt/1.2 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.015em;color:#121417;margin:4px 0 16px}
.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dcdad5;border-radius:8px;overflow:hidden;margin-bottom:18px}
.party{padding:13px 16px;font-size:9.6pt;line-height:1.5}
.party+.party{border-left:1px solid #dcdad5}
.party .k{margin-bottom:5px}
.party .pn{display:block;font:600 10.4pt/1.35 Inter,sans-serif;color:#121417;margin-bottom:2px}
.party .pe{color:#6b717a}
.party .pl{display:block}
.cover>svg{align-self:flex-start}
table{width:100%;border-collapse:collapse}
.terms{margin-bottom:8px}
.terms th,.terms td{text-align:left;vertical-align:top;padding:8px 12px;border-bottom:1px solid #e8e6e2;font-size:9.4pt}
.terms th{width:28%;font-weight:600;color:#4a4f57;background:#f7f6f3}
.terms tr:first-child th,.terms tr:first-child td{border-top:1px solid #dcdad5}
.terms td b{font-weight:600;color:#121417}
.note{font-size:8.4pt;color:#6b717a;font-style:italic;margin-top:6px}
/* terms */
h2{font:600 11pt/1.3 Inter,sans-serif;color:#121417;margin:20px 0 7px;break-after:avoid;display:flex;gap:10px}
h2 .n{min-width:24px;color:#b8583b}
h3{font:600 9.6pt Inter,sans-serif;color:#121417;margin:14px 0 6px;break-after:avoid}
p{margin:0 0 7px;orphans:3;widows:3}
.cl{display:grid;grid-template-columns:34px 1fr;margin-bottom:6px}
.cl .n{font:500 8.8pt Inter,sans-serif;color:#80858d;padding-top:2px}
ul,ol{margin:0 0 9px 34px}li{margin-bottom:3px;padding-left:2px}
ul.alpha{list-style:none;margin-left:34px}
.grid{margin:6px 0 10px}
.grid th{font:600 7.8pt Inter,sans-serif;color:#4a4f57;background:#f7f6f3;border-top:1px solid #dcdad5;border-bottom:1px solid #dcdad5;padding:6px 10px;text-align:left}
.grid td{padding:7px 10px;border-bottom:1px solid #e8e6e2;font-size:9.6pt;vertical-align:top}
.grid .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
/* signatures */
.sig{break-inside:avoid;margin-top:8px}
.sig-intro{margin-bottom:22px}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-k{font-size:7.6pt;font-weight:600;letter-spacing:.05em;color:#b8583b;margin-bottom:2px}
.sig-who{font:600 10.4pt Inter,sans-serif;margin-bottom:22px}
.sig-line{border-bottom:1px solid #121417;height:40px;display:flex;align-items:flex-end;padding-bottom:3px}
.sig-line .ink{font:italic 500 17pt/1 Newsreader,Georgia,serif;color:#16233f}
.sig-l{font-size:7.4pt;color:#6b717a;margin:4px 0 14px}
.sig-val{border-bottom:1px solid #c9c7c2;min-height:22px;font-size:10pt;padding-top:3px}
.esign{margin-top:18px;padding:10px 14px;background:#f7f6f3;border-left:2px solid #d97757;font:8.6pt/1.5 Inter,sans-serif;color:#4a4f57}
/* schedules */
.sched-head{padding-bottom:12px;border-bottom:3px solid #d97757;margin-bottom:16px}
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
    ["Setup fee", `<b>${legalInline(f.setup)}</b>, due on signing (Section 2.1)`],
    ["Monthly fee", `<b>${legalInline(f.monthly)}</b> a month${f.addon ? `, plus the Reactivation add-on at ${legalInline(f.addon)}` : ""}, starting the day the first Booked Appointment lands (Section 2.2)`],
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
<div class="cover-foot"><span>${esc(business)} · cinderrevenue.com</span><span>Confidential. Prepared for ${legalInline(f.company || "the Client")}.</span></div>
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
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#e7e6e2}
body{font:10.4pt/1.62 Inter,-apple-system,"Segoe UI",sans-serif;color:#2a2e34}
.sheet{background:#fff;width:8.5in;margin:28px auto;padding:.8in .85in .85in;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08)}
@media print{html{background:#fff}.sheet{width:auto;margin:0;padding:0;box-shadow:none}}
@media screen and (max-width:900px){.sheet{width:auto;margin:10px;padding:.45in .4in}.cover{height:auto;min-height:9in}}
.cover{background:#121417;color:#f3f1ec;height:11in;padding:.9in .9in .8in;display:flex;flex-direction:column;position:relative;overflow:hidden}
@media print{.cover{width:8.5in;height:11in;padding:.9in .9in .8in;break-after:page}}
.cover::before{content:"";position:absolute;right:-1.6in;top:-1.4in;width:5.2in;height:5.2in;border-radius:50%;background:radial-gradient(circle at 38% 34%,rgba(247,205,182,.22),rgba(217,119,87,.12) 45%,rgba(18,20,23,0) 70%)}
.cover>svg{align-self:flex-start;position:relative}
.cover .rule{height:4px;width:72px;background:linear-gradient(90deg,#f0a07a,#d97757 55%,#b8583b);margin:2.1in 0 26px}
.cover .kind{font-size:10pt;font-weight:600;color:#e89a74;margin-bottom:12px}
.cover h1{font:600 34pt/1.06 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.03em;color:#fff;max-width:6.2in}
.cover .plan{margin-top:16px;font-size:12pt;color:#b9bcc2}
.cover .plan b{color:#fff;font-weight:600}
.cover dl{margin-top:auto;display:grid;grid-template-columns:1.4fr 1.4fr 1fr 1fr;gap:6px 26px;border-top:1px solid #34373d;padding-top:18px}
.cover dt{font-size:7.4pt;font-weight:600;color:#8d9198;letter-spacing:.05em;margin-bottom:3px}
.cover dd{font-size:9.6pt;color:#f3f1ec;line-height:1.45}
h2{font:600 17pt/1.2 "Inter Tight","Inter Display",Inter,sans-serif;letter-spacing:-.015em;color:#121417;margin:34px 0 12px;break-after:avoid;padding-top:14px;border-top:1px solid #e4e2dd}
.body>h2:first-child{margin-top:0;border-top:0;padding-top:0}
h3{font:600 11.4pt/1.3 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin:18px 0 6px;break-after:avoid}
p{margin:0 0 10px}
ul,ol{margin:0 0 14px;padding-left:20px}li{margin:4px 0;padding-left:3px}
ul li::marker{color:#d97757}ol li::marker{color:#b8583b;font-weight:600}
strong{font-weight:600;color:#121417}
a{display:inline-block;background:#121417;color:#fff;font-weight:600;text-decoration:none;padding:7px 14px;border-radius:7px;margin:2px 0;font-size:10pt}
a::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#d97757;margin-left:8px;vertical-align:middle}
table{width:100%;border-collapse:collapse;margin:8px 0 14px;break-inside:avoid;font-size:9.8pt}
th{text-align:left;font-weight:600;color:#80858d;font-size:8pt;border-bottom:1.5px solid #121417;padding:6px 14px 6px 0}
td{border-bottom:1px solid #e8e6e2;padding:10px 14px 10px 0;vertical-align:top}
td strong{font:600 14pt "Inter Tight",Inter,sans-serif;letter-spacing:-.01em}
.cards{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px;margin:8px 0 16px;break-inside:avoid}
.cd{border:1px solid #e4e2dd;border-top:3px solid #d97757;border-radius:10px;padding:14px;background:#fcfcfa}
.cd b{display:block;font:600 11pt/1.25 "Inter Tight","Inter Display",Inter,sans-serif;color:#121417;margin-bottom:6px}
.cd span{font-size:9.2pt;line-height:1.5;color:#4a5059}
.accept{margin-top:30px;padding-top:16px;border-top:1px solid #e4e2dd;break-inside:avoid}
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
<section class="sheet cover">${wordmark("#f3f1ec", 30)}<div class="rule"></div><p class="kind">Proposal</p><h1>${inline(title)}</h1>${plan ? `<p class="plan">Recommended plan: <b>${inline(plan)}</b></p>` : ""}
<dl><div><dt>PREPARED FOR</dt><dd>${inline(person || "")}${co.length ? "<br>" + inline(co.join(", ")) : ""}</dd></div><div><dt>PREPARED BY</dt><dd>${esc(o.preparedBy || "Samuel Ward")}<br>${esc(business)}</dd></div><div><dt>DATE</dt><dd>${inline(date)}${valid ? `<br><span style="color:#8d9198">Valid until ${esc(valid)}</span>` : ""}</dd></div><div><dt>PROPOSAL NO.</dt><dd>${esc(o.no)}</dd></div></dl></section>
<section class="sheet"><div class="body">${markdownToHtml(rest)}</div>
<div class="accept"><h3>Acceptance</h3><p>Accepting this proposal means you'd like to start. Your service agreement follows, and the agreement's terms govern the work.</p>
<div class="grid"><div><div class="ln"></div><p class="lb">Signature</p></div><div><div class="ln"></div><p class="lb">Printed name</p></div><div><div class="ln"></div><p class="lb">Date</p></div></div></div></section>
${o.autoPrint ? `<script>document.fonts.ready.then(()=>setTimeout(()=>print(),200))</script>` : ""}</body></html>`;
}
