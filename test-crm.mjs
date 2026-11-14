// CRM checks: trade fields, the owner's price book, the ballpark, stages and the owner's own setup.
import assert from "node:assert/strict";
import { jobFields, cleanDetails, detailLine, parsePriceBook, ballpark, matchRate, stageFor, cleanOwnerSetup, rangeText, previewFirstText } from "./lib/crm.ts";

let n = 0; const ok = fn => { fn(); n++; };

// Trade fields
ok(() => assert.deepEqual(jobFields("Fence").map(f => f.key), ["length_ft", "material", "height", "gates", "hoa", "address"]));
ok(() => assert.deepEqual(jobFields("Pool").map(f => f.key), ["job", "size", "address"]));
ok(() => assert.deepEqual(cleanDetails("Fence", { length_ft: "150 ft", material: " cedar ", height: "6", gates: "2", hoa: "yes", junk: "x" }),
  { length_ft: 150, material: "cedar", height: "6 ft", gates: 2, hoa: "Yes" }));
ok(() => assert.deepEqual(cleanDetails("Fence", { length_ft: "-4", hoa: "maybe" }), {}));
ok(() => assert.equal(detailLine("Fence", { length_ft: 150, height: "6 ft", material: "cedar", gates: 2, hoa: "Yes" }), "150 ft · 6 ft cedar · 2 gates · HOA"));
ok(() => assert.equal(detailLine("Fence", { length_ft: 80, gates: 1 }), "80 ft · 1 gate"));
ok(() => assert.equal(detailLine("Pool", { job: "Pool fence", size: "40x20" }), "Pool fence · 40x20"));

// Price book and ballpark
const book = parsePriceBook(JSON.stringify({ unit: "ft", rates: [{ name: "Wood privacy (cedar)", low: 38, high: 48 }, { name: "Vinyl", low: 40, high: 55 }, { name: "Chain link", low: 18, high: 26 }, { name: "bad", low: 0, high: 5 }], gate: [450, 650] }));
ok(() => assert.equal(book.rates.length, 3, "invalid rates dropped"));
ok(() => assert.equal(matchRate(book, "6 ft cedar").name, "Wood privacy (cedar)"));
ok(() => assert.equal(matchRate(book, "vinyl privacy").name, "Vinyl"));
ok(() => assert.equal(matchRate(book, "something odd"), null));
ok(() => assert.deepEqual(ballpark(book, { length_ft: 150, material: "cedar", height: "6 ft", gates: 2 }), { low: 6600, high: 8500, basis: "150 ft of Wood privacy (cedar) and 2 gates" }));
ok(() => assert.equal(ballpark(book, { material: "cedar" }), null, "no length, no number"));
ok(() => assert.equal(ballpark(book, { length_ft: 150 }), null, "no material, no number"));
ok(() => assert.equal(ballpark(null, { length_ft: 150, material: "cedar" }), null));
ok(() => assert.equal(parsePriceBook("not json"), null));
const jobBook = parsePriceBook(JSON.stringify({ unit: "job", rates: [{ name: "Full detail", low: 180, high: 260 }] }));
ok(() => assert.deepEqual(ballpark(jobBook, { service: "anything" }), { low: 200, high: 300, basis: "Full detail" }));
ok(() => assert.equal(rangeText({ low: 6600, high: 8500 }), "$6,600–$8,500"));

// Stages
ok(() => assert.equal(stageFor({ status: "auto" }), "new"));
ok(() => assert.equal(stageFor({ status: "booked" }), "booked"));
ok(() => assert.equal(stageFor({ status: "auto", next_appt: "2026-11-20T15:00:00Z" }), "booked"));
ok(() => assert.equal(stageFor({ status: "booked", quote_status: "open" }), "quoted"));
ok(() => assert.equal(stageFor({ status: "closed", quote_status: "won" }), "won"));
ok(() => assert.equal(stageFor({ status: "closed" }), "lost"));
ok(() => assert.equal(stageFor({ status: "auto", stage: "won" }), "won", "owner's move wins"));
ok(() => assert.equal(stageFor({ status: "auto", stage: "bogus" }), "new"));

// Owner setup: only their own keys, only allowed values
const s = cleanOwnerSetup({ display_name: " Front Range Fence ", trade: "Fence", team_size: "2-5 people", lead_sources: "Angi, Google, Hacker", priority: "quotes", texting_number: "+15555550100", website: "frontrangefence.com", share_ballpark: "maybe", price_book: JSON.stringify({ rates: [{ name: "Vinyl", low: 40, high: 55 }] }) });
ok(() => assert.equal(s.display_name, "Front Range Fence"));
ok(() => assert.equal(s.lead_sources, "Angi, Google"));
ok(() => assert.equal(s.texting_number, undefined, "owners can't change the texting number"));
ok(() => assert.equal(s.share_ballpark, undefined));
ok(() => assert.equal(s.website, "https://frontrangefence.com"));
ok(() => assert.equal(JSON.parse(s.price_book).rates[0].name, "Vinyl"));
ok(() => assert.equal(cleanOwnerSetup({ trade: "Plumbing" }).trade, undefined));
ok(() => assert.match(previewFirstText("Front Range Fence", "Fence"), /Front Range Fence.*fence.*Reply STOP to opt out\.$/));

console.log(`CRM checks passed (${n} assertions).`);
