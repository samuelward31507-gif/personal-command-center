import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { gmailConfigured, DAILY_SEND_CAP } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }

/** GET: is Gmail connected, as which address, and how many sent today. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  try {
    const [acc] = await sql`SELECT email, connected_at FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string; connected_at: string }[];
    const [sent] = await sql`SELECT count(*)::int AS n FROM public.contact_activities WHERE owner_id = ${o} AND notes LIKE 'Email sent: %' AND notes LIKE '%via Gmail%' AND occurred_at > now() - interval '24 hours'` as { n: number }[];
    return Response.json({ configured: gmailConfigured(), connected: !!acc, email: acc?.email ?? null, sentLast24h: sent?.n ?? 0, cap: DAILY_SEND_CAP }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Table not created yet: report as not connected rather than breaking the page.
    console.error("Gmail status failed", e);
    return Response.json({ configured: gmailConfigured(), connected: false, email: null, sentLast24h: 0, cap: DAILY_SEND_CAP });
  }
}

/** DELETE: disconnect Gmail (forgets the stored token; revoke it in your Google account too if you like). */
export async function DELETE() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`;
  return Response.json({ ok: true });
}
