import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
const { verifyMetaSignature, parseMetaWebhook } = await import("./lib/meta-inbox.ts");
let n = 0; const ok = f => { f(); n++; };
const raw = JSON.stringify({ object: "instagram", entry: [{ messaging: [
  { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 1794170000000, message: { mid: "m1", text: "how much for a fence quote?" } },
  { sender: { id: "999" }, recipient: { id: "111" }, timestamp: 1794170001000, message: { mid: "m2", text: "hey!", is_echo: true } },
  { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 1794170002000, read: { mid: "m1" } },
  { sender: { id: "222" }, recipient: { id: "999" }, timestamp: 1794170003000, message: { mid: "m3", attachments: [{ type: "image" }] } },
] }] });
const sig = "sha256=" + createHmac("sha256", "s3cret").update(raw).digest("hex");
ok(() => assert.equal(verifyMetaSignature(raw, sig, "s3cret"), true));
ok(() => assert.equal(verifyMetaSignature(raw + " ", sig, "s3cret"), false, "tampered body"));
ok(() => assert.equal(verifyMetaSignature(raw, sig, ""), false, "no secret configured: reject"));
ok(() => assert.equal(verifyMetaSignature(raw, null, "s3cret"), false));
const msgs = parseMetaWebhook(JSON.parse(raw));
ok(() => assert.equal(msgs.length, 2, "skips our own echo and the read receipt"));
ok(() => assert.equal(msgs[0].channel, "instagram"));
ok(() => assert.equal(msgs[0].text, "how much for a fence quote?"));
ok(() => assert.equal(msgs[1].text, "[image]"));
ok(() => assert.equal(parseMetaWebhook({ object: "page", entry: [{ messaging: [{ sender: { id: "1" }, message: { mid: "x", text: "hi" } }] }] })[0].channel, "facebook"));
ok(() => assert.deepEqual(parseMetaWebhook({ object: "user" }), []));
console.log(`Meta inbox checks passed (${n} assertions).`);
