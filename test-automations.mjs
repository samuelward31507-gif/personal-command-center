// The owner's own follow-ups: the pure rules in lib/automations.ts.
import assert from "node:assert/strict";
const A = await import("./lib/automations.ts");
let n = 0; const ok = f => { f(); n++; };
let k = 0; const id = () => "rule" + String(++k).padStart(4, "0");
ok(() => { const r = A.cleanRule({ trigger: "quoted", days: "3", message: "  Hi {first}, any questions on the quote?  " }); assert.equal(r.days, 3); assert.equal(r.name, "A quote goes out"); assert.equal(r.message, "Hi {first}, any questions on the quote?"); assert.equal(r.on, true); });
ok(() => assert.match(A.cleanRule({ trigger: "sold", days: 1, message: "Hello there friend" }).error, /when/));
ok(() => assert.match(A.cleanRule({ trigger: "won", days: 900, message: "Hello there friend" }).error, /730/));
ok(() => assert.match(A.cleanRule({ trigger: "won", days: -1, message: "Hello there friend" }).error, /730/));
ok(() => assert.match(A.cleanRule({ trigger: "won", days: 1, message: "Hi" }).error, /Write the text/));
ok(() => assert.equal(A.cleanRule({ trigger: "won", days: 1, message: "x".repeat(600) }).message.length, 480));
ok(() => { // New rules start now; a kept rule that stays on keeps its start; off-and-on starts again.
  const t0 = "2026-11-01T00:00:00.000Z", t1 = "2026-11-16T00:00:00.000Z";
  const saved = A.mergeRules([{ trigger: "quoted", days: 3, message: "Any questions on the quote?" }, { trigger: "won", days: 365, message: "One year check-in text", on: false }], [], t0, id);
  assert.equal(saved.length, 2); assert.equal(saved[0].since, t0);
  const again = A.mergeRules([{ ...saved[0], message: "Any questions on that quote?" }, { ...saved[1], on: true }, { trigger: "paid", days: 7, message: "Thanks, tell a friend!" }], saved, t1, id);
  assert.equal(again[0].id, saved[0].id); assert.equal(again[0].since, t0, "edited but stayed on: keeps its start");
  assert.equal(again[1].since, t1, "turned back on: starts now, no catching up"); assert.equal(again[2].since, t1); assert.notEqual(again[2].id, saved[0].id);
  assert.deepEqual(A.readRules(JSON.stringify(again)).map(r => r.id), again.map(r => r.id)); });
ok(() => assert.match(A.mergeRules(Array.from({ length: 13 }, () => ({ trigger: "won", days: 1, message: "Hello there friend" })), [], "2026-11-16T00:00:00.000Z", id).error, /Up to 12/));
ok(() => assert.match(A.mergeRules([{ trigger: "won", days: 1, message: "ok" }], [], "x", id).error, /Write the text/));
ok(() => assert.deepEqual(A.readRules("not json"), []));
ok(() => assert.deepEqual(A.readRules([{ trigger: "won", days: 1, message: "Hello there friend", id: "bad id!", since: "x" }]), [], "a rule without a clean id is dropped"));
ok(() => { assert.equal(A.ruleWhen({ trigger: "quoted", days: 3 }), "3 days after a quote goes out, and they haven't answered yet");
  assert.equal(A.ruleWhen({ trigger: "won", days: 365 }), "1 year after a job is won"); assert.equal(A.ruleWhen({ trigger: "paid", days: 0 }), "Right when an invoice is paid in full");
  assert.equal(A.ruleWhen({ trigger: "lost", days: 28 }), "4 weeks after a job is lost"); assert.equal(A.ruleWhen({ trigger: "won", days: 1 }), "1 day after a job is won"); });
console.log(`automations: ${n} checks passed`);
