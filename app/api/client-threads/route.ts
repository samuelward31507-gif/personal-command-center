import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { claudeText } from "@/lib/ai-text";
import { clientById, sendToCustomer, sendReviewRequest } from "@/lib/client-runtime-run";
import { digits10, parseDecision, parseLeadList, replySystem, replyUser } from "@/lib/client-runtime";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const e164 = (p: string) => { const d = digits10(p); return d.length === 10 ? "+1" + d : ""; };

/** GET ?project= → the client's live threads, quotes and readiness. GET ?thread= → that thread's texts. */
export async function GET(req: Request) {
  const o = await owner();
  if (!o) return reply({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const sql = neon(process.env.DATABASE_URL);
  const u = new URL(req.url), project = u.searchParams.get("project") ?? "", th = u.searchParams.get("thread") ?? "";
  if (UUID.test(th)) {
    const texts = await sql`SELECT x.direction, x.author, x.body, x.ok, x.at FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
      WHERE x.thread_id = ${th}::uuid AND t.owner_id = ${o} ORDER BY x.at LIMIT 300`;
    return reply({ texts });
  }
  if (!UUID.test(project)) return reply({ error: "Pick a client." }, 400);
  const c = await clientById(sql, o, project);
  const [threads, quotes, rv] = await Promise.all([
    sql`SELECT t.id, t.customer_phone, t.customer_name, t.source, t.status, t.last_in_at, t.last_out_at, t.updated_at,
        (SELECT json_build_object('body', x.body, 'direction', x.direction, 'at', x.at) FROM public.client_texts x WHERE x.thread_id = t.id ORDER BY x.at DESC LIMIT 1) AS last
      FROM public.client_threads t WHERE t.owner_id = ${o} AND t.project_id = ${project}::uuid ORDER BY t.updated_at DESC LIMIT 100`,
    sql`SELECT id, customer_phone, customer_name, amount, sent_on, steps_sent, status, kind FROM public.client_quotes WHERE owner_id = ${o} AND project_id = ${project}::uuid ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT count(*)::int AS n FROM public.client_reviews WHERE owner_id = ${o} AND project_id = ${project}::uuid`,
  ]);
  const s = c?.setup ?? {};
  // The website chat bubble's key: made once per client, safe to put in their site's HTML.
  let chatKey = "";
  if (c) {
    const [k] = await sql`SELECT chat_key FROM public.client_ops WHERE project_id = ${project}::uuid AND owner_id = ${o}` as { chat_key: string | null }[];
    chatKey = k?.chat_key || randomBytes(18).toString("base64url");
    if (!k?.chat_key) await sql`UPDATE public.client_ops SET chat_key = ${chatKey} WHERE project_id = ${project}::uuid AND owner_id = ${o} AND chat_key IS NULL`;
  }
  const missing = [!s.texting_number && "Texting number", !s.owner_cell && "Owner's cell", !s.booking_link && "Booking link", !s.review_link && "Google review link",
    !(c?.messages ?? []).some(m => m.status === "approved") && "Approved messages"].filter(Boolean);
  return reply({ threads, quotes, reviews: rv[0]?.n ?? 0, chatKey, ready: { live: missing.length === 0, missing, number: s.texting_number || "" } });
}

/** POST {project, action, ...}: reply as the owner, change a thread's status, add or close a quote, send a review request, or test the reply engine. */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return reply({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const project = str(b?.project, 40);
  if (!b || !UUID.test(project)) return reply({ error: "Pick a client." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const c = await clientById(sql, o, project);
  if (!c) return reply({ error: "Open the setup sheet for this client first." }, 404);
  const action = str(b.action, 20);

  if (action === "simulate") {
    if (!process.env.ANTHROPIC_API_KEY) return reply({ error: "The AI key isn't set." }, 503);
    const hist = Array.isArray(b.history) ? (b.history as { direction?: string; body?: string }[]).slice(-20).map(h => ({ direction: h.direction === "out" ? "out" : "in", body: str(h.body, 600) })).filter(h => h.body) : [];
    if (!hist.length) return reply({ error: "Type what the customer would text." }, 400);
    try {
      const text = await claudeText({ apiKey: process.env.ANTHROPIC_API_KEY, system: replySystem(c.setup, c.messages), user: replyUser(hist, str(b.name, 80)), label: "Client reply test", model: process.env.CINDER_REPLY_MODEL?.trim() || "claude-haiku-5-5", maxTokens: 500, timeoutMs: 15000 });
      return reply({ decision: parseDecision(text) ?? { reply: "", handoff: true, stage: "qualifying", summary: "The engine's answer couldn't be read, so this would go to the owner." } });
    } catch (e) { return reply({ error: e instanceof Error ? e.message : "The test failed." }, 502); }
  }

  const thread = str(b.thread, 40);
  if (action === "reply" || action === "status" || action === "name") {
    if (!UUID.test(thread)) return reply({ error: "Pick a conversation." }, 400);
    const [t] = await sql`SELECT id, customer_phone FROM public.client_threads WHERE id = ${thread}::uuid AND owner_id = ${o} AND project_id = ${project}::uuid` as { id: string; customer_phone: string }[];
    if (!t) return reply({ error: "Conversation not found." }, 404);
    if (action === "reply") {
      const body = str(b.body, 600);
      if (!body) return reply({ error: "Type a message." }, 400);
      const ok = await sendToCustomer(sql, c, t.id, t.customer_phone, body, "owner");
      // A person stepped in: the automation steps back until someone turns it on again.
      await sql`UPDATE public.client_threads SET status = 'paused', updated_at = now() WHERE id = ${t.id}::uuid AND status = 'auto'`;
      return ok ? reply({ ok }) : reply({ error: "The text didn't send. Check the texting number and registration." }, 502);
    }
    if (action === "status") {
      const st = str(b.status, 20);
      if (!["auto", "paused", "booked", "closed"].includes(st)) return reply({ error: "Unknown status." }, 400);
      await sql`UPDATE public.client_threads SET status = ${st}, updated_at = now() WHERE id = ${t.id}::uuid AND status <> 'opted_out'`;
      return reply({ ok: true });
    }
    await sql`UPDATE public.client_threads SET customer_name = ${str(b.name, 80)}, updated_at = now() WHERE id = ${t.id}::uuid`;
    return reply({ ok: true });
  }

  if (action === "quote") {
    const phone = e164(str(b.phone, 30)), name = str(b.name, 80), sentOn = str(b.sentOn, 10) || new Date().toISOString().slice(0, 10);
    const amount = Number(String(b.amount ?? "").replace(/[$,\s]/g, ""));
    if (!phone) return reply({ error: "Add the customer's cell number." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sentOn)) return reply({ error: "Quote date must be YYYY-MM-DD." }, 400);
    await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on)
      VALUES (${o}, ${project}::uuid, ${phone}, ${name}, ${Number.isFinite(amount) && amount > 0 ? amount : null}, ${sentOn}::date)`;
    return reply({ ok: true });
  }
  if (action === "rehash") {
    // Only people who already contacted this business: their old inquiries, never a bought list.
    if (b.consent !== true) return reply({ error: "Confirm these are people who contacted the business before." }, 400);
    const leads = parseLeadList(str(b.list, 40000));
    if (!leads.length) return reply({ error: "Paste one lead per line: name, then cell number." }, 400);
    const today = new Date().toISOString().slice(0, 10);
    let added = 0;
    for (const l of leads) {
      const r = await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, sent_on, kind)
        SELECT ${o}, ${project}::uuid, ${l.phone}, ${l.name}, ${today}::date, 'rehash'
        WHERE NOT EXISTS (SELECT 1 FROM public.client_quotes q WHERE q.project_id = ${project}::uuid AND q.customer_phone = ${l.phone} AND q.kind = 'rehash')
          AND NOT EXISTS (SELECT 1 FROM public.client_threads t WHERE t.project_id = ${project}::uuid AND t.customer_phone = ${l.phone} AND t.status = 'opted_out')
        RETURNING id`;
      added += r.length;
    }
    return reply({ ok: true, added, skipped: leads.length - added });
  }
  if (action === "quote_status") {
    const st = str(b.status, 10), id = str(b.quote, 40);
    if (!UUID.test(id) || !["won", "lost", "stopped", "open"].includes(st)) return reply({ error: "Unknown quote or status." }, 400);
    await sql`UPDATE public.client_quotes SET status = ${st} WHERE id = ${id}::uuid AND owner_id = ${o}`;
    return reply({ ok: true });
  }
  if (action === "review") {
    const phone = e164(str(b.phone, 30));
    if (!phone) return reply({ error: "Add the customer's cell number." }, 400);
    const r = await sendReviewRequest(sql, c, phone, str(b.name, 80));
    return r.ok ? reply({ ok: true }) : reply({ error: r.error }, 400);
  }
  return reply({ error: "Unknown action." }, 400);
}
