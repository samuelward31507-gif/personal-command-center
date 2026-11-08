// Workspace settings: defaults match today's behaviour, saves are checked strictly, bad rows never break a page.
import assert from "node:assert/strict";
import { DEFAULT_WORKSPACE, envDefaults, mergeWorkspace, validateWorkspace, offersFrom, goalLabel, todayIn, isTimezone } from "./lib/workspace.ts";
import { suggestOffer, suggestDeal, OFFERS } from "./lib/offers.ts";
import { goalMath } from "./lib/scoreboard.ts";
import { fillAgreement } from "./lib/agreement-template.ts";
import { buildScript, buildObjections } from "./lib/call-script.ts";
import { buildSystemPrompt } from "./lib/ask.ts";
import { topMoves } from "./lib/weekly-review.ts";
import { renderReport } from "./lib/client-report.ts";
let n = 0; const ok = f => { f(); n++; };

// Defaults are exactly the old hard-coded values.
ok(() => assert.deepEqual(offersFrom(DEFAULT_WORKSPACE).tier1, { ...OFFERS.tier1 }));
ok(() => assert.deepEqual(offersFrom(DEFAULT_WORKSPACE).tier2, { ...OFFERS.tier2 }));
ok(() => assert.equal(goalLabel(DEFAULT_WORKSPACE), "$50k by year-end"));
ok(() => assert.equal(DEFAULT_WORKSPACE.timezone, "America/Denver"));

// Old environment settings carry over.
const env = envDefaults({ CINDER_PROVIDER_ADDRESS: "7620 Conifer Dr", CINDER_ALERT_EMAIL: "a@b.co", CINDER_TIMEZONE: "Not/AZone" });
ok(() => assert.equal(env.address, "7620 Conifer Dr"));
ok(() => assert.equal(env.contactEmail, "a@b.co"));
ok(() => assert.equal(env.timezone, "America/Denver", "an invalid zone in env falls back"));

// Merging: broken or partial rows fall back field by field.
ok(() => assert.deepEqual(mergeWorkspace(null), DEFAULT_WORKSPACE));
ok(() => assert.deepEqual(mergeWorkspace("garbage"), DEFAULT_WORKSPACE));
const m = mergeWorkspace({ businessName: "  Acme Growth  ", tier1: { setupFee: "$2,000", monthlyFee: -5 }, timezone: "Mars/Base", goalAmount: 0, goalBy: "2027-02-30x", dailyCallTarget: 9999 });
ok(() => assert.equal(m.businessName, "Acme Growth"));
ok(() => assert.equal(m.tier1.setupFee, 2000, "money strings are parsed"));
ok(() => assert.equal(m.tier1.monthlyFee, 997, "negative fee ignored"));
ok(() => assert.equal(m.timezone, "America/Denver"));
ok(() => assert.equal(m.goalAmount, 50_000));
ok(() => assert.equal(m.goalBy, "2026-12-31"));
ok(() => assert.equal(m.dailyCallTarget, 100));
ok(() => assert.equal(mergeWorkspace({ businessName: "x".repeat(500) }).businessName.length, 80, "text is capped"));

// Strict validation for saves.
const good = { ...DEFAULT_WORKSPACE, contactEmail: "sam@example.com", tier1: { label: "Starter", setupFee: 2000, monthlyFee: 1200 }, goalAmount: 120000, goalBy: "2027-06-30", dailyCallTarget: 30 };
const v = validateWorkspace(good);
ok(() => assert.ok("ok" in v));
ok(() => assert.equal(v.ok.tier1.label, "Starter"));
ok(() => assert.equal(v.ok.goalAmount, 120000));
ok(() => assert.match(validateWorkspace({ ...good, businessName: " " }).error, /Business name/));
ok(() => assert.match(validateWorkspace({ ...good, legalName: "" }).error, /Legal name/));
ok(() => assert.match(validateWorkspace({ ...good, contactEmail: "nope" }).error, /email/));
ok(() => assert.match(validateWorkspace({ ...good, timezone: "Mars/Base" }).error, /time zone/));
ok(() => assert.match(validateWorkspace({ ...good, tier2: { label: "x", setupFee: "abc", monthlyFee: 1 } }).error, /Tier 2 setup fee/));
ok(() => assert.match(validateWorkspace({ ...good, goalAmount: 0 }).error, /goal/i));
ok(() => assert.match(validateWorkspace({ ...good, goalBy: "soon" }).error, /date/));
ok(() => assert.match(validateWorkspace({ ...good, dailyCallTarget: 0 }).error, /call target/));
ok(() => assert.ok("error" in validateWorkspace(null)));

