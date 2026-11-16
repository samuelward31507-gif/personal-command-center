import assert from "node:assert/strict";
import { buildSow, sowMarkdown, fillAgreement } from "./lib/agreement-template.ts";
// List price: setup, the one-time Reactivation campaign when chosen (Never Miss a Lead only; Book & Close includes it), then monthly.
for (const [tier, setupFee, monthlyFee, asked] of [["tier1", 997, 697, false], ["tier1", 997, 697, true], ["tier2", 1997, 1497, true], ["tier2", 1997, 1497, false]]) {
  const s = buildSow({ tier, setupFee, monthlyFee, addon: asked });
  const addon = asked && tier === "tier1";
  assert.equal(s.founding, false);
  assert.equal(s.rows.length, addon ? 3 : 2);
  assert.equal(s.rows[0].amount, setupFee);
  if (addon) { assert.equal(s.rows[1].amount, 497); assert.match(s.rows[1].when, /Once/); }
  assert.equal(s.rows[s.rows.length - 1].amount, monthlyFee, "Reactivation is one time, never on the monthly");
  assert.equal(s.firstMonth, monthlyFee);
  assert.equal(s.setupDue, setupFee + (addon ? 497 : 0));
}
// A hand-discounted setup still shows the discount plainly.
const d = buildSow({ tier: "tier2", setupFee: 1000, monthlyFee: 1497 });
assert.equal(d.founding, true); assert.equal(d.rows.length, 2); assert.equal(d.firstMonth, 1497, "a setup discount never halves the first month"); assert.match(d.rows[0].label, /discounted from \$1,997\.00/);
const md = sowMarkdown({ tier: "tier1", setupFee: 997, monthlyFee: 697 });
assert.match(md, /\| Setup\. Once, when you sign\. \| \$997\.00 \|/);
assert.match(md, /\| Monthly\. Starts the day your first appointment books\. Month to month, cancel with 30 days’ notice\. \| \$697\.00 \|/);
assert.doesNotMatch(md, /12 months|founding|50% off/, "no terms, no founding language");
const doc = fillAgreement({ tier: "tier2", date: "November 12, 2026", company: "On The Fence Inc", setupFee: 1997, monthlyFee: 1497, addon: true });
assert.match(doc, /Schedule A — Plan and Statement of Work/);
assert.doesNotMatch(doc, /\$497/, "Book & Close includes reactivation: never charged");
assert.match(fillAgreement({ tier: "tier1", date: "November 12, 2026", company: "X", setupFee: 997, monthlyFee: 697, addon: true }), /Reactivation campaign: \*\*\$497\*\* one time, due with the setup fee/);
assert.doesNotMatch(doc, /first month's fee is 50% off/);
assert.match(doc, /or at least \*\*3\*\* if Client receives 10 to 29 new leads a month/);
assert.match(doc, /Reactivation campaign \(included\)/);
assert.match(doc, /CP 575 or 147C/);
assert.doesNotMatch(doc, /why quotes didn't sign/);
console.log("sow ok");
