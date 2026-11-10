import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { siteStats, type Ev } from "@/lib/site-track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=7|30|90: cinderrevenue.com visitors, sessions, bounce, time, booking clicks, demo plays, pages, sources, prospects who watched. */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const d = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(d) ? d : 30;
  const sql = neon(process.env.DATABASE_URL);
  const evs = await sql`SELECT type, vid, sid, path, label, ref, utm_source, ms, at FROM public.site_events WHERE owner_id = ${o} AND at > now() - make_interval(days => ${days}) ORDER BY at LIMIT 50000`.catch(() => []) as Ev[];
  const watched = await sql`SELECT who_company, who_name, max(at) AS at, count(*) FILTER (WHERE type = 'play')::int AS plays, max(ms) AS ms
    FROM public.site_events WHERE owner_id = ${o} AND who_company <> '' AND at > now() - make_interval(days => ${days}) GROUP BY who_company, who_name ORDER BY max(at) DESC LIMIT 25`.catch(() => []);
  return Response.json({ days, stats: siteStats(evs.map(e => ({ ...e, at: new Date(e.at).toISOString() }))),
    watched: watched.map(w => ({ company: String(w.who_company), name: String(w.who_name), at: new Date(w.at as string).toISOString(), plays: Number(w.plays), seconds: w.ms ? Math.round(Number(w.ms) / 1000) : null })) },
    { headers: { "Cache-Control": "no-store" } });
}
