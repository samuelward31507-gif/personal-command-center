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
ok(() => assert.equal(fillLine(SCRIPTS.trades.open, "trades", "Mark").startsWith("Hey, is this Mark?"), true));
ok(() => assert.ok(fillLine(SCRIPTS.trades.open, "trades", "").startsWith("Hey, is this the owner?")));
ok(() => assert.ok(fillLine(VOICEMAIL.trades, "trades", null).startsWith("Hey, Sam")));
ok(() => assert.ok(fillLine(GATEKEEPER, "trades", "").includes("who should I ask for?")));
ok(() => assert.ok(fillLine("{price} x", "trades").includes("$1,997")));
ok(() => assert.ok(fillLine("{price} x", "detailing").includes("$997")));
ok(() => assert.ok(!/\{/.test(fillLine(CLOSE, "trades", "A"))));
console.log(`Call playbook checks passed (${n} assertions).`);
