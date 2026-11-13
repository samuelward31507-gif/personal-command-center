import { neon } from "@neondatabase/serverless";
import { encryptToken } from "@/lib/gmail";
import { exchangeJobberCode, jobberAccountName, jobberConfigured, readJobberState } from "@/lib/jobber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f4;color:#121417;font-family:Inter,system-ui,sans-serif}main{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:26px;letter-spacing:-.02em;margin:0 0 10px}p{color:#4a5059;line-height:1.55;margin:0}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

/** GET: Jobber sends the owner back here after they press Allow. Stores the tokens encrypted. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = readJobberState(url.searchParams.get("state") ?? "");
  if (!projectId) return page("This link expired", "Ask for a new connect link and try again.", 410);
  if (url.searchParams.get("error")) return page("Not connected", "Jobber wasn't connected. If that was a mistake, open the link again and press Allow.", 400);
  if (!jobberConfigured() || !process.env.DATABASE_URL) return page("Not switched on yet", "The Jobber connection isn't switched on yet. Nothing was changed.", 503);
  try {
    const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || url.origin;
    const t = await exchangeJobberCode(url.searchParams.get("code") ?? "", origin);
    if (!t.refresh_token) return page("Couldn't connect", "Jobber didn't send a long-lived token. Open the link again and press Allow.", 400);
    const name = await jobberAccountName(t.access_token).catch(() => "");
    const sql = neon(process.env.DATABASE_URL);
    const [p] = await sql`SELECT owner_id FROM public.projects WHERE id = ${projectId}::uuid` as { owner_id: string }[];
    if (!p) return page("Couldn't connect", "That client wasn't found.", 404);
    const expires = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
    await sql`INSERT INTO public.client_jobber (project_id, owner_id, account_name, refresh_token_enc, access_token_enc, access_expires_at)
      VALUES (${projectId}::uuid, ${p.owner_id}, ${name}, ${encryptToken(t.refresh_token)}, ${encryptToken(t.access_token)}, ${expires}::timestamptz)
      ON CONFLICT (project_id) DO UPDATE SET account_name = EXCLUDED.account_name, refresh_token_enc = EXCLUDED.refresh_token_enc,
        access_token_enc = EXCLUDED.access_token_enc, access_expires_at = EXCLUDED.access_expires_at, last_error = '', connected_at = now()`;
    return page("Jobber connected", `Every estimate Cinder books will now show up in ${name ? name + "’s " : "your "}Jobber as a request, on the customer’s record. You can close this page.`);
  } catch (e) {
    console.error("Jobber connect failed", e instanceof Error ? e.message : e);
    return page("Couldn't connect", "Something went wrong talking to Jobber. Open the link again in a minute.", 502);
  }
}
