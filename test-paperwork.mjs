// Fence job paperwork (lib/paperwork.ts): the locate line, what blocks digging, and keeping the checklist in step.
import assert from "node:assert/strict";
const P = await import("./lib/paperwork.ts");
let n = 0; const ok = f => { f(); n++; };
const today = "2026-11-17"; // a Tuesday

ok(() => { const p = P.cleanPaperwork({ locate: { ticket: " A2611170042 ", requested: "2026-11-17", clears: "2026-11-20" }, permit: { needed: "no", number: "X1", approved: "2026-11-01" }, hoa: { needed: "maybe" }, junk: 1 });
  assert.equal(p.locate.ticket, "A2611170042"); assert.equal(p.permit.number, "", "not needed clears the number"); assert.equal(p.permit.approved, null); assert.equal(p.hoa.needed, ""); assert.equal(p.junk, undefined); });
ok(() => assert.equal(P.cleanPaperwork({ locate: { clears: "Nov 20" } }).locate.clears, null, "dates are YYYY-MM-DD"));

// 811: Tuesday + 3 business days = Friday; Friday + 3 = Wednesday (the weekend skipped).
ok(() => { assert.equal(P.addBusinessDays("2026-11-17", 3), "2026-11-20"); assert.equal(P.addBusinessDays("2026-11-20", 3), "2026-11-25"); });

ok(() => assert.deepEqual(P.locateLine(P.EMPTY_PAPERWORK, today), { text: "No 811 ticket yet", clear: false }));
ok(() => assert.equal(P.locateLine(P.cleanPaperwork({ locate: { ticket: "A1", requested: "2026-11-17", clears: "2026-11-19" } }), today).text, "Locate clears Thursday"));
ok(() => assert.equal(P.locateLine(P.cleanPaperwork({ locate: { ticket: "A1", clears: "2026-11-18" } }), today).text, "Locate clears tomorrow"));
ok(() => assert.equal(P.locateLine(P.cleanPaperwork({ locate: { ticket: "A1", clears: "2026-12-02" } }), today).text, "Locate clears Dec 2"));
ok(() => assert.deepEqual(P.locateLine(P.cleanPaperwork({ locate: { ticket: "A1", clears: "2026-11-16" } }), today), { text: "Locate cleared Nov 16", clear: true }));
ok(() => assert.equal(P.locateLine(P.cleanPaperwork({ locate: { ticket: "A1" } }), today).text, "811 ticket A1, clear date not set"));

// Digging: every reason an install day isn't clear.
ok(() => assert.deepEqual(P.digBlockers(P.EMPTY_PAPERWORK, null), [], "no install date, nothing to block"));
ok(() => assert.deepEqual(P.digBlockers(P.EMPTY_PAPERWORK, "2026-11-20"), ["There's no 811 locate ticket yet."]));
ok(() => { const p = P.cleanPaperwork({ locate: { ticket: "A1", requested: "2026-11-17", clears: "2026-11-20" }, permit: { needed: "yes", number: "B-77" }, hoa: { needed: "yes" } });
  assert.deepEqual(P.digBlockers(p, "2026-11-19"), ["The 811 locate doesn't clear until Fri, Nov 20.", "The permit isn't approved yet.", "The HOA hasn't approved it yet."]);
  assert.deepEqual(P.digBlockers(P.cleanPaperwork({ ...p, permit: { needed: "yes", approved: "2026-11-18" }, hoa: { needed: "no" } }), "2026-11-20"), [], "clear on the day the locate clears"); });

// The checklist: paperwork ticks the matching job steps, with the day it happened.
ok(() => { const p = P.cleanPaperwork({ locate: { ticket: "A1", requested: "2026-11-17" }, permit: { needed: "yes", approved: "2026-11-18" }, hoa: { needed: "no" } });
  assert.deepEqual(P.stepsFrom(p), { locate: "2026-11-17", permit: "2026-11-18" }); assert.deepEqual(P.stepsNotNeeded(p), ["hoa"]); });
ok(() => { const items = P.paperworkItems(P.cleanPaperwork({ permit: { needed: "no" }, signoff: { on: "2026-11-17", by: "Tom Becker" } }), today);
  assert.deepEqual(items.map(i => [i.key, i.done]), [["locate", false], ["permit", true], ["hoa", false], ["pins", false], ["signoff", true]]);
  assert.equal(items[4].text, "Signed off by Tom Becker"); });
console.log(`paperwork: ${n} checks passed`);
