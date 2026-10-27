import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validCalAiDate, verifyCalAiSignature } from "./lib/cal-ai-webhook.ts";

const secret = "test-only-secret";
const body = JSON.stringify({
  triggerEvent: "BOOKING_CREATED",
  uid: "booking-test-123",
  startTime: "2026-10-28T16:00:00.000Z",
  endTime: "2026-10-28T16:30:00.000Z",
});
const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

assert.equal(verifyCalAiSignature(body, signature, secret), true, "valid raw HMAC is accepted");
assert.equal(verifyCalAiSignature(body, "sha256=" + signature, secret), true, "sha256-prefixed HMAC is accepted");
assert.equal(verifyCalAiSignature(body + " ", signature, secret), false, "signature rejects a modified body");
assert.equal(verifyCalAiSignature(body, signature, "wrong-secret"), false, "signature rejects a wrong secret");
assert.equal(verifyCalAiSignature(body, "not-a-signature", secret), false, "signature rejects malformed input");
assert.equal(verifyCalAiSignature(body, "a".repeat(64), secret), false, "signature rejects a mismatched digest");
assert.equal(validCalAiDate("2026-10-28T16:00:00.000Z"), true, "valid ISO timestamps are accepted");
assert.equal(validCalAiDate("not-a-date"), false, "invalid timestamps are rejected");
assert.equal(validCalAiDate(""), false, "empty timestamps are rejected");

console.log("Cal.ai webhook validation tests passed (9 assertions).");
