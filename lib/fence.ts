// Measure-to-quote for fence, the pure part: run lengths from map points (geodesic, not pixels), the owner's rules
// per fence type, the material takeoff, and the quote lines for good / better / best. No database, no map library,
// so every number is tested by hand (test-fence.mjs).

export type LatLng = { lat: number; lng: number };
export type Run = { id: string; points: LatLng[]; kind: "new" | "tearout" };
export type Gate = { id: string; run: string; at: LatLng; type: "single" | "double"; width: number };
export type Drawing = { runs: Run[]; gates: Gate[]; center?: LatLng; zoom?: number };

/** A fence type the owner sets up once. Costs are what it costs the owner (private); prices are what the customer pays. */
export type FenceType = {
  id: string; name: string; height: number;
  postSpacing: number;        // feet between line posts
  railsPerSection: number;    // rails between two posts
  picketsPerFoot: number;     // fill units per linear foot: pickets, panels (1 per 8 ft = 0.125) or fabric feet (1)
  infill: string;             // what the fill is called on the material list: Pickets, Panels, Fabric (ft)
  concretePerPost: number;    // bags per post
  cost: { post: number; gatePost: number; rail: number; picket: number; concrete: number; gateSingle: number; gateDouble: number; laborPerFoot: number };
  price: { perFoot: number; gateSingle: number; gateDouble: number; tearoutPerFoot: number };
};

const R = 6371008.8, FT = 3.280839895;
const rad = (d: number) => (d * Math.PI) / 180;
/** Great-circle distance in feet (haversine). Accurate to well under an inch over a yard. */
export function feetBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * FT;
}
/** Each straight stretch of a run, in feet. */
export const segmentFeet = (r: Pick<Run, "points">) => r.points.slice(1).map((p, i) => feetBetween(r.points[i], p));
export const runFeet = (r: Pick<Run, "points">) => segmentFeet(r).reduce((a, b) => a + b, 0);
const r1 = (n: number) => Math.round(n * 10) / 10, r2 = (n: number) => Math.round(n * 100) / 100;

/** Total new fence and tear-out, in feet (to a tenth), and the gates. */
export function measureOf(d: Drawing): { newFeet: number; tearoutFeet: number; gates: { single: number; double: number }; gateFeet: number } {
  const newFeet = d.runs.filter(r => r.kind === "new").reduce((a, r) => a + runFeet(r), 0);
  const tearoutFeet = d.runs.filter(r => r.kind === "tearout").reduce((a, r) => a + runFeet(r), 0);
  const gates = { single: d.gates.filter(g => g.type === "single").length, double: d.gates.filter(g => g.type === "double").length };
  const gateFeet = d.gates.reduce((a, g) => a + g.width, 0);
  return { newFeet: r1(newFeet), tearoutFeet: r1(tearoutFeet), gates, gateFeet: r1(gateFeet) };
}

export type Takeoff = {
  fenceFeet: number; sections: number; posts: number; gatePosts: number; rails: number; pickets: number; concrete: number;
  gates: { single: number; double: number }; tearoutFeet: number;
  /** The owner's cost, line by line, and in total (private). */
  materials: { name: string; qty: number; unit: string; cost: number }[]; materialCost: number; laborCost: number;
};

/**
 * The materials for one fence type on a drawing. Each straight stretch of a new run is divided into sections no longer
 * than the post spacing; a run has one more post than it has sections (corners are shared, ends count once). Gates take
 * their width out of the fence and stand on two gate posts each, which replace line posts. Concrete goes in every post.
 */
