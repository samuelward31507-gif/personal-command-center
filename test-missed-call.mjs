// Regression tests for the missed-call text-back. Run with: node --experimental-strip-types --no-warnings test-missed-call.mjs
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { e164, missedCallText, voiceTwiml, afterDialTwiml, wasMissed, forwardText, twilioSignature, validTwilioSignature } from "./lib/missed-call.ts";

let n = 0;
const ok = fn => { fn(); n++; };

ok(() => assert.equal(e164("(205) 837-0211"), "+12058370211"));
ok(() => assert.equal(e164("12058370211"), "+12058370211"));
ok(() => assert.equal(e164("+447911123456"), "+447911123456"));
ok(() => assert.equal(e164("anonymous"), ""));
ok(() => assert.equal(e164(undefined), ""));

ok(() => assert.match(missedCallText("Scooter World"), /^Hey, it's Scooter World\. Sorry we missed your call!/));
ok(() => assert.equal(missedCallText("Acme", "Hi from {business}!"), "Hi from Acme!"));
ok(() => assert.ok(missedCallText("X", "a".repeat(999)).length <= 320));

const v = voiceTwiml("+12058370211", "+13035550100", "/api/twilio/dial-status", 20);
ok(() => assert.match(v, /<Dial timeout="20" callerId="\+13035550100" action="\/api\/twilio\/dial-status" method="POST"><Number>\+12058370211<\/Number><\/Dial>/));
ok(() => assert.match(voiceTwiml("", "+1303", "/api/twilio/dial-status"), /<Redirect method="POST">\/api\/twilio\/dial-status\?direct=1<\/Redirect>/, "no forward number → every call is missed"));
ok(() => assert.match(afterDialTwiml(true, "Bob & Sons"), /Bob &amp; Sons/, "TwiML is escaped"));
ok(() => assert.match(afterDialTwiml(false, "x"), /<Hangup\/>/));
ok(() => assert.doesNotMatch(afterDialTwiml(false, "x"), /<Say/, "answered calls get no message"));

ok(() => assert.equal(wasMissed("no-answer", false), true));
ok(() => assert.equal(wasMissed("busy", false), true));
ok(() => assert.equal(wasMissed("completed", false), false));
ok(() => assert.equal(wasMissed(undefined, true), true));
ok(() => assert.equal(wasMissed(undefined, false), false));

ok(() => assert.equal(forwardText("+13035550100", "  how much\n for a fence? "), "Text from +13035550100:\nhow much for a fence?"));

// Twilio's documented signature algorithm.
const url = "https://example.com/api/twilio/sms";
const params = { From: "+13035550100", Body: "hi", AccountSid: "AC1" };
const want = createHmac("sha1", "tok").update(url + "AccountSidAC1Bodyhi" + "From+13035550100").digest("base64");
ok(() => assert.equal(twilioSignature("tok", url, params), want));
ok(() => assert.equal(validTwilioSignature("tok", want, ["https://wrong.test/x", url], params), true));
ok(() => assert.equal(validTwilioSignature("tok", want, ["https://wrong.test/x"], params), false));
ok(() => assert.equal(validTwilioSignature("tok", null, [url], params), false));
ok(() => assert.equal(validTwilioSignature("", want, [url], params), false));
ok(() => assert.equal(validTwilioSignature("tok", want, [url], { ...params, Body: "tampered" }), false));

for (const f of ["voice", "dial-status", "sms"]) {
  const src = readFileSync(`app/api/twilio/${f}/route.ts`, "utf8");
  ok(() => assert.match(src, /readTwilioRequest\(request\)/, `${f} verifies the Twilio signature`));
  ok(() => assert.match(src, /status: 403/, `${f} rejects unsigned requests`));
}
const sms = readFileSync("app/api/twilio/sms/route.ts", "utf8");
ok(() => assert.match(sms, /from !== me/, "the founder's own texts are not forwarded back to them"));

ok(() => assert.match(voiceTwiml("", "+1303", "/api/twilio/dial-status?key=abc"), /dial-status\?key=abc&amp;direct=1/, "key survives the no-forward redirect"));
const tw = readFileSync("lib/twilio.ts", "utf8");
ok(() => assert.match(tw, /if \(!sig && webhookKeyOk/, "unsigned requests need the secret key"));
ok(() => assert.match(tw, /want.length < 16/, "the key fallback is off unless a long key is set"));
console.log(`missed-call: ${n} assertions passed`);
