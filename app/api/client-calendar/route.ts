import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { gmailConfigured } from "@/lib/gmail";
import { calAuthUrl, calState, readCalState } from "@/lib/client-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?state= : the link a client's owner opens to connect their Google Calendar. Sends them to Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  if (!readCalState(state)) return new Response("This link expired. Ask for a new one.", { status: 410 });
  if (!gmailConfigured()) return new Response("Calendar connections aren't switched on yet.", { status: 503 });
  return Response.redirect(calAuthUrl(url.origin, state), 302);
}

/** POST { projectId }: a fresh 7-day link to send the client's owner, and whether their calendar is connected. */
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
  const [c] = await sql`SELECT google_email, connected_at FROM public.client_calendars WHERE project_id = ${b.projectId}::uuid` as { google_email: string; connected_at: string }[];
  const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
  return Response.json({ link: `${origin}/api/client-calendar?state=${encodeURIComponent(calState(b.projectId))}`, connected: !!c, email: c?.google_email ?? "", configured: gmailConfigured() });
}