export function takeoff(d: Drawing, t: FenceType): Takeoff {
  const runs = d.runs.filter(r => r.kind === "new" && r.points.length > 1);
  let sections = 0, posts = 0, fence = 0;
  for (const r of runs) {
    const gateFeet = d.gates.filter(g => g.run === r.id).reduce((a, g) => a + g.width, 0);
    const segs = segmentFeet(r), total = segs.reduce((a, b) => a + b, 0);
    const scale = total > 0 ? Math.max(0, total - gateFeet) / total : 0; // gates come out of the run proportionally
    // Lengths are counted to a tenth of a foot, as shown, so 160.0004 ft is 160 ft and not a 21st section.
    const s = segs.reduce((a, len) => { const l = r1(len * scale); return a + Math.max(l > 0.5 ? 1 : 0, Math.ceil(l / Math.max(1, t.postSpacing) - 1e-9)); }, 0);
    sections += s; fence += r1(total) - gateFeet;
    if (s) posts += s + 1;
  }
  const gates = { single: d.gates.filter(g => g.type === "single").length, double: d.gates.filter(g => g.type === "double").length };
  const gateCount = gates.single + gates.double, gatePosts = gateCount * 2;
  // A gate's two posts stand where two line posts would have: at most as many as there are line posts.
  posts = Math.max(0, posts - Math.min(posts, gatePosts));
  const rails = sections * t.railsPerSection, pickets = Math.ceil(Math.max(0, fence) * t.picketsPerFoot - 1e-9);
  const concrete = Math.ceil((posts + gatePosts) * t.concretePerPost - 1e-9);
  const tearoutFeet = r1(d.runs.filter(r => r.kind === "tearout").reduce((a, r) => a + runFeet(r), 0));
  const m = (name: string, qty: number, unit: string, each: number) => ({ name, qty, unit, cost: r2(qty * each) });
  const materials = [
    m("Line posts", posts, "ea", t.cost.post), m("Gate posts", gatePosts, "ea", t.cost.gatePost), m("Rails", rails, "ea", t.cost.rail),
    m(t.infill || "Pickets", pickets, /fabric/i.test(t.infill) ? "ft" : "ea", t.cost.picket), m("Concrete", concrete, "bag", t.cost.concrete),
    m("Single gate kit", gates.single, "ea", t.cost.gateSingle), m("Double gate kit", gates.double, "ea", t.cost.gateDouble),
  ].filter(x => x.qty > 0);
  return { fenceFeet: r1(Math.max(0, fence)), sections, posts, gatePosts, rails, pickets, concrete, gates, tearoutFeet, materials,
    materialCost: r2(materials.reduce((a, x) => a + x.cost, 0)), laborCost: r2(Math.max(0, fence) * t.cost.laborPerFoot) };
}

/**
 * The quote lines for one or more fence types on the same drawing. With two or three types, each becomes an option
 * (good / better / best) through the quote's existing tiers; tear-out is a shared line every option includes.
 */
export function quoteLines(d: Drawing, types: FenceType[]): { name: string; qty: number; unit: string; price: number; tier?: string }[] {
  const tiered = types.length > 1, out: { name: string; qty: number; unit: string; price: number; tier?: string }[] = [];
  for (const t of types.slice(0, 3)) {
    const k = takeoff(d, t), tier = tiered ? t.name.slice(0, 20) : undefined;
    if (k.fenceFeet > 0) out.push({ name: `${t.name}, ${t.height} ft`, qty: Math.round(k.fenceFeet), unit: "ft", price: t.price.perFoot, ...(tier ? { tier } : {}) });
    if (k.gates.single) out.push({ name: `Single gate, ${t.name}`, qty: k.gates.single, unit: "ea", price: t.price.gateSingle, ...(tier ? { tier } : {}) });
    if (k.gates.double) out.push({ name: `Double drive gate, ${t.name}`, qty: k.gates.double, unit: "ea", price: t.price.gateDouble, ...(tier ? { tier } : {}) });
  }
  const tear = measureOf(d).tearoutFeet, perFoot = types[0]?.price.tearoutPerFoot ?? 0;
  if (tear > 0 && perFoot > 0) out.push({ name: "Remove and haul away the old fence", qty: Math.round(tear), unit: "ft", price: perFoot });
  return out;
}

const num = (v: unknown, lo: number, hi: number, d = 0) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const pt = (v: unknown): LatLng | null => { const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; const lat = Number(o.lat), lng = Number(o.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 } : null; };
const idOf = (v: unknown, i: number) => /^[\w-]{1,24}$/.test(String(v ?? "")) ? String(v) : `r${i + 1}`;

/** A drawing from the screen, checked: up to 40 runs of up to 200 points, up to 20 gates on runs that exist. */
export function cleanDrawing(input: unknown): Drawing {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const runs: Run[] = (Array.isArray(o.runs) ? o.runs : []).slice(0, 40).map((x, i) => { const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { id: idOf(r.id, i), kind: r.kind === "tearout" ? "tearout" as const : "new" as const, points: (Array.isArray(r.points) ? r.points : []).slice(0, 200).map(pt).filter((p): p is LatLng => !!p) }; })
    .filter(r => r.points.length >= 2);
  const ids = new Set(runs.map(r => r.id));
  const gates: Gate[] = (Array.isArray(o.gates) ? o.gates : []).slice(0, 20).flatMap((x, i) => { const g = (x && typeof x === "object" ? x : {}) as Record<string, unknown>, at = pt(g.at);
    if (!at || !ids.has(String(g.run))) return [];
    const type = g.type === "double" ? "double" as const : "single" as const;
    return [{ id: idOf(g.id, i).replace(/^r/, "g"), run: String(g.run), at, type, width: num(g.width, 3, 24, type === "double" ? 12 : 4) }]; });
  const center = pt(o.center), zoom = num(o.zoom, 10, 23, 20);
  return { runs, gates, ...(center ? { center, zoom } : {}) };
}

