import { e164, wasMissed, missedCallText, afterDialTwiml } from "@/lib/missed-call";
import { readTwilioRequest, sendSms, twilioConfigured, twiml } from "@/lib/twilio";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/twilio/dial-status — after the ring. Missed → text the caller within seconds and alert the founder. */
export async function POST(request: Request) {
  if (!twilioConfigured()) return new Response("Not configured", { status: 503 });
  const p = await readTwilioRequest(request);
  if (!p) return new Response("Forbidden", { status: 403 });
  const business = process.env.CINDER_BUSINESS_NAME?.trim() || "Cinder Revenue Company";
  const direct = new URL(request.url).searchParams.get("direct") === "1";
  const missed = wasMissed(p.DialCallStatus, direct);
  const caller = e164(p.From ?? "");
  if (missed && caller) {
    const [sent] = await Promise.all([
      sendSms(caller, p.To ?? "", missedCallText(business, process.env.MISSED_CALL_TEXT)),
      sendAlert({ subject: `Missed call from ${caller}`, lines: [`Missed call from ${caller} to ${p.To ?? "your Twilio number"}.`, "They were texted back automatically. Their reply will be forwarded to your phone."] }),
    ]);
    if (!sent) console.error("Missed-call text not sent", { callSid: p.CallSid });
  }
  return twiml(afterDialTwiml(missed, business));
}
export const GET = POST;
