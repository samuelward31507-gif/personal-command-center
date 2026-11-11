"use client";

// Draws a post's image (1080×1350, the 4:5 size Instagram and Facebook show biggest) in the site's look,
// right in the browser, so every post has an image to download. No server, no image service.
import { useEffect, useRef } from "react";
import { wrap, type Card } from "@/lib/content-engine";

export const W = 1080, H = 1350;
const C = { bg: "#f6f6f4", card: "#ffffff", text: "#121417", text2: "#4a4f57", text3: "#80858d", line: "rgba(18,20,23,.10)", blue: "#0a84ff", grey: "#e6e6e9", ok: "#17905a" };

function fam(v: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const f = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return f ? `${f}, ${fallback}` : fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Fit text into a box: the biggest size from `sizes` whose lines fit `maxLines`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, sizes: number[], maxW: number, maxLines: number) {
  for (const s of sizes) {
    ctx.font = `${weight} ${s}px ${family}`;
    const lines = wrap(text, maxW, t => ctx.measureText(t).width);
    if (lines.length <= maxLines) return { size: s, lines };
  }
  const s = sizes[sizes.length - 1]; ctx.font = `${weight} ${s}px ${family}`;
  return { size: s, lines: wrap(text, maxW, t => ctx.measureText(t).width).slice(0, maxLines) };
}

export function drawCard(ctx: CanvasRenderingContext2D, card: Card, meta: { page?: string } = {}) {
  const head = fam("--font-display", "Inter Tight, Inter, system-ui, sans-serif");
  const sans = fam("--font-geist-sans", "Inter, system-ui, sans-serif");
  const P = 96;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Footer on every card: wordmark left, site right.
  const foot = () => {
    ctx.fillStyle = C.text; ctx.font = `600 40px ${head}`; ctx.fillText("cinder", P, H - 92);
    ctx.fillStyle = C.text3; ctx.font = `500 28px ${sans}`;
    const site = "cinderrevenue.com"; ctx.fillText(site, W - P - ctx.measureText(site).width, H - 94);
    if (meta.page) { ctx.fillText(meta.page, W / 2 - ctx.measureText(meta.page).width / 2, H - 94); }
  };

  if (card.type === "hook") {
    const t = fit(ctx, card.text, 600, head, [104, 94, 84, 74, 66], W - P * 2, 7);
    const lh = t.size * 1.08;
    const subLines = card.sub ? (ctx.font = `400 42px ${sans}`, wrap(card.sub, W - P * 2, s => ctx.measureText(s).width).slice(0, 3)) : [];
    const block = t.lines.length * lh + (subLines.length ? 40 + subLines.length * 58 : 0);
    let y = Math.max(220, (H - block) / 2 - 40) + t.size;
    ctx.fillStyle = C.text; ctx.font = `600 ${t.size}px ${head}`;
    for (const l of t.lines) { ctx.fillText(l, P, y); y += lh; }
    if (subLines.length) { y += 24; ctx.fillStyle = C.text2; ctx.font = `400 42px ${sans}`; for (const l of subLines) { ctx.fillText(l, P, y); y += 58; } }
  } else if (card.type === "stat") {
    const f = fit(ctx, card.figure, 600, head, [320, 280, 240, 200], W - P * 2, 1);
    ctx.fillStyle = C.text; ctx.font = `600 ${f.size}px ${head}`; ctx.fillText(card.figure, P - 8, 300 + f.size * .8);
    let y = 300 + f.size * .8 + 110;
    const t = fit(ctx, card.line, 500, head, [64, 58, 52], W - P * 2, 5);
    ctx.font = `500 ${t.size}px ${head}`;
    for (const l of t.lines) { ctx.fillText(l, P, y); y += t.size * 1.18; }
    ctx.fillStyle = C.text3; ctx.font = `400 32px ${sans}`; ctx.fillText(card.source, P, y + 30);
  } else if (card.type === "thread") {
    // Lay the bubbles out first, then draw the phone screen just tall enough to hold them, centered.
    const x = P, w = W - P * 2, maxB = w * .72, pad = 30, fs = 36, lh = 46, maxH = H - 196 - 200;
    ctx.font = `400 ${fs}px ${sans}`;
    const bubbles: { m: typeof card.messages[number]; lines: string[]; bw: number; bh: number }[] = [];
    let used = 64;
    for (const m of card.messages) {
      const lines = wrap(m.text, maxB - pad * 2, s => ctx.measureText(s).width);
      const bw = Math.min(maxB, Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2), bh = lines.length * lh + 34;
      if (used + bh + 64 > maxH) break;
      bubbles.push({ m, lines, bw, bh }); used += bh + 18;
    }
    const h = Math.max(420, used - 18 + 64), y0 = Math.max(196, (H - 120 - h) / 2 + 30);
    ctx.fillStyle = C.text3; ctx.font = `500 30px ${sans}`; ctx.fillText(card.title, P, y0 - 40);
    ctx.save(); ctx.shadowColor = "rgba(18,20,23,.14)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
    roundRect(ctx, x, y0, w, h, 48); ctx.fillStyle = C.card; ctx.fill(); ctx.restore();
    roundRect(ctx, x, y0, w, h, 48); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    let y = y0 + 64; ctx.font = `400 ${fs}px ${sans}`;
    for (const { m, lines, bw, bh } of bubbles) {
      const bx = m.from === "out" ? x + w - 40 - bw : x + 40;
      roundRect(ctx, bx, y, bw, bh, 34); ctx.fillStyle = m.from === "out" ? C.blue : C.grey; ctx.fill();
      ctx.fillStyle = m.from === "out" ? "#fff" : C.text;
      lines.forEach((l, i) => ctx.fillText(l, bx + pad, y + 50 + i * lh));
      y += bh + 18;
    }
  } else {
    const t = fit(ctx, card.title, 600, head, [80, 72, 64, 56], W - P * 2, 3);
    let y = 230; ctx.fillStyle = C.text; ctx.font = `600 ${t.size}px ${head}`;
    for (const l of t.lines) { ctx.fillText(l, P, y); y += t.size * 1.1; }
    y += 50;
    for (const item of card.items) {
      ctx.font = `400 44px ${sans}`;
      const lines = wrap(item, W - P * 2 - 64, s => ctx.measureText(s).width).slice(0, 3);
      ctx.beginPath(); ctx.arc(P + 14, y - 14, 14, 0, Math.PI * 2); ctx.fillStyle = C.ok; ctx.fill();
      ctx.fillStyle = C.text; lines.forEach((l, i) => ctx.fillText(l, P + 64, y + i * 58));
      y += lines.length * 58 + 44;
      if (y > H - 220) break;
    }
  }
  foot();
}

/** A preview of the card; `onReady` hands back the canvas so the parent can download it. */
export default function PostCard({ card, page, label, onCanvas }: { card: Card; page?: string; label: string; onCanvas?: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const draw = () => { const c = ref.current; const ctx = c?.getContext("2d"); if (!c || !ctx || !live) return; drawCard(ctx, card, { page }); onCanvas?.(c); };
    draw();
    document.fonts?.ready.then(draw).catch(() => {});
    return () => { live = false; };
  }, [card, page, onCanvas]);
  return <canvas ref={ref} width={W} height={H} className="cw-canvas" role="img" aria-label={label} />;
}

export function downloadCanvas(c: HTMLCanvasElement, name: string) {
  c.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
}
