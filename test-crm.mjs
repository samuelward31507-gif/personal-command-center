// CRM checks: trade fields, the owner's price book, the ballpark, stages and the owner's own setup.
import assert from "node:assert/strict";
import { jobFields, cleanDetails, detailLine, parsePriceBook, ballpark, matchRate, stageFor, cleanOwnerSetup, rangeText, previewFirstText, sourceReport, quoteText, reviewDue, cleanDate, winbackDraft, cleanWinback, QUOTE_TOKEN, jobSteps, cleanJob, jobProgress, cleanCosts, jobProfit } from "./lib/crm.ts";

let n = 0; const ok = fn => { fn(); n++; };

// Trade fields
ok(() => assert.deepEqual(jobFields("Fence").map(f => f.key), ["length_ft", "material", "height", "gates", "hoa", "address"]));
ok(() => assert.deepEqual(jobFields("Pool").map(f => f.key), ["job", "size", "address"]));
ok(() => assert.deepEqual(cleanDetails("Fence", { length_ft: "150 ft", material: " cedar ", height: "6", gates: "2", hoa: "yes", junk: "x" }),
  { length_ft: 150, material: "cedar", height: "6 ft", gates: 2, hoa: "Yes" }));
ok(() => assert.deepEqual(cleanDetails("Fence", { length_ft: "-4", hoa: "maybe" }), {}));
ok(() => assert.equal(detailLine("Fence", { length_ft: 150, height: "6 ft", material: "cedar", gates: 2, hoa: "Yes" }), "150 ft, 6 ft cedar, 2 gates, HOA"));
ok(() => assert.equal(detailLine("Fence", { length_ft: 80, gates: 1 }), "80 ft, 1 gate"));
ok(() => assert.equal(detailLine("Pool", { job: "Pool fence", size: "40x20" }), "Pool fence, 40x20"));

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


// Where jobs come from
const rep = sourceReport([
  { source: "angi", stage: "won", value: 9000, quote: null }, { source: "angi", stage: "quoted", value: null, quote: null }, { source: "angi", stage: "lost", value: null, quote: null },
  { source: "facebook", stage: "won", value: null, quote: { amount: 3000 } }, { source: "facebook", stage: "new", value: null, quote: null },
  { source: "missed_call", stage: "booked", value: null, quote: null }, { source: "weird", stage: "new", value: null, quote: null }]);
ok(() => assert.deepEqual(rep.map(r => [r.label, r.leads, r.booked, r.won, r.wonValue]), [["Angi", 3, 2, 1, 9000], ["Facebook", 2, 1, 1, 3000], ["Missed calls", 1, 1, 0, 0], ["Other", 1, 0, 0, 0]]));

// Quote link text
ok(() => assert.equal(quoteText({ first: "Dana", business: "Ridgeline Fence Co.", amount: 4200, line: "80 ft · 6 ft cedar", url: "https://x.co/q/abc" }),
  "Hi Dana, here's your quote from Ridgeline Fence Co: $4,200 for 80 ft · 6 ft cedar. You can look it over and approve it here: https://x.co/q/abc"));
ok(() => assert.equal(quoteText({ first: "", business: "Acme", amount: null, line: "", url: "u" }), "Hi, here's your quote from Acme. You can look it over and approve it here: u"));
ok(() => assert.ok(QUOTE_TOKEN.test("abcdefghijklmnopqrstuvwx") && !QUOTE_TOKEN.test("short") && !QUOTE_TOKEN.test("abcdefghijklmnopqrstuv'x")));

// Review timing
ok(() => assert.equal(reviewDue("2026-11-13", "2026-11-14"), true));
ok(() => assert.equal(reviewDue("2026-11-14", "2026-11-14"), false, "not the day of the install"));
ok(() => assert.equal(reviewDue(null, "2026-11-14"), false));
ok(() => assert.equal(cleanDate("2026-11-18"), "2026-11-18"));
ok(() => assert.equal(cleanDate("2026-13-40"), null));
ok(() => assert.equal(cleanDate("tomorrow"), null));

