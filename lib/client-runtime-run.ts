// Client runtime, I/O: what happens when a client's customer calls or texts their Cinder number,
// plus quote follow-ups and review requests. Every send is logged on the customer's thread.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { claudeText } from "@/lib/ai-text";
import { sendSms } from "@/lib/twilio";
import { cleanMessages } from "@/lib/client-ops";
import { digits10, fill, wording, FALLBACK, isStop, isStart, replySystem, replyUser, parseDecision, ownerAlert, quoteStepDue, SEQUENCES, REVIEW_TEXT, type Vars } from "@/lib/client-runtime";

type Sql = NeonQueryFunction<false, false>;
export type Client = { projectId: string; owner: string; setup: Record<string, string>; messages: ReturnType<typeof cleanMessages> };

/** The client whose Cinder number this is, or null (then it's Cinder's own number). */
export async function clientByNumber(sql: Sql, to: string): Promise<Client | null> {
  const d = digits10(to);
  if (d.length !== 10) return null;
  const [r] = await sql`SELECT project_id, owner_id, setup, messages FROM public.client_ops
    WHERE right(regexp_replace(coalesce(setup->>'texting_number', ''), '[^0-9]', '', 'g'), 10) = ${d} LIMIT 1` as Record<string, unknown>[];
  if (!r) return null;
  return { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup && typeof r.setup === "object" ? r.setup : {}) as Record<string, string>, messages: cleanMessages(r.messages) };
}

export async function clientById(sql: Sql, owner: string, projectId: string): Promise<Client | null> {
  const [r] = await sql`SELECT project_id, owner_id, setup, messages FROM public.client_ops WHERE project_id = ${projectId}::uuid AND owner_id = ${owner}` as Record<string, unknown>[];
  if (!r) return null;
  return { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup && typeof r.setup === "object" ? r.setup : {}) as Record<string, string>, messages: cleanMessages(r.messages) };
}

const varsFor = (c: Client, first = ""): Vars => ({ first, business: c.setup.display_name, owner: c.setup.owner_name, link: c.setup.booking_link, review_link: c.setup.review_link });
const e164 = (p: string) => { const d = digits10(p); return d.length === 10 ? "+1" + d : ""; };

