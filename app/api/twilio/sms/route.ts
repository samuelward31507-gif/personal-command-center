import { e164, forwardText, EMPTY_TWIML } from "@/lib/missed-call";
import { readTwilioRequest, sendSms, twilioConfigured, twiml } from "@/lib/twilio";
import { sendAlert } from "@/lib/notify";
import { neon } from "@neondatabase/serverless";
import { clientByNumber, clientInboundText } from "@/lib/client-runtime-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (fromC) await clientInboundText(sql, client, fromC, p.Body ?? "").catch(e => console.error("Client text failed", e));
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
