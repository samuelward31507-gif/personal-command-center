import assert from "node:assert/strict";
const E = await import("./lib/content-engine.ts");

// Weeks start Monday.
assert.equal(E.weekStart("2026-11-10"), "2026-11-09");
assert.equal(E.weekStart("2026-11-15"), "2026-11-09");
assert.equal(E.weekStart("2026-11-16"), "2026-11-16");
assert.equal(E.dayDate("2026-11-09", 7), "2026-11-16");

// 77 slots: 5 feed posts and 5 reels a day, LinkedIn weekdays, groups Tue and Thu.
const plan = E.planWeek();
assert.equal(plan.length, 77); assert.equal(E.POSTS_PER_WEEK, 77);
assert.equal(plan.filter(s => s.platform === "feed" && s.day === 2).length, 5);
assert.equal(plan.filter(s => s.platform === "video" && s.day === 6).length, 5);
assert.ok(plan.every(s => s.angle));
for (let d = 0; d < 7; d++) assert.ok(plan.some(s => s.day === d && s.platform === "feed" && s.pillar === "offer"), `no offer on day ${d}`);
assert.equal(plan.filter(s => s.platform === "linkedin").length, 5);
assert.deepEqual(plan.filter(s => s.platform === "group").map(s => s.day), [1, 3]);
assert.ok(plan.every(s => E.PILLARS[s.pillar].platforms.includes(s.platform)));
assert.ok(!plan.some(s => s.platform === "group" && s.pillar === "offer"));
// No topic twice on the same platform on the same day.
for (const p of ["feed", "video"]) for (let d = 0; d < 7; d++) { const ps = plan.filter(s => s.platform === p && s.day === d).map(s => s.pillar); assert.equal(new Set(ps).size, ps.length, `${p} day ${d} repeats a topic`); }
const li = plan.filter(s => s.platform === "linkedin").map(s => s.pillar);
for (let i = 1; i < li.length; i++) assert.notEqual(li[i], li[i - 1]);

// Topics that brought leads get more slots.
const hot = E.planWeek(Array.from({ length: 4 }, () => ({ pillar: "tip", platform: "feed", views: 900, comments: 4, leads: 2 })));
assert.ok(hot.filter(s => s.pillar === "tip").length > plan.filter(s => s.pillar === "tip").length);
assert.ok(E.pillarScores([{ pillar: "tip", platform: "feed", views: 400, comments: 1, leads: 1 }]).tip > 10);

// Prompt carries the rules and the real numbers.
const ctx = { dials: 312, conversations: 31, meetings: 3, emailsSent: 61, streakDays: 5, clientsLive: 0, leadsAnswered: 0, estimatesBooked: 0, heard: ["owner said he's on roofs all day"], recent: ["Old hook"], trades: ["fence companies"], offer: "Half-price setup" };
const sys = E.contentSystem();
assert.match(sys, /Never open with or center on "AI"/);
assert.match(sys, /Invoca, 2021/);
const user = E.contentUser(ctx, plan.slice(0, 3), "2026-11-16");
assert.match(user, /Dials: 312/); assert.match(user, /Clients live: 0 \(still signing/); assert.match(user, /Old hook/); assert.match(user, /1\. Monday/); assert.match(user, /Shape: /);

// Parsing: lines up with slots, cleans cards, drops unsourced stats, keeps carousels only on the feed.
const slots = [{ day: 0, platform: "feed", pillar: "missed", n: 0 }, { day: 0, platform: "video", pillar: "tip", n: 0 }, { day: 1, platform: "feed", pillar: "quotes", n: 0 }];
const reply = "Here you go:\n" + JSON.stringify([
  { slot: 1, format: "carousel", hook: "Nobody leaves voicemails", body: "Body one", card: { type: "stat", figure: "2%", line: "leave a voicemail", source: "Invoca, 2021" }, slides: [{ type: "hook", text: "a" }, { type: "hook", text: "b" }, { type: "list", title: "Do this", items: ["one", "two"] }] },
  { slot: 2, format: "carousel", hook: "Copy this text", body: "Caption", card: { type: "stat", figure: "93%", line: "made up", source: "Somebody" }, shoot: "Film your phone", scenes: ["Copy this text", "Day 2: any questions?", "Day 5: still on?", "Follow up until it's a yes or a no"] },
  { slot: 3, hook: "", body: "no hook" },
  { slot: 1, hook: "dupe", body: "dupe" },
]);
const ds = E.parseDrafts(reply, slots, ctx);
assert.equal(ds.length, 2);
assert.equal(ds[0].format, "carousel"); assert.equal(ds[0].slides.length, 3); assert.equal(ds[0].card.type, "stat");
assert.equal(ds[1].format, "video"); assert.equal(ds[1].slides.length, 4); assert.equal(ds[1].slides[1].text, "Day 2: any questions?"); assert.equal(ds[1].card.type, "hook"); assert.equal(ds[1].shoot, "Film your phone");
assert.equal(E.cleanCard({ type: "stat", figure: "312", line: "dials this week", source: "Cinder, this week" }, "x", ctx).type, "stat");
assert.equal(E.cleanCard({ type: "stat", figure: "400", line: "dials", source: "Cinder, this week" }, "x", ctx).type, "hook");
assert.equal(E.cleanCard({ type: "thread", messages: [{ from: "in", text: "hi" }] }, "fallback").type, "hook");
assert.equal(E.cleanCard(null, "fallback").text, "fallback");
assert.deepEqual(E.parseDrafts("no json", slots), []);

// Lint catches what we never post.
assert.ok(E.lint({ hook: "AI that answers your phone", body: "x", platform: "feed" }).some(i => /AI/.test(i)));
assert.ok(E.lint({ hook: "Hi", body: "Check out Cinder, link in bio", platform: "group" }).some(i => /Group post/.test(i)));
assert.ok(E.lint({ hook: "Hi", body: "87% of owners lose calls", platform: "feed" }).some(i => /no source/.test(i)));
assert.deepEqual(E.lint({ hook: "Missed calls are jobs", body: "Only 2% leave a voicemail (Invoca, 2021).", platform: "feed" }), []);

// Captions get the right tags; LinkedIn and groups get none.
assert.match(E.captionFor({ body: "x", platform: "feed", pillar: "missed" }), /#contractor/);
assert.match(E.captionFor({ body: "x", platform: "video", pillar: "detail" }), /#autodetailing/);
assert.equal(E.captionFor({ body: "x", platform: "linkedin", pillar: "missed" }), "x");

// Wrapping.
assert.deepEqual(E.wrap("one two three four", 9, s => s.length), ["one two", "three", "four"]);
assert.deepEqual(E.wrap("a\nb", 10, s => s.length), ["a", "b"]);
console.log("content engine ok");
