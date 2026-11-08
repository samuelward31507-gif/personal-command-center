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
  const isGet = request.method === "GET";
  const form = isGet ? null : await request.formData().catch(() => null);
  console.log("Twilio webhook", { method: request.method, path: new URL(request.url).pathname, hasForm: !!form, configured: twilioConfigured() });
  if (!isGet && !form) return null;
  const params: Record<string, string> = {};
  // GET webhooks carry everything in the query string, which is already part of the signed URL.
  if (isGet) for (const [k, v] of new URL(request.url).searchParams) params[k] = v;
  else for (const [k, v] of form!.entries()) if (typeof v === "string") params[k] = v;
  const signed = isGet ? {} : params;
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  if (params.AccountSid !== sid) {
    console.error("Twilio webhook rejected: AccountSid mismatch", { got: (params.AccountSid || "").slice(0, 6), want: sid.slice(0, 6), sidLen: sid.length });
    return null;
  }
  const urls = candidateUrls(request);
  const sig = request.headers.get("x-twilio-signature");
  if (!validTwilioSignature(token, sig, urls, signed)) {
    console.error("Twilio webhook rejected: bad signature", { hasSig: !!sig, tokenLen: token.length, urls });
    return null;
  }
  return params;
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
