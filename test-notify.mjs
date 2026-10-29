// Regression tests for founder alert emails. Run with: node --experimental-strip-types test-notify.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderAlert } from "./lib/notify.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const r = renderAlert({ subject: "x", lines: ["Dana <script> from Peak", "Phone: 555"], link: { label: "Open", path: "/crm?contact=1" } }, "https://app.test/");
ok(() => assert.match(r.text, /https:\/\/app\.test\/crm\?contact=1/));
ok(() => assert.doesNotMatch(r.html, /<script>/, "alert HTML is escaped"));
ok(() => assert.match(r.html, /&lt;script&gt;/));
const notify = readFileSync("lib/notify.ts", "utf8");
ok(() => assert.match(notify, /to: \[to\]/, "only ever sent to the founder's configured address"));
ok(() => assert.match(notify, /CINDER_ALERT_EMAIL/));
ok(() => assert.match(notify, /catch \(e\)/, "an alert failure never throws"));
for (const f of ["app/api/inbound-lead/route.ts", "app/api/webhooks/cal-ai/route.ts", "app/api/sign/route.ts"]) {
  const src = readFileSync(f, "utf8");
  ok(() => assert.match(src, /sendAlert\(/, f + " alerts the founder"));
  ok(() => assert.doesNotMatch(src, /to:\s*\[?\s*(lead|person|v\.ok)\b/, f + " never emails the prospect"));
}
console.log(`Alert email regression checks passed (${n} assertions).`);
