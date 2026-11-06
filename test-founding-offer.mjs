// Founding offer checks. Run with: node --experimental-strip-types --no-warnings test-founding-offer.mjs
import assert from "node:assert/strict";
import {
  DEFAULT_OFFER, mergeOffer, validateOffer, spotsLeft, cleanDiscovery, readDiscovery, guaranteeEligible, guaranteeCalc,
  priceScript, cleanDelivery, deliveryState, atRiskTaskTitle, cleanReviews, readReviews, monthlyFigures, monthlyReport, estimatesToPayFor,
} from "./lib/founding-offer.ts";

let n = 0; const ok = (fn, msg) => { try { fn(); n++; } catch (e) { e.message = (msg ? msg + ": " : "") + e.message; throw e; } };

// B1 offer settings
ok(() => assert.equal(DEFAULT_OFFER.setupFee, 1000));
ok(() => assert.equal(DEFAULT_OFFER.standardSetup, 1500));
ok(() => assert.equal(DEFAULT_OFFER.monthly, 997));
ok(() => assert.equal(DEFAULT_OFFER.spotsTotal, 5));
ok(() => assert.deepEqual(mergeOffer({ spotsTotal: "7", rates: { oldReply: 2 } }).rates, DEFAULT_OFFER.rates), "bad rate falls back");
ok(() => assert.equal(mergeOffer({ spotsTotal: "7" }).spotsTotal, 7));
const v = validateOffer({ offerName: "Sprint", setupFee: "1,000", standardSetup: 1500, monthly: 997, spotsTotal: 5, rates: { oldReply: 12, oldBook: 25, newReply: 30, newBook: 0.3 } });
ok(() => assert.ok("ok" in v)); ok(() => assert.equal(v.ok.rates.oldReply, 0.12), "percent input becomes a fraction"); ok(() => assert.equal(v.ok.rates.newBook, 0.3));
ok(() => assert.match(validateOffer({ offerName: "", setupFee: 1, standardSetup: 1, monthly: 1, spotsTotal: 1 }).error, /name/));
ok(() => assert.match(validateOffer({ offerName: "x", setupFee: 1, standardSetup: 1, monthly: 1, spotsTotal: 2.5, rates: {} }).error, /whole number/));
// Spots: signing a founding client lowers spots left
ok(() => assert.equal(spotsLeft(DEFAULT_OFFER, 0), 5));
ok(() => assert.equal(spotsLeft(DEFAULT_OFFER, 1), 4), "one founding client signed");
ok(() => assert.equal(spotsLeft(DEFAULT_OFFER, 9), 0));

// B2 discovery
const d1 = cleanDiscovery({ oldLeads: "300", newLeadsPerMonth: 30, avgJobValue: "$6,000", closeRate: "30", usesCrm: "Jobber", reviewLink: "https://g.page/r/abc/review" });
ok(() => assert.deepEqual(d1.ok, { oldLeads: 300, newLeadsPerMonth: 30, avgJobValue: 6000, closeRate: 30, usesCrm: "Jobber", reviewLink: "https://g.page/r/abc/review" }));
ok(() => assert.equal(cleanDiscovery({ closeRate: "0.3" }).ok.closeRate, 30), "fraction close rate becomes a percent");
ok(() => assert.match(cleanDiscovery({ usesCrm: "Salesforce" }).error, /CRM/));
ok(() => assert.match(cleanDiscovery({ reviewLink: "not a link" }).error, /review link/));
ok(() => assert.deepEqual(readDiscovery({ usesCrm: "Salesforce" }), {}), "lenient read never throws");
ok(() => assert.equal(guaranteeEligible({ oldLeads: 150 }), true));
ok(() => assert.equal(guaranteeEligible({ oldLeads: 149 }), false));

// B3 guarantee calculator (acceptance)
const g1 = guaranteeCalc({ oldLeads: 300, newLeadsPerMonth: 30 });
ok(() => assert.equal(g1.expected, 10.2)); ok(() => assert.equal(g1.safe, 5)); ok(() => assert.equal(g1.eligible, true)); ok(() => assert.equal(g1.offer, true)); ok(() => assert.equal(g1.warning, null));
ok(() => assert.equal(g1.text, "Expected ~10.2 booked estimates in 30 days. Safe to guarantee: 5."));
const g2 = guaranteeCalc({ oldLeads: 100, newLeadsPerMonth: 15 });
ok(() => assert.equal(g2.expected, 3.9)); ok(() => assert.equal(g2.safe, 1)); ok(() => assert.equal(g2.offer, false));
ok(() => assert.equal(g2.warning, "Don't offer the 3-estimate guarantee. Offer the plan without it, or a website first."));
ok(() => assert.equal(guaranteeCalc({ oldLeads: 100, newLeadsPerMonth: 200 }).offer, false), "not eligible under 150 old leads even with a high safe number");
ok(() => assert.equal(guaranteeCalc({ oldLeads: 160, newLeadsPerMonth: 0 }).offer, false), "eligible but safe number under 3");
ok(() => assert.equal(guaranteeCalc({ oldLeads: 300, newLeadsPerMonth: 30 }, mergeOffer({ rates: { oldReply: 0.2 } })).safe, 8), "rates come from settings");

// B4 price script
ok(() => assert.equal(priceScript(), "It's $1,000 to set up, then $997 a month, month to month, and the monthly doesn't start until we book your first estimate. If you don't get at least 3 booked estimates in your first 30 days, month two is free."));

