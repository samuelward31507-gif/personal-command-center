import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { unwrapCalAiPayload, validCalAiDate, verifyCalAiSignature } from "./lib/cal-ai-webhook.ts";

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

const nested = unwrapCalAiPayload({
  triggerEvent: "BOOKING_RESCHEDULED",
  createdAt: "2026-10-27T12:00:00.000Z",
  payload: {
    uid: "booking-new",
    rescheduleUid: "booking-old",
    startTime: "2026-10-29T16:00:00.000Z",
    endTime: "2026-10-29T16:30:00.000Z",
    attendees: [{ email: "prospect@example.com" }],
  },
});
assert.equal(nested?.triggerEvent, "BOOKING_RESCHEDULED", "nested webhook keeps the envelope trigger");
assert.equal(nested?.uid, "booking-new", "nested webhook unwraps booking UID");
assert.equal(nested?.rescheduleUid, "booking-old", "nested webhook keeps the original UID for rescheduling");
assert.equal((nested?.attendees as Array<{ email: string }>)[0].email, "prospect@example.com", "nested webhook unwraps attendee data");

const flat = unwrapCalAiPayload({
  triggerEvent: "MEETING_ENDED",
  uid: "booking-flat",
  startTime: "2026-10-28T16:00:00.000Z",
});
assert.equal(flat?.triggerEvent, "MEETING_ENDED", "flat meeting-ended payload remains supported");
assert.equal(flat?.uid, "booking-flat", "flat payload fields remain intact");
assert.equal(unwrapCalAiPayload(null), null, "null payload is rejected");
assert.equal(unwrapCalAiPayload([]), null, "array payload is rejected");

console.log("Cal.ai webhook validation tests passed (17 assertions).");
