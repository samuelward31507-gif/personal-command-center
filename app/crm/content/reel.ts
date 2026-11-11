"use client";

// Turns a reel's scenes into a 9:16 video in the browser: each scene slides in, holds long enough to read,
// with story-style progress bars on top. Records MP4 where the browser can (Chrome and Safari), WebM otherwise.
// No server and no video service; the tab has to stay open while it records (browsers slow hidden tabs).
import { drawCard, W, RH } from "./post-card";
import type { Card } from "@/lib/content-engine";

const FPS = 30;
const words = (c: Card) => (c.type === "hook" ? `${c.text} ${c.sub ?? ""}` : c.type === "stat" ? `${c.figure} ${c.line}` : c.type === "list" ? `${c.title} ${c.items.join(" ")}` : c.messages.map(m => m.text).join(" ")).split(/\s+/).filter(Boolean).length;
/** Seconds a scene stays up: enough to read it twice at a glance, never under 1.8s or over 4.6s. */
export const sceneSeconds = (c: Card) => Math.min(4.6, Math.max(1.8, 1.1 + words(c) * 0.28));

export function reelMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

/** Scenes for a reel: the written scenes, or the hook plus the post's sentences when there are none. */
export function scenesFor(d: { hook: string; body: string; slides: Card[]; card: Card }): Card[] {
  if (d.slides.length >= 3) return d.slides;
  const sentences = d.body.replace(/\s+/g, " ").split(/(?<=[.?!])\s+/).filter(s => s.length > 3).slice(0, 4);
  const seen = new Set([d.hook.toLowerCase()]);
  const lines = sentences.filter(t => { const k = t.toLowerCase(); if (seen.has(k) || k.includes(d.hook.toLowerCase())) return false; seen.add(k); return true; });
  return [{ type: "hook" as const, text: d.hook }, ...(d.card.type !== "hook" ? [d.card] : []), ...lines.map(text => ({ type: "hook" as const, text }))].slice(0, 6);
}

/** Record the reel. `onProgress` gets 0–1. Resolves with the video file. */
export async function renderReel(scenes: Card[], onProgress?: (p: number) => void): Promise<Blob> {
  const mime = reelMime();
  if (!mime) throw new Error("This browser can't record video. Use Chrome on a computer.");
  await document.fonts?.ready;
  // Each scene drawn once, then composited with motion.
  const stills = scenes.map(c => { const s = document.createElement("canvas"); s.width = W; s.height = RH; drawCard(s.getContext("2d")!, c); return s; });
  const durs = scenes.map(sceneSeconds);
  const total = durs.reduce((a, b) => a + b, 0) + 0.4;
  const out = document.createElement("canvas"); out.width = W; out.height = RH;
  const ctx = out.getContext("2d")!;
  const stream = out.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_400_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: mime.split(";")[0] })); });

  const frame = (t: number) => {
    let i = 0, start = 0;
    while (i < durs.length - 1 && t >= start + durs[i]) { start += durs[i]; i++; }
    const local = t - start, ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const inP = ease(local / 0.35);
    ctx.fillStyle = "#f6f6f4"; ctx.fillRect(0, 0, W, RH);
    // Previous scene fades out underneath while the new one slides up.
    if (i > 0 && local < 0.35) { ctx.globalAlpha = 1 - inP; ctx.drawImage(stills[i - 1], 0, -40 * inP); }
    ctx.globalAlpha = i === 0 ? Math.max(inP, 0.0001) : inP;
    const zoom = 1 + 0.025 * Math.min(1, local / durs[i]);
    ctx.save(); ctx.translate(W / 2, RH / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -RH / 2 + 40 * (1 - inP));
    ctx.drawImage(stills[i], 0, 0); ctx.restore(); ctx.globalAlpha = 1;
    // Progress bars, one per scene.
    const gap = 10, bw = (W - 96 * 2 - gap * (durs.length - 1)) / durs.length;
    durs.forEach((d, k) => {
      const x = 96 + k * (bw + gap), fill = k < i ? 1 : k > i ? 0 : Math.min(1, local / d);
      ctx.fillStyle = "rgba(18,20,23,.12)"; ctx.fillRect(x, 300, bw, 6);
      ctx.fillStyle = "#121417"; ctx.fillRect(x, 300, bw * fill, 6);
    });
  };

  frame(0);
  rec.start(500);
  const t0 = performance.now();
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      frame(Math.min(t, total - 0.01));
      onProgress?.(Math.min(1, t / total));
      if (t >= total) resolve(); else setTimeout(tick, 1000 / FPS);
    };
    tick();
  });
  rec.stop();
  stream.getTracks().forEach(t => t.stop());
  return done;
}

export const reelExt = (b: Blob) => (b.type.includes("mp4") ? "mp4" : "webm");

export function downloadBlob(b: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
