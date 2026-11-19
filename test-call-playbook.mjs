import assert from "node:assert/strict";
const { SCRIPTS, fillLine, VOICEMAIL, GATEKEEPER, CLOSE } = await import("./lib/call-playbook.ts");
let n = 0; const ok = f => { f(); n++; };
for (const t of ["trades", "generator", "detailing"]) {
  const s = SCRIPTS[t];
  ok(() => assert.ok(s.open && s.pitch && s.guarantee && s.price && s.dig.length));
  const keys = s.objections.map(o => o.key);
  ok(() => assert.equal(new Set(keys).size, keys.length, `${t}: objection keys unique`));
  ok(() => assert.equal(new Set(s.objections.map(o => o.id)).size, s.objections.length));
  ok(() => assert.ok(!/\bAI\b/.test(s.open + s.pitch), `${t}: don't lead with AI`));
  ok(() => assert.ok(!keys.some(k => /^[0-9cnp]$/i.test(k)), `${t}: objection keys don't clash with call-mode keys`));
}
ok(() => assert.ok(fillLine(SCRIPTS.trades.open, "trades", "Mark").startsWith("Hey Mark, it's Sam")));
ok(() => assert.ok(fillLine(SCRIPTS.trades.open, "trades", "").startsWith("Hey, it's Sam")));
ok(() => assert.ok(fillLine(VOICEMAIL.trades, "trades", null).startsWith("Hey, Sam")));
ok(() => assert.ok(fillLine(GATEKEEPER, "trades", "").includes("who should I ask for?")));
ok(() => assert.ok(fillLine("{price} x", "trades").includes("$1,997")));
ok(() => assert.match(SCRIPTS.generator.pitch, /outage rush/));
ok(() => assert.ok(!/day 1, day 3/.test(SCRIPTS.trades.pitch + SCRIPTS.generator.pitch), "follow-up days match the offer"));
ok(() => assert.ok(fillLine("{price} x", "detailing").includes("$997")));
ok(() => assert.ok(!/\{/.test(fillLine(CLOSE, "trades", "A"))));
for (const t of ["trades", "generator", "detailing"]) ok(() => assert.match(SCRIPTS[t].open, /30 seconds/, "permission-based opener"));
ok(() => assert.match(SCRIPTS.trades.close, /tomorrow or Friday/, "trades close books a time"));
ok(() => assert.doesNotMatch(CLOSE, /interested|open to/i, "soft ask only"));
ok(() => assert.match(CLOSE, /morning or afternoon/));
ok(() => assert.ok(SCRIPTS.trades.objections.some(o => o.key === "w" && /booked out/.test(o.label))));
ok(() => assert.ok(SCRIPTS.detailing.objections.some(o => o.key === "w" && /booked out/.test(o.label))));
ok(() => assert.match(fillLine(SCRIPTS.trades.close, "trades", "Mark", { company: "Ridge Fence" }), /set up as Ridge Fence\./));
ok(() => assert.match(SCRIPTS.trades.open, /I'll be honest, this is a cold call/));
console.log(`Call playbook checks passed (${n} assertions).`);

// The fence and generator pitch forks on the either/or answer.
for (const t of ["trades", "generator"]) {
  const sides = SCRIPTS[t].sides;
  ok(() => assert.equal(sides?.length, 2, `${t}: two sides`));
  ok(() => assert.deepEqual(sides.map(x => x.id), ["calls", "quotes"]));
  ok(() => assert.deepEqual(sides.map(x => x.key), ["m", "q"]));
  for (const sd of sides) {
    ok(() => assert.ok(sd.probe.length && sd.fix && /\{company\}/.test(sd.close), `${t}/${sd.id} complete`));
    ok(() => assert.ok(!SCRIPTS[t].objections.some(o => o.key === sd.key), `${t}/${sd.id} key is free`));
  }
  ok(() => assert.equal(sides[1].tier, "Book & Close"));
  ok(() => assert.match(sides[1].fix, /days 2, 5 and 10, then monthly/));
}
ok(() => assert.equal(SCRIPTS.detailing.sides, undefined));
