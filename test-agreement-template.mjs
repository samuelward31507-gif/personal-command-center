// Agreement template checks: the CRM fills Samuel's reviewed template; it never drafts terms itself.
import assert from "node:assert/strict";
import { fillAgreement, agreementTier, AGREEMENT_TEMPLATE } from "./lib/agreement-template.ts";
let n = 0; const ok = f => { f(); n++; };
const blanks = s => s.match(/\[[^\]\n]{1,80}\]/g) ?? [];
const base = { date: "November 3, 2026", providerEmail: "cinderrevenuecompany@gmail.com", company: "Ridgeline Fence", ownerName: "Mike Torres", email: "mike@ridgeline.com", phone: "(719) 555-0182", location: "Denver, CO" };
const t1 = fillAgreement({ ...base, tier: "tier1", setupFee: 1500, monthlyFee: 997 });
const t2 = fillAgreement({ ...base, tier: "tier2", setupFee: 3000, monthlyFee: 1500 });
ok(() => assert.equal(agreementTier("tier1_speed_to_lead"), "tier1"));
ok(() => assert.equal(agreementTier("tier2_revenue_system"), "tier2"));
ok(() => assert.equal(agreementTier("ai_voice_agent"), null, "only Tier 1 and 2 have a template"));
for (const doc of [t1, t2]) {
  ok(() => assert.ok(!doc.includes("{{"), "every merge field is filled"));
  ok(() => assert.ok(!/<!--|\|---\||^---$/m.test(doc), "no notes block, tables or rules the signing page can't render"));
  ok(() => assert.match(doc, /Samuel Ward, doing business as Cinder Revenue Company/));
  ok(() => assert.match(doc, /21 business days/));
  ok(() => assert.match(doc, /3-month minimum term/));
  ok(() => assert.match(doc, /\$30 per additional 1,000 texts/));
  ok(() => assert.match(doc, /Electronic signatures count as originals/));
  ok(() => assert.match(doc, /Mike Torres, Owner/));
  ok(() => assert.match(doc, /mike@ridgeline\.com/));
}
ok(() => assert.match(t1, /Tier 1 — Speed to Lead/));
ok(() => assert.match(t1, /up to \*\*2,000 texts per month\*\*/));
ok(() => assert.match(t1, /Setup fee: \*\*\$1,500\*\*/));
ok(() => assert.match(t1, /Monthly fee: \*\*\$997\*\*/));
ok(() => assert.ok(!t1.includes("Quote and proposal follow-up on day 1"), "Tier 1 doesn't get the Tier 2 schedule"));
ok(() => assert.match(t2, /up to \*\*5,000 texts per month\*\*/));
ok(() => assert.match(t2, /Setup \$3,000, then \$1,500\/month/));
ok(() => assert.match(t2, /Quote and proposal follow-up on day 1, 3 and 7/));
ok(() => assert.deepEqual(blanks(t1), ["[Your business address]", "[Client entity type, e.g. a Colorado limited liability company]", "[Street address]"], "only unknowns stay blank"));
const bare = fillAgreement({ tier: "tier1", date: "d", company: "", setupFee: 1500, monthlyFee: 997 });
ok(() => assert.ok(blanks(bare).includes("[Client legal business name]") && blanks(bare).includes("[Owner name]") && blanks(bare).includes("[Client email]"), "missing client details become blanks, never guesses"));
ok(() => assert.ok(fillAgreement({ ...base, tier: "tier1", setupFee: 1500, monthlyFee: 997, providerAddress: "123 Main St, Denver, CO" }).includes("123 Main St"), "provider address from env fills in"));
ok(() => assert.ok(!AGREEMENT_TEMPLATE.includes("billed at cost each month with the invoice"), "no leftover AI-draft wording"));
console.log(`Agreement template checks passed (${n} assertions).`);
