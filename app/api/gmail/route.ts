import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { gmailConfigured } from "@/lib/gmail";
import { inboxCap, loadInboxes, mainOf, sendsToday, PER_INBOX_CAP } from "@/lib/gmail-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }

/** GET: connected inboxes, how many each sent in the last 24h and its daily cap (new inboxes warm up). */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  try {
    const inboxes = await loadInboxes(sql, o);
    const sent = await sendsToday(sql, o, inboxes);
    const list = inboxes.map(i => ({ email: i.email, main: i.is_main, sent: sent.get(i.email.toLowerCase()) ?? 0, cap: inboxCap(i), warming: inboxCap(i) < PER_INBOX_CAP }));
    const main = mainOf(inboxes);
    // The limit is a rolling 24 hours: each send frees its slot exactly 24 hours later.
    const [w] = await sql`SELECT min(occurred_at) AS first FROM public.contact_activities WHERE owner_id = ${o} AND notes LIKE 'Email sent: %via Gmail%' AND occurred_at > now() - interval '24 hours'` as { first: string | null }[];
    const freesAt = w?.first ? new Date(Date.parse(w.first) + 86400000).toISOString() : null;
    return Response.json({ configured: gmailConfigured(), connected: list.length > 0, email: main?.email ?? null, inboxes: list,
      sentLast24h: list.reduce((n, i) => n + i.sent, 0), cap: list.reduce((n, i) => n + i.cap, 0), freesAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Gmail status failed", e);
    return Response.json({ configured: gmailConfigured(), connected: false, email: null, inboxes: [], sentLast24h: 0, cap: 0 });
  }
}

/** DELETE ?email=x: disconnect one inbox (no email: all of them). Its sent threads keep their history. */
export async function DELETE(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sql = neon(process.env.DATABASE_URL!);
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (email) await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o} AND lower(email) = ${email}`;
  else await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`;
  // Keep one main inbox.
  await sql`UPDATE public.gmail_accounts SET is_main = true WHERE id = (SELECT id FROM public.gmail_accounts WHERE owner_id = ${o} ORDER BY connected_at LIMIT 1) AND NOT EXISTS (SELECT 1 FROM public.gmail_accounts WHERE owner_id = ${o} AND is_main)`;
  return Response.json({ ok: true });
}
