import { randomBytes } from "node:crypto";
import { getAllowedSession } from "@/lib/auth/server";
import { authUrl, gmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: send the signed-in owner to Google to allow sending from their inbox (gmail.send only). */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  if (!r?.data?.session || !r?.data?.user?.id) return Response.redirect(new URL("/crm/email?gmail=signin", req.url), 302);
  if (!gmailConfigured()) return Response.redirect(new URL("/crm/email?gmail=not-configured", req.url), 302);
  const state = randomBytes(24).toString("base64url");
  const origin = new URL(req.url).origin;
  return new Response(null, { status: 302, headers: {
    Location: authUrl(origin, state),
    "Set-Cookie": `cinder_gmail_state=${state}; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  } });
}
