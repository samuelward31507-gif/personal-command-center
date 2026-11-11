import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { placesConfigured, runSearch } from "@/lib/lead-finder-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const db = () => { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); };
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
const bad = (error: string, status = 400) => Response.json({ error }, { status });
const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} ,.'&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");

/** GET: saved searches, how many fresh leads are waiting, and whether Google Maps search is set up. */
export async function GET() {
  const o = await owner(); if (!o) return bad("Unauthorized", 401);
  try {
    const sql = db();
    const searches = await sql`SELECT id, trade, city, pages, found, added, status, last_run_at FROM public.lead_searches WHERE owner_id = ${o} ORDER BY status = 'done', created_at DESC LIMIT 200`;
    const [w] = await sql`SELECT count(*)::int AS waiting, count(*) FILTER (WHERE c.source = 'Google Maps')::int AS from_maps FROM public.contacts c WHERE c.owner_id = ${o} AND lower(coalesce(c.status,'')) = 'lead'
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.contact_id = c.id AND a.channel = 'call')` as { waiting: number; from_maps: number }[];
    return Response.json({ searches, waiting: w?.waiting ?? 0, fromMaps: w?.from_maps ?? 0, floor: Number(process.env.CINDER_LEAD_FLOOR) || 150, configured: placesConfigured() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Leads GET failed", e); return bad("Couldn't load lead searches.", 500); }
}

/** POST { action: "add", trades[], cities[] } | { action: "run", id } | { action: "pause" | "resume", id } */
export async function POST(req: Request) {
  const o = await owner(); if (!o) return bad("Unauthorized", 401);
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const sql = db();
    if (b.action === "add") {
      const trades = (Array.isArray(b.trades) ? b.trades : []).map(t => clean(t, 60)).filter(Boolean).slice(0, 10);
      const cities = (Array.isArray(b.cities) ? b.cities : []).map(c => clean(c, 80)).filter(Boolean).slice(0, 60);
      if (!trades.length || !cities.length) return bad("Pick at least one trade and one city.");
      let n = 0;
      for (const t of trades) for (const c of cities) {
        const r = await sql`INSERT INTO public.lead_searches (owner_id, trade, city) VALUES (${o}, ${t.toLowerCase()}, ${c}) ON CONFLICT (owner_id, trade, city) DO NOTHING RETURNING id`;
        n += r.length;
      }
      return Response.json({ ok: true, added: n });
    }
    const id = typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : "";
    if (!id) return bad("Which search?");
    if (b.action === "run") {
      if (!placesConfigured()) return bad("Add GOOGLE_PLACES_KEY in Vercel to search Google Maps.", 503);
      const r = await runSearch(sql, o, id, 3);
      return Response.json({ ok: true, ...r });
    }
    if (b.action === "pause" || b.action === "resume") {
      await sql`UPDATE public.lead_searches SET status = ${b.action === "pause" ? "paused" : "queued"} WHERE id = ${id}::uuid AND owner_id = ${o} AND status <> 'done'`;
      return Response.json({ ok: true });
    }
    return bad("Unknown action.");
  } catch (e) { console.error("Leads POST failed", e); return bad(e instanceof Error && /GOOGLE|Google/.test(e.message) ? e.message : "Couldn't do that.", 500); }
}