// Helpers.
ok(() => assert.ok(isTimezone("America/Chicago")));
ok(() => assert.ok(!isTimezone("")));
ok(() => assert.equal(todayIn("America/Denver", new Date("2026-11-02T05:00:00Z")), "2026-11-01", "Denver is still the 1st at 10pm"));
ok(() => assert.equal(goalLabel({ ...DEFAULT_WORKSPACE, goalAmount: 12500, goalBy: "2027-03-31" }), "$12,500 by Mar 31, 2027"));

// Consumers use settings when given, old values when not.
const custom = offersFrom(v.ok);
ok(() => assert.equal(suggestOffer("Ridgeline Fence", null, custom).setupFee, custom.tier2.setupFee, "Book & Close is the default plan"));
ok(() => assert.equal(suggestOffer("Ridgeline Fence", null).setupFee, 2500));
ok(() => assert.equal(suggestDeal({ name: "", company: "Blue Pools" }, null, "interested", custom).monthlyFee, custom.tier2.monthlyFee));
const g = goalMath({ today: "2026-11-01", collected: 30000, expectedByGoal: 0, offers: Object.values(custom), goal: { amount: 120000, by: "2027-06-30" } });
ok(() => assert.equal(g.goal, 120000));
ok(() => assert.equal(g.progressPct, 25));
ok(() => assert.equal(goalMath({ today: "2026-11-01", collected: 25000, expectedByGoal: 0, offers: [] }).goal, 50000, "no goal given → old goal"));

const ag = fillAgreement({ tier: "tier1", date: "Nov 1, 2026", company: "Ridgeline Fence", setupFee: 2000, monthlyFee: 1200, providerName: "Acme LLC", signerName: "Jordan Lee" });
ok(() => assert.match(ag, /\*\*Provider:\*\* Acme LLC/));
ok(() => assert.match(ag, /Name: Jordan Lee/));
ok(() => assert.match(fillAgreement({ tier: "tier1", date: "x", company: "y", setupFee: 1, monthlyFee: 1 }), /Name: Samuel Ward/, "signer defaults"));

