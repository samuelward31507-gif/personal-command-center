// A small MP4 writer for one H.264 video track, built from WebCodecs output (avc format: length-prefixed
// samples plus the avcC record as `description`). The moov box goes first so the file plays as it downloads
// and Instagram, TikTok and Facebook accept it. No B-frames (Chrome's encoder doesn't make them), so no ctts.

export type Mp4Sample = { data: Uint8Array; key: boolean; duration: number };
export type Mp4Track = { width: number; height: number; timescale: number; avcC: Uint8Array; samples: Mp4Sample[] };

const enc = new TextEncoder();
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const size = 8 + parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(enc.encode(type), 4);
  let o = 8; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const full = (type: string, version: number, flags: number, ...parts: Uint8Array[]) => box(type, u8(version), u24(flags), ...parts);
const u8 = (v: number) => Uint8Array.of(v & 255);
const u16 = (v: number) => Uint8Array.of((v >> 8) & 255, v & 255);
const u24 = (v: number) => Uint8Array.of((v >> 16) & 255, (v >> 8) & 255, v & 255);
const u32 = (v: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); return b; };
const zeros = (n: number) => new Uint8Array(n);
const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32);
const cat = (parts: Uint8Array[]) => { const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

function moov(t: Mp4Track, mdatOffset: number): Uint8Array {
  const n = t.samples.length;
  const duration = t.samples.reduce((a, s) => a + s.duration, 0);
  const mvhd = full("mvhd", 0, 0, u32(0), u32(0), u32(t.timescale), u32(duration), u32(0x00010000), u16(0x0100), zeros(10), ...MATRIX, zeros(24), u32(2));
  const tkhd = full("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(duration), zeros(8), u16(0), u16(0), u16(0), u16(0), ...MATRIX, u32(t.width << 16), u32(t.height << 16));
  const mdhd = full("mdhd", 0, 0, u32(0), u32(0), u32(t.timescale), u32(duration), u16(0x55c4), u16(0));
  const hdlr = full("hdlr", 0, 0, u32(0), enc.encode("vide"), zeros(12), enc.encode("VideoHandler\0"));
  const vmhd = full("vmhd", 0, 1, zeros(8));
  const dinf = box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1)));
  const name = zeros(32);
  const avc1 = box("avc1", zeros(6), u16(1), zeros(16), u16(t.width), u16(t.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), name, u16(0x18), u16(0xffff),
    box("avcC", t.avcC), box("pasp", u32(1), u32(1)));
  const stsd = full("stsd", 0, 0, u32(1), avc1);
  // Durations, run-length coded.
  const runs: [number, number][] = [];
  for (const s of t.samples) { const last = runs[runs.length - 1]; if (last && last[1] === s.duration) last[0]++; else runs.push([1, s.duration]); }
  const stts = full("stts", 0, 0, u32(runs.length), ...runs.flatMap(([c, d]) => [u32(c), u32(d)]));
  const keys = t.samples.flatMap((s, i) => (s.key ? [i + 1] : []));
  const stss = full("stss", 0, 0, u32(keys.length), ...keys.map(u32));
  const stsc = full("stsc", 0, 0, u32(1), u32(1), u32(n), u32(1)); // every sample in one chunk
  const stsz = full("stsz", 0, 0, u32(0), u32(n), ...t.samples.map(s => u32(s.data.length)));
  const stco = full("stco", 0, 0, u32(1), u32(mdatOffset));
  const stbl = box("stbl", stsd, stts, stss, stsc, stsz, stco);
  const minf = box("minf", vmhd, dinf, stbl);
  return box("moov", mvhd, box("trak", tkhd, box("mdia", mdhd, hdlr, minf)));
}

/** The finished file. */
export function muxMp4(t: Mp4Track): Uint8Array {
  if (!t.samples.length) throw new Error("No video frames.");
  if (!t.samples[0].key) throw new Error("The first frame must be a key frame.");
  const ftyp = box("ftyp", enc.encode("isom"), u32(0x200), enc.encode("isom"), enc.encode("iso2"), enc.encode("avc1"), enc.encode("mp41"));
  const mdatSize = 8 + t.samples.reduce((a, s) => a + s.data.length, 0);
  const moovLen = moov(t, 0).length; // same length whatever the offset
  const m = moov(t, ftyp.length + moovLen + 8);
  const head = new Uint8Array(8); new DataView(head.buffer).setUint32(0, mdatSize); head.set(enc.encode("mdat"), 4);
  return cat([ftyp, m, head, ...t.samples.map(s => s.data)]);
}
