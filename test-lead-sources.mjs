import assert from "node:assert/strict";
import { parseLead, flatten, sourceOf } from "./lib/lead-sources.ts";
import { isStop, isPlainOptOut, isHelp, isStopKeyword } from "./lib/client-runtime.ts";
// Angi / HomeAdvisor lead delivery
const angi = parseLead({ firstName: "Dana", lastName: "Ruiz", phonePrimary: "(720) 555-0148", email: "d@x.com", address: "12 Elm St", city: "Littleton", state: "CO", postalCode: "80120", taskName: "Install a Wood Fence", comments: "About 80 ft, side yard", timeframe: "Within 1 week" }, "angi");
assert.equal(angi.phone, "+17205550148"); assert.equal(angi.name, "Dana Ruiz"); assert.equal(angi.source, "angi"); assert.equal(angi.via, "Angi");
assert.match(angi.message, /Install a Wood Fence. About 80 ft, side yard. Address: 12 Elm St, Littleton, CO, 80120. Timing: Within 1 week/);
// Thumbtack-style nested payload
const tt = parseLead({ request: { title: "Fence installation", description: "Cedar, 140 ft" }, customer: { name: "Tom Becker", phone: "+1 303 555 0177" } }, "thumbtack");
assert.equal(tt.phone, "+13035550177"); assert.equal(tt.name, "Tom Becker"); assert.match(tt.message, /Fence installation. Cedar, 140 ft/);
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
import { skipRing } from "./lib/missed-call.ts";
assert.equal(skipRing({ owner_cell: "+17205550100" }, {}), false, "direct call to the Cinder number rings the owner");
assert.equal(skipRing({ owner_cell: "+17205550100" }, { ForwardedFrom: "+17205550100" }), true, "forwarded: no loop");
assert.equal(skipRing({ owner_cell: "+17205550100", forwarding: "Their number forwards missed calls here" }, {}), true);
assert.equal(skipRing({}, {}), true);
console.log("forwarding ok");
// Google Ads lead forms: user_column_data, the column IDs Google uses, and the source from the URL.
const gads = parseLead({ lead_id: "L1", api_version: "1.0", form_id: 4, google_key: "k", is_test: true, user_column_data: [
  { column_name: "Full Name", string_value: "Rosa Diaz", column_id: "FULL_NAME" }, { column_name: "User Phone", string_value: "+1 720-555-0133", column_id: "PHONE_NUMBER" },
  { column_name: "User Email", string_value: "rosa@example.com", column_id: "EMAIL" }, { column_name: "Postal Code", string_value: "80211", column_id: "POSTAL_CODE" },
  { column_name: "What do you need?", string_value: "New cedar fence", column_id: "SERVICE" }] }, "google ads");
assert.equal(gads.phone, "+17205550133"); assert.equal(gads.name, "Rosa Diaz"); assert.equal(gads.email, "rosa@example.com"); assert.equal(gads.source, "google ads"); assert.equal(gads.via, "Google");
assert.match(gads.message, /New cedar fence/); assert.match(gads.message, /80211/);
assert.equal(sourceOf("google_ads"), "google ads"); assert.equal(sourceOf("Google Ads"), "google ads"); assert.equal(sourceOf("facebook"), "facebook");
const gfirst = parseLead({ user_column_data: [{ column_id: "FIRST_NAME", string_value: "Al" }, { column_id: "LAST_NAME", string_value: "Bo" }, { column_id: "PHONE_NUMBER", string_value: "7205550111" }] }, "google ads");
assert.equal(gfirst.name, "Al Bo");
console.log("google ads lead forms ok");
