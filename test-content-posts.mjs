import assert from "node:assert/strict";
const { ALL_POSTS, PAGE_POSTS, DEMO_CLIPS, VIDEO_SCRIPTS, PAGE_VIDEOS, nextPost } = await import("./lib/content-posts.ts");
let n = 0; const ok = f => { f(); n++; };

// Keys unique across every channel, and each post sits on the channel it's listed under.
const keys = ALL_POSTS.map(p => p.key);
ok(() => assert.equal(new Set(keys).size, keys.length, "post keys are unique across ALL_POSTS"));
ok(() => assert.equal(ALL_POSTS.length, PAGE_POSTS.length + DEMO_CLIPS.length + VIDEO_SCRIPTS.length - 1 + PAGE_VIDEOS.length));
for (const p of ALL_POSTS) ok(() => assert.ok(p.file && /^\/content\/(posts|videos)?\/?[a-z0-9-]+\.(jpg|mp4)$/.test(p.file), `${p.key}: has a ready file`));
for (const c of DEMO_CLIPS) ok(() => assert.ok(c.channel === "video" && /^\/content\/demo-[a-z-]+\.mp4$/.test(c.file ?? ""), `${c.key}: has a demo file`));
ok(() => assert.ok(PAGE_POSTS.every(p => p.channel === "page") && VIDEO_SCRIPTS.every(p => p.channel === "video")));
ok(() => assert.ok(VIDEO_SCRIPTS.every(p => p.shoot && p.shoot.trim()), "every video has a shoot note"));
// Lead with more jobs, never "AI".
for (const p of ALL_POSTS) ok(() => assert.ok(!/\bAI\b/.test(`${p.label}\n${p.body}\n${p.shoot ?? ""}`), `${p.key}: no "AI" in copy`));
for (const p of ALL_POSTS) ok(() => assert.ok(p.label.trim() && p.body.trim().length > 40, `${p.key}: has a label and a body`));

// Rotation: first never-posted post, in order.
ok(() => assert.equal(nextPost("page", []).key, PAGE_POSTS[0].key));
ok(() => assert.equal(nextPost("video", []).key, DEMO_CLIPS[0].key, "ready-made demo videos come first"));
ok(() => assert.equal(nextPost("page", [{ key: PAGE_POSTS[0].key, at: "2026-11-01T12:00:00Z" }]).key, PAGE_POSTS[1].key));
// Posts on the other channel don't move this channel's rotation.
ok(() => assert.equal(nextPost("page", [{ key: VIDEO_SCRIPTS[0].key, at: "2026-11-01T12:00:00Z" }]).key, PAGE_POSTS[0].key));
// Walk the whole page rotation: every post comes up exactly once before any repeats.
{
  const log = []; const seen = [];
  for (let i = 0; i < PAGE_POSTS.length; i++) {
    const p = nextPost("page", log);
    seen.push(p.key);
    log.push({ key: p.key, at: new Date(Date.UTC(2026, 10, 1 + i)).toISOString() });
  }
  ok(() => assert.equal(new Set(seen).size, PAGE_POSTS.length, "no repeats until all posted"));
  // All posted: the one posted longest ago comes back first.
  ok(() => assert.equal(nextPost("page", log).key, seen[0]));
  // Posting the oldest again makes the next-oldest come up.
  log.push({ key: seen[0], at: "2026-12-30T12:00:00Z" });
  ok(() => assert.equal(nextPost("page", log).key, seen[1]));
}
// Only the newest post of a key counts.
ok(() => {
  const V = ALL_POSTS.filter(p => p.channel === "video");
  const [a, b] = V;
  const rest = V.slice(2).map((p, i) => ({ key: p.key, at: `2026-11-${String(i + 1).padStart(2, "0")}T12:00:00Z` }));
  const log = [...rest, { key: a.key, at: "2026-10-01T12:00:00Z" }, { key: a.key, at: "2026-11-30T12:00:00Z" }, { key: b.key, at: "2026-10-15T12:00:00Z" }];
  assert.equal(nextPost("video", log).key, b.key);
});

console.log(`Content post checks passed (${n} assertions).`);
