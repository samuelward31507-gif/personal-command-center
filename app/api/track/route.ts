import { neon } from "@neondatabase/serverless";
import { isBot, parseTrack } from "@/lib/site-track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: one anonymous event from cinderrevenue.com (proxied as /api/t). Always answers 204 so the site never waits or breaks. */
export async function POST(req: Request) {
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  try {
    const o = process.env.CINDER_OWNER_ID?.trim();
    if (!o || !process.env.DATABASE_URL) return done;
    if (isBot(req.headers.get("user-agent") ?? "")) return done;
    const text = await req.text();
    if (text.length > 4000) return done;
    const r = parseTrack(JSON.parse(text));
    if (!r) return done;
    const h = (k: string) => { try { return decodeURIComponent(req.headers.get(k) ?? "").slice(0, 60); } catch { return ""; } };
    const sql = neon(process.env.DATABASE_URL);
    await sql`INSERT INTO public.site_events (owner_id, vid, sid, type, path, label, ref, utm_source, utm_medium, utm_campaign, who_name, who_company, ms, country, region, city, mobile)
      VALUES (${o}, ${r.vid}, ${r.sid}, ${r.type}, ${r.path}, ${r.label}, ${r.ref}, ${r.utmSource}, ${r.utmMedium}, ${r.utmCampaign}, ${r.whoName}, ${r.whoCompany}, ${r.ms},
        ${h("x-vercel-ip-country")}, ${h("x-vercel-ip-country-region")}, ${h("x-vercel-ip-city")}, ${r.mobile})`;
  } catch { /* analytics never breaks the site */ }
  return done;
}
