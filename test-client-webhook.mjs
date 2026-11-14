// Webhook checks: only public https URLs, signed bodies, never throws.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { safeHookUrl, signBody, emitEvent } from "./lib/client-webhook.ts";
let n = 0; const ok = fn => { fn(); n++; };
ok(() => assert.equal(safeHookUrl("https://n8n.example.com/webhook/abc"), "https://n8n.example.com/webhook/abc"));
for (const bad of ["http://n8n.example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://user:pw@n8n.example.com/x", "https://box.local/x", "https://[::1]/x", "", "nonsense"])
  ok(() => assert.equal(safeHookUrl(bad), null, bad));
ok(() => assert.equal(signBody("{}", "s3cret"), "sha256=" + createHmac("sha256", "s3cret").update("{}").digest("hex")));
ok(async () => assert.equal(await emitEvent({}, "p", "lead.new", {}), false));
ok(async () => assert.equal(await emitEvent({ webhook_url: "http://insecure.example.com" }, "p", "lead.new", {}), false));
console.log(`Webhook checks passed (${n} assertions).`);
