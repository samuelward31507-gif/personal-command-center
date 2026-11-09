// Inbox sorter: pull new mail from the cold-email inbox and sort it with Claude. Shared by the Email page and the 7am job.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { accessToken, decryptToken } from "@/lib/gmail";
import { claudeText } from "@/lib/ai-text";
import { isBulk, parseFrom, parseSort, sortPrompt, SORT_SYSTEM, USEFUL, type RawMail } from "@/lib/inbox-sort";

type Sql = NeonQueryFunction<false, false>;
export type SortResult = { sorted: number; useful: number; more?: boolean; connected?: boolean; error?: string; needsReconnect?: boolean; status?: number };

/** Sort up to 40 new inbox emails. Bulk senders are filed without AI; the rest go to Claude in one batch. */
export async function sortNewMail(sql: Sql, o: string): Promise<SortResult> {
  const [acc] = await sql`SELECT email, refresh_token_enc FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string; refresh_token_enc: string }[];
  if (!acc) return { sorted: 0, useful: 0, connected: false };
  let token: string;
  try { token = await accessToken(decryptToken(acc.refresh_token_enc)); }
  catch (e) {
    if (e instanceof Error && /revoked/.test(e.message)) { await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`; return { sorted: 0, useful: 0, error: "Gmail disconnected. Click Connect Gmail.", connected: false, status: 401 }; }
    return { sorted: 0, useful: 0, error: "Couldn't reach Gmail.", status: 502 };
  }
  const g = (path: string) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  const list = await g("messages?labelIds=INBOX&maxResults=60");
  if (list.status === 403) return { sorted: 0, useful: 0, error: "Reconnect Gmail so Cinder can read who emailed you.", needsReconnect: true, status: 403 };
  if (!list.ok) return { sorted: 0, useful: 0, error: "Couldn't read the inbox.", status: 502 };
  const ids = ((await list.json()).messages ?? []) as { id: string; threadId: string }[];
  if (!ids.length) return { sorted: 0, useful: 0 };
  const known = new Set((await sql`SELECT message_id FROM public.gmail_inbox WHERE owner_id = ${o} AND message_id = ANY(${ids.map(x => x.id)}::text[])`).map(r => String(r.message_id)));
  const fresh = ids.filter(x => !known.has(x.id)).slice(0, 40);
  if (!fresh.length) return { sorted: 0, useful: 0 };

  const mails: RawMail[] = [];
  for (const x of fresh) {
    const r = await g(`messages/${x.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`);
    if (!r.ok) continue;
    const m = await r.json() as { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: { headers?: { name: string; value: string }[] } };
    const h = (n: string) => m.payload?.headers?.find(y => y.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const from = h("From");
    if ((m.labelIds ?? []).includes("SENT") || parseFrom(from).addr === acc.email.toLowerCase()) continue;
    mails.push({ id: m.id, threadId: m.threadId, from, subject: h("Subject").slice(0, 300), snippet: (m.snippet ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").slice(0, 400), listUnsubscribe: !!h("List-Unsubscribe"), date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString() });
  }
  const people = mails.filter(m => !isBulk(m));
  const addrs = mails.map(m => parseFrom(m.from).addr);
  const contacts = await sql`SELECT id, lower(email) AS email FROM public.contacts WHERE owner_id = ${o} AND lower(email) = ANY(${addrs}::text[])` as { id: string; email: string }[];
  const contactOf = new Map(contacts.map(c => [c.email, c.id]));
  let sorted: { category: string; summary: string; next: string }[] = people.map(() => ({ category: "other", summary: "", next: "" }));
  if (people.length && process.env.ANTHROPIC_API_KEY) {
    try {
      const text = await claudeText({ apiKey: process.env.ANTHROPIC_API_KEY, system: SORT_SYSTEM, user: sortPrompt(people, new Set(contactOf.keys())), maxTokens: 3000, timeoutMs: 40_000, label: "Inbox sort", model: "claude-haiku-5-5" });
      sorted = parseSort(text, people.length);
    } catch (e) { console.error("Inbox sort failed", e instanceof Error ? e.message : e); return { sorted: 0, useful: 0, error: "Couldn't sort the inbox right now. Try again in a minute.", status: 502 }; }
  }
  let useful = 0;
  for (const m of mails) {
    const k = people.indexOf(m), s = k >= 0 ? sorted[k] : { category: "other", summary: "", next: "" };
    if ((USEFUL as string[]).includes(s.category)) useful++;
    const { name, addr } = parseFrom(m.from);
    await sql`INSERT INTO public.gmail_inbox (owner_id, message_id, thread_id, from_addr, from_name, subject, snippet, received_at, category, summary, next_step, contact_id)
      VALUES (${o}, ${m.id}, ${m.threadId}, ${addr}, ${name}, ${m.subject}, ${m.snippet}, ${m.date}::timestamptz, ${s.category}, ${s.summary}, ${s.next}, ${contactOf.get(addr) ?? null})
      ON CONFLICT (owner_id, message_id) DO NOTHING`;
  }
  return { sorted: mails.length, useful, more: ids.length > known.size + fresh.length };
}
