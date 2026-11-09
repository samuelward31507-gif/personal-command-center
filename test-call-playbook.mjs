import assert from "node:assert/strict";
const { SCRIPTS, fillLine, VOICEMAIL, GATEKEEPER, CLOSE } = await import("./lib/call-playbook.ts");
let n = 0; const ok = f => { f(); n++; };
for (const t of ["trades", "detailing"]) {
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
ok(() => assert.ok(fillLine("{price} x", "detailing").includes("$997")));
ok(() => assert.ok(!/\{/.test(fillLine(CLOSE, "trades", "A"))));
for (const t of ["trades", "detailing"]) ok(() => assert.match(SCRIPTS[t].open, /30 seconds to tell you why I called/, "permission-based opener"));
ok(() => assert.doesNotMatch(CLOSE, /interested|open to/i, "soft ask only"));
ok(() => assert.match(CLOSE, /morning or afternoon/));
ok(() => assert.ok(SCRIPTS.trades.objections.some(o => o.key === "w" && /slammed/.test(o.label))));
ok(() => assert.ok(SCRIPTS.detailing.objections.some(o => o.key === "w" && /booked out/.test(o.label))));
console.log(`Call playbook checks passed (${n} assertions).`);
