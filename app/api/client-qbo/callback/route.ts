import { neon } from "@neondatabase/serverless";
import { encryptToken } from "@/lib/gmail";
import { exchangeQboCode, qboCompanyName, qboConfigured, readQboState } from "@/lib/qbo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f4;color:#121417;font-family:Inter,system-ui,sans-serif}main{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:26px;letter-spacing:-.02em;margin:0 0 10px}p{color:#4a5059;line-height:1.55;margin:0}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(body)}</p></main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

/** GET: Intuit sends the owner back here after Connect, with the code and their company (realm) id. Stores the tokens encrypted. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = readQboState(url.searchParams.get("state") ?? "");
  if (!projectId) return page("This link expired", "Open Settings in the Cinder app and connect QuickBooks again.", 410);
  if (url.searchParams.get("error")) return page("Not connected", "QuickBooks wasn't connected. If that was a mistake, connect again from Settings.", 400);
  const realm = url.searchParams.get("realmId") ?? "";
  if (!/^\d{1,30}$/.test(realm)) return page("Couldn't connect", "QuickBooks didn't say which company. Connect again from Settings.", 400);
  if (!qboConfigured() || !process.env.DATABASE_URL) return page("Not switched on yet", "The QuickBooks connection isn't switched on yet. Nothing was changed.", 503);
  try {
    const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || url.origin;
    const t = await exchangeQboCode(url.searchParams.get("code") ?? "", origin);
    if (!t.refresh_token) return page("Couldn't connect", "QuickBooks didn't send a long-lived token. Connect again from Settings.", 400);
    const name = await qboCompanyName(t.access_token, realm);
    const sql = neon(process.env.DATABASE_URL);
    const [p] = await sql`SELECT owner_id FROM public.projects WHERE id = ${projectId}::uuid` as { owner_id: string }[];
    if (!p) return page("Couldn't connect", "That business wasn't found.", 404);
    const expires = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
    await sql`INSERT INTO public.client_qbo (project_id, owner_id, realm_id, company_name, refresh_token_enc, access_token_enc, access_expires_at)
      VALUES (${projectId}::uuid, ${p.owner_id}, ${realm}, ${name}, ${encryptToken(t.refresh_token)}, ${encryptToken(t.access_token)}, ${expires}::timestamptz)
      ON CONFLICT (project_id) DO UPDATE SET realm_id = EXCLUDED.realm_id, company_name = EXCLUDED.company_name, refresh_token_enc = EXCLUDED.refresh_token_enc,
        access_token_enc = EXCLUDED.access_token_enc, access_expires_at = EXCLUDED.access_expires_at, item_id = CASE WHEN client_qbo.realm_id = EXCLUDED.realm_id THEN client_qbo.item_id ELSE '' END,
        last_error = '', connected_at = now()`;
    return page("QuickBooks connected", `Every invoice you send and every payment you record in Cinder now lands in ${name ? name + "'s" : "your"} QuickBooks, on the right customer. You can close this page.`);
  } catch (e) {
    console.error("QuickBooks connect failed", e instanceof Error ? e.message : e);
    return page("Couldn't connect", "Something went wrong talking to QuickBooks. Try again in a minute.", 502);
  }
}
