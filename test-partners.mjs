import assert from "node:assert/strict";
const { validatePartner, pitchFor, mapsSearch, PARTNER_KINDS, PARTNER_FEE } = await import("./lib/partners.ts");
assert.deepEqual(validatePartner({}), { error: "Add the business name." });
assert.deepEqual(validatePartner({ name: "X", email: "nope" }), { error: "That email doesn't look right." });
const p = validatePartner({ name: " Denver Fence Supply ", kind: "supply", status: "active", referrals: "3" });
assert.equal(p.name, "Denver Fence Supply"); assert.equal(p.status, "active"); assert.equal(p.referrals, 3);
assert.equal(validatePartner({ name: "Y", kind: "bogus", status: "bogus" }).kind, "other");
assert.equal(validatePartner({ name: "Y", status: "bogus" }).status, "to_contact");
for (const k of PARTNER_KINDS) { assert.ok(pitchFor(k.key).endsWith(`$${PARTNER_FEE}.`), k.key); assert.ok(!/\bAI\b/.test(pitchFor(k.key)), "no AI lead"); }
assert.match(mapsSearch("supply", "Denver"), /fence%20supply%20Denver$/);
console.log("Partner checks passed.");
