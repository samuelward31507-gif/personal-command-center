// Source-level regression guards for outreach outcome handling.
// Run with: node --experimental-strip-types test-outreach-outcomes.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("app/api/outreach/route.ts", "utf8");
const ui = readFileSync("app/crm/outreach/page.tsx", "utf8");

assert.match(api, /"not_a_fit", "wrong_contact"/, "API accepts not-a-fit and wrong-contact outcomes");
assert.match(api, /const callbackRequested = outcome === "callback_requested"/, "callback requests have dedicated scheduling behavior");
assert.match(api, /nextDate\.setDate\(nextDate\.getDate\(\) \+ 1\)/, "callback requests are rescheduled for tomorrow");
assert.match(api, /const shouldHoldStep = finalStep \|\| stopForResponse \|\| callbackRequested \|\| notAFit \|\| wrongContact/, "callbacks and terminal outcomes do not advance the cadence");
assert.match(api, /notAFit \? "completed"/, "not-a-fit closes the sequence without using suppression");
assert.match(api, /wrongContact \? "parked"/, "wrong-contact parks the sequence for correction");
assert.match(api, /outcome === "do_not_contact"/, "explicit do-not-contact remains a distinct suppression path");
assert.match(ui, /Not a fit — close without suppressing/, "UI distinguishes not-a-fit from opt-out");
assert.match(ui, /Wrong contact — park for correction/, "UI exposes wrong-contact correction");
assert.match(ui, /Callback requested — remind me tomorrow/, "UI explains callback reminder behavior");
assert.match(ui, /No call will be placed automatically/, "callback workflow remains founder-controlled");

console.log("Outreach outcome regression checks passed (11 assertions).");
