import assert from "node:assert/strict";
const { cleanSpeedTest, summarize, speedLine, duration, loomScript, loomFinding } = await import("./lib/speed-test.ts");
let n = 0; const ok = f => { f(); n++; };

const at = "2026-11-17T21:14:00.000Z";
const h = 3600 * 1000;
ok(() => assert.equal(cleanSpeedTest({ via: "form", at: "nope" }), null));
ok(() => assert.equal(cleanSpeedTest({ via: "fax", at }), null));
ok(() => assert.equal(cleanSpeedTest({ via: "form", at, repliedAt: "2026-11-17T20:00:00Z" }), null, "reply before request is rejected"));
ok(() => assert.deepEqual(cleanSpeedTest({ via: "call", at, repliedAt: null, extra: 1 }), { via: "call", at, repliedAt: null }));
ok(() => assert.equal(duration(8 * 60000), "8 min"));
ok(() => assert.equal(duration(4 * h + 12 * 60000), "4h 12m"));
ok(() => assert.equal(duration(72 * h), "3 days"));

const now = Date.parse(at);
ok(() => assert.equal(summarize({ via: "form", at, repliedAt: null }, now + 30 * 60000).state, "waiting"));
ok(() => assert.equal(summarize({ via: "form", at, repliedAt: null }, now + 49 * h).state, "no_reply"));
ok(() => assert.equal(summarize({ via: "form", at, repliedAt: new Date(now + 3 * 60000).toISOString() }).tone, "good"));
ok(() => assert.equal(summarize({ via: "form", at, repliedAt: new Date(now + 4 * h).toISOString() }).tone, "bad"));
ok(() => assert.equal(speedLine({ via: "form", at, repliedAt: null }, now + 10 * 60000), null, "no claim while waiting"));
ok(() => assert.match(speedLine({ via: "form", at, repliedAt: null }, now + 50 * h, "America/Chicago"), /quote form on your website Tuesday at 3:14 PM\. Nobody got back to me\./));
ok(() => assert.match(speedLine({ via: "call", at, repliedAt: new Date(now + 4 * h).toISOString() }, now, "America/Chicago"), /4h later/));

const base = { company: "Narron Fences", firstName: "Penny", website: "narronfences.com", now: now + 50 * h, timeZone: "America/New_York" };
ok(() => assert.equal(loomFinding({ ...base, speed: { via: "form", at, repliedAt: null }, reviewCount: 7 }).kind, "speed", "a failed test beats reviews"));
ok(() => assert.equal(loomFinding({ ...base, speed: { via: "form", at, repliedAt: new Date(now + 60000).toISOString() }, reviewCount: 7 }).kind, "reviews", "a fast reply is not used against them"));
ok(() => assert.equal(loomFinding({ ...base, noWebsite: true }).kind, "website"));
ok(() => assert.equal(loomFinding({ ...base }).kind, "general"));
const s = loomScript({ ...base, reviewCount: 7, rating: 3.5, bookingLink: "https://cal.com/x" });
ok(() => assert.equal(s.beats.length, 5));
ok(() => assert.match(s.text, /^0:00  \[narronfences\.com/));
ok(() => assert.match(s.text, /Hey Penny, it's Sam with Cinder/));
ok(() => assert.match(s.text, /7 Google reviews at 3\.5 stars/));
ok(() => assert.match(s.text, /Link under the video: https:\/\/cal\.com\/x/));
ok(() => assert.doesNotMatch(s.text, /\bAI\b/, "never lead with AI"));
ok(() => assert.match(loomScript({ company: "X" }).text, /^0:00  \[Their Google listing\]\nHey, it's Sam/));
console.log(`Speed test and Loom checks passed (${n} assertions).`);
