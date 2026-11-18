// Measure-to-quote math (lib/fence.ts), checked against examples worked by hand.
import assert from "node:assert/strict";
const F = await import("./lib/fence.ts");
let n = 0; const ok = f => { f(); n++; };

// A point `feet` north / east of another, so a run has a known length.
const R = 6371008.8, FT = 3.280839895;
const north = (p, feet) => ({ lat: p.lat + (feet / FT / R) * 180 / Math.PI, lng: p.lng });
const east = (p, feet) => ({ lat: p.lat, lng: p.lng + (feet / FT / R) * 180 / Math.PI / Math.cos(p.lat * Math.PI / 180) });
const A = { lat: 39.6133, lng: -105.0166 }; // Littleton, CO
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

const cedar = F.cleanFenceTypes([{ id: "cedar", name: "Cedar privacy", height: 6, infill: "Pickets", postSpacing: 8, railsPerSection: 3, picketsPerFoot: 2.2, concretePerPost: 2,
  cost: { post: 24, gatePost: 38, rail: 9, picket: 3.1, concrete: 6.5, gateSingle: 140, gateDouble: 260, laborPerFoot: 12 },
  price: { perFoot: 62, gateSingle: 550, gateDouble: 950, tearoutPerFoot: 4 } }])[0];
const pt = F.cleanFenceTypes([{ id: "pt", name: "Pressure-treated", height: 6, infill: "Pickets", postSpacing: 8, railsPerSection: 3, picketsPerFoot: 2.2, concretePerPost: 2,
  cost: { post: 14, rail: 6, picket: 1.9, concrete: 6.5 }, price: { perFoot: 45, gateSingle: 450, tearoutPerFoot: 4 } }])[0];
const vinyl = F.cleanFenceTypes([{ id: "vinyl", name: "Vinyl", height: 6, infill: "Panels", postSpacing: 8, railsPerSection: 0, picketsPerFoot: 0.125, concretePerPost: 2,
  cost: { post: 42, picket: 118, concrete: 6.5 }, price: { perFoot: 78, gateSingle: 700 } }])[0];

ok(() => near(F.feetBetween(A, north(A, 160)), 160, 0.01, "160 ft north measures 160 ft"));
ok(() => near(F.feetBetween(A, east(A, 100)), 100, 0.05, "100 ft east measures 100 ft at this latitude"));

// Example 1: one straight 160 ft run of 6 ft cedar, posts every 8 ft.
// 160 / 8 = 20 sections, 21 posts; 3 rails a section = 60; 160 x 2.2 = 352 pickets; 21 posts x 2 bags = 42 bags.
ok(() => { const d = { runs: [{ id: "r1", kind: "new", points: [A, north(A, 160)] }], gates: [] }, k = F.takeoff(d, cedar);
  assert.equal(k.fenceFeet, 160); assert.equal(k.sections, 20); assert.equal(k.posts, 21); assert.equal(k.gatePosts, 0);
  assert.equal(k.rails, 60); assert.equal(k.pickets, 352); assert.equal(k.concrete, 42);
  // Cost: 21 x 24 + 60 x 9 + 352 x 3.10 + 42 x 6.50 = 504 + 540 + 1091.20 + 273 = 2408.20. Labor 160 x 12 = 1920.
  assert.equal(k.materialCost, 2408.2); assert.equal(k.laborCost, 1920); });

// Example 2: an L, 100 ft north then 60 ft east, with a 4 ft walk gate on it.
// Fence = 160 - 4 = 156 ft, taken from both legs in proportion: 97.5 ft and 58.5 ft.
// Sections: ceil(97.5 / 8) = 13 and ceil(58.5 / 8) = 8, so 21; posts 22, of which 2 become gate posts: 20 line + 2 gate.
// Rails 21 x 3 = 63; pickets ceil(156 x 2.2 = 343.2) = 344; concrete (20 + 2) x 2 = 44.
ok(() => { const B = north(A, 100), d = { runs: [{ id: "r1", kind: "new", points: [A, B, east(B, 60)] }], gates: [{ id: "g1", run: "r1", at: B, type: "single", width: 4 }] };
  const k = F.takeoff(d, cedar);
  assert.equal(k.fenceFeet, 156); assert.equal(k.sections, 21); assert.equal(k.posts, 20); assert.equal(k.gatePosts, 2);
  assert.equal(k.rails, 63); assert.equal(k.pickets, 344); assert.equal(k.concrete, 44); assert.equal(k.gates.single, 1);
  assert.deepEqual(k.materials.map(m => m.name), ["Line posts", "Gate posts", "Rails", "Pickets", "Concrete", "Single gate kit"]); });

