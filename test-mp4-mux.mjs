// MP4 writer check: encode a short clip with x264, rebuild it the way WebCodecs hands it over (length-prefixed
// samples + avcC), write it with lib/mp4-mux.ts, and make sure ffmpeg plays every frame back. Skips without ffmpeg.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { muxMp4 } from "./lib/mp4-mux.ts";

let ff = true; try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { ff = false; }
if (!ff) { console.log("MP4 writer check skipped (no ffmpeg)."); process.exit(0); }
const dir = mkdtempSync(join(tmpdir(), "mux-"));
const raw = join(dir, "in.h264"), out = join(dir, "out.mp4");
execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=2", "-c:v", "libx264", "-bf", "0", "-g", "30", "-pix_fmt", "yuv420p", "-profile:v", "high", "-f", "h264", raw]);
const b = readFileSync(raw);
// Split Annex B into NAL units.
const nals = []; let i = 0, start = -1;
while (i < b.length - 3) {
  const sc = b[i] === 0 && b[i + 1] === 0 && (b[i + 2] === 1 || (b[i + 2] === 0 && b[i + 3] === 1));
  if (sc) { if (start >= 0) nals.push(b.subarray(start, i)); i += b[i + 2] === 1 ? 3 : 4; start = i; } else i++;
}
nals.push(b.subarray(start));
const sps = nals.find(n => (n[0] & 31) === 7), pps = nals.find(n => (n[0] & 31) === 8);
const avcC = Uint8Array.from([1, sps[1], sps[2], sps[3], 0xff, 0xe1, sps.length >> 8, sps.length & 255, ...sps, 1, pps.length >> 8, pps.length & 255, ...pps]);
const samples = []; let cur = [], key = false;
for (const n of nals) {
  const t = n[0] & 31;
  if (t === 7 || t === 8 || t === 9) continue;
  if ((t === 1 || t === 5) && cur.some(x => ((x[0] & 31) === 1 || (x[0] & 31) === 5))) { samples.push({ cur, key }); cur = []; key = false; }
  cur.push(n); if (t === 5) key = true;
}
samples.push({ cur, key });
const toSample = ({ cur, key }) => { const len = cur.reduce((a, n) => a + 4 + n.length, 0), data = new Uint8Array(len); let o = 0; for (const n of cur) { new DataView(data.buffer).setUint32(o, n.length); data.set(n, o + 4); o += 4 + n.length; } return { data, key, duration: 1000 }; };
const file = muxMp4({ width: 1080, height: 1920, timescale: 30000, avcC, samples: samples.map(toSample) });
writeFileSync(out, file);
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", out]).toString());
const s = probe.streams[0];
assert.equal(s.codec_name, "h264");
assert.equal(s.width, 1080); assert.equal(s.height, 1920);
assert.equal(Number(s.nb_read_frames), 60);
assert.ok(Math.abs(Number(probe.format.duration) - 2) < 0.05);
assert.equal(execFileSync("ffmpeg", ["-v", "error", "-i", out, "-f", "null", "-"]).toString(), "");
// moov comes before mdat (plays while downloading)
const s4 = Buffer.from(file).toString("latin1");
assert.ok(s4.indexOf("moov") < s4.indexOf("mdat"));
assert.throws(() => muxMp4({ width: 2, height: 2, timescale: 30, avcC, samples: [] }));
console.log("MP4 writer checks passed (60 frames decoded).");
