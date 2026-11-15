// Closing jobs, on the server: quotes the customer approves from a link, the Google review ask the day after the
// install, and win-back texts to past customers who agreed to offers. Every send goes through the same rules as
// the rest of Cinder: the client's number, texting hours, opt-outs, and everything logged on the conversation.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { cleanItems } from "@/lib/billing";
import { cleanWinback, detailLine, cleanDetails, money, quoteText, reviewDue, QUOTE_TOKEN } from "@/lib/crm";
import { digits10, fill, inTextingHours } from "@/lib/client-runtime";
import { alertOwner, clientById, quoteUrl, sendReviewRequest, sendToCustomer, type Client } from "@/lib/client-runtime-run";
import { emitEvent } from "@/lib/client-webhook";

type Sql = NeonQueryFunction<false, false>;
const tz = (c: Client) => c.setup.timezone || "America/Denver";
const todayIn = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: tz(c) });
const first = (name: string) => (name || "").trim().split(" ")[0] || "";

/** The customer's latest open quote, with a link token made the first time it's needed. */
async function openQuoteFor(sql: Sql, c: Client, phone: string) {
  const [q] = await sql`SELECT id, token, amount::float AS amount, customer_name FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open', 'replied')
    AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(phone)} ORDER BY created_at DESC LIMIT 1` as { id: string; token: string | null; amount: number | null; customer_name: string }[];
  if (!q) return null;
  if (!q.token) { q.token = randomBytes(18).toString("base64url"); await sql`UPDATE public.client_quotes SET token = ${q.token} WHERE id = ${q.id}::uuid AND token IS NULL`; }
  return q as { id: string; token: string; amount: number | null; customer_name: string };
}

/**
 * Text the customer their quote as a link they can approve. The owner asked for it, so it goes out right away, but
 * only in texting hours (8 AM to 8 PM their time): after that the quote is saved and the owner sends it in the morning.
 */
