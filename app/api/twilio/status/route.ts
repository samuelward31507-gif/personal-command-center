import { neon } from "@neondatabase/serverless";
import { readTwilioRequest, twilioConfigured } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["queued", "sending", "sent", "delivered", "undelivered", "failed"]);

/** POST /api/twilio/status — Twilio's status callback for texts Cinder sent: the inbox shows Delivered, or that it didn't get there. */
export async function POST(request: Request) {
  if (!twilioConfigured()) return new Response("Not configured", { status: 503 });
  const p = await readTwilioRequest(request);
  if (!p) return new Response("Forbidden", { status: 403 });
  const sid = String(p.MessageSid ?? p.SmsSid ?? ""), status = String(p.MessageStatus ?? p.SmsStatus ?? "").toLowerCase();
  if (!sid || !STATUSES.has(status) || !process.env.DATABASE_URL) return new Response(null, { status: 204 });
  try {
    // Statuses can arrive out of order; a final one is never overwritten by an earlier one.
    await neon(process.env.DATABASE_URL)`UPDATE public.client_texts SET status = ${status}, ok = CASE WHEN ${status} IN ('undelivered', 'failed') THEN false ELSE ok END
      WHERE sid = ${sid} AND status NOT IN ('delivered', 'undelivered', 'failed')`;
  } catch (e) { console.error("Status callback failed", e instanceof Error ? e.message : e); }
  return new Response(null, { status: 204 });
}
