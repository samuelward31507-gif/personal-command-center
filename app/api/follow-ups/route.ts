import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: warm leads waiting on a text from you. Everyone whose latest call was "Interested" or "Send info" in the
 * last 30 days (and who hasn't asked to stop), with when their info text went out and their open info follow-ups.
 */
export async function GET() {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  try {
    const rows = await sql`WITH last AS (
        SELECT DISTINCT ON (a.contact_id) a.contact_id, a.outcome, a.occurred_at, a.notes
        FROM public.contact_activities a
        WHERE a.owner_id = ${o} AND a.channel = 'call' AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated'
        ORDER BY a.contact_id, a.occurred_at DESC)
      SELECT c.id, c.first_name, c.last_name, c.company, c.phone, c.niche, c.location, l.outcome, l.occurred_at, l.notes AS call_note,
        (SELECT max(t.occurred_at) FROM public.contact_activities t WHERE t.owner_id = c.owner_id AND t.contact_id = c.id
           AND t.action = 'outbound_text' AND t.occurred_at >= l.occurred_at) AS info_sent_at,
        (SELECT max(t.occurred_at) FROM public.contact_activities t WHERE t.owner_id = c.owner_id AND t.contact_id = c.id
           AND t.action = 'inbound_text' AND t.occurred_at >= l.occurred_at) AS replied_at,
        (SELECT coalesce(json_agg(json_build_object('id', k.id, 'title', k.title, 'due', k.due_at) ORDER BY k.due_at), '[]'::json)
           FROM public.tasks k WHERE k.owner_id = c.owner_id AND k.contact_id = c.id AND k.status IN ('todo', 'in_progress')
           AND k.title LIKE 'Follow up on info%') AS tasks
      FROM last l JOIN public.contacts c ON c.id = l.contact_id AND c.owner_id = ${o}
      WHERE l.outcome IN ('interested', 'send_info') AND l.occurred_at > now() - interval '30 days' AND c.phone <> ''
        AND NOT EXISTS (SELECT 1 FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id AND s.contact_id = c.id)
      ORDER BY l.occurred_at DESC LIMIT 200`;
    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
    const leads = rows.map(x => ({
      id: String(x.id), firstName: String(x.first_name ?? ""), lastName: String(x.last_name ?? ""), company: String(x.company ?? ""),
      phone: String(x.phone ?? ""), niche: String(x.niche ?? ""), outcome: String(x.outcome), at: iso(x.occurred_at),
      infoSentAt: iso(x.info_sent_at), repliedAt: iso(x.replied_at), location: String(x.location ?? ""),
      callNote: String(x.call_note ?? "").split("\n").filter(l => l && !/^Call launched/.test(l)).join(" ").slice(0, 300),
      tasks: (Array.isArray(x.tasks) ? x.tasks : []).map((t: { id: string; title: string; due: string }) => ({ id: String(t.id), title: String(t.title), due: iso(t.due), day: Number(/day (\d+)/.exec(t.title)?.[1] ?? 0) })),
    }));
    // Clients won 14+ days ago (within 6 months) who haven't been asked for a referral yet.
    const won = await sql`SELECT d.id AS deal_id, d.title, c.id, c.first_name, c.company, c.phone,
        COALESCE(d.signed_at, d.conversion_completed_at, d.updated_at) AS won_at
      FROM public.deals d JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.owner_id = ${o} AND d.stage = 'won' AND c.phone <> ''
        AND COALESCE(d.signed_at, d.conversion_completed_at, d.updated_at) < now() - interval '14 days'
        AND COALESCE(d.signed_at, d.conversion_completed_at, d.updated_at) > now() - interval '180 days'
        AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = d.owner_id AND a.contact_id = c.id
          AND a.action = 'outbound_text' AND a.notes ILIKE '%quick favor:%')
      ORDER BY won_at LIMIT 20`;
    const referrals = won.map(x => ({ dealId: String(x.deal_id), title: String(x.title ?? ""), id: String(x.id), firstName: String(x.first_name ?? ""), company: String(x.company ?? ""), phone: String(x.phone ?? ""), wonAt: iso(x.won_at) }));
    return Response.json({ leads, referrals }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Follow-ups GET failed", e);
    return Response.json({ error: "Couldn't load follow-ups." }, { status: 500 });
  }
}
