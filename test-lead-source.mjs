// Lead sources: channel from free-text sources, and the per-channel funnel.
import assert from "node:assert/strict";
import { channelOf, channelReport, SOURCE_CHOICES, CHANNEL_LABEL } from "./lib/lead-source.ts";
let n = 0; const ok = f => { f(); n++; };

ok(() => assert.equal(channelOf("Instagram DM"), "instagram"));
ok(() => assert.equal(channelOf("ig"), "instagram"));
ok(() => assert.equal(channelOf("Facebook DM"), "facebook"));
ok(() => assert.equal(channelOf("Cal.com booking"), "booking"));
ok(() => assert.equal(channelOf("Website form · Google"), "website"));
ok(() => assert.equal(channelOf("Referral from Mike"), "referral"));
ok(() => assert.equal(channelOf("upsell"), "upsell"));
ok(() => assert.equal(channelOf("Cold call"), "cold_call"));
ok(() => assert.equal(channelOf("trade show"), "other"));
ok(() => assert.equal(channelOf("contact record", "Website form"), "website", "meaningless deal source falls back to the contact"));
ok(() => assert.equal(channelOf("", "CSV import"), "unknown"));
ok(() => assert.equal(channelOf(null, null), "unknown"));
ok(() => assert.equal(channelOf("call outcome", "Instagram DM"), "instagram", "a call on a DM lead credits the DM"));
ok(() => assert.equal(channelOf("call outcome", "CSV import"), "cold_call"));
ok(() => assert.ok(SOURCE_CHOICES.every(label => channelOf(label) !== "other" && channelOf(label) !== "unknown" || label === "Other"), "every picker choice maps to its own channel"));
ok(() => assert.ok(SOURCE_CHOICES.every(label => CHANNEL_LABEL[channelOf(label)] === label), "picker labels round-trip"));

const d = (dealSource, stage, o = {}) => ({ dealSource, contactSource: "", stage, meeting: false, monthlyFee: 997, setupFee: 1500, ...o });
const r = channelReport([
  d("Instagram DM", "won"), d("Instagram DM", "lost"), d("Instagram DM", "meeting_held"), d("Instagram DM", "contacted"),
  d("Cold call", "contacted"), d("Cold call", "contacted"), d("Cold call", "lost", { meeting: true }),
  d("", "new"),
]);
const ig = r.rows.find(x => x.channel === "instagram");
ok(() => assert.deepEqual([ig.deals, ig.meetings, ig.won, ig.lost, ig.wonMonthly], [4, 2, 1, 1, 997]));
ok(() => assert.equal(ig.meetingRate, 50));
ok(() => assert.equal(ig.closeRate, 50, "close rate only counts decided deals"));
const cc = r.rows.find(x => x.channel === "cold_call");
ok(() => assert.equal(cc.meetings, 1, "a logged meeting counts even if the deal was lost later"));
ok(() => assert.equal(cc.closeRate, 0));
ok(() => assert.equal(r.rows[0].channel, "instagram", "channels with wins first"));
ok(() => assert.equal(r.best.channel, "instagram"));
ok(() => assert.equal(r.unknownShare, 13));
ok(() => assert.equal(channelReport([d("Instagram DM", "won"), d("Instagram DM", "new")]).best, null, "no verdict on tiny samples"));
ok(() => assert.deepEqual(channelReport([]), { rows: [], best: null, unknownShare: 0 }));

console.log(`lead sources: ${n} checks passed`);
