import assert from "node:assert/strict";
import { buildSow, sowMarkdown, allocate, fillAgreement } from "./lib/agreement-template.ts";
const sum = a => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
assert.equal(sum(allocate(1500, [30, 25, 15, 15, 15])), 1500);
assert.equal(sum(allocate(997, [40, 15, 12, 8, 13, 12])), 997);
for (const [tier, setupFee, monthlyFee, addon] of [["tier1", 750, 997, false], ["tier2", 1250, 1997, true], ["tier2", 2500, 1997, false]]) {
  const s = buildSow({ tier, setupFee, monthlyFee, addon });
  // Every section's items add up to its header.
  let head = null, items = [];
  const check = () => { if (head && head.label !== "First 12 months") assert.equal(sum(items), head.amount, head.label); };
  for (const r of s.rows) { if (r.kind === "section") { check(); head = r; items = []; } else if (r.kind === "item") items.push(r.amount); }
  const month = monthlyFee + (addon ? 497 : 0), founding = setupFee < (tier === "tier1" ? 1500 : 2500);
  assert.equal(s.founding, founding);
  assert.equal(s.firstMonth, founding ? month / 2 : month);
  assert.equal(s.year, Math.round((setupFee + s.firstMonth + month * 11) * 100) / 100);
}
const md = sowMarkdown({ tier: "tier1", setupFee: 750, monthlyFee: 997 });
assert.match(md, /\| \*\*Building your system \(one time\)\*\* \| \*\*\$1,500\.00\*\* \|/);
assert.match(md, /\| Founding client discount on setup \| −\$750\.00 \|/);
assert.match(md, /\| \*\*Total for 12 months\*\* \| \*\*\$12,215\.50\*\* \|/);   // 750 + 498.50 + 997 × 11
const doc = fillAgreement({ tier: "tier2", date: "November 12, 2026", company: "On The Fence Inc", setupFee: 1250, monthlyFee: 1997, addon: true });
assert.match(doc, /Schedule A — Plan and Statement of Work/);
assert.match(doc, /Reactivation add-on: \*\*\$497\*\* a month/);
assert.match(doc, /Founding client: the first month's fee is 50% off/);
assert.doesNotMatch(doc, /why quotes didn't sign/);
console.log("sow ok");
