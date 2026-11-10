import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { validatePartner } from "@/lib/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });
async function owner() {
  const r = await getAllowedSession();
  return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
}

/** GET: every partner, newest touch first. */
export async function GET() {
  const o = await owner();
  if (!o) return reply({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM public.partners WHERE owner_id = ${o} ORDER BY (status = 'no'), updated_at DESC LIMIT 500`;
  return reply({ partners: rows });
}

/** POST: add a partner, or update one with `id`. `touch: true` stamps today's contact. Nothing is sent. */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return reply({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const p = validatePartner(b);
  if ("error" in p) return reply(p, 400);
  const sql = neon(process.env.DATABASE_URL);
  const id = typeof b?.id === "string" && UUID.test(b.id) ? b.id : null;
  const touch = b?.touch === true;
  const rows = id
    ? await sql`UPDATE public.partners SET kind = ${p.kind}, name = ${p.name}, contact_name = ${p.contact_name}, phone = ${p.phone}, email = ${p.email},
        city = ${p.city}, status = ${p.status}, referrals = ${p.referrals}, notes = ${p.notes},
        last_touch_at = CASE WHEN ${touch} THEN now() ELSE last_touch_at END, updated_at = now()
        WHERE id = ${id}::uuid AND owner_id = ${o} RETURNING *`
    : await sql`INSERT INTO public.partners (owner_id, kind, name, contact_name, phone, email, city, status, referrals, notes)
        VALUES (${o}, ${p.kind}, ${p.name}, ${p.contact_name}, ${p.phone}, ${p.email}, ${p.city}, ${p.status}, ${p.referrals}, ${p.notes}) RETURNING *`;
  if (!rows.length) return reply({ error: "Partner not found." }, 404);
  return reply({ partner: rows[0] });
}
