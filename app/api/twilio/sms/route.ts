import { e164, forwardText, EMPTY_TWIML } from "@/lib/missed-call";
import { readTwilioRequest, sendSms, twilioConfigured, twiml } from "@/lib/twilio";
import { sendAlert } from "@/lib/notify";
import { neon } from "@neondatabase/serverless";
import { after } from "next/server";
import { clientByNumber, clientInboundText } from "@/lib/client-runtime-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The reply runs after Twilio gets its answer (Twilio waits 15 seconds at most); a calendar lookup plus the reply engine can take longer.
export const maxDuration = 60;

/** POST /api/twilio/sms — Twilio "A message comes in" webhook. Forwards the text to the founder's cell + email. */
export async function POST(request: Request) {
  if (!twilioConfigured()) return twiml(EMPTY_TWIML);
  const p = await readTwilioRequest(request);
  if (!p) return new Response("Forbidden", { status: 403 });
  // A client's customer texting the client's Cinder number: the reply engine answers for the client.
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  const client = sql ? await clientByNumber(sql, p.To ?? "").catch(() => null) : null;
  if (client && sql) {
    const fromC = e164(p.From ?? "");
    // Photos the customer texted (MMS): Twilio sends MediaUrl0..N with their types; keep the images.
    const media = Array.from({ length: Math.min(10, Number(p.NumMedia) || 0) }, (_, i) => ({ url: p[`MediaUrl${i}`] ?? "", type: p[`MediaContentType${i}`] ?? "" }))
      .filter(m => /^https:\/\/api\.twilio\.com\//.test(m.url) && m.type.startsWith("image/"));
    if (fromC) after(() => clientInboundText(sql, client, fromC, p.Body ?? "", media).catch(e => console.error("Client text failed", e)));
    return twiml(EMPTY_TWIML);
  }
  const from = e164(p.From ?? "") || "unknown";
  const me = e164(process.env.CINDER_TEXT_TO ?? "");
  const body = p.Body ?? "";
  if (me && from !== me) {
    await Promise.all([
      sendSms(me, p.To ?? "", forwardText(from, body)),
      sendAlert({ subject: `New text from ${from}`, lines: [`From: ${from}`, body.slice(0, 1200) || "(no text)"] }),
    ]);
  }
  return twiml(EMPTY_TWIML);
}
export const GET = POST;