/** The owner's fence types from setup: up to 12, each with sane bounds. Missing costs are zero, never guessed. */
export function cleanFenceTypes(v: unknown): FenceType[] {
  let arr: unknown = v;
  if (typeof v === "string") { try { arr = JSON.parse(v); } catch { arr = []; } }
  return (Array.isArray(arr) ? arr : []).slice(0, 12).flatMap((x, i) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>, c = (o.cost && typeof o.cost === "object" ? o.cost : {}) as Record<string, unknown>, p = (o.price && typeof o.price === "object" ? o.price : {}) as Record<string, unknown>;
    const name = ctl(o.name, 40); if (!name) return [];
    const money = (v: unknown) => r2(num(v, 0, 100000));
    return [{ id: /^[\w-]{1,24}$/.test(String(o.id ?? "")) ? String(o.id) : `t${i + 1}`, name, height: num(o.height, 2, 16, 6),
      infill: ctl(o.infill, 24) || "Pickets", postSpacing: num(o.postSpacing, 4, 12, 8), railsPerSection: Math.round(num(o.railsPerSection, 0, 6, 2)), picketsPerFoot: num(o.picketsPerFoot, 0, 20, 0), concretePerPost: num(o.concretePerPost, 0, 6, 2),
      cost: { post: money(c.post), gatePost: money(c.gatePost), rail: money(c.rail), picket: money(c.picket), concrete: money(c.concrete), gateSingle: money(c.gateSingle), gateDouble: money(c.gateDouble), laborPerFoot: money(c.laborPerFoot) },
      price: { perFoot: money(p.perFoot), gateSingle: money(p.gateSingle), gateDouble: money(p.gateDouble), tearoutPerFoot: money(p.tearoutPerFoot) } }];
  });
}

/** Starting points an owner edits, never prices Cinder vouches for: common residential types with typical layouts. */
export const FENCE_STARTERS: Omit<FenceType, "id" | "cost" | "price">[] = [
  { name: "Pressure-treated privacy", height: 6, infill: "Pickets", postSpacing: 8, railsPerSection: 3, picketsPerFoot: 2.2, concretePerPost: 2 },
  { name: "Cedar privacy", height: 6, infill: "Pickets", postSpacing: 8, railsPerSection: 3, picketsPerFoot: 2.2, concretePerPost: 2 },
  { name: "Vinyl privacy", height: 6, infill: "Panels", postSpacing: 8, railsPerSection: 0, picketsPerFoot: 0.125, concretePerPost: 2 },
  { name: "Black aluminum", height: 4, infill: "Panels", postSpacing: 6, railsPerSection: 0, picketsPerFoot: 1 / 6, concretePerPost: 1 },
  { name: "Chain link", height: 4, infill: "Fabric (ft)", postSpacing: 10, railsPerSection: 1, picketsPerFoot: 1, concretePerPost: 1 },
];

/**
 * A satellite picture of the drawing (Google Static Maps): new fence in white, tear-out dashed in grey, gates as
 * dots. For the customer's quote page and the crew. Empty when there's no key or nothing drawn.
 */
export function staticMapUrl(d: Drawing | null | undefined, key: string, size = "640x360"): string {
  if (!d || !key || !d.runs.length) return "";
  const p = (x: LatLng) => `${x.lat.toFixed(6)},${x.lng.toFixed(6)}`;
  const parts = [`size=${size}`, "scale=2", "maptype=satellite"];
  for (const r of d.runs.slice(0, 20)) parts.push(`path=${encodeURIComponent(`color:${r.kind === "new" ? "0xffffffff" : "0xc8ccd2cc"}|weight:${r.kind === "new" ? 4 : 3}|${r.points.slice(0, 60).map(p).join("|")}`)}`);
  if (d.gates.length) parts.push(`markers=${encodeURIComponent(`size:tiny|color:0xd0663f|${d.gates.slice(0, 20).map(g => p(g.at)).join("|")}`)}`);
  parts.push(`key=${encodeURIComponent(key)}`);
  const url = `https://maps.googleapis.com/maps/api/staticmap?${parts.join("&")}`;
  return url.length <= 8192 ? url : "";
}
