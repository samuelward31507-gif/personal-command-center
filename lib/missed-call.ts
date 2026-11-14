// Missed-call text-back over Twilio (REST + TwiML, no SDK). Pure helpers live here so they can be tested
// without a network; the route handlers in app/api/twilio/* do the I/O.
//
// Flow: a call to the Twilio number → /api/twilio/voice rings CINDER_FORWARD_TO (if set) →
// /api/twilio/dial-status: if nobody picked up, the caller gets a text in seconds →
// any text back hits /api/twilio/sms and is forwarded to CINDER_TEXT_TO (the founder's cell) + an email alert.

import { createHmac, timingSafeEqual } from "node:crypto";

export const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"]);

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "+1 (205) 837-0211" / "2058370211" → "+12058370211". Anything that isn't a plausible number → "". */
export function e164(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const d = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(d)) return d;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "";
}

/** The first text a missed caller gets. Overridable with MISSED_CALL_TEXT ("{business}" is filled in). */
export function missedCallText(business: string, template?: string): string {
  const name = business.trim() || "us";
  const t = template?.trim() || "Hey, it's {business}. Sorry we missed your call! What can we help you with? Reply here and we'll get right back to you.";
  const body = t.replace(/\{business\}/g, name).trim();
  // First text to someone new: carriers want the opt-out line on it.
  const line = " Reply STOP to opt out.";
  return /\bSTOP\b/.test(body) ? body.slice(0, 320) : body.slice(0, 320 - line.length).replace(/\s+$/, "") + line;
}

/** TwiML for an incoming call: ring the forward number for `timeout` seconds, else go straight to the missed path. */
export function voiceTwiml(forwardTo: string, callerId: string, statusUrl: string, timeout = 20): string {
  if (!forwardTo) return `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${xml(statusUrl + (statusUrl.includes("?") ? "&" : "?") + "direct=1")}</Redirect></Response>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="${timeout}" callerId="${xml(callerId)}" action="${xml(statusUrl)}" method="POST"><Number>${xml(forwardTo)}</Number></Dial></Response>`;
}

/** TwiML after the dial: answered → hang up quietly; missed → tell the caller a text is coming. */
export function afterDialTwiml(missed: boolean, business: string): string {
  if (!missed) return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
  const name = business.trim() || "us";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Thanks for calling ${xml(name)}. Sorry we missed you. We just sent you a text, so reply there and we'll get right back to you.</Say><Hangup/></Response>`;
}

export const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/** Was the forwarded call missed? `direct` = there was no forward number, so every call counts as missed. */
export function wasMissed(dialStatus: unknown, direct: boolean): boolean {
  if (direct) return true;
  return typeof dialStatus === "string" && MISSED_STATUSES.has(dialStatus);
}

/** What the founder's cell gets when someone texts the business number back. */
export function forwardText(from: string, body: string): string {
  const clean = body.replace(/\s+/g, " ").trim().slice(0, 1200);
  return `Text from ${from}:\n${clean || "(no text)"}`;
}

/**
 * Twilio request signature: base64(HMAC-SHA1(authToken, url + each POST param name+value, sorted by name)).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join("");
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

export function validTwilioSignature(authToken: string, signature: string | null, urls: string[], params: Record<string, string>): boolean {
  if (!authToken || !signature) return false;
  const got = Buffer.from(signature);
  return urls.some(u => {
    const want = Buffer.from(twilioSignature(authToken, u, params));
    return want.length === got.length && timingSafeEqual(want, got);
  });
}

/**
 * Should a call to a client's Cinder number skip ringing the owner and go straight to the text-back?
 * Yes when the call was forwarded from their own number on no-answer/busy: their phone already rang, and ringing
 * the owner's cell again could forward right back here (a loop). Twilio sets ForwardedFrom when the carrier says so.
 */
export function skipRing(setup: Record<string, string>, params: Record<string, string>): boolean {
  const d = (v: string | undefined) => (v || "").replace(/\D/g, "").slice(-10);
  if (!d(setup.owner_cell)) return true;
  if (/forward/i.test(setup.forwarding || "")) return true;
  const fwd = d(params.ForwardedFrom);
  return fwd.length === 10;
}
