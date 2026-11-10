// Reply and bounce detection for cold-email threads. Shared by the Email page and the 7am morning job.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { accessToken, classifyThread, decryptToken, type ThreadMessage, type ThreadVerdict } from "@/lib/gmail";
import { loadInboxes, mainOf } from "@/lib/gmail-accounts";

type Sql = NeonQueryFunction<false, false>;
const BATCH = 60;
export type SyncResult = { checked?: number; replies?: number; bounces?: number; connected?: boolean; more?: boolean; error?: string; needsReconnect?: boolean; status?: number };

/** Check every unanswered cold-email thread from the last 30 days. Replies stop the sequence; "stop" replies suppress; bounces flag the address. */
export async function syncReplies(sql: Sql, o: string): Promise<SyncResult> {
  const inboxes = await loadInboxes(sql, o);
  if (!inboxes.length) return { checked: 0, replies: 0, bounces: 0, connected: false };
  const mine = inboxes.map(i => i.email);
  const main = mainOf(inboxes)!.email.toLowerCase();

  // One thread per contact: the first Gmail send holds the thread every follow-up joins.
  // Unfinished sequences first, oldest last email first (they're next in line for a follow-up), so a long
  // list never starves the contacts that are about to be emailed again.
  const rows = await sql`SELECT contact_id, thread FROM (
      SELECT DISTINCT ON (a.contact_id) a.contact_id, substring(a.notes from 'Thread: ([A-Za-z0-9]+)') AS thread, lower(substring(a.notes from '\nFrom: (\S+)')) AS sender,
        (SELECT max(x.occurred_at) FROM public.contact_activities x WHERE x.owner_id = a.owner_id AND x.contact_id = a.contact_id AND x.notes LIKE 'Email sent: %') AS last_at,
        EXISTS (SELECT 1 FROM public.contact_activities x WHERE x.owner_id = a.owner_id AND x.contact_id = a.contact_id AND x.notes LIKE 'Email sent: breakup%') AS finished
      FROM public.contact_activities a
      WHERE a.owner_id = ${o} AND a.notes LIKE 'Email sent: %via Gmail%' AND a.occurred_at > now() - interval '30 days'
        AND substring(a.notes from 'Thread: ([A-Za-z0-9]+)') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.contact_activities b WHERE b.owner_id = a.owner_id AND b.contact_id = a.contact_id
          AND (b.notes LIKE 'Email reply:%' OR b.notes LIKE 'Email bounced:%'))
      ORDER BY a.contact_id, a.occurred_at ASC) t
    ORDER BY finished, last_at ASC` as { contact_id: string; thread: string | null; sender: string | null }[];
  const todo = rows.filter(x => x.thread).slice(0, BATCH);
  if (!todo.length) return { checked: 0, replies: 0, bounces: 0, connected: true };

  // Each thread is read through the inbox that sent it.
  const tokens = new Map<string, string | null>();
  let replies = 0, bounces = 0, checked = 0;
  const dropped: string[] = [];
  for (const t of todo) {
    const from = (t.sender || main).toLowerCase();
    if (!tokens.has(from)) {
      const acc = inboxes.find(i => i.email.toLowerCase() === from);
      if (!acc) { tokens.set(from, null); }
      else {
        try { tokens.set(from, await accessToken(decryptToken(acc.refresh_token_enc))); }
        catch (e) {
          tokens.set(from, null);
          if (e instanceof Error && /revoked/.test(e.message)) { await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o} AND lower(email) = ${from}`; dropped.push(from); }
          else if (inboxes.length === 1) return { error: e instanceof Error ? e.message : "Couldn't reach Gmail.", connected: true, status: 502 };
        }
      }
    }
    const token = tokens.get(from);
    if (!token) continue;
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(t.thread!)}?format=metadata&metadataHeaders=From`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) return { error: `Reconnect ${from} and allow viewing email headers so Cinder can see replies.`, needsReconnect: true, checked, replies, bounces, status: 403 };
    if (!res.ok) continue;
    checked++;
    const j = await res.json().catch(() => ({})) as { messages?: { snippet?: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] };
    const msgs: ThreadMessage[] = (j.messages ?? []).map(m => ({ from: m.payload?.headers?.find(h => h.name.toLowerCase() === "from")?.value ?? "", snippet: m.snippet, internalDate: m.internalDate, labelIds: m.labelIds }));
    const v = classifyThread(msgs, mine);
    if (!v) continue;
    if (v.kind === "bounce") bounces++; else replies++;
    await recordVerdict(sql, o, t.contact_id, v);
  }
  if (dropped.length) return { error: `${dropped.join(", ")} disconnected (Google expires access every 7 days for now). Connect ${dropped.length === 1 ? "it" : "them"} again on the Email page.`, connected: inboxes.length > dropped.length, checked, replies, bounces, status: 401 };
  return { checked, replies, bounces, connected: true, more: rows.length > todo.length };
}

/** Log a reply or bounce so every sequence stops for that contact; a "stop" reply also suppresses them. */
export async function recordVerdict(sql: Sql, o: string, contactId: string, v: NonNullable<ThreadVerdict>): Promise<void> {
  if (v.kind === "bounce") {
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, occurred_at)
      VALUES (${o}, ${contactId}::uuid, 'note', 'note', 'other', ${`Email bounced: the address didn't accept mail.\n${v.snippet}`}, ${v.at}::timestamptz)`;
  } else {
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes, occurred_at)
      VALUES (${o}, ${contactId}::uuid, 'note', 'note', 'reply_received', ${`Email reply: ${v.from}${v.kind === "unsubscribe" ? " (asked to stop)" : ""}\n${v.snippet}`}, ${v.at}::timestamptz)`;
    if (v.kind === "unsubscribe") {
      await sql`INSERT INTO public.contact_suppressions (owner_id, contact_id, email_normalized, reason, source)
        SELECT ${o}, c.id, lower(c.email), 'do_not_contact', 'email_unsubscribe' FROM public.contacts c WHERE c.id = ${contactId}::uuid AND c.owner_id = ${o}
        ON CONFLICT DO NOTHING`;
    }
  }
  await sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${contactId}::uuid AND owner_id = ${o}`;
}
