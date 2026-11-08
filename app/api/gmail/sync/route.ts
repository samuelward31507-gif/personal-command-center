import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { accessToken, classifyThread, decryptToken, type ThreadMessage } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many threads one sync checks. The page calls this every few minutes, so the backlog clears quickly. */
const BATCH = 60;

/**
 * POST: check every cold-email thread from the last 30 days that hasn't been answered yet.
 * A reply stops the sequence and lands on the dashboard; an "unsubscribe" reply also suppresses the contact;
 * a bounce stops the sequence and flags the address. Reads headers and Gmail's short preview only.
 */
export async function POST() {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  const [acc] = await sql`SELECT email, refresh_token_enc FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string; refresh_token_enc: string }[];
  if (!acc) return Response.json({ checked: 0, replies: 0, bounces: 0, connected: false });

  // One thread per contact: the first Gmail send holds the thread every follow-up joins.
  const rows = await sql`SELECT DISTINCT ON (a.contact_id) a.contact_id, substring(a.notes from 'Thread: ([A-Za-z0-9]+)') AS thread
    FROM public.contact_activities a
    WHERE a.owner_id = ${o} AND a.notes LIKE 'Email sent: %via Gmail%' AND a.occurred_at > now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities b WHERE b.owner_id = a.owner_id AND b.contact_id = a.contact_id
        AND (b.notes LIKE 'Email reply:%' OR b.notes LIKE 'Email bounced:%'))
    ORDER BY a.contact_id, a.occurred_at ASC` as { contact_id: string; thread: string | null }[];
  const todo = rows.filter(x => x.thread).slice(0, BATCH);
  if (!todo.length) return Response.json({ checked: 0, replies: 0, bounces: 0, connected: true });

  let token: string;
  try { token = await accessToken(decryptToken(acc.refresh_token_enc)); }
  catch (e) {
    if (e instanceof Error && /revoked/.test(e.message)) {
      await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`;
      return Response.json({ error: "Gmail disconnected (Google expires access every 7 days for now). Click Connect Gmail to turn sending and reply tracking back on.", connected: false }, { status: 401 });
    }
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't reach Gmail.", connected: true }, { status: 502 });
  }

  let replies = 0, bounces = 0, checked = 0;
  for (const t of todo) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(t.thread!)}?format=metadata&metadataHeaders=From`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) return Response.json({ error: "Reconnect Gmail and allow viewing email headers so Cinder can see replies.", needsReconnect: true, checked, replies, bounces }, { status: 403 });
    if (!res.ok) continue;
    checked++;
    const j = await res.json().catch(() => ({})) as { messages?: { snippet?: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] };
    const msgs: ThreadMessage[] = (j.messages ?? []).map(m => ({ from: m.payload?.headers?.find(h => h.name.toLowerCase() === "from")?.value ?? "", snippet: m.snippet, internalDate: m.internalDate, labelIds: m.labelIds }));
    const v = classifyThread(msgs, acc.email);
    if (!v) continue;
    if (v.kind === "bounce") {
      bounces++;
      await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, occurred_at)
        VALUES (${o}, ${t.contact_id}::uuid, 'note', 'note', 'other', ${`Email bounced: the address didn't accept mail.\n${v.snippet}`}, ${v.at}::timestamptz)`;
    } else {
      replies++;
      await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, occurred_at)
        VALUES (${o}, ${t.contact_id}::uuid, 'note', 'note', 'reply_received', ${`Email reply: ${v.from}${v.kind === "unsubscribe" ? " (asked to stop)" : ""}\n${v.snippet}`}, ${v.at}::timestamptz)`;
      if (v.kind === "unsubscribe") {
        await sql`INSERT INTO public.contact_suppressions (owner_id, contact_id, email_normalized, reason, source)
          SELECT ${o}, c.id, lower(c.email), 'do_not_contact', 'email_unsubscribe' FROM public.contacts c WHERE c.id = ${t.contact_id}::uuid AND c.owner_id = ${o}
          ON CONFLICT DO NOTHING`;
      }
    }
    await sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${t.contact_id}::uuid AND owner_id = ${o}`;
  }
  return Response.json({ checked, replies, bounces, connected: true, more: rows.length > todo.length });
}
