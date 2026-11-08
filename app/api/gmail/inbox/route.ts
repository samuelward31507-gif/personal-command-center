import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { USEFUL, REPLY_SYSTEM, replyPrompt } from "@/lib/inbox-sort";
import { claudeText } from "@/lib/ai-text";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendThreadReply } from "@/lib/gmail-send";
import { sortNewMail } from "@/lib/gmail-inbox";

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
 * POST {} : sort new inbox mail.
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
  // Draft a reply (not sent), or send the reply you approved.
  if (b.draft !== undefined || b.reply !== undefined) {
    const id = b.draft ?? b.reply;
    if (!uuid(id)) return Response.json({ error: "Email id is required." }, { status: 400 });
    const [m] = await sql`SELECT message_id, thread_id, from_addr, from_name, subject, snippet, category, summary, contact_id FROM public.gmail_inbox WHERE id = ${id}::uuid AND owner_id = ${o}` as Record<string, string | null>[];
    if (!m) return Response.json({ error: "Email not found." }, { status: 404 });
    const ws = await loadWorkspace(o);
    if (b.draft !== undefined) {
      if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Drafting needs the Anthropic key." }, { status: 503 });
      try {
        const text = await claudeText({ apiKey: process.env.ANTHROPIC_API_KEY, system: REPLY_SYSTEM, user: replyPrompt({ from: String(m.from_name || m.from_addr), subject: String(m.subject), snippet: String(m.snippet), category: String(m.category), summary: String(m.summary) }, ws), maxTokens: 600, timeoutMs: 30_000, label: "Inbox reply draft", model: "claude-haiku-5-5" });
        return Response.json({ draft: text.trim() });
      } catch { return Response.json({ error: "Couldn't draft a reply right now. Try again." }, { status: 502 }); }
    }
    const body = typeof b.body === "string" ? b.body.trim().slice(0, 5000) : "";
    if (!body) return Response.json({ error: "Write the reply first." }, { status: 400 });
    const r = await sendThreadReply(sql, o, ws, { gmailMessageId: String(m.message_id), threadId: String(m.thread_id), to: String(m.from_addr), subject: String(m.subject), body, contactId: m.contact_id });
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    await sql`UPDATE public.gmail_inbox SET handled_at = now() WHERE id = ${id}::uuid AND owner_id = ${o}`;
    return Response.json({ ok: true });
  }
  const { status, ...res } = await sortNewMail(sql, o);
  return Response.json(res, { status: status ?? 200 });
}