// Example 3: two separate 40 ft runs: 5 sections and 6 posts each, so 10 sections and 12 posts (no shared post).
ok(() => { const d = { runs: [{ id: "a", kind: "new", points: [A, north(A, 40)] }, { id: "b", kind: "new", points: [east(A, 200), north(east(A, 200), 40)] }], gates: [] };
  const k = F.takeoff(d, cedar); assert.equal(k.sections, 10); assert.equal(k.posts, 12); });

// Example 4: vinyl panels: 96 ft = 12 sections of 8 ft, 13 posts, 96 x 0.125 = 12 panels, no rails.
ok(() => { const k = F.takeoff({ runs: [{ id: "r1", kind: "new", points: [A, north(A, 96)] }], gates: [] }, vinyl);
  assert.equal(k.sections, 12); assert.equal(k.posts, 13); assert.equal(k.pickets, 12); assert.equal(k.rails, 0); assert.equal(k.materials.find(m => m.name === "Panels").qty, 12); });

// A run a hair over a section (8.4 ft at 8 ft spacing) still needs 2 sections.
ok(() => assert.equal(F.takeoff({ runs: [{ id: "r1", kind: "new", points: [A, north(A, 8.4)] }], gates: [] }, cedar).sections, 2));

// Tear-out is measured but needs no materials.
ok(() => { const d = { runs: [{ id: "r1", kind: "new", points: [A, north(A, 160)] }, { id: "old", kind: "tearout", points: [east(A, 50), north(east(A, 50), 120)] }], gates: [] };
  assert.equal(F.measureOf(d).tearoutFeet, 120); assert.equal(F.measureOf(d).newFeet, 160); assert.equal(F.takeoff(d, cedar).posts, 21); });

// Quote: one type = plain lines; three types = good / better / best tiers on the same drawing, tear-out shared.
ok(() => { const B = north(A, 100), d = { runs: [{ id: "r1", kind: "new", points: [A, B, east(B, 60)] }, { id: "old", kind: "tearout", points: [east(A, 50), north(east(A, 50), 120)] }],
    gates: [{ id: "g1", run: "r1", at: B, type: "single", width: 4 }] };
  assert.deepEqual(F.quoteLines(d, [cedar]), [
    { name: "Cedar privacy, 6 ft", qty: 156, unit: "ft", price: 62 }, { name: "Single gate, Cedar privacy", qty: 1, unit: "ea", price: 550 },
    { name: "Remove and haul away the old fence", qty: 120, unit: "ft", price: 4 }]);
  const three = F.quoteLines(d, [pt, cedar, vinyl]);
  assert.deepEqual([...new Set(three.filter(l => l.tier).map(l => l.tier))], ["Pressure-treated", "Cedar privacy", "Vinyl"]);
  assert.equal(three.filter(l => !l.tier).length, 1, "tear-out is in every option"); });

// Cleaning: bad points and gates on missing runs drop; widths are bounded; types need a name.
ok(() => { const d = F.cleanDrawing({ runs: [{ id: "r1", points: [A, { lat: 999, lng: 0 }, north(A, 10)] }, { id: "x", points: [A] }], gates: [{ run: "r1", at: A, type: "double", width: 40 }, { run: "nope", at: A }] });
  assert.equal(d.runs.length, 1); assert.equal(d.runs[0].points.length, 2); assert.equal(d.gates.length, 1); assert.equal(d.gates[0].width, 12, "out-of-range width falls back"); });
ok(() => { assert.equal(F.cleanFenceTypes([{ name: "" }, { name: "Split rail", postSpacing: 99 }]).length, 1); assert.equal(F.cleanFenceTypes([{ name: "Split rail", postSpacing: 99 }])[0].postSpacing, 8); });
ok(() => assert.equal(F.FENCE_STARTERS.length, 5));
console.log(`fence: ${n} checks passed`);
