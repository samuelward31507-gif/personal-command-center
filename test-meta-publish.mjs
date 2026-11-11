import assert from "node:assert/strict";
const M = await import("./lib/meta-publish.ts");
assert.equal(M.metaConfig({}), null);
assert.equal(M.metaConfig({ META_PAGE_ID: "1" }), null);
const c = M.metaConfig({ META_PAGE_ID: " 12 ", META_PAGE_TOKEN: "tok", META_IG_USER_ID: "34" });
assert.deepEqual(c, { page: "12", token: "tok", ig: "34", version: "v23.0" });
// Denver is UTC-7 in November, UTC-6 in July.
assert.equal(M.zonedTime("2026-11-10", 7, 30, "America/Denver").toISOString(), "2026-11-10T14:30:00.000Z");
assert.equal(M.zonedTime("2026-07-10", 7, 30, "America/Denver").toISOString(), "2026-07-10T13:30:00.000Z");
assert.equal(M.slotTime("2026-11-10", 4, "feed", "America/Denver").toISOString(), "2026-11-11T02:30:00.000Z");
assert.equal(M.slotTime("2026-11-10", 0, "video", "America/Denver").toISOString(), "2026-11-10T14:45:00.000Z");
assert.equal(M.slotTime("2026-11-10", 9, "feed", "America/Denver").toISOString(), "2026-11-11T02:30:00.000Z");
console.log("meta publish ok");
