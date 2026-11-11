import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { emailFromIdToken, encryptToken, exchangeCode, gmailConfigured } from "@/lib/gmail";
import { readCalState } from "@/lib/client-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (req: Request, status: string) => new Response(null, { status: 302, headers: {
  Location: new URL(`/crm/email?gmail=${status}`, req.url).toString(),
  "Set-Cookie": "cinder_gmail_state=; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
} });

/** GET: Google sends the owner back here. Checks the state, stores the refresh token encrypted. */
export async function GET(req: Request) {
  // A client connecting their Google Calendar comes back through this same address (one redirect URI for the app).
  const calProject = readCalState(new URL(req.url).searchParams.get("state") ?? "");
  if (calProject) return calendarConnected(req, calProject);
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

const calPage = (title: string, text: string, status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f4;color:#121417;font:16px/1.55 Inter,system-ui,sans-serif;padding:24px}main{max-width:420px;background:#fff;border:1px solid rgba(18,20,23,.08);border-radius:16px;padding:28px;box-shadow:0 12px 32px -14px rgba(18,20,23,.16)}h1{font-size:22px;letter-spacing:-.02em;margin:0 0 8px}p{margin:0;color:#4a4f57}</style></head>
<body><main><h1>${title}</h1><p>${text}</p></main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

/** A client's owner allowed Cinder to read their busy times and add estimates to their calendar. */
async function calendarConnected(req: Request, projectId: string) {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return calPage("Calendar not connected", "No problem. If you change your mind, open the link again.");
  if (!gmailConfigured() || !process.env.DATABASE_URL) return calPage("Not set up yet", "Calendar connections aren't switched on yet. Let us know and we'll fix it.", 503);
  try {
    const t = await exchangeCode(url.searchParams.get("code") ?? "", url.origin);
    if (!t.refresh_token) return calPage("One more try", "Google didn't give us lasting access. Open the link again and choose Allow.");
    if (!(t.scope ?? "").includes("calendar.events")) return calPage("One more try", "Calendar access wasn't allowed. Open the link again and tick the calendar box.");
    const sql = neon(process.env.DATABASE_URL);
    const [p] = await sql`SELECT owner_id FROM public.projects WHERE id = ${projectId}::uuid` as { owner_id: string }[];
    if (!p) return calPage("Link expired", "This link isn't valid anymore. Ask for a new one.", 404);
    await sql`INSERT INTO public.client_calendars (project_id, owner_id, google_email, refresh_token_enc)
      VALUES (${projectId}::uuid, ${p.owner_id}, ${emailFromIdToken(t.id_token ?? "")}, ${encryptToken(t.refresh_token)})
      ON CONFLICT (project_id) DO UPDATE SET google_email = EXCLUDED.google_email, refresh_token_enc = EXCLUDED.refresh_token_enc, connected_at = now()`;
    return calPage("Calendar connected", "Done. New estimates will show up on your Google Calendar, at times you're free. You can close this page.");
  } catch (e) {
    console.error("Client calendar connect failed", e instanceof Error ? e.message : e);
    return calPage("Something went wrong", "We couldn't connect the calendar. Try the link again in a minute.", 500);
  }
}
