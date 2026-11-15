"use client";

// Turns a reel's scenes into a 9:16 1080×1920 video in the browser.
// Every frame is drawn on its own and encoded with the browser's H.264 encoder (WebCodecs), then written to MP4
// by lib/mp4-mux.ts. Nothing records in real time, so there are no dropped frames, it's faster than real time,
// and it keeps going in a background tab. Browsers without WebCodecs H.264 fall back to recording.
// Finished reels are kept in this browser (IndexedDB) so they're made once, not on every visit.
import { drawCard, drawFooter, W, RH } from "./post-card";
import type { Card } from "@/lib/content-engine";
import { muxMp4, type Mp4Sample } from "@/lib/mp4-mux";

const FPS = 30;
const BITRATE = 8_000_000; // text on a flat background: most frames cost far less than this
const words = (c: Card) => (c.type === "hook" ? `${c.text} ${c.sub ?? ""}` : c.type === "stat" ? `${c.figure} ${c.line}` : c.type === "list" ? `${c.title} ${c.items.join(" ")}` : c.messages.map(m => m.text).join(" ")).split(/\s+/).filter(Boolean).length;
/** Seconds a scene stays up: enough to read it twice at a glance, never under 2s or over 4.8s. */
export const sceneSeconds = (c: Card) => Math.min(4.8, Math.max(2, 1.2 + words(c) * 0.28));

/** Scenes for a reel: the written scenes, or the hook plus the post's sentences when there are none. */
export function scenesFor(d: { hook: string; body: string; slides: Card[]; card: Card }): Card[] {
  if (d.slides.length >= 3) return d.slides;
  const sentences = d.body.replace(/\s+/g, " ").split(/(?<=[.?!])\s+/).filter(s => s.length > 3).slice(0, 4);
  const seen = new Set([d.hook.toLowerCase()]);
  const lines = sentences.filter(t => { const k = t.toLowerCase(); if (seen.has(k) || k.includes(d.hook.toLowerCase())) return false; seen.add(k); return true; });
  return [{ type: "hook" as const, text: d.hook }, ...(d.card.type !== "hook" ? [d.card] : []), ...lines.map(text => ({ type: "hook" as const, text }))].slice(0, 6);
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const inOutSine = (x: number) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;

/** A drawing function for the reel: call it with a time in seconds and it paints that frame on `canvas`. */
export function reelScene(scenes: Card[]) {
  const stills = scenes.map(c => { const s = document.createElement("canvas"); s.width = W; s.height = RH; drawCard(s.getContext("2d")!, c, { noFoot: true }); return s; });
  const durs = scenes.map(sceneSeconds);
  const total = durs.reduce((a, b) => a + b, 0) + 0.6; // the last scene holds a beat longer
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = RH;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const mask = document.createElement("canvas"); mask.width = W; mask.height = RH;
  const mctx = mask.getContext("2d")!;
  ctx.imageSmoothingQuality = "high"; mctx.imageSmoothingQuality = "high";
  const T = 0.55, FEATHER = 420;

  const draw = (t: number) => {
    let i = 0, start = 0;
    while (i < durs.length - 1 && t >= start + durs[i]) { start += durs[i]; i++; }
    const local = t - start;
    ctx.globalAlpha = 1; ctx.fillStyle = "#f6f6f4"; ctx.fillRect(0, 0, W, RH);
    // Slow push-in across the whole scene.
    const zoomOf = (k: number, x: number) => 1 + 0.03 * inOutSine(x / durs[k]);
    const place = (img: CanvasImageSource, zoom: number, dy: number, alpha: number) => {
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(W / 2, RH / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -RH / 2 + dy);
      ctx.drawImage(img, 0, 0); ctx.restore();
    };
    const entering = i > 0 && local < T;
    const live = i > 0 && scenes[i].type === "hook"; // a hook's words animate in; others wipe in
    if (live) {
      if (local < 0.3) { const o = outCubic(local / 0.3); place(stills[i - 1], zoomOf(i - 1, durs[i - 1]), -60 * o, 1 - o); }
      const z = zoomOf(i, local);
      ctx.save(); ctx.translate(W / 2, RH / 2); ctx.scale(z, z); ctx.translate(-W / 2, -RH / 2);
      drawCard(ctx, scenes[i], { noFoot: true, noBg: true, t: local - 0.12 });
      ctx.restore();
    } else if (entering) {
      // Outgoing scene lifts and fades.
      const o = outCubic(local / (T * 0.7));
      place(stills[i - 1], zoomOf(i - 1, durs[i - 1]), -70 * o, 1 - o);
      // Incoming scene wipes in top to bottom with a soft edge, rising into place.
      const p = outCubic(local / T);
      const edge = -FEATHER + (RH + FEATHER * 2) * outCubic(local / (T * 1.15));
      mctx.globalCompositeOperation = "source-over"; mctx.clearRect(0, 0, W, RH); mctx.drawImage(stills[i], 0, 0);
      mctx.globalCompositeOperation = "destination-in";
      const g = mctx.createLinearGradient(0, edge - FEATHER, 0, edge);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = g; mctx.fillRect(0, 0, W, RH);
      place(mask, zoomOf(i, local), 44 * (1 - p), Math.max(0.001, p));
    } else {
      // The first frame shows the hook fully, so it works as the cover.
      place(stills[i], zoomOf(i, local), 0, 1);
    }
    ctx.globalAlpha = 1; drawFooter(ctx);
    // Story-style progress bars, one per scene.
    const gap = 10, bw = (W - 96 * 2 - gap * (durs.length - 1)) / durs.length;
    durs.forEach((d, k) => {
      const x = 96 + k * (bw + gap), fill = k < i ? 1 : k > i ? 0 : clamp(local / d);
      ctx.fillStyle = "rgba(18,20,23,.12)"; roundRect(ctx, x, 300, bw, 6);
      if (fill > 0) { ctx.fillStyle = "#121417"; roundRect(ctx, x, 300, bw * fill, 6); }
    });
  };
  return { canvas, draw, total };
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, h / 2) : ctx.rect(x, y, w, h); ctx.fill();
}

