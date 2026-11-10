import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { findEmails } from "@/lib/find-emails-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: how many contacts still have a website but no email. POST {limit}: check that many sites and save what's found. */
async function owner() {
  const r = await getAllowedSession();
  return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
}
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ left: 0 });
  const sql = neon(process.env.DATABASE_URL);
  const [x] = await sql`SELECT count(*)::int AS left FROM public.contacts c WHERE c.owner_id = ${o} AND coalesce(c.email,'') = '' AND coalesce(c.website,'') <> '' AND c.email_lookup_at IS NULL`;
  return Response.json({ left: x?.left ?? 0 });
}
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(25, Number(b.limit) || 20));
  const sql = neon(process.env.DATABASE_URL);
  const r = await findEmails(sql, o, { limit, batch: limit, budgetMs: 45_000 });
  return Response.json(r);
}
