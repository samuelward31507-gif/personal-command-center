import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { auditLinkFor } from "@/lib/auto-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { contactId }: the free audit for a booked prospect (made once from their homepage, reused after), as a
 * cinderrevenue.com link to text them before the call. { link: null } when there's no website or nothing to report.
 */
export async function POST(request: Request) {
  const result = await getAllowedSession();
  const owner = result?.data?.session && result?.data?.user?.id ? String(result.data.user.id) : null;
  if (!owner) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const b = await request.json().catch(() => ({})) as { contactId?: string };
  if (!b.contactId || !UUID.test(b.contactId)) return Response.json({ error: "A contact is required." }, { status: 400 });
  const sql = neon(process.env.DATABASE_URL);
  try {
    const [c] = await sql`SELECT id, company, name, website, niche FROM public.contacts WHERE id = ${b.contactId}::uuid AND owner_id = ${owner} LIMIT 1` as { id: string; company: string; name: string; website: string | null; niche: string | null }[];
    if (!c) return Response.json({ error: "Contact not found." }, { status: 404 });
    const link = await auditLinkFor(sql, owner, c);
    const token = link?.split("/report/")[1];
    return Response.json({ link: token ? `https://cinderrevenue.com/report/${token}` : null });
  } catch (e) {
    console.error("Pre-call audit failed", e instanceof Error ? e.message.slice(0, 160) : e);
    return Response.json({ error: "Couldn't make the audit. Try again." }, { status: 500 });
  }
}
