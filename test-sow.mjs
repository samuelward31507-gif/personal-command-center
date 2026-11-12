import assert from "node:assert/strict";
import { buildSow, sowMarkdown, fillAgreement } from "./lib/agreement-template.ts";
for (const [tier, setupFee, monthlyFee, addon] of [["tier1", 750, 997, false], ["tier2", 1250, 1997, true], ["tier2", 2500, 1997, false]]) {
  const s = buildSow({ tier, setupFee, monthlyFee, addon });
  const month = monthlyFee + (addon ? 497 : 0), founding = setupFee < (tier === "tier1" ? 1500 : 2500);
  assert.equal(s.founding, founding);
  assert.equal(s.rows.length, 3);
  assert.equal(s.rows[0].amount, setupFee);
  assert.equal(s.firstMonth, founding ? month / 2 : month);
  assert.equal(s.rows[2].amount, month);
}
const md = sowMarkdown({ tier: "tier1", setupFee: 750, monthlyFee: 997 });
assert.match(md, /\| Setup \(founding price, normally \$1,500\.00\)\. Once, when you sign\. \| \$750\.00 \|/);
assert.match(md, /\| First month \(50% off\)\. The day your first appointment books\. \| \$498\.50 \|/);
assert.doesNotMatch(md, /12 months/, "no 12-month totals: there is no term");
const doc = fillAgreement({ tier: "tier2", date: "November 12, 2026", company: "On The Fence Inc", setupFee: 1250, monthlyFee: 1997, addon: true });
assert.match(doc, /Schedule A — Plan and Statement of Work/);
assert.match(doc, /Reactivation add-on: \*\*\$497\*\* a month/);
assert.match(doc, /Founding client: the first month's fee is 50% off/);
assert.match(doc, /CP 575 or 147C/);
assert.doesNotMatch(doc, /why quotes didn't sign/);
console.log("sow ok");