export async function sendQuoteLink(sql: Sql, c: Client, threadId: string, note?: string, send = true): Promise<{ ok: boolean; sent: boolean; url?: string; error?: string }> {
  const [t] = await sql`SELECT id, customer_phone, customer_name, status, details FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; customer_phone: string; customer_name: string; status: string; details: unknown }[];
  if (!t) return { ok: false, sent: false, error: "Not found." };
  const q = await openQuoteFor(sql, c, t.customer_phone);
  if (!q) return { ok: false, sent: false, error: "Move them to Quoted first." };
  if (typeof note === "string") await sql`UPDATE public.client_quotes SET note = ${note.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, 600)} WHERE id = ${q.id}::uuid`;
  const url = quoteUrl(q.token);
  if (!send) return { ok: true, sent: false, url };
  if (t.status === "opted_out") return { ok: true, sent: false, url, error: "They opted out of texts. Copy the link and email it instead." };
  if (!c.setup.texting_number) return { ok: true, sent: false, url, error: "Your texting number isn't connected yet. Copy the link and send it yourself." };
  if (!inTextingHours(tz(c))) return { ok: true, sent: false, url, error: "It's outside texting hours (8 AM to 8 PM). The quote's saved: send the link in the morning." };
  const line = detailLine(c.setup.trade, cleanDetails(c.setup.trade, t.details));
  const ok = await sendToCustomer(sql, c, t.id, t.customer_phone, quoteText({ first: first(t.customer_name || q.customer_name), business: c.setup.display_name || "", amount: q.amount, line, url }), "owner");
  if (ok) await sql`UPDATE public.client_quotes SET link_sent_at = now() WHERE id = ${q.id}::uuid`;
  return ok ? { ok: true, sent: true, url } : { ok: false, sent: false, url, error: "The text didn't send. Copy the link and send it yourself." };
}

export type PublicQuote = { business: string; owner: string; phone: string; customer: string; amount: number | null; line: string; note: string; sent: string;
  items: { name: string; qty: number; unit: string; price: number }[]; tax_rate: number;
  state: "open" | "approved" | "declined" | "closed"; answeredAt: string | null;
  /** A deposit to hold the date, paid on the owner's own pay page. Cinder never takes the money. */
  deposit: number | null; payLink: string };

/** What the customer sees behind the link. Nothing else about the business or other customers. Marks it viewed. */
export async function publicQuote(sql: Sql, token: string): Promise<PublicQuote | null> {
  if (!QUOTE_TOKEN.test(token)) return null;
  const [q] = await sql`SELECT q.id, q.owner_id, q.project_id, q.customer_phone, q.customer_name, q.amount::float AS amount, q.note, q.sent_on::text AS sent_on, q.status,
      q.approved_at, q.declined_at, q.viewed_at, q.items, q.tax_rate::float AS tax_rate, q.deposit::float AS deposit
    FROM public.client_quotes q WHERE q.token = ${token} LIMIT 1` as Record<string, unknown>[];
  if (!q) return null;
  const c = await clientById(sql, String(q.owner_id), String(q.project_id));
  if (!c) return null;
  const [t] = await sql`SELECT customer_name, details FROM public.client_threads WHERE project_id = ${c.projectId}::uuid
    AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(String(q.customer_phone))} LIMIT 1` as { customer_name: string; details: unknown }[];
  if (!q.viewed_at) await sql`UPDATE public.client_quotes SET viewed_at = now() WHERE id = ${String(q.id)}::uuid AND viewed_at IS NULL`;
  const status = String(q.status);
  return {
    business: c.setup.display_name || "", owner: first(c.setup.owner_name || ""), phone: c.setup.texting_number || "",
    customer: first(t?.customer_name || String(q.customer_name || "")), amount: q.amount == null ? null : Number(q.amount),
    line: t ? detailLine(c.setup.trade, cleanDetails(c.setup.trade, t.details)) : "", note: String(q.note ?? ""), sent: String(q.sent_on),
    items: cleanItems(q.items), tax_rate: Number(q.tax_rate ?? 0),
    state: q.approved_at ? "approved" : q.declined_at ? "declined" : status === "won" ? "closed" : "open",
    answeredAt: q.approved_at ? new Date(String(q.approved_at)).toISOString() : q.declined_at ? new Date(String(q.declined_at)).toISOString() : null,
    deposit: q.deposit == null ? null : Number(q.deposit), payLink: c.setup.pay_link || "",
  };
}

/**
 * The customer approved (or passed on) the quote. Approve: the job is won, follow-ups stop, the owner hears right away.
 * Pass: follow-ups stop and the owner hears why, if they said. Answering twice changes nothing.
 */
export async function answerQuote(sql: Sql, token: string, answer: "approve" | "decline", reason = ""): Promise<{ ok: boolean; state?: PublicQuote["state"]; error?: string }> {
  if (!QUOTE_TOKEN.test(token)) return { ok: false, error: "This quote link isn't valid." };
  const approve = answer === "approve";
  const [q] = await sql`UPDATE public.client_quotes SET status = ${approve ? "won" : "lost"}, last_step_at = now(),
      approved_at = CASE WHEN ${approve}::boolean THEN now() ELSE approved_at END, declined_at = CASE WHEN ${approve}::boolean THEN declined_at ELSE now() END
    WHERE token = ${token} AND approved_at IS NULL AND declined_at IS NULL AND status <> 'won'
    RETURNING id, owner_id, project_id, customer_phone, customer_name, amount::float AS amount` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; amount: number | null }[];
  if (!q) { const now = await publicQuote(sql, token); return now ? { ok: true, state: now.state } : { ok: false, error: "This quote link isn't valid." }; }
  const c = await clientById(sql, q.owner_id, q.project_id);
  if (!c) return { ok: true, state: approve ? "approved" : "declined" };
  const [t] = await sql`UPDATE public.client_threads SET stage = ${approve ? "won" : "lost"}, stage_at = now(), value = coalesce(${q.amount}::numeric, value),
      status = CASE WHEN status = 'opted_out' THEN status ELSE 'closed' END, updated_at = now()
    WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(q.customer_phone)}
    RETURNING id, customer_name` as { id: string; customer_name: string }[];
  const name = t?.customer_name || q.customer_name || q.customer_phone;
  const why = reason.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300);
  if (t) await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'in', 'system',
    ${approve ? `Approved the quote online${q.amount ? `: ${money(q.amount)}` : ""}` : `Passed on the quote online${why ? `: "${why}"` : ""}`})`;
  await alertOwner(c, approve
    ? `Cinder · Quote approved: ${name}${q.amount ? `, ${money(q.amount)}` : ""}. Text them to set the install date.`
    : `Cinder · Quote declined: ${name}${why ? `. They said: "${why}"` : ". They didn't say why"}. Follow-ups stopped.`, t?.id, sql);
  void emitEvent(c.setup, c.projectId, approve ? "job.won" : "job.lost", { customer: { id: t?.id ?? "", name, phone: q.customer_phone }, amount: q.amount, via: "customer", reason: why || undefined });
  return { ok: true, state: approve ? "approved" : "declined" };
}

/**
 * Morning job: the Google review ask, the day after the install, for every won job the owner said to ask for.
 * Once per customer, ever (sendReviewRequest checks). A job that can't be asked yet stays queued; one that never can is dropped.
 */
