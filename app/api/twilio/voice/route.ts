import { e164, voiceTwiml, afterDialTwiml, missedCallText, EMPTY_TWIML } from "@/lib/missed-call";
import { readTwilioRequest, sendSms, twilioConfigured, twiml } from "@/lib/twilio";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/twilio/voice — Twilio "A call comes in" webhook. Rings CINDER_FORWARD_TO, then hands off to dial-status. */
export async function POST(request: Request) {
  if (!twilioConfigured()) return twiml(EMPTY_TWIML);
  const p = await readTwilioRequest(request);
  if (!p) return new Response("Forbidden", { status: 403 });
  const forwardTo = e164(process.env.CINDER_FORWARD_TO ?? "");
  const business = process.env.CINDER_BUSINESS_NAME?.trim() || "Cinder Revenue Company";
  if (!forwardTo) {
    // Nobody to ring: every call is a missed call. Text back right here, no second webhook hop.
    const caller = e164(p.From ?? "");
    if (caller) {
      const [sent] = await Promise.all([
        sendSms(caller, p.To ?? "", missedCallText(business, process.env.MISSED_CALL_TEXT)),
        sendAlert({ subject: `Missed call from ${caller}`, lines: [`Missed call from ${caller} to ${p.To ?? "your Twilio number"}.`, "They were texted back automatically."] }),
      ]);
      if (!sent) console.error("Missed-call text not sent", { callSid: p.CallSid });
    }
    return twiml(afterDialTwiml(true, business));
  }
  const timeout = Math.min(40, Math.max(10, Number(process.env.CINDER_RING_SECONDS) || 20));
  // Carry the trial ?key= through to the follow-up webhook so it is accepted too.
  const key = new URL(request.url).searchParams.get("key");
  // Absolute URL: Twilio's trial webhooks are fetched through a proxy, so a relative link resolves to the wrong host.
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const base = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || `https://${host}`;
  const statusUrl = `${base}/api/twilio/dial-status` + (key ? `?key=${encodeURIComponent(key)}` : "");
  return twiml(voiceTwiml(forwardTo, p.To ?? "", statusUrl, timeout));
}
export const GET = POST;