// B5 delivery tracker (acceptance)
ok(() => assert.match(cleanDelivery({ goLiveDate: "2026-02-30" }).error, /Go-live/));
const del = cleanDelivery({ signedDate: "2026-11-02", goLiveDate: "2026-11-10", checklist: { forms: true, nope: true }, oldLeadsReceived: "212" }).ok;
ok(() => assert.deepEqual(del.checklist, { forms: true })); ok(() => assert.equal(del.oldLeadsReceived, 212));
const day16 = "2026-11-25"; // go-live Nov 10 = day 1, Nov 25 = day 16
const s1 = deliveryState(del, [{ bookedOn: "2026-11-12", source: "callback" }], day16);
ok(() => assert.equal(s1.windowDay, 16)); ok(() => assert.equal(s1.status, "at risk")); ok(() => assert.equal(s1.atRisk, true));
ok(() => assert.equal(s1.guaranteeWindowEnd, "2026-12-10"));
ok(() => assert.equal(s1.monthlyBillingStart, "2026-11-12"), "monthly billing starts on the first booked estimate");
ok(() => assert.equal(deliveryState(del, [{ bookedOn: "2026-11-12", source: "callback" }], "2026-11-23").status, "on track"), "day 14 is still on track");
ok(() => assert.equal(deliveryState(del, [{ bookedOn: "2026-11-12", source: "callback" }, { bookedOn: "2026-11-20", source: "revival" }], day16).status, "on track"), "2 booked by day 16 is on track");
ok(() => assert.equal(deliveryState(del, ["2026-11-11", "2026-11-12", "2026-11-13"].map(d => ({ bookedOn: d, source: "revival" })), day16).status, "met"));
ok(() => assert.equal(deliveryState(del, [{ bookedOn: "2026-11-12", source: "callback" }], "2026-12-11").status, "missed -> month 2 credit"));
ok(() => assert.equal(deliveryState(del, [{ bookedOn: "2026-11-12", source: "other" }], day16).bookedInWindow, 0), "only leads our system contacted count");
ok(() => assert.equal(deliveryState({}, [], day16).status, "not live"));
ok(() => assert.equal(deliveryState({}, [{ bookedOn: "2026-11-01", source: "revival" }], day16).monthlyBillingStart, "2026-11-01"), "revival can book before go-live");
ok(() => assert.equal(atRiskTaskTitle("Peachtree Fence"), "Guarantee at risk: Peachtree Fence"));

// B6 Review Builder
ok(() => assert.deepEqual(readReviews(null), { delayDays: 3, reminderDays: 4, requestsSent: 0, reviewsReceived: 0 }));
ok(() => assert.equal(cleanReviews({ trigger: "Friday check-in only", delayDays: "5" }).ok.delayDays, 5));
ok(() => assert.match(cleanReviews({ trigger: "carrier pigeon" }).error, /trigger/));

// B7 monthly report
const f = monthlyFigures({ leadsIn: 42, under10Pct: 98, avgJobValue: 6000, closeRatePct: 30, reviewRequests: 11, newReviews: 4,
  bookings: [{ bookedOn: "2026-11-03", source: "revival" }, { bookedOn: "2026-11-09", source: "revival" }, { bookedOn: "2026-11-15", source: "callback" }, { bookedOn: "2026-11-20", source: "other" }] });
ok(() => assert.equal(f.booked, 3)); ok(() => assert.equal(f.fromRevival, 2)); ok(() => assert.equal(f.fromCallback, 1));
ok(() => assert.equal(f.estimatedValue, 5400), "3 × $6,000 × 30%");
const rep = monthlyReport("Peachtree Fence", "November 2026", f);
ok(() => assert.deepEqual(rep.rows.map(r => r.label), ["Leads in", "Texted in under 10 seconds", "Booked estimates", "Estimated value", "Review requests sent", "New reviews"]));
ok(() => assert.match(rep.text, /^Peachtree Fence, your November 2026 report: 42 leads came in, 98% texted back in under 10 seconds, 3 estimates booked \(about \$5,400/));
ok(() => assert.equal(monthlyReport("X", "Nov", monthlyFigures({ bookings: [] })).rows.length, 1), "blank figures are left out");

// Website one-job calculator (A8)
ok(() => assert.equal(estimatesToPayFor(997, 6000, 30), 1));
ok(() => assert.equal(estimatesToPayFor(997, 3000, 25), 2));
ok(() => assert.equal(estimatesToPayFor(997, 0, 30), null));

// Website copy (site alignment SOW)
import { readFileSync, readdirSync, statSync } from "node:fs";
const home = readFileSync("site/index.html", "utf8");
ok(() => assert.match(home, /\$90,000/), "calculator shows real numbers before JS runs (20 × 50% × 50% × 25% × $6,000 × 12)");
ok(() => assert.doesNotMatch(home, /calc-half/), "no inflated every-call-is-a-job figure");
ok(() => assert.match(home, /Cinder pays for itself with <b data-o="onejob">1<\/b>/), "one-job line default: 6000 / 25% → 1");
ok(() => assert.match(home, /your next monthly payment is waived and we keep working/));
ok(() => assert.match(home, /Pool builders: \$2,000 setup \+ \$1,500\/mo, same guarantee\./));
ok(() => assert.match(home, /No contract\. Cancel by text\. You keep your number\. You own your data\./));
const walk = d => readdirSync(d).flatMap(f => { const p = d + "/" + f; return statSync(p).isDirectory() ? walk(p) : [p]; });
const text = walk("site").filter(f => /\.(html|js|xml|txt|md)$/.test(f)).map(f => readFileSync(f, "utf8")).join("\n");
for (const bad of [/3-month/i, /initial term/i, /once the system is live/i, /HVAC/i, /plumbing/i, /pest/i, /98%/, /under a minute/i, /two weeks/i])
  ok(() => assert.doesNotMatch(text, bad), "banned on the site: " + bad);

console.log(`Founding offer checks passed (${n} assertions).`);
