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
  // Carry the trial ?key= through to the follow-up webhook so it is accepted too.
  const key = new URL(request.url).searchParams.get("key");
  // Absolute URL: Twilio's trial webhooks are fetched through a proxy, so a relative link resolves to the wrong host.
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const base = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || `https://${host}`;
  const statusUrl = `${base}/api/twilio/dial-status` + (key ? `?key=${encodeURIComponent(key)}` : "");
  return twiml(voiceTwiml(forwardTo, p.To ?? "", statusUrl, timeout));
}
export const GET = POST;
