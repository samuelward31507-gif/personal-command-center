import { e164, voiceTwiml, EMPTY_TWIML } from "@/lib/missed-call";
import { readTwilioRequest, twilioConfigured, twiml } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/twilio/voice — Twilio "A call comes in" webhook. Rings CINDER_FORWARD_TO, then hands off to dial-status. */
export async function POST(request: Request) {
  if (!twilioConfigured()) return twiml(EMPTY_TWIML);
  const p = await readTwilioRequest(request);
  if (!p) return new Response("Forbidden", { status: 403 });
  const forwardTo = e164(process.env.CINDER_FORWARD_TO ?? "");
  const timeout = Math.min(40, Math.max(10, Number(process.env.CINDER_RING_SECONDS) || 20));
  return twiml(voiceTwiml(forwardTo, p.To ?? "", "/api/twilio/dial-status", timeout));
}
