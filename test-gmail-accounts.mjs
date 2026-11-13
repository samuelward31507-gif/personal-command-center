// Inbox rotation: caps, warm-up, who sent what, which inbox goes next.
import assert from "node:assert/strict";
import { inboxCap, senderOf, countSends, pickInbox, mainOf, PER_INBOX_CAP } from "./lib/gmail-accounts.ts";
let n = 0; const ok = f => { f(); n++; };
const NOW = Date.parse("2026-11-20T12:00:00Z"), D = 86400000;
const main = { email: "sam@cinder.com", refresh_token_enc: "x", connected_at: "2026-11-01T00:00:00Z", ramp: false, is_main: true };
const a = { email: "sam@trycinder.com", refresh_token_enc: "x", connected_at: new Date(NOW - 2 * D).toISOString(), ramp: true, is_main: false };
const b = { email: "sam@getcinder.com", refresh_token_enc: "x", connected_at: new Date(NOW - 22 * D).toISOString(), ramp: true, is_main: false };
ok(() => assert.equal(inboxCap(main, NOW), PER_INBOX_CAP));
ok(() => assert.equal(inboxCap(a, NOW), 10, "week 1 of warm-up"));
ok(() => assert.equal(inboxCap(b, NOW), 40, "warmed up after 3 weeks"));
ok(() => assert.equal(senderOf("Email sent: intro via Gmail\nSubject: x\nThread: t\nFrom: Sam@TryCinder.com"), "sam@trycinder.com"));
ok(() => assert.equal(senderOf("Email sent: intro via Gmail\nSubject: x"), null));
const sent = countSends(["Email sent: intro via Gmail", "Email sent: intro via Gmail\nFrom: sam@trycinder.com"], [main, a, b]);
ok(() => assert.equal(sent.get("sam@cinder.com"), 1, "old logs belong to the main inbox"));
ok(() => assert.equal(sent.get("sam@trycinder.com"), 1));
ok(() => assert.equal(pickInbox([main, a, b], sent, NOW).email, "sam@getcinder.com", "most room left"));
ok(() => assert.equal(pickInbox([main, { ...b, is_main: false }], new Map([["sam@cinder.com", 0], ["sam@getcinder.com", 0]]), NOW).email, "sam@getcinder.com", "tie spares the main inbox"));
ok(() => assert.equal(pickInbox([main, a], new Map([["sam@cinder.com", 40], ["sam@trycinder.com", 10]]), NOW), null, "everyone at cap"));
ok(() => assert.equal(mainOf([a, main]).email, "sam@cinder.com"));
console.log(`Inbox rotation checks passed (${n} assertions).`);

{
  const { resting, BOUNCE_LIMIT } = await import("./lib/gmail-accounts.ts");
  const assert = (await import("node:assert/strict")).default;
  assert.equal(resting(undefined), false);
  assert.equal(resting({ sent: 10, bounced: 5 }), false, "too few sends to judge");
  assert.equal(resting({ sent: 100, bounced: 2 }), false);
  assert.equal(resting({ sent: 100, bounced: 3 }), true);
  assert.equal(BOUNCE_LIMIT, 0.03);
  assert.equal(resting({ sent: 126, bounced: 6, cleanSince: 47 }), false, "40+ clean sends after the last bounce lift the rest");
  assert.equal(resting({ sent: 126, bounced: 6, cleanSince: 12 }), true, "still resting until the list proves clean");
  const { tally } = await import("./lib/gmail-accounts.ts");
  const t = tally([{ notes: "Email sent: intro via Gmail", sent_by: null }, { notes: "Email bounced: x", sent_by: "Email sent: intro via Gmail" }, { notes: "Email sent: intro via Gmail", sent_by: null }], "a@x.com", [{ email: "a@x.com" }]).get("a@x.com");
  assert.deepEqual(t, { sent: 2, bounced: 1, cleanSince: 1 }, "a bounce resets the clean run");
  console.log("Sending health checks passed (5 assertions).");
}
