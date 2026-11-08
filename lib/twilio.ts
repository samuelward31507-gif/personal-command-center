// Twilio I/O for the missed-call text-back: verify webhook requests and send texts over the REST API.
import { validTwilioSignature } from "@/lib/missed-call";

export function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim());
}

/** The URLs Twilio may have signed (Vercel can rewrite host/proto, so try the public forms too). */
function candidateUrls(request: Request): string[] {
  const u = new URL(request.url);
  const path = u.pathname + u.search;
  const out = new Set<string>([request.url]);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) out.add(`https://${host}${path}`);
  const app = process.env.CINDER_APP_URL?.trim();
  if (app) out.add(app.replace(/\/$/, "") + path);
  return [...out];
}

/** Parse a Twilio webhook. Returns null when the signature doesn't check out. */
export async function readTwilioRequest(request: Request): Promise<Record<string, string> | null> {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const form = await request.formData().catch(() => null);
  if (!form) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  if (params.AccountSid !== process.env.TWILIO_ACCOUNT_SID?.trim()) return null;
  return validTwilioSignature(token, request.headers.get("x-twilio-signature"), candidateUrls(request), params) ? params : null;
}

/** Send one SMS. Returns false (and logs) instead of throwing. */
export async function sendSms(to: string, from: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token || !to || !from) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      console.error("Twilio SMS failed", { status: res.status, code: p?.code, message: typeof p?.message === "string" ? p.message.slice(0, 200) : undefined });
    }
    return res.ok;
  } catch (e) {
    console.error("Twilio SMS failed", { name: e instanceof Error ? e.name : typeof e });
    return false;
  }
}

export const twiml = (body: string) => new Response(body, { headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" } });
