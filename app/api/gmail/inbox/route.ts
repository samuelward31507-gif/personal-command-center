import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { accessToken, decryptToken } from "@/lib/gmail";
import { claudeText } from "@/lib/ai-text";
import { isBulk, parseFrom, parseSort, sortPrompt, SORT_SYSTEM, USEFUL, type RawMail } from "@/lib/inbox-sort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
function db() { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); }
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

/** GET: emails that need you (interested, meetings, questions, follow-ups) from the last 30 days, not yet handled. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db()`SELECT id, thread_id, from_addr, from_name, subject, snippet, received_at, category, summary, next_step, contact_id
      FROM public.gmail_inbox WHERE owner_id = ${o} AND handled_at IS NULL AND category = ANY(${USEFUL}::text[]) AND received_at > now() - interval '30 days'
      ORDER BY received_at DESC LIMIT 50`;
    const [acc] = await db()`SELECT email FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string }[];
    return Response.json({ account: acc?.email ?? null, mail: rows.map(r => ({ id: String(r.id), threadId: String(r.thread_id), from: String(r.from_name || r.from_addr), addr: String(r.from_addr), subject: String(r.subject), snippet: String(r.snippet), at: new Date(r.received_at as string).toISOString(), category: String(r.category), summary: String(r.summary), next: String(r.next_step), contactId: r.contact_id ? String(r.contact_id) : null })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Inbox GET failed", e); return Response.json({ error: "Couldn't load the inbox." }, { status: 500 }); }
}

/**
 * POST {} : sort new inbox mail (up to 40 per run). Bulk senders are filed without AI; the rest go to Claude in one batch.
 * POST { done: id } : mark one handled.
 */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const sql = db();
  if (b.done !== undefined) {
    if (!uuid(b.done)) return Response.json({ error: "Email id is required." }, { status: 400 });
    await sql`UPDATE public.gmail_inbox SET handled_at = now() WHERE id = ${b.done}::uuid AND owner_id = ${o}`;
    return Response.json({ ok: true });
  }
  const [acc] = await sql`SELECT email, refresh_token_enc FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string; refresh_token_enc: string }[];
  if (!acc) return Response.json({ sorted: 0, useful: 0, connected: false });
  let token: string;
  try { token = await accessToken(decryptToken(acc.refresh_token_enc)); }
  catch (e) {
    if (e instanceof Error && /revoked/.test(e.message)) { await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`; return Response.json({ error: "Gmail disconnected. Click Connect Gmail.", connected: false }, { status: 401 }); }
    return Response.json({ error: "Couldn't reach Gmail." }, { status: 502 });
  }
  const g = (path: string) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  const list = await g("messages?labelIds=INBOX&maxResults=60");
  if (list.status === 403) return Response.json({ error: "Reconnect Gmail so Cinder can read who emailed you.", needsReconnect: true }, { status: 403 });
  if (!list.ok) return Response.json({ error: "Couldn't read the inbox." }, { status: 502 });
  const ids = ((await list.json()).messages ?? []) as { id: string; threadId: string }[];
  if (!ids.length) return Response.json({ sorted: 0, useful: 0 });
  const known = new Set((await sql`SELECT message_id FROM public.gmail_inbox WHERE owner_id = ${o} AND message_id = ANY(${ids.map(x => x.id)}::text[])`).map(r => String(r.message_id)));
  const fresh = ids.filter(x => !known.has(x.id)).slice(0, 40);
  if (!fresh.length) return Response.json({ sorted: 0, useful: 0 });

  const mails: RawMail[] = [];
  for (const x of fresh) {
    const r = await g(`messages/${x.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`);
    if (!r.ok) continue;
    const m = await r.json() as { id: string; threadId: string; snippet?: string; internalDate?: string; payload?: { headers?: { name: string; value: string }[] } };
    const h = (n: string) => m.payload?.headers?.find(y => y.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const from = h("From");
    if (parseFrom(from).addr === acc.email.toLowerCase()) continue;
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
    } catch (e) { console.error("Inbox sort failed", e instanceof Error ? e.message : e); return Response.json({ error: "Couldn't sort the inbox right now. Try again in a minute." }, { status: 502 }); }
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
  return Response.json({ sorted: mails.length, useful, more: ids.length > known.size + fresh.length });
}
