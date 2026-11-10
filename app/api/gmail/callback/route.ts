import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { emailFromIdToken, encryptToken, exchangeCode, gmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (req: Request, status: string) => new Response(null, { status: 302, headers: {
  Location: new URL(`/crm/email?gmail=${status}`, req.url).toString(),
  "Set-Cookie": "cinder_gmail_state=; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
} });

/** GET: Google sends the owner back here. Checks the state, stores the refresh token encrypted. */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  const ownerId = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!ownerId) return back(req, "signin");
  if (!gmailConfigured() || !process.env.DATABASE_URL) return back(req, "not-configured");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(req, "denied");
  const state = url.searchParams.get("state") ?? "", code = url.searchParams.get("code") ?? "";
  const cookie = (req.headers.get("cookie") ?? "").split(/;\s*/).find(c => c.startsWith("cinder_gmail_state="))?.slice("cinder_gmail_state=".length) ?? "";
  if (!state || !cookie || state.length !== cookie.length || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) return back(req, "expired");
  try {
    const t = await exchangeCode(code, url.origin);
    if (!t.refresh_token) return back(req, "no-refresh");
    if (!(t.scope ?? "").includes("gmail.send") || !(t.scope ?? "").includes("gmail.metadata")) return back(req, "no-scope");
    const email = emailFromIdToken(t.id_token ?? "");
    if (!email) return back(req, "error");
    const sql = neon(process.env.DATABASE_URL);
    // One row per inbox. Reconnecting an inbox keeps its warm-up start; the first inbox is the main one.
    await sql`INSERT INTO public.gmail_accounts (owner_id, email, refresh_token_enc, is_main, ramp)
      VALUES (${ownerId}, ${email}, ${encryptToken(t.refresh_token)}, NOT EXISTS (SELECT 1 FROM public.gmail_accounts WHERE owner_id = ${ownerId}), true)
      ON CONFLICT (owner_id, lower(email)) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc, updated_at = now()`;
    return back(req, "connected");
  } catch (e) {
    console.error("Gmail connect failed", e instanceof Error ? e.message : e);
    return back(req, "error");
  }
}
