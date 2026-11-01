// Website demo checks. Run with: node --experimental-strip-types test-demo.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDemo, demoPrompt, parseDemo, rateDecision, DEMO_LIMITS } from "./lib/demo.ts";
let n = 0; const ok = fn => { fn(); n++; };
ok(() => assert.equal(validateDemo({ request: "hi", website: "x" }), "spam"));
ok(() => assert.match(validateDemo({ request: "hi" }).error, /quote request/));
ok(() => assert.equal(validateDemo({ trade: "Pool", request: "Want a pool next spring" }).business, "Blue Ridge Pools"));
ok(() => assert.equal(validateDemo({ request: "Need a fence <script>", business: "<b>X</b>" }).business, "b X /b"));
ok(() => assert.equal(validateDemo({ request: "x".repeat(900) }).request.length, 400));
ok(() => assert.match(demoPrompt(validateDemo({ trade: "Pool", request: "pool please now" })).system, /pool builder/));
ok(() => assert.match(demoPrompt(validateDemo({ request: "fence please now" })).system, /never quote prices/));
ok(() => assert.deepEqual(parseDemo('```json\n{"reply":"Hi","followup":"Book at https://x.com","ownerAlert":"New"}\n```'), { reply: "Hi", followup: "Book at [booking link]", ownerAlert: "New" }));
ok(() => assert.equal(parseDemo("no json here"), null));
ok(() => assert.equal(parseDemo('{"followup":"x"}'), null));
ok(() => assert.equal(rateDecision(DEMO_LIMITS.perIpPerDay, 0).ok, false));
ok(() => assert.equal(rateDecision(0, DEMO_LIMITS.perDay).ok, false));
ok(() => assert.equal(rateDecision(1, 1).ok, true));
const api = readFileSync("app/api/demo-reply/route.ts", "utf8");
ok(() => assert.doesNotMatch(api, /twilio|INSERT INTO public\.contacts|sendAlert/i, "demo never texts, never creates leads"));
ok(() => assert.match(api, /createHash\("sha256"\)/, "only a hashed IP is stored"));
ok(() => assert.match(readFileSync("site/vercel.json", "utf8"), /\/api\/demo-reply/));
console.log(`Demo checks passed (${n} assertions).`);
{
  const { validateTestimonial, publishable } = await import("./lib/testimonial.ts");
  const a = (await import("node:assert/strict")).default;
  a.match(validateTestimonial({ quote: "short", name: "Rod" }).error, /sentence/);
  a.match(validateTestimonial({ quote: "Every lead gets a reply now.", name: "" }).error, /name/);
  a.equal(validateTestimonial({ quote: "Every lead gets a reply now.", name: "Rod", permission: "yes" }).permission, false, "permission must be an explicit true");
  a.equal(publishable({ status: "submitted", permission: false, quote: "x", name: "Rod", role: "", company: "" }), null, "never publish without permission");
  a.match(publishable({ status: "submitted", permission: true, quote: "Great", name: "Rod", role: "Owner", company: "Double R Fence" }), /Rod, Owner, Double R Fence/);
  console.log("Testimonial checks passed.");
}