const si = { firstName: "Mike", company: "Ridgeline Fence", location: "Denver, CO", notes: "", setupFee: 1500, monthlyFee: 997 };
ok(() => assert.match(buildScript({ ...si, me: "Jordan", brand: "Acme" })[0].say, /it's Jordan with Acme\./));
ok(() => assert.match(buildScript(si)[0].say, /it's Sam with Cinder\./));
ok(() => assert.ok(buildObjections({ ...si, me: "Jordan", brand: "Acme" }).every(o => !o.say.includes("Samuel"))));

const ctx = { today: "2026-11-01", now: "Sun, 7:00 AM", timeZone: "America/Denver", weekday: "Sun" };
ok(() => assert.match(buildSystemPrompt(ctx), /Sam runs Cinder Revenue Company/));
ok(() => assert.match(buildSystemPrompt(ctx), /Never Miss a Lead \$1,500 setup \+ \$997\/mo; Book & Close \$2,500 setup \+ \$1,997\/mo/));
const p2 = buildSystemPrompt(ctx, { owner: "Jordan", name: "Acme", niche: "roofers", offers: [{ label: "Starter", setupFee: 2000, monthlyFee: 1200 }] });
ok(() => assert.match(p2, /Jordan runs Acme, helping roofers book more jobs .*\. Offers: Starter \$2,000 setup \+ \$1,200\/mo\./));
ok(() => assert.ok(!p2.includes("Samuel")));

const empty = { week: { calls: 0, conversations: 0, meetings: 0, proposals: 0, won: 0, wonValue: 0 }, pipeline: [], money: { paidThisWeek: 0, expectedNext14: 0, overdue: 0 }, agreementsWaiting: [], proposalsWaiting: [], overdueMoney: [], lateSteps: [], lateMilestones: [], overdueTasks: 0 };
ok(() => assert.match(topMoves(empty, { niche: "roofers" })[0].text, /DMs to roofers/));
ok(() => assert.match(topMoves(empty)[0].text, /contractors and home-service companies/));
ok(() => assert.match(renderReport("Ridgeline", "2026-10", {}, "Jordan", "Acme").body, /Jordan\nAcme$/));

console.log(`workspace: ${n} checks passed`);

// Four payment links: the tier link is used only when the invoice amount matches that tier's price.
{
  const { paymentLinkFor, validateWorkspace: vw, mergeWorkspace: mw, DEFAULT_WORKSPACE: D } = await import("./lib/workspace.ts");
  let m = 0; const ok2 = f => { f(); m++; };
  const w = mw({ paymentLink: "https://pay.example.com/any", tier1: { setupLink: "https://buy.stripe.com/t1s", monthlyLink: "https://buy.stripe.com/t1m" }, tier2: { setupLink: "https://buy.stripe.com/t2s", monthlyLink: "https://buy.stripe.com/t2m" } });
  ok2(() => assert.deepEqual(paymentLinkFor(w, "tier1_speed_to_lead", "setup_fee", 1500), { link: "https://buy.stripe.com/t1s", kind: "setup" }));
  ok2(() => assert.equal(paymentLinkFor(w, "tier1_speed_to_lead", "monthly_retainer", 997).link, "https://buy.stripe.com/t1m"));
  ok2(() => assert.equal(paymentLinkFor(w, "tier2_revenue_system", "setup_fee", 2500).link, "https://buy.stripe.com/t2s"));
  ok2(() => assert.equal(paymentLinkFor(w, "tier2_revenue_system", "monthly_retainer", 1997).link, "https://buy.stripe.com/t2m"));
  ok2(() => assert.equal(paymentLinkFor(w, "tier1_speed_to_lead", "setup_fee", 1200).kind, "general", "discounted price never gets the fixed-price link"));
  ok2(() => assert.equal(paymentLinkFor(w, "ai_voice_agent", "one_time", 500).kind, "general"));
  ok2(() => assert.equal(paymentLinkFor(D, "tier1_speed_to_lead", "setup_fee", 1500).kind, "none"));
  ok2(() => assert.equal(mw({ tier1: { setupLink: "http://insecure.com" } }).tier1.setupLink, "", "http links are ignored"));
  ok2(() => assert.match(vw({ ...D, tier2: { ...D.tier2, monthlyLink: "not a url" } }).error, /Tier 2 monthly payment link/));
  ok2(() => assert.equal(vw({ ...D, tier1: { ...D.tier1, setupLink: "https://buy.stripe.com/x" } }).ok.tier1.setupLink, "https://buy.stripe.com/x"));
  ok2(() => assert.equal(vw({ ...D, tier1: { ...D.tier1, setupLink: "" } }).ok.tier1.setupLink, "", "a link can be cleared"));
  console.log(`payment links: ${m} checks passed`);
}
// Booking link: https only, defaults to the existing Cal.com page.
{
  const { mergeWorkspace, validateWorkspace, DEFAULT_WORKSPACE } = await import("./lib/workspace.ts");
  const a = (await import("node:assert/strict")).default;
  a.match(DEFAULT_WORKSPACE.bookingLink, /^https:\/\//);
  a.equal(mergeWorkspace({ bookingLink: "http://x.com" }).bookingLink, DEFAULT_WORKSPACE.bookingLink);
  a.equal(mergeWorkspace({ bookingLink: "https://calendly.com/me" }).bookingLink, "https://calendly.com/me");
  a.match(validateWorkspace({ ...DEFAULT_WORKSPACE, bookingLink: "nope" }).error, /Booking link/);
  console.log("Booking link checks passed.");
}

// White-label: logo and accent are optional, validated, and default to Cinder.
{
  const { isWhiteLabel } = await import("./lib/workspace.ts");
  const a = assert;
  a.equal(DEFAULT_WORKSPACE.logoUrl, ""); a.equal(DEFAULT_WORKSPACE.accentColor, "");
  a.equal(isWhiteLabel(DEFAULT_WORKSPACE), false, "Cinder itself is not white-labelled");
  a.equal(isWhiteLabel({ ...DEFAULT_WORKSPACE, businessName: "Ridgeline Growth" }), true);
  a.equal(isWhiteLabel({ ...DEFAULT_WORKSPACE, logoUrl: "https://x.com/logo.png" }), true);
  a.equal(mergeWorkspace({ accentColor: "#22AA88" }).accentColor, "#22aa88");
  a.equal(mergeWorkspace({ accentColor: "red" }).accentColor, "", "bad colors fall back to Cinder");
  a.equal(mergeWorkspace({ logoUrl: "http://x.com/a.png" }).logoUrl, "", "logos must be https");
  a.match(validateWorkspace({ ...DEFAULT_WORKSPACE, logoUrl: "javascript:alert(1)" }).error, /Logo/);
  a.match(validateWorkspace({ ...DEFAULT_WORKSPACE, accentColor: "#12" }).error, /Accent/);
  a.equal(validateWorkspace({ ...DEFAULT_WORKSPACE, logoUrl: "https://cdn.x.com/l.svg", accentColor: "#123456" }).ok.logoUrl, "https://cdn.x.com/l.svg");
  console.log("White-label checks passed.");
}
