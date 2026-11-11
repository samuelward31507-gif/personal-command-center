import assert from "node:assert/strict";
import { parseLead, flatten, sourceOf } from "./lib/lead-sources.ts";
import { isStop, isPlainOptOut, isHelp, isStopKeyword } from "./lib/client-runtime.ts";
// Angi / HomeAdvisor lead delivery
const angi = parseLead({ firstName: "Dana", lastName: "Ruiz", phonePrimary: "(720) 555-0148", email: "d@x.com", address: "12 Elm St", city: "Littleton", state: "CO", postalCode: "80120", taskName: "Install a Wood Fence", comments: "About 80 ft, side yard", timeframe: "Within 1 week" }, "angi");
assert.equal(angi.phone, "+17205550148"); assert.equal(angi.name, "Dana Ruiz"); assert.equal(angi.source, "angi"); assert.equal(angi.via, "Angi");
assert.match(angi.message, /Install a Wood Fence · About 80 ft, side yard · Address: 12 Elm St, Littleton, CO, 80120 · Timing: Within 1 week/);
// Thumbtack-style nested payload
const tt = parseLead({ request: { title: "Fence installation", description: "Cedar, 140 ft" }, customer: { name: "Tom Becker", phone: "+1 303 555 0177" } }, "thumbtack");
assert.equal(tt.phone, "+13035550177"); assert.equal(tt.name, "Tom Becker"); assert.match(tt.message, /Fence installation · Cedar, 140 ft/);
// Facebook Lead Ads (field_data) without a hint, source in payload
const fb = parseLead({ platform: "fb", field_data: [{ name: "full_name", values: ["Priya Shah"] }, { name: "phone_number", values: ["+17205550163"] }, { name: "what_service_do_you_need?", values: ["Vinyl fence"] }] });
assert.equal(fb.source, "facebook"); assert.equal(fb.name, "Priya Shah"); assert.equal(fb.message, "Vinyl fence");
// Zapier flat, no phone → null
assert.equal(parseLead({ name: "No Phone", email: "a@b.c" }, "zapier"), null);
assert.equal(sourceOf("HomeAdvisor"), "angi"); assert.equal(sourceOf(""), "web form");
assert.equal(flatten({ a: { b: "1" } }).ab, "1");
// Opt-outs
for (const t of ["STOP", "stop.", "Unsubscribe", "please stop texting me", "Don't text me again", "remove me from your list", "wrong number", "take me off this", "No more texts please", "opt out"]) assert.ok(isStop(t), t);
for (const t of ["Can you stop by Thursday?", "Don't stop, I'm interested", "When will the crew stop for lunch", "Cancel my Thursday appointment please", "yes"]) assert.ok(!isStop(t), t);
assert.ok(isStopKeyword("cancel")); assert.ok(!isPlainOptOut("STOP")); assert.ok(isHelp("help")); assert.ok(!isHelp("can you help me with a fence"));
console.log("lead sources + opt-outs ok");