async function thread(sql: Sql, c: Client, phone: string, source: string) {
  const [t] = await sql`INSERT INTO public.client_threads (owner_id, project_id, customer_phone, source)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${e164(phone)}, ${source})
    ON CONFLICT (project_id, customer_phone) DO UPDATE SET updated_at = now()
    RETURNING id, status, customer_name, (xmax = 0) AS fresh` as { id: string; status: string; customer_name: string; fresh: boolean }[];
  return t;
}
async function log(sql: Sql, c: Client, threadId: string, direction: "in" | "out", author: string, body: string, ok = true) {
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body, ok) VALUES (${c.owner}, ${threadId}::uuid, ${direction}, ${author}, ${body}, ${ok})`;
  if (direction === "in") await sql`UPDATE public.client_threads SET last_in_at = now(), updated_at = now() WHERE id = ${threadId}::uuid`;
  else await sql`UPDATE public.client_threads SET last_out_at = now(), updated_at = now() WHERE id = ${threadId}::uuid`;
}
/** Text the customer from the client's number and log it. */
export async function sendToCustomer(sql: Sql, c: Client, threadId: string, phone: string, body: string, author: string): Promise<boolean> {
  const ok = await sendSms(e164(phone), c.setup.texting_number || "", body);
  await log(sql, c, threadId, "out", author, body, ok);
  return ok;
}
async function alertOwner(c: Client, text: string) {
  const cell = e164(c.setup.owner_cell || "");
  if (cell) await sendSms(cell, c.setup.texting_number || "", text);
}

/** A call to the client's number went unanswered: text the caller back right away and tell the owner. */
export async function clientMissedCall(sql: Sql, c: Client, caller: string): Promise<void> {
  const t = await thread(sql, c, caller, "missed_call");
  if (t.status === "opted_out") return;
  const body = fill(wording(c.messages, "missed_call", FALLBACK.missed_call), varsFor(c));
  await log(sql, c, t.id, "in", "system", "Missed call");
  await sendToCustomer(sql, c, t.id, caller, body, "template");
  await alertOwner(c, ownerAlert("missed", e164(caller), "They got your text back. Replies are handled for you."));
}

/** The reply engine's next text, or null when it should hand off. Never throws. */
export async function draftReply(sql: Sql, c: Client, threadId: string, customerName: string) {
  const history = await sql`SELECT direction, body FROM public.client_texts WHERE thread_id = ${threadId}::uuid ORDER BY at DESC LIMIT 20` as { direction: string; body: string }[];
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const text = await claudeText({ apiKey: key, system: replySystem(c.setup, c.messages), user: replyUser(history.reverse(), customerName), label: "Client reply", model: process.env.CINDER_REPLY_MODEL?.trim() || "claude-haiku-5-5", maxTokens: 500, timeoutMs: 9000 });
    return parseDecision(text);
  } catch (e) { console.error("Client reply failed", e instanceof Error ? e.message : e); return null; }
}

/** A customer texted the client's number. */
export async function clientInboundText(sql: Sql, c: Client, from: string, body: string): Promise<void> {
  const t = await thread(sql, c, from, "text");
  await log(sql, c, t.id, "in", "customer", body);
  const [{ n: inbound }] = await sql`SELECT count(*)::int AS n FROM public.client_texts WHERE thread_id = ${t.id}::uuid AND direction = 'in' AND author = 'customer'` as { n: number }[];
  const firstText = inbound <= 1;
  // Any reply stops the quote follow-ups for that number: a person is talking now.
  await sql`UPDATE public.client_quotes SET status = 'replied' WHERE project_id = ${c.projectId}::uuid AND status = 'open' AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(from)}`;
  if (isStop(body)) {
    await sql`UPDATE public.client_threads SET status = 'opted_out', updated_at = now() WHERE id = ${t.id}::uuid`;
    await sql`UPDATE public.client_quotes SET status = 'stopped' WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(from)} AND status IN ('open','replied')`;
    return; // The carrier sends the opt-out confirmation.
  }
  if (t.status === "opted_out") { if (isStart(body)) await sql`UPDATE public.client_threads SET status = 'auto' WHERE id = ${t.id}::uuid`; else return; }
  if (t.status === "paused" || t.status === "closed") { await alertOwner(c, ownerAlert("handoff", t.customer_name || e164(from), `They texted: "${body.slice(0, 160)}"`)); return; }
  const d = await draftReply(sql, c, t.id, t.customer_name);
  const who = t.customer_name || e164(from);
  if (!d || d.handoff) {
    if (d?.reply) await sendToCustomer(sql, c, t.id, from, d.reply, "ai");
    await sendToCustomer(sql, c, t.id, from, fill(wording(c.messages, "handoff", FALLBACK.handoff), varsFor(c)), "template");
    await sql`UPDATE public.client_threads SET status = 'paused', updated_at = now() WHERE id = ${t.id}::uuid`;
    await alertOwner(c, ownerAlert("handoff", who, d?.summary || `They texted: "${body.slice(0, 160)}"`));
    return;
  }
  await sendToCustomer(sql, c, t.id, from, d.reply, "ai");
  if (d.stage === "booked") {
    await sql`UPDATE public.client_threads SET status = 'booked', updated_at = now() WHERE id = ${t.id}::uuid`;
    await alertOwner(c, ownerAlert("booked", who, d.summary));
  } else if (firstText) await alertOwner(c, ownerAlert("new", who, d.summary));
}

/** Morning job: send every quote follow-up that's due today, across all clients. */
export async function runQuoteFollowUps(sql: Sql, today: string, limit = 60): Promise<{ sent: number; skipped: number }> {
  const quotes = await sql`SELECT q.id, q.owner_id, q.project_id, q.customer_phone, q.customer_name, q.sent_on, q.steps_sent, q.kind
    FROM public.client_quotes q WHERE q.status = 'open' ORDER BY q.sent_on LIMIT 1000` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; sent_on: string; steps_sent: number; kind: string }[];
  let sent = 0, skipped = 0;
  for (const q of quotes) {
    if (sent >= limit) break;
    const seq = q.kind === "rehash" ? SEQUENCES.rehash : SEQUENCES.quote;
    const step = quoteStepDue(String(q.sent_on).slice(0, 10), q.steps_sent, today, seq.days);
    if (step === null) continue;
    const c = await clientById(sql, q.owner_id, q.project_id);
    if (!c?.setup.texting_number) { skipped++; continue; }
    const t = await thread(sql, c, q.customer_phone, "quote");
    if (t.status === "opted_out" || t.status === "paused") { skipped++; continue; }
    const body = fill(wording(c.messages, `${q.kind === "rehash" ? "rehash" : "quote"}_${step + 1}`, seq.texts[step]), varsFor(c, q.customer_name.split(" ")[0]));
    const ok = await sendToCustomer(sql, c, t.id, q.customer_phone, body, "template");
    await sql`UPDATE public.client_quotes SET steps_sent = steps_sent + 1, last_step_at = now(),
      status = CASE WHEN steps_sent + 1 >= ${seq.days.length} THEN 'lost' ELSE status END WHERE id = ${q.id}::uuid`;
    if (ok) sent++; else skipped++;
  }
  return { sent, skipped };
}

/** After a finished job: ask for a Google review, once per customer. */
export async function sendReviewRequest(sql: Sql, c: Client, phone: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!c.setup.review_link) return { ok: false, error: "Add the client's Google review link in the setup sheet first." };
  if (!c.setup.texting_number) return { ok: false, error: "Add the client's texting number in the setup sheet first." };
  const [dup] = await sql`SELECT 1 FROM public.client_reviews WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(phone)} LIMIT 1`;
  if (dup) return { ok: false, error: "That customer already got a review request." };
  const t = await thread(sql, c, phone, "review");
  if (t.status === "opted_out") return { ok: false, error: "That customer opted out of texts." };
  const ok = await sendToCustomer(sql, c, t.id, phone, fill(wording(c.messages, "review", REVIEW_TEXT), varsFor(c, name.split(" ")[0])), "template");
  if (ok) await sql`INSERT INTO public.client_reviews (owner_id, project_id, customer_phone, customer_name) VALUES (${c.owner}, ${c.projectId}::uuid, ${e164(phone)}, ${name})`;
  return ok ? { ok } : { ok, error: "The text didn't send. Check the texting number and registration." };
}
