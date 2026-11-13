import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { jobberAuthUrl, jobberConfigured, jobberState, readJobberState } from "@/lib/jobber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?state= : the link a client's owner opens to connect Jobber. Sends them to Jobber's Allow screen. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  if (!readJobberState(state)) return new Response("This link expired. Ask for a new one.", { status: 410 });
  if (!jobberConfigured()) return new Response("The Jobber connection isn't switched on yet.", { status: 503 });
  const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || url.origin;
  return Response.redirect(jobberAuthUrl(origin, state), 302);
}

/** POST { projectId }: a fresh 7-day link to send the client's owner, plus the connection's status. */
export async function POST(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { projectId?: string };
  if (!b.projectId || !/^[0-9a-f-]{36}$/i.test(b.projectId)) return Response.json({ error: "Which client?" }, { status: 400 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  const [p] = await sql`SELECT 1 FROM public.projects WHERE id = ${b.projectId}::uuid AND owner_id = ${o}`;
  if (!p) return Response.json({ error: "Unknown client." }, { status: 404 });
  const [j] = await sql`SELECT account_name, last_error, last_push_at FROM public.client_jobber WHERE project_id = ${b.projectId}::uuid` as { account_name: string; last_error: string; last_push_at: string | null }[];
  const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
  return Response.json({ link: `${origin}/api/client-jobber?state=${encodeURIComponent(jobberState(b.projectId))}`, connected: !!j,
    account: j?.account_name ?? "", lastError: j?.last_error ?? "", lastPush: j?.last_push_at ?? null, configured: jobberConfigured() });
}
