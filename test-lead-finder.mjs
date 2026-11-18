import assert from "node:assert/strict";
const L = await import("./lib/lead-finder.ts");
assert.equal(L.cityState("1234 E Main St, Aurora, CO 80012, USA"), "Aurora, CO");
assert.equal(L.cityState("Fort Collins, CO, USA"), "Fort Collins, CO");

const good = { id: "a", displayName: { text: "Ridge Fence Co" }, formattedAddress: "1 A St, Denver, CO 80202, USA", nationalPhoneNumber: "(303) 555-0101", websiteUri: "https://ridgefence.com", rating: 4.8, userRatingCount: 87, businessStatus: "OPERATIONAL" };
const F = "fence company", G = "standby generator dealer";
const JUL = new Date("2026-07-15T12:00:00Z"), DEC = new Date("2026-12-10T12:00:00Z");
assert.ok(L.scorePlace(good, F, JUL).score >= 80);
assert.match(L.scorePlace(good, F, JUL).why, /87 reviews, established but owner-run/);
// closed a weekend day ranks higher (Sam's calls: 41% interested vs 22%)
const weekdays = { periods: [1,2,3,4,5].map(d => ({ open: { day: d, hour: 7 }, close: { day: d, hour: 17 } })) };
assert.ok(L.scorePlace({ ...good, regularOpeningHours: weekdays }, F, JUL).score > L.scorePlace(good, F, JUL).score);
assert.match(L.scorePlace({ ...good, regularOpeningHours: weekdays }, F, JUL).why, /closed Saturdays/);
assert.equal(L.openDays({ ...good, regularOpeningHours: { periods: [{ open: { day: 0, hour: 0 } }] } }).size, 7, "24/7");
assert.equal(L.openDays(good), null);
// cold-state fence in winter ranks lower; Sunbelt and generators don't
assert.ok(L.scorePlace(good, F, DEC).score < L.scorePlace(good, F, JUL).score, "Denver fence in December");
const tampa = { ...good, formattedAddress: "1 A St, Tampa, FL 33602, USA" };
assert.equal(L.scorePlace(tampa, F, DEC).score, L.scorePlace(tampa, F, JUL).score);
assert.equal(L.scorePlace(good, G, DEC).score, L.scorePlace(good, G, JUL).score);

// ICP hard rules
assert.equal(L.scorePlace({ ...good, userRatingCount: 30 }, F).score, 0, "fence needs 40+ reviews");
assert.ok(L.scorePlace({ ...good, userRatingCount: 30 }, G).score > 0, "generator dealers need only 25+");
assert.equal(L.scorePlace({ ...good, userRatingCount: 800 }, F).score, 0, "too big");
assert.equal(L.scorePlace({ ...good, rating: 3.9 }, F).score, 0, "under 4.0");
assert.ok(L.scorePlace({ ...good, websiteUri: "" }, F, JUL).score > 0, "no website still passes (they can live on Angi or LSA)");
assert.ok(L.scorePlace({ ...good, websiteUri: "https://facebook.com/ridge" }, F, JUL).score < L.scorePlace(good, F, JUL).score, "a real website ranks higher");
assert.equal(L.scorePlace({ ...good, displayName: { text: "Superior Fence & Rail of Dayton" } }, F).score, 0, "franchise skipped");
assert.equal(L.scorePlace({ ...good, displayName: { text: "Generator Supercenter of Tampa" } }, G).score, 0, "generator franchise skipped");
assert.equal(L.scorePlace({ ...good, displayName: { text: "Ridge Fence Supply" } }, F).score, 0, "supply yard skipped");
assert.equal(L.scorePlace({ ...good, nationalPhoneNumber: "" }, F).score, 0);
assert.equal(L.scorePlace({ ...good, businessStatus: "CLOSED_PERMANENTLY" }, F).score, 0);
assert.equal(L.scorePlace({ ...good, displayName: { text: "The Home Depot" } }, F).score, 0);
assert.ok(L.scorePlace({ ...good, userRatingCount: 400 }, F, JUL).score < L.scorePlace(good, F, JUL).score, "office-size ranks below owner-run");

assert.equal(L.nicheOf("fence contractor"), "Fence");
assert.equal(L.nicheOf("generac dealer"), "Standby generators");
assert.equal(L.nicheOf("plumber"), "");

const leads = L.pickLeads([good, { ...good, id: "b" }, { ...good, id: "c", nationalPhoneNumber: "303-555-0199", userRatingCount: 2, rating: 3.1 }, { ...good, id: "d", nationalPhoneNumber: "720 555 0100", displayName: { text: "Peak Pro Fence" } }], new Set(["7205550100"]), F);
assert.equal(leads.length, 1, "dedupes by phone, drops existing and weak");
assert.equal(leads[0].phone, "(303) 555-0101"); assert.equal(leads[0].location, "Denver, CO");
const note = L.noteFor(leads[0], F);
assert.match(note, /^Lead grade: B · Google Maps|^Lead grade: B · Found on Google Maps \(fence company\) · 4.8★ from 87 reviews/);
assert.match(note, /Lead grade: ([ABC])/, "my-day reads the grade");
console.log("lead finder ok");
