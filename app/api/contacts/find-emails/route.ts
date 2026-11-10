import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { emailsIn, pickEmail, contactPages } from "@/lib/email-finder";
import { fetchPage as page } from "@/lib/website-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function lookup(website: string): Promise<string> {
  const base = /^https?:\/\//i.test(website) ? website : "https://" + website;
  const home = await page(base);
  if (!home) return "";
  let found = emailsIn(home), best = pickEmail(found, base);
  if (best) return best;
  for (const u of contactPages(home, base)) { found = [...found, ...emailsIn(await page(u))]; best = pickEmail(found, base); if (best) return best; }
  return "";
}

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
  const rows = await sql`SELECT c.id, c.website FROM public.contacts c WHERE c.owner_id = ${o} AND coalesce(c.email,'') = '' AND coalesce(c.website,'') <> '' AND c.email_lookup_at IS NULL
    ORDER BY c.created_at DESC LIMIT ${limit}`;
  const results = await Promise.all(rows.map(async row => ({ id: String(row.id), email: await lookup(String(row.website)) })));
  let found = 0;
  for (const x of results) {
    if (x.email) found++;
    await sql`UPDATE public.contacts SET email = CASE WHEN coalesce(email,'') = '' AND ${x.email} <> '' THEN ${x.email} ELSE email END, email_lookup_at = now(), updated_at = now() WHERE id = ${x.id}::uuid AND owner_id = ${o}`;
  }
  const [x] = await sql`SELECT count(*)::int AS left FROM public.contacts c WHERE c.owner_id = ${o} AND coalesce(c.email,'') = '' AND coalesce(c.website,'') <> '' AND c.email_lookup_at IS NULL`;
  return Response.json({ checked: results.length, found, left: x?.left ?? 0 });
}
