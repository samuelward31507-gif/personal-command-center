// Website analytics: beacon cleaning, bot filter, and the rollup.
import assert from "node:assert/strict";
import { parseTrack, isBot, siteStats } from "./lib/site-track.ts";
let n = 0; const ok = f => { f(); n++; };
const base = { type: "view", vid: "abcdefgh12", sid: "sess12345678", path: "/watch?n=Mark&b=JC", ref: "https://www.google.com/search?q=x", n: "Mark", b: "JC Fence Company" };
const r = parseTrack(base);
ok(() => assert.equal(r.path, "/watch")); ok(() => assert.equal(r.ref, "google.com")); ok(() => assert.equal(r.whoCompany, "JC Fence Company"));
ok(() => assert.equal(parseTrack({ ...base, type: "hack" }), null)); ok(() => assert.equal(parseTrack({ ...base, vid: "x" }), null));
ok(() => assert.equal(parseTrack({ ...base, ref: "https://cinderrevenue.com/" }).ref, "", "internal referrers don't count"));
ok(() => assert.ok(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"))); ok(() => assert.ok(!isBot("Mozilla/5.0 (iPhone) Safari/604.1")));
const at = "2026-11-10T17:00:00Z";
const evs = [
  { type: "view", vid: "v1", sid: "s1", path: "/", label: "", ref: "google.com", utm_source: "", ms: null, at },
  { type: "leave", vid: "v1", sid: "s1", path: "/", label: "", ref: "", utm_source: "", ms: 4000, at },
  { type: "view", vid: "v2", sid: "s2", path: "/watch", label: "", ref: "", utm_source: "", ms: null, at },
  { type: "play", vid: "v2", sid: "s2", path: "/watch", label: "watch film", ref: "", utm_source: "", ms: null, at },
  { type: "click", vid: "v2", sid: "s2", path: "/watch", label: "Book: cal.com", ref: "", utm_source: "", ms: null, at },
  { type: "leave", vid: "v2", sid: "s2", path: "/watch", label: "", ref: "", utm_source: "", ms: 61000, at },
];
const s = siteStats(evs);
ok(() => assert.equal(s.visitors, 2)); ok(() => assert.equal(s.bounceRate, 50)); ok(() => assert.equal(s.bookClicks, 1)); ok(() => assert.equal(s.bookClickRate, 50));
ok(() => assert.equal(s.demoPlays, 1)); ok(() => assert.deepEqual(s.sources.map(x => x.source).sort(), ["Direct or text link", "google.com"]));
ok(() => assert.ok(s.medianSeconds === 61 || s.medianSeconds === 4));
console.log(`Site tracking checks passed (${n} assertions).`);