// Win back
ok(() => assert.equal(winbackDraft("Fence", "Mike Ross", "Ridgeline Fence Co.", 3), "Hi {first}, it's Mike with Ridgeline Fence Co. Spring's a good time to stain, seal or fix any boards that moved over the winter. Want us to come take a look? Just reply YES."));
ok(() => assert.match(winbackDraft("Fence", "", "Acme", 9), /^Hi \{first\}, it's Acme\. Before winter/));
ok(() => assert.equal(cleanWinback("Hi {first}, Ridgeline here. Want a stain this spring? Reply YES.", "Ridgeline Fence Co.").ok, true));
ok(() => assert.equal(cleanWinback("Hi {first}, want a stain this spring? Reply YES.", "Ridgeline Fence Co.").ok, false, "must name the business"));
ok(() => assert.equal(cleanWinback("Hi Ridgeline here, see https://x.co for a deal now", "Ridgeline").ok, false, "no links"));
ok(() => assert.equal(cleanWinback("short", "R").ok, false));

// The job after the yes
ok(() => assert.deepEqual(jobSteps("fence", { hoa: "No" }).map(s => s.key), ["deposit", "permit", "locate", "materials", "installed", "walk"]));
ok(() => assert.ok(jobSteps("fence", { hoa: "Yes" }).some(s => s.key === "hoa")));
ok(() => assert.deepEqual(jobSteps("roofing", {}).map(s => s.key), ["deposit", "materials", "installed", "walk"]));
ok(() => assert.deepEqual(cleanJob({ deposit: "2026-11-10", bogus: "2026-11-10", permit: "soon" }), { deposit: "2026-11-10" }));
ok(() => assert.deepEqual(jobProgress("fence", { details: {}, job: { deposit: "2026-11-10" }, invoice: null }), { done: 1, total: 8, next: "Permit sorted" }));
ok(() => assert.equal(jobProgress("fence", { details: {}, job: { deposit: "a", permit: "a", locate: "a", materials: "a", installed: "a", walk: "a" }, invoice: { status: "sent" } }).next, "Paid"));
ok(() => assert.equal(jobProgress("x", { details: {}, job: { deposit: "a", materials: "a", installed: "a", walk: "a" }, invoice: { status: "paid" } }).next, null));
ok(() => assert.deepEqual(cleanCosts({ materials: "$3,100", labor: "1800", other: "-5" }), { materials: 3100, labor: 1800, other: 0 }));
ok(() => assert.deepEqual(jobProfit(8600, { materials: 3100, labor: 1800, other: 0 }), { cost: 4900, profit: 3700, margin: 43 }));
ok(() => assert.equal(jobProfit(8600, { materials: 0, labor: 0, other: 0 }), null));

console.log(`CRM checks passed (${n} assertions).`);

// Quote templates: named, up to 30 lines each, options and tiers kept, prices clean, no duplicate names.
{ const { quoteTemplates } = await import("./lib/crm.ts");
  const t = quoteTemplates(JSON.stringify([{ name: " Cedar 6ft ", items: [{ name: "Cedar privacy", qty: "140", unit: "ft", price: "62.5" }, { name: "Walk gate", qty: 1, price: 550, opt: true }, { name: "Better", qty: 1, price: 9800, tier: "Better" }] },
    { name: "cedar 6FT", items: [{ name: "dup" }] }, { name: "", items: [{ name: "x" }] }, { name: "Empty", items: [] }]));
  assert.equal(t.length, 1); assert.equal(t[0].name, "Cedar 6ft"); assert.equal(t[0].items[0].qty, 140); assert.equal(t[0].items[0].price, 62.5); assert.equal(t[0].items[1].opt, true); assert.equal(t[0].items[2].tier, "Better");
  assert.equal(quoteTemplates(Array.from({ length: 25 }, (_, i) => ({ name: "T" + i, items: [{ name: "x", price: 1 }] }))).length, 20);
  console.log("quote templates ok"); }