const CODECS = ["avc1.640032", "avc1.640028", "avc1.4d0032", "avc1.4d0028", "avc1.420032", "avc1.420028"];
async function avcConfig(): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of CODECS) {
    const cfg: VideoEncoderConfig = { codec, width: W, height: RH, bitrate: BITRATE, bitrateMode: "variable", framerate: FPS, latencyMode: "quality", avc: { format: "avc" } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { /* try the next */ }
  }
  return null;
}

async function encodeFrames(s: ReturnType<typeof reelScene>, cfg: VideoEncoderConfig, onProgress?: (p: number) => void): Promise<Blob> {
  const samples: Mp4Sample[] = [];
  let avcC: Uint8Array | null = null, failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const desc = meta?.decoderConfig?.description;
      if (desc && !avcC) avcC = ArrayBuffer.isView(desc) ? new Uint8Array(desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength)) : new Uint8Array((desc as ArrayBuffer).slice(0));
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
      samples.push({ data, key: chunk.type === "key", duration: 1000 });
    },
    error: e => { failure = e; },
  });
  encoder.configure(cfg);
  const frames = Math.round(s.total * FPS), step = 1e6 / FPS;
  for (let f = 0; f < frames; f++) {
    if (failure) break;
    s.draw(f / FPS);
    const vf = new VideoFrame(s.canvas, { timestamp: Math.round(f * step), duration: Math.round(step) });
    encoder.encode(vf, { keyFrame: f % (FPS * 2) === 0 });
    vf.close();
    // Don't run ahead of the encoder; also gives the page a moment to stay responsive.
    while (encoder.encodeQueueSize > 3 && !failure) await new Promise(r => setTimeout(r, 4));
    if (f % 10 === 0) { onProgress?.(f / frames); await new Promise(r => setTimeout(r, 0)); }
  }
  if (!failure) await encoder.flush().catch(e => { failure = e; });
  if (encoder.state !== "closed") encoder.close();
  if (failure) throw failure instanceof Error ? failure : new Error("The video encoder stopped.");
  if (!avcC) throw new Error("The video encoder gave no stream header.");
  onProgress?.(1);
  return new Blob([muxMp4({ width: W, height: RH, timescale: FPS * 1000, avcC, samples }) as BlobPart], { type: "video/mp4" });
}

function recorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}
/** Fallback: record the canvas in real time, one requested frame at a time. */
async function recordFrames(s: ReturnType<typeof reelScene>, onProgress?: (p: number) => void): Promise<Blob> {
  const mime = recorderMime();
  if (!mime) throw new Error("This browser can't make video. Use Chrome or Edge on a computer.");
  s.draw(0);
  const stream = s.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: mime.split(";")[0] })); });
  rec.start(500);
  const t0 = performance.now();
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      s.draw(Math.min(t, s.total - 0.01)); track.requestFrame?.();
      onProgress?.(Math.min(1, t / s.total));
      if (t >= s.total) resolve(); else setTimeout(tick, 1000 / FPS);
    };
    tick();
  });
  rec.stop(); stream.getTracks().forEach(t => t.stop());
  return done;
}

/** Make the reel. `onProgress` gets 0–1. */
export async function renderReel(scenes: Card[], onProgress?: (p: number) => void): Promise<Blob> {
  await document.fonts?.ready;
  const s = reelScene(scenes);
  const cfg = await avcConfig();
  if (cfg) { try { return await encodeFrames(s, cfg, onProgress); } catch (e) { console.warn("Encoder failed, recording instead", e); } }
  return recordFrames(s, onProgress);
}

export const reelExt = (b: Blob) => (b.type.includes("mp4") ? "mp4" : "webm");

export function downloadBlob(b: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

// ---- Made once, kept in this browser ----
const VERSION = "r2";
export function reelKey(id: string, scenes: Card[]): string {
  const s = JSON.stringify(scenes); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${VERSION}:${id}:${(h >>> 0).toString(36)}`;
}
function store(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    try {
      const r = indexedDB.open("cinder-reels", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("reels");
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function cacheGet(key: string): Promise<Blob | null> {
  const db = await store(); if (!db) return null;
  return new Promise(res => { try { const q = db.transaction("reels").objectStore("reels").get(key); q.onsuccess = () => res(q.result instanceof Blob ? q.result : null); q.onerror = () => res(null); } catch { res(null); } });
}
async function cachePut(key: string, blob: Blob): Promise<void> {
  const db = await store(); if (!db) return;
  await new Promise<void>(res => { try { const tx = db.transaction("reels", "readwrite"); tx.objectStore("reels").put(blob, key); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch { res(); } });
}
/** The reel for a post: from this browser if it was made before, otherwise made now and kept. */
export async function getReel(id: string, scenes: Card[], onProgress?: (p: number) => void): Promise<{ blob: Blob; fresh: boolean }> {
  const key = reelKey(id, scenes);
  const hit = await cacheGet(key);
  if (hit) { onProgress?.(1); return { blob: hit, fresh: false }; }
  const blob = await renderReel(scenes, onProgress);
  await cachePut(key, blob);
  return { blob, fresh: true };
}
