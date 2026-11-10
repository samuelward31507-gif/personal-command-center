// Sending inboxes: cold email rotates across every connected inbox, each under its own daily cap.
// New inboxes warm up (10 a day, +10 each week, up to 40) so a fresh address doesn't land in spam.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export const PER_INBOX_CAP = 40;
export type Inbox = { email: string; refresh_token_enc: string; connected_at: string; ramp: boolean; is_main: boolean };

export function inboxCap(i: { ramp: boolean; connected_at: string }, now = Date.now()): number {
  if (!i.ramp) return PER_INBOX_CAP;
  const weeks = Math.max(0, Math.floor((now - Date.parse(i.connected_at)) / (7 * 86400000)));
  return Math.min(PER_INBOX_CAP, 10 + 10 * weeks);
}

/** The address a logged send went out from ("From: x" line); older logs have none. */
export function senderOf(note: string): string | null {
  return note.match(/\nFrom: (\S+@\S+)/)?.[1]?.toLowerCase() ?? null;
}

export function mainOf<T extends { is_main: boolean; connected_at: string }>(xs: T[]): T | undefined {
  return xs.find(x => x.is_main) ?? [...xs].sort((a, b) => Date.parse(a.connected_at) - Date.parse(b.connected_at))[0];
}

/** Sends per inbox in the last 24h. Logs without a From line belong to the main inbox. */
export function countSends(notes: string[], inboxes: Inbox[]): Map<string, number> {
  const main = mainOf(inboxes)?.email.toLowerCase() ?? "";
  const m = new Map(inboxes.map(i => [i.email.toLowerCase(), 0]));
  for (const n of notes) { const e = senderOf(n) ?? main; if (m.has(e)) m.set(e, (m.get(e) ?? 0) + 1); }
  return m;
}

/** The inbox with the most room left today, or null when every inbox is at its cap. */
export function pickInbox(inboxes: Inbox[], sent: Map<string, number>, now = Date.now()): Inbox | null {
  let best: Inbox | null = null, room = 0;
  for (const i of inboxes) {
    const left = inboxCap(i, now) - (sent.get(i.email.toLowerCase()) ?? 0);
    if (left <= 0) continue;
    // Most room wins; on a tie, spare the main inbox (it carries your real conversations).
    if (!best || left > room || (left === room && best.is_main && !i.is_main)) { best = i; room = left; }
  }
  return room > 0 ? best : null;
}

export async function loadInboxes(sql: Sql, o: string): Promise<Inbox[]> {
  return await sql`SELECT email, refresh_token_enc, connected_at, ramp, is_main FROM public.gmail_accounts WHERE owner_id = ${o} ORDER BY connected_at` as Inbox[];
}
export async function sendsToday(sql: Sql, o: string, inboxes: Inbox[]): Promise<Map<string, number>> {
  const rows = await sql`SELECT notes FROM public.contact_activities WHERE owner_id = ${o} AND notes LIKE 'Email sent: %via Gmail%' AND occurred_at > now() - interval '24 hours'` as { notes: string }[];
  return countSends(rows.map(r => r.notes), inboxes);
}