export async function runAutoReviews(sql: Sql, limit = 60): Promise<{ sent: number; skipped: number }> {
  const rows = await sql`SELECT t.id, t.owner_id, t.project_id, t.customer_phone, t.customer_name, t.install_on::text AS install_on FROM public.client_threads t
    WHERE t.review_auto AND t.install_on IS NOT NULL AND t.install_on < current_date + 1 AND t.status <> 'opted_out' ORDER BY t.install_on LIMIT 400` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; install_on: string }[];
  const clients = new Map<string, Client | null>();
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (sent >= limit) break;
    const key = r.owner_id + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, r.owner_id, r.project_id));
    const c = clients.get(key);
    if (!c || !reviewDue(r.install_on, todayIn(c))) continue;
    if (!inTextingHours(tz(c))) { skipped++; continue; }
    const res = await sendReviewRequest(sql, c, r.customer_phone, r.customer_name);
    // Sent, already asked, or no review link / opted out: either way this one is done. A failed send tries again next run.
    if (res.ok || !/didn't send/.test(res.error ?? "")) await sql`UPDATE public.client_threads SET review_auto = false WHERE id = ${r.id}::uuid`;
    if (res.ok) sent++; else skipped++;
  }
  return { sent, skipped };
}

/** Ask for the review now: the owner tapped "Job done". */
export async function reviewNow(sql: Sql, c: Client, threadId: string): Promise<{ ok: boolean; error?: string }> {
  const [t] = await sql`SELECT customer_phone, customer_name FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { customer_phone: string; customer_name: string }[];
  if (!t) return { ok: false, error: "Not found." };
  const r = await sendReviewRequest(sql, c, t.customer_phone, t.customer_name);
  if (r.ok || /already/.test(r.error ?? "")) await sql`UPDATE public.client_threads SET review_auto = false WHERE id = ${threadId}::uuid`;
  return r.ok ? { ok: true } : { ok: false, error: /already/.test(r.error ?? "") ? "They already got a review request." : r.error || "The text didn't send." };
}

/**
 * Past customers: won jobs at least a month old. Only those who agreed to offers (the box on the website form) can get a
 * win-back text; everyone else only ever hears about their own job. Each customer gets one at most every 90 days.
 */
export async function winbackAudience(sql: Sql, c: Client): Promise<{ past: number; eligible: { id: string; name: string; phone: string }[] }> {
  const rows = await sql`SELECT t.id, t.customer_name, t.customer_phone,
      EXISTS (SELECT 1 FROM public.client_consent k WHERE k.project_id = t.project_id AND k.evidence ILIKE '%opted in to promo texts%'
        AND right(regexp_replace(k.phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10)) AS agreed,
      (t.winback_at IS NOT NULL AND t.winback_at > now() - interval '90 days') AS recent
    FROM public.client_threads t
    WHERE t.project_id = ${c.projectId}::uuid AND t.status <> 'opted_out'
      AND (t.stage = 'won' OR (t.stage IS NULL AND EXISTS (SELECT 1 FROM public.client_quotes q WHERE q.project_id = t.project_id AND q.status = 'won'
        AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10))))
      AND coalesce(t.stage_at, t.updated_at) < now() - interval '30 days'
    ORDER BY t.customer_name LIMIT 2000` as { id: string; customer_name: string; customer_phone: string; agreed: boolean; recent: boolean }[];
  return { past: rows.length, eligible: rows.filter(r => r.agreed && !r.recent).map(r => ({ id: r.id, name: r.customer_name, phone: r.customer_phone })) };
}

/** Send the owner's win-back text to every eligible past customer. Replies go to Cinder, like any lead. */
export async function sendWinback(sql: Sql, c: Client, body: unknown, limit = 150): Promise<{ ok: boolean; sent?: number; left?: number; error?: string }> {
  const clean = cleanWinback(body, c.setup.display_name || "");
  if (!clean.ok) return { ok: false, error: clean.error };
  if (!c.setup.texting_number) return { ok: false, error: "Your texting number isn't connected yet." };
  if (!inTextingHours(tz(c))) return { ok: false, error: "It's outside texting hours (8 AM to 8 PM). Send it in the morning." };
  const { eligible } = await winbackAudience(sql, c);
  if (!eligible.length) return { ok: false, error: "No past customers can get this text right now." };
  let sent = 0;
  for (const r of eligible.slice(0, limit)) {
    // Claim first, so a double tap never texts anyone twice.
    const [claimed] = await sql`UPDATE public.client_threads SET winback_at = now(), status = 'auto', updated_at = now()
      WHERE id = ${r.id}::uuid AND (winback_at IS NULL OR winback_at < now() - interval '90 days') AND status <> 'opted_out' RETURNING id`;
    if (!claimed) continue;
    const ok = await sendToCustomer(sql, c, r.id, r.phone, fill(clean.text, { first: first(r.name), business: c.setup.display_name, owner: c.setup.owner_name }), "owner");
    if (ok) sent++;
  }
  return { ok: true, sent, left: Math.max(0, eligible.length - limit) };
}
