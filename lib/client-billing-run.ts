// Jobber's core, on the server, without the bloat: quote lines the owner checks and sends himself, installs on his
// Google Calendar, invoices paid through his own pay link (Cinder never holds money), payment reminders, and one
// list of every customer. Every write is scoped to the signed-in owner's business; every text is logged.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { chosen, cleanItems, cleanTax, fillInvoice, invoiceText, reminderDue, REMINDER_TEXTS, totals, INVOICE_TOKEN, dollars, type Item } from "@/lib/billing";
import { cleanDate, cleanDetails, cleanPayMethod, detailLine, type Payment } from "@/lib/crm";
import { changeOrderLines, lateFeeOn, refundProblem } from "@/lib/service";
import { qboDeletePayment, qboSyncInvoice, qboSyncPayment } from "@/lib/qbo";
import { digits10, inTextingHours } from "@/lib/client-runtime";
import { alertOwner, appOrigin, clientById, sendToCustomer, type Client } from "@/lib/client-runtime-run";
import { clientCalendar, createAllDayEvent, createEvent, deleteEvent } from "@/lib/client-calendar";
import { emitEvent } from "@/lib/client-webhook";

type Sql = NeonQueryFunction<false, false>;
const tz = (c: Client) => c.setup.timezone || "America/Denver";
const todayIn = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: tz(c) });
const first = (s: string) => (s || "").trim().split(" ")[0] || "";
const phoneMatch = (a: string) => digits10(a);
export const invoiceUrl = (token: string) => `${appOrigin()}/i/${token}`;
const prettyDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

async function threadOf(sql: Sql, c: Client, id: string) {
  const [t] = await sql`SELECT id, customer_name, customer_phone, status, details, value::float AS value, install_on::text AS install_on, install_time, install_days, install_event_id
    FROM public.client_threads WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; customer_name: string; customer_phone: string; status: string; details: unknown; value: number | null;
      install_on: string | null; install_time: string | null; install_days: number; install_event_id: string | null }[];
  return t ?? null;
}

// ---------- Quote lines ----------
/** The owner's lines and tax on the customer's open quote; the quote amount becomes their total. Sending is separate. */
export async function saveQuoteLines(sql: Sql, c: Client, threadId: string, input: { items: unknown; tax?: unknown; note?: string; deposit?: unknown }): Promise<{ ok: boolean; total?: number; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const items = cleanItems(input.items);
  if (!items.length) return { ok: false, error: "Add at least one line with a price." };
  const tax = cleanTax(input.tax ?? c.setup.tax_rate ?? 0);
  // With options the amount on file is the first option plus what's always included; the customer's pick replaces it.
  const { total } = totals(chosen(items, null), tax);
  // A deposit the customer pays through the owner's own pay link once they approve. Never more than the quote.
  const depN = input.deposit === undefined ? undefined : Math.round(Number(String(input.deposit ?? "").replace(/[$,\s]/g, "")) || 0);
  const deposit = depN === undefined ? undefined : depN > 0 && depN <= total ? depN : null;
  const [q] = await sql`UPDATE public.client_quotes SET items = ${JSON.stringify(items)}::jsonb, tax_rate = ${tax}, amount = ${total},
      deposit = CASE WHEN ${deposit === undefined}::boolean THEN deposit ELSE ${deposit ?? null}::numeric END,
      note = CASE WHEN ${typeof input.note === "string"}::boolean THEN ${String(input.note ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, 600)} ELSE note END
    WHERE id = (SELECT id FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open', 'replied')
      AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${phoneMatch(t.customer_phone)} ORDER BY created_at DESC LIMIT 1) RETURNING id`;
  if (!q) return { ok: false, error: "Move them to Quoted first." };
  await sql`UPDATE public.client_threads SET value = ${total}, updated_at = now() WHERE id = ${t.id}::uuid`;
  return { ok: true, total };
}

// ---------- The install on Google Calendar ----------
/**
 * When the install is: a day (and a start time, or all day) and how many days it runs. Put on the owner's Google
 * Calendar when it's connected; a change replaces the old event, clearing the date removes it.
 */
export async function scheduleInstall(sql: Sql, c: Client, threadId: string, input: { date?: unknown; time?: unknown; days?: unknown }): Promise<{ ok: boolean; calendar: "added" | "removed" | "not_connected" | "failed" | "none"; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, calendar: "none", error: "Not found." };
  const date = cleanDate(input.date);
  const time = typeof input.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ? input.time : null;
  const days = Math.min(14, Math.max(1, Math.round(Number(input.days) || 1)));
  const same = date === t.install_on && time === (t.install_time ?? null) && days === (t.install_days || 1);
  await sql`UPDATE public.client_threads SET install_on = ${date}::date, install_time = ${time}, install_days = ${days}, updated_at = now() WHERE id = ${t.id}::uuid`;
  if (same && (t.install_event_id || !date)) return { ok: true, calendar: "none" };
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (!cal) return { ok: true, calendar: date ? "not_connected" : "none" };
  try {
    if (t.install_event_id) { await deleteEvent(cal, t.install_event_id); await sql`UPDATE public.client_threads SET install_event_id = NULL WHERE id = ${t.id}::uuid`; }
    if (!date) return { ok: true, calendar: t.install_event_id ? "removed" : "none" };
    const d = cleanDetails(c.setup.trade, t.details);
    const who = t.customer_name || t.customer_phone;
    const details = [detailLine(c.setup.trade, d), d.address ? `Address: ${d.address}` : "", `Phone: ${t.customer_phone}`, t.value ? `Job: ${dollars(t.value)}` : "", "Scheduled in Cinder."].filter(Boolean).join("\n");
    let id: string;
    if (time && days === 1) {
      const start = new Date(`${date}T${time}:00`); // wall time; Google applies the time zone below
      const end = new Date(start.getTime() + 8 * 3600000);
      const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}T${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}:00`;
      id = await createEvent(cal, { start: fmt(start), end: fmt(end), tz: tz(c), title: `Install: ${who}`, details });
    } else id = await createAllDayEvent(cal, { date, days, title: `Install: ${who}${days > 1 ? ` (${days} days)` : ""}`, details });
    await sql`UPDATE public.client_threads SET install_event_id = ${id} WHERE id = ${t.id}::uuid`;
    return { ok: true, calendar: "added" };
  } catch (e) { console.error("Install calendar failed", e instanceof Error ? e.message : e); return { ok: true, calendar: "failed" }; }
}

// ---------- Invoices ----------
export type Invoice = { id: string; number: number; status: string; items: Item[]; tax_rate: number; total: number; note: string; due_on: string | null;
  sent_at: string | null; viewed_at: string | null; paid_at: string | null; paid_claimed_at: string | null; reminders: number; reminders_paused: boolean; url: string | null; paid_amount: number };
const asInvoice = (r: Record<string, unknown>): Invoice => ({
  id: String(r.id), number: Number(r.number), status: String(r.status), items: cleanItems(r.items), tax_rate: Number(r.tax_rate ?? 0), total: Number(r.total ?? 0), note: String(r.note ?? ""),
  due_on: r.due_on ? String(r.due_on).slice(0, 10) : null, sent_at: r.sent_at ? new Date(String(r.sent_at)).toISOString() : null, viewed_at: r.viewed_at ? new Date(String(r.viewed_at)).toISOString() : null,
  paid_at: r.paid_at ? new Date(String(r.paid_at)).toISOString() : null, paid_claimed_at: r.paid_claimed_at ? new Date(String(r.paid_claimed_at)).toISOString() : null,
  reminders: Number(r.reminders ?? 0), reminders_paused: !!r.reminders_paused, url: r.token ? invoiceUrl(String(r.token)) : null,
  paid_amount: Number(r.paid_amount ?? 0),
});

const round2 = (n: number) => Math.round(n * 100) / 100;
/**
 * Paid in full: the right moment for the Google review ask. It goes out about two hours later, inside texting hours,
 * once per customer ever. The owner can turn this off (review_on_paid = no) or cancel one from the record.
 */
export async function queueReview(sql: Sql, c: Client, threadId: string) {
  if (!c.setup.review_link || c.setup.review_on_paid === "no") return;
  await sql`UPDATE public.client_threads t SET review_after = now() + interval '2 hours' WHERE t.id = ${threadId}::uuid AND t.review_after IS NULL AND t.status <> 'opted_out'
    AND NOT EXISTS (SELECT 1 FROM public.client_reviews r WHERE r.project_id = t.project_id AND right(regexp_replace(r.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10))`;
}
/** Adds up what came in on an invoice and settles its status: paid in full, or back to sent when a payment is removed. */
async function settle(sql: Sql, c: Client, invoiceId: string): Promise<{ total: number; paid: number; status: string; number: number; thread_id: string } | null> {
  const [r] = await sql`UPDATE public.client_invoices i SET paid_amount = coalesce((SELECT sum(amount) FROM public.client_payments p WHERE p.invoice_id = i.id), 0)
    WHERE i.id = ${invoiceId}::uuid AND i.project_id = ${c.projectId}::uuid RETURNING i.total::float AS total, i.paid_amount::float AS paid, i.status, i.number, i.thread_id, i.sent_at` as { total: number; paid: number; status: string; number: number; thread_id: string; sent_at: string | null }[];
  if (!r) return null;
  if (r.status !== "void") {
    const full = r.paid >= r.total - 0.005 && r.total > 0;
    if (full && r.status !== "paid") { await sql`UPDATE public.client_invoices SET status = 'paid', paid_at = now(), reminders_paused = true WHERE id = ${invoiceId}::uuid`; await queueReview(sql, c, r.thread_id); }
    if (!full && r.status === "paid") await sql`UPDATE public.client_invoices SET status = CASE WHEN sent_at IS NULL THEN 'draft' ELSE 'sent' END, paid_at = NULL WHERE id = ${invoiceId}::uuid`;
    r.status = full ? "paid" : r.status === "paid" ? (r.sent_at ? "sent" : "draft") : r.status;
  }
  return r;
}

/** Records money that came in on an invoice: all of it, or part (a deposit, a progress payment). Never more than the balance. */
export async function recordPayment(sql: Sql, c: Client, invoiceId: string, input: { amount?: unknown; method?: unknown; on?: unknown; note?: unknown }): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const [inv] = await sql`SELECT id, thread_id, number, total::float AS total, paid_amount::float AS paid, status FROM public.client_invoices WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; thread_id: string; number: number; total: number; paid: number; status: string }[];
  if (!inv) return { ok: false, error: "That invoice isn't here." };
  if (inv.status === "void") return { ok: false, error: "That invoice was voided." };
  const balance = round2(inv.total - inv.paid);
  const amount = round2(Number(String(input.amount ?? "").replace(/[$,\s]/g, "")));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Type the amount, like 1500." };
  if (amount > balance + 0.005) return { ok: false, error: `That's more than the ${dollars(balance)} still owed.` };
  const on = cleanDate(input.on) ?? new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });
  const method = cleanPayMethod(input.method);
  const note = String(input.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  const [ins] = await sql`INSERT INTO public.client_payments (owner_id, project_id, invoice_id, thread_id, amount, method, paid_on, note) VALUES (${c.owner}, ${c.projectId}::uuid, ${inv.id}::uuid, ${inv.thread_id}::uuid, ${amount}, ${method}, ${on}::date, ${note}) RETURNING id` as { id: string }[];
  const s = await settle(sql, c, inv.id);
  await qboSyncPayment(sql, c.projectId, ins.id);
  const left = s ? round2(s.total - s.paid) : 0;
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${inv.thread_id}::uuid, 'out', 'system',
    ${left > 0 ? `Payment of ${dollars(amount)} recorded on invoice #${inv.number}. ${dollars(left)} still owed.` : `Invoice #${inv.number} paid in full: ${dollars(amount)} came in.`})`;
  if (left <= 0) void emitEvent(c.setup, c.projectId, "invoice.paid", { customer: { id: inv.thread_id }, number: inv.number, total: inv.total });
  return { ok: true, balance: left };
}

/** Takes a recorded payment back off (typed wrong). The invoice goes back to owing that amount. */
export async function deletePayment(sql: Sql, c: Client, paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const [p] = await sql`DELETE FROM public.client_payments WHERE id = ${paymentId}::uuid AND project_id = ${c.projectId}::uuid RETURNING invoice_id, qbo_id` as { invoice_id: string; qbo_id: string }[];
  if (!p) return { ok: false, error: "That payment was already removed." };
  await settle(sql, c, p.invoice_id);
  await qboDeletePayment(sql, c.projectId, p.qbo_id);
  return { ok: true };
}

/**
 * Money given back on an invoice. It lowers what the invoice charged by the same amount, so the balance stays where it
 * was (no reminders, no reopening) and collected money goes down. Typed wrong? Delete it. The money itself goes back
 * through the owner's own account; this only records it.
 */
export async function recordRefund(sql: Sql, c: Client, invoiceId: string, input: { amount?: unknown; method?: unknown; on?: unknown; note?: unknown }): Promise<{ ok: boolean; error?: string }> {
  const [inv] = await sql`SELECT i.id, i.thread_id, i.number, i.status,
      coalesce((SELECT sum(amount) FROM public.client_payments p WHERE p.invoice_id = i.id), 0)::float AS paid,
      coalesce((SELECT sum(amount) FROM public.client_refunds r WHERE r.invoice_id = i.id), 0)::float AS refunded
    FROM public.client_invoices i WHERE i.id = ${invoiceId}::uuid AND i.project_id = ${c.projectId}::uuid` as { id: string; thread_id: string; number: number; status: string; paid: number; refunded: number }[];
  if (!inv) return { ok: false, error: "That invoice isn't here." };
  if (inv.status === "void") return { ok: false, error: "That invoice was voided." };
  const amount = round2(Number(String(input.amount ?? "").replace(/[$,\s]/g, "")));
  const problem = refundProblem(inv.paid, inv.refunded, amount);
  if (problem) return { ok: false, error: problem };
  const on = cleanDate(input.on) ?? new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });
  const note = String(input.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  await sql`INSERT INTO public.client_refunds (owner_id, project_id, invoice_id, thread_id, amount, method, refunded_on, note) VALUES (${c.owner}, ${c.projectId}::uuid, ${inv.id}::uuid, ${inv.thread_id}::uuid, ${amount}, ${cleanPayMethod(input.method)}, ${on}::date, ${note})`;
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${inv.thread_id}::uuid, 'out', 'system', ${`Refund of ${dollars(amount)} recorded on invoice #${inv.number}${note ? `: ${note}` : ""}.`})`;
  return { ok: true };
}
/** Takes a recorded refund back off (typed wrong). */
export async function deleteRefund(sql: Sql, c: Client, refundId: string): Promise<{ ok: boolean; error?: string }> {
  const [r] = await sql`DELETE FROM public.client_refunds WHERE id = ${refundId}::uuid AND project_id = ${c.projectId}::uuid RETURNING id` as { id: string }[];
  return r ? { ok: true } : { ok: false, error: "That refund was already removed." };
}

/** Every payment recorded, newest first: the Money screen's payments list and the invoice sheet's history. */
export async function loadPayments(sql: Sql, c: Client, limit = 200): Promise<Payment[]> {
  const rows = await sql`SELECT p.id, p.invoice_id, p.thread_id, p.amount::float AS amount, p.method, p.paid_on::text AS paid_on, p.note, i.number, t.customer_name
    , false AS refund, p.created_at FROM public.client_payments p JOIN public.client_invoices i ON i.id = p.invoice_id JOIN public.client_threads t ON t.id = p.thread_id
    WHERE p.project_id = ${c.projectId}::uuid
    UNION ALL
    SELECT r.id, r.invoice_id, r.thread_id, -r.amount::float, r.method, r.refunded_on::text, r.note, i.number, t.customer_name, true, r.created_at
    FROM public.client_refunds r JOIN public.client_invoices i ON i.id = r.invoice_id JOIN public.client_threads t ON t.id = r.thread_id
    WHERE r.project_id = ${c.projectId}::uuid
    ORDER BY 6 DESC, 11 DESC LIMIT ${limit}` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), invoice_id: String(r.invoice_id), thread_id: String(r.thread_id), amount: Number(r.amount), method: cleanPayMethod(r.method), paid_on: String(r.paid_on).slice(0, 10), note: String(r.note ?? ""), number: Number(r.number), customer: String(r.customer_name ?? "") , ...(r.refund === true ? { refund: true } : {}) }));
}

/** A draft invoice for a won job: the quote's lines when there are some, else one line for the job value. */
/**
 * The job's invoice, pulled from the quote. With `part`, a progress invoice instead: a percentage of the job, or the rest
 * of it, as one line against the job's total (change orders included), never more than what's left to bill.
 */
export async function createInvoice(sql: Sql, c: Client, threadId: string, part?: { percent?: unknown; rest?: unknown }): Promise<{ ok: boolean; invoice?: Invoice; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const progress = !!part && (part.rest === true || Number(part.percent) > 0);
  const [open] = progress ? [] : await sql`SELECT * FROM public.client_invoices WHERE thread_id = ${t.id}::uuid AND status IN ('draft', 'sent') AND plan_id IS NULL ORDER BY created_at DESC LIMIT 1` as Record<string, unknown>[];
  if (open) return { ok: true, invoice: asInvoice(open) };
  const [q] = await sql`SELECT items, tax_rate::float AS tax_rate, amount::float AS amount FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote'
    AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${phoneMatch(t.customer_phone)} ORDER BY (status = 'won') DESC, created_at DESC LIMIT 1` as { items: unknown; tax_rate: number; amount: number | null }[];
  let items = chosen(cleanItems(q?.items), null);
  const taxRate = items.length ? Number(q?.tax_rate ?? 0) : 0;
  if (!items.length) {
    const amount = t.value ?? q?.amount ?? 0;
    const line = detailLine(c.setup.trade, cleanDetails(c.setup.trade, t.details));
    items = [{ name: line ? `${line}, installed` : "Job", qty: 1, unit: "", price: amount }];
  }
  const cos = await sql`SELECT id, number, items FROM public.client_change_orders WHERE thread_id = ${t.id}::uuid AND status = 'approved' AND invoice_id IS NULL ORDER BY number` as { id: string; number: number; items: unknown }[];
  for (const co of cos) items = [...items, ...changeOrderLines({ number: co.number, items: cleanItems(co.items) })].slice(0, 30);
  let progressTax = taxRate;
  if (progress) {
    const full = totals(items, taxRate).total;
    const [b] = await sql`SELECT coalesce(sum(total), 0)::float AS billed FROM public.client_invoices WHERE thread_id = ${t.id}::uuid AND plan_id IS NULL AND status <> 'void'` as { billed: number }[];
    const left = Math.round((full - (b?.billed ?? 0)) * 100) / 100;
    if (!(full > 0)) return { ok: false, error: "Set the job's price first (on the quote or the job)." };
    if (left <= 0.005) return { ok: false, error: "Everything on this job is already billed." };
    const pct = Math.min(100, Math.max(1, Math.round(Number(part!.percent) || 0)));
    const amount = part!.rest === true ? left : Math.min(left, Math.round(full * pct) / 100);
    const label = detailLine(c.setup.trade, cleanDetails(c.setup.trade, t.details)) || "the job";
    const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    items = [{ name: part!.rest === true ? `Balance for ${label} (job total ${money(full)}, ${money(full - left)} billed before)` : `${pct}% of ${label} (job total ${money(full)})`, qty: 1, unit: "", price: amount }];
    progressTax = 0;
  }
  const days = Number(c.setup.invoice_days ?? 7) || 0;
  const due = new Date(Date.parse(todayIn(c) + "T12:00:00Z") + days * 86400000).toISOString().slice(0, 10);
  const { total } = totals(items, progressTax);
  // Numbers start at 1001 per business; a clash (two taps at once) retries once with the next number.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [r] = await sql`INSERT INTO public.client_invoices (owner_id, project_id, thread_id, number, items, tax_rate, total, due_on)
        VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, (SELECT coalesce(max(number), 1000) + 1 FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid),
          ${JSON.stringify(items)}::jsonb, ${progressTax}, ${total}, ${due}::date) RETURNING *` as Record<string, unknown>[];
      if (cos.length && !progress) await sql`UPDATE public.client_change_orders SET invoice_id = ${String(r.id)}::uuid WHERE id = ANY(${cos.map(x => x.id)}::uuid[])`;
      return { ok: true, invoice: asInvoice(r) };
    } catch (e) { if (attempt) { console.error("Invoice create failed", e instanceof Error ? e.message : e); return { ok: false, error: "Couldn't make the invoice. Try again." }; } }
  }
  return { ok: false, error: "Couldn't make the invoice." };
}

/** Change the lines, tax, note or due date. A paid or voided invoice is final. */
export async function saveInvoice(sql: Sql, c: Client, invoiceId: string, input: { items?: unknown; tax?: unknown; note?: unknown; due?: unknown }): Promise<{ ok: boolean; error?: string }> {
  const items = input.items === undefined ? null : cleanItems(input.items);
  if (items && !items.length) return { ok: false, error: "Add at least one line with a price." };
  const [cur] = await sql`SELECT items, tax_rate::float AS tax_rate FROM public.client_invoices WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('draft', 'sent')` as { items: unknown; tax_rate: number }[];
  if (!cur) return { ok: false, error: "That invoice can't be changed." };
  const nextItems = items ?? cleanItems(cur.items), tax = input.tax === undefined ? Number(cur.tax_rate) : cleanTax(input.tax);
  const due = input.due === undefined ? undefined : cleanDate(input.due);
  await sql`UPDATE public.client_invoices SET items = ${JSON.stringify(nextItems)}::jsonb, tax_rate = ${tax}, total = ${totals(nextItems, tax).total},
      note = CASE WHEN ${typeof input.note === "string"}::boolean THEN ${String(input.note ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, 600)} ELSE note END,
      due_on = CASE WHEN ${due === undefined}::boolean THEN due_on ELSE ${due ?? null}::date END
    WHERE id = ${invoiceId}::uuid`;
  await qboSyncInvoice(sql, c.projectId, invoiceId);
  return { ok: true };
}

/** Text the customer the invoice. Owner-initiated, inside texting hours; outside them it's saved for the morning. */
export async function sendInvoice(sql: Sql, c: Client, invoiceId: string): Promise<{ ok: boolean; sent: boolean; url?: string; warn?: string; error?: string }> {
  const [r] = await sql`SELECT i.*, t.customer_phone, t.customer_name, t.status AS thread_status FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
    WHERE i.id = ${invoiceId}::uuid AND i.project_id = ${c.projectId}::uuid AND i.status IN ('draft', 'sent')` as Record<string, unknown>[];
  if (!r) return { ok: false, sent: false, error: "That invoice can't be sent." };
  if (!(Number(r.total) > 0)) return { ok: false, sent: false, error: "The invoice total is $0. Add a price first." };
  let token = r.token ? String(r.token) : "";
  if (!token) { token = randomBytes(18).toString("base64url"); await sql`UPDATE public.client_invoices SET token = ${token} WHERE id = ${invoiceId}::uuid AND token IS NULL`; }
  const url = invoiceUrl(token);
  await sql`UPDATE public.client_invoices SET status = 'sent', sent_at = coalesce(sent_at, now()) WHERE id = ${invoiceId}::uuid`;
  await qboSyncInvoice(sql, c.projectId, invoiceId);
  if (r.thread_status === "opted_out") return { ok: true, sent: false, url, warn: "They opted out of texts. Copy the link and email it instead." };
  if (!c.setup.texting_number) return { ok: true, sent: false, url, warn: "Your texting number isn't connected yet. Copy the link and send it yourself." };
  if (!inTextingHours(tz(c))) return { ok: true, sent: false, url, warn: "It's outside texting hours (8 AM to 8 PM). It's ready: text it in the morning." };
  const ok = await sendToCustomer(sql, c, String(r.thread_id), String(r.customer_phone), invoiceText({ first: first(String(r.customer_name ?? "")), business: c.setup.display_name || "",
    number: Number(r.number), total: Number(r.total), due: r.due_on ? prettyDay(String(r.due_on).slice(0, 10)) : null, url }), "owner");
  if (ok) void emitEvent(c.setup, c.projectId, "invoice.sent", { customer: { id: String(r.thread_id), name: String(r.customer_name ?? ""), phone: String(r.customer_phone) }, number: Number(r.number), total: Number(r.total) });
  return ok ? { ok: true, sent: true, url } : { ok: false, sent: false, url, error: "The text didn't send. Copy the link and send it yourself." };
}

/** Paid (the owner saw the money), back to unpaid, voided, or reminders paused / resumed. */
export async function setInvoice(sql: Sql, c: Client, invoiceId: string, what: "paid" | "unpaid" | "void" | "pause" | "resume"): Promise<{ ok: boolean; error?: string }> {
  if (what === "paid") {
    const [i] = await sql`SELECT total::float AS total, paid_amount::float AS paid, status FROM public.client_invoices WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid` as { total: number; paid: number; status: string }[];
    if (i && (i.status === "draft" || i.status === "sent") && i.total - i.paid > 0.005) return recordPayment(sql, c, invoiceId, { amount: round2(i.total - i.paid), method: "other", note: "Marked paid in full" });
  }
  if (what === "unpaid") { await sql`DELETE FROM public.client_refunds WHERE invoice_id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid`; const gone = await sql`DELETE FROM public.client_payments WHERE invoice_id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid RETURNING qbo_id` as { qbo_id: string }[]; for (const g of gone) await qboDeletePayment(sql, c.projectId, g.qbo_id); }
  const r = what === "paid" ? await sql`UPDATE public.client_invoices SET status = 'paid', paid_at = now() WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('draft', 'sent') RETURNING thread_id, number, total`
    : what === "unpaid" ? await sql`UPDATE public.client_invoices SET status = CASE WHEN sent_at IS NULL THEN 'draft' ELSE 'sent' END, paid_at = NULL, paid_amount = 0 WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid AND status = 'paid' RETURNING thread_id, number, total`
    : what === "void" ? await sql`UPDATE public.client_invoices SET status = 'void' WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('draft', 'sent') RETURNING thread_id, number, total`
    : await sql`UPDATE public.client_invoices SET reminders_paused = ${what === "pause"} WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid RETURNING thread_id, number, total`;
  if (!r.length) return { ok: false, error: "That invoice was already updated." };
  const row = r[0] as { thread_id: string; number: number; total: number };
  if (what === "void") await qboSyncInvoice(sql, c.projectId, invoiceId);
  if (what === "paid" || what === "void") await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${row.thread_id}::uuid, 'out', 'system',
    ${what === "paid" ? `Invoice #${row.number} paid: ${dollars(Number(row.total))}` : `Invoice #${row.number} voided`})`;
  if (what === "paid") { void emitEvent(c.setup, c.projectId, "invoice.paid", { customer: { id: row.thread_id }, number: row.number, total: Number(row.total) }); await queueReview(sql, c, row.thread_id); }
  return { ok: true };
}

export type PublicInvoice = { business: string; owner: string; phone: string; customer: string; number: number; items: Item[]; tax_rate: number; total: number; note: string;
  due_on: string | null; issued: string; status: "open" | "paid" | "void"; pay_link: string; claimed: boolean; address: string; paid_amount: number; payments: { amount: number; paid_on: string }[]; refunds?: { amount: number; paid_on: string }[] };
/** What the customer sees behind the invoice link. Marks it viewed. */
export async function publicInvoice(sql: Sql, token: string): Promise<PublicInvoice | null> {
  if (!INVOICE_TOKEN.test(token)) return null;
  const [r] = await sql`SELECT i.*, t.customer_name, t.details FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id WHERE i.token = ${token} LIMIT 1` as Record<string, unknown>[];
  if (!r || r.status === "draft") return null;
  const c = await clientById(sql, String(r.owner_id), String(r.project_id));
  if (!c) return null;
  if (!r.viewed_at) await sql`UPDATE public.client_invoices SET viewed_at = now() WHERE id = ${String(r.id)}::uuid AND viewed_at IS NULL`;
  const d = cleanDetails(c.setup.trade, r.details);
  return { business: c.setup.display_name || "", owner: first(c.setup.owner_name || ""), phone: c.setup.texting_number || "", customer: String(r.customer_name || ""),
    number: Number(r.number), items: cleanItems(r.items), tax_rate: Number(r.tax_rate ?? 0), total: Number(r.total ?? 0), note: String(r.note ?? ""),
    due_on: r.due_on ? String(r.due_on).slice(0, 10) : null, issued: new Date(String(r.sent_at ?? r.created_at)).toISOString().slice(0, 10),
    status: r.status === "paid" ? "paid" : r.status === "void" ? "void" : "open", pay_link: c.setup.pay_link || "", claimed: !!r.paid_claimed_at, address: String(d.address ?? ""),
    paid_amount: Number(r.paid_amount ?? 0),
    payments: (await sql`SELECT amount::float AS amount, paid_on::text AS paid_on FROM public.client_payments WHERE invoice_id = ${String(r.id)}::uuid ORDER BY paid_on` as { amount: number; paid_on: string }[]).map(p => ({ amount: Number(p.amount), paid_on: String(p.paid_on).slice(0, 10) })),
    refunds: (await sql`SELECT amount::float AS amount, refunded_on::text AS paid_on FROM public.client_refunds WHERE invoice_id = ${String(r.id)}::uuid ORDER BY refunded_on`.catch(() => []) as { amount: number; paid_on: string }[]).map(p => ({ amount: Number(p.amount), paid_on: String(p.paid_on).slice(0, 10) })) };
}
/** The customer says they paid. Cinder can't see the money, so the owner checks and marks it paid. */
export async function claimPaid(sql: Sql, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!INVOICE_TOKEN.test(token)) return { ok: false, error: "This invoice link isn't valid." };
  const [r] = await sql`UPDATE public.client_invoices SET paid_claimed_at = now(), reminders_paused = true WHERE token = ${token} AND status = 'sent' AND paid_claimed_at IS NULL
    RETURNING owner_id, project_id, thread_id, number, total` as { owner_id: string; project_id: string; thread_id: string; number: number; total: number }[];
  if (!r) return { ok: true };
  const c = await clientById(sql, r.owner_id, r.project_id);
  const [t] = await sql`SELECT customer_name, customer_phone FROM public.client_threads WHERE id = ${r.thread_id}::uuid` as { customer_name: string; customer_phone: string }[];
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${r.owner_id}, ${r.thread_id}::uuid, 'in', 'system', ${`Said they paid invoice #${r.number}`})`;
  if (c) await alertOwner(c, `Cinder · ${t?.customer_name || t?.customer_phone || "A customer"} says they paid invoice #${r.number} (${dollars(Number(r.total))}). Check your account, then mark it paid in Cinder.`, r.thread_id, sql);
  return { ok: true };
}

/**
 * Daily: for owners who turned late fees on, each sent invoice past due by their number of days gets one "Late fee"
 * line (lateFeeOn), once, with a note on the customer's record. Paused reminders mean the owner is talking to them:
 * those are left alone.
 */
export async function runLateFees(sql: Sql, limit = 200): Promise<{ added: number }> {
  const rows = await sql`SELECT i.id, i.owner_id, i.project_id, i.thread_id, i.number, i.items, i.tax_rate::float AS tax_rate, (i.total - i.paid_amount)::float AS balance, i.due_on::text AS due_on, o.setup
    FROM public.client_invoices i JOIN public.client_ops o ON o.project_id = i.project_id
    WHERE i.status = 'sent' AND i.late_fee_at IS NULL AND NOT i.reminders_paused AND i.plan_id IS NULL AND coalesce(o.setup->>'late_fee', '') <> ''
      AND i.due_on IS NOT NULL AND i.due_on < current_date ORDER BY i.due_on LIMIT ${limit}` as Record<string, unknown>[];
  let added = 0;
  for (const r of rows) {
    const setup = (r.setup ?? {}) as Record<string, string>;
    const days = Math.max(1, Math.min(90, Number(setup.late_fee_days) || 15));
    if (Date.parse(String(r.due_on) + "T12:00:00Z") + days * 86400000 > Date.now()) continue;
    const fee = lateFeeOn(setup.late_fee, Number(r.balance));
    if (!(fee > 0)) continue;
    const items = [...cleanItems(r.items), { name: `Late fee, ${days} days past due`, qty: 1, unit: "", price: fee }];
    const { total } = totals(items, Number(r.tax_rate) || 0);
    // The fee line isn't taxed: totals() taxes every line, so the fee is added after tax.
    const untaxed = totals(items.slice(0, -1), Number(r.tax_rate) || 0).total + fee;
    void total;
    const [done] = await sql`UPDATE public.client_invoices SET items = ${JSON.stringify(items)}::jsonb, total = ${Math.round(untaxed * 100) / 100}, late_fee_at = now() WHERE id = ${String(r.id)}::uuid AND late_fee_at IS NULL RETURNING id`;
    if (!done) continue;
    await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${String(r.owner_id)}, ${String(r.thread_id)}::uuid, 'out', 'system', ${`Late fee of ${dollars(fee)} added to invoice #${r.number} (${days} days past due).`})`;
    await qboSyncInvoice(sql, String(r.project_id), String(r.id)).catch(() => null);
    added++;
  }
  return { added };
}

/** Daily: the payment reminders that are due, in each owner's texting hours. A reply from the customer pauses them. */
export async function runInvoiceReminders(sql: Sql, limit = 60): Promise<{ sent: number; skipped: number }> {
  const rows = await sql`SELECT i.id, i.owner_id, i.project_id, i.thread_id, i.number, (i.total - i.paid_amount)::float AS total, i.due_on::text AS due_on, i.reminders, i.reminders_paused, i.token, i.last_reminder_at,
      t.customer_phone, t.customer_name, t.status AS thread_status, t.last_in_at
    FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
    WHERE i.status = 'sent' AND NOT i.reminders_paused AND i.reminders < 3 AND i.due_on < current_date + 1 ORDER BY i.due_on LIMIT 500` as Record<string, unknown>[];
  const clients = new Map<string, Client | null>();
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (sent >= limit) break;
    const key = String(r.owner_id) + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, String(r.owner_id), String(r.project_id)));
    const c = clients.get(key);
    if (!c?.setup.texting_number || r.thread_status === "opted_out" || !r.token) { skipped++; continue; }
    // They texted back since the last reminder: a person should answer, so reminders wait for the owner.
    if (r.last_in_at && r.last_reminder_at && new Date(String(r.last_in_at)) > new Date(String(r.last_reminder_at))) { await sql`UPDATE public.client_invoices SET reminders_paused = true WHERE id = ${String(r.id)}::uuid`; skipped++; continue; }
    const step = reminderDue({ status: "sent", dueOn: String(r.due_on), reminders: Number(r.reminders), paused: false }, todayIn(c));
    if (step === null) continue;
    if (!inTextingHours(tz(c))) { skipped++; continue; }
    const [claimed] = await sql`UPDATE public.client_invoices SET reminders = reminders + 1, last_reminder_at = now() WHERE id = ${String(r.id)}::uuid AND reminders = ${step} AND status = 'sent' RETURNING id`;
    if (!claimed) continue;
    const ok = await sendToCustomer(sql, c, String(r.thread_id), String(r.customer_phone), fillInvoice(REMINDER_TEXTS[step], { first: first(String(r.customer_name ?? "")), business: c.setup.display_name || "",
      owner: first(c.setup.owner_name || ""), number: Number(r.number), total: Number(r.total), url: invoiceUrl(String(r.token)) }), "template");
    if (ok) sent++; else skipped++;
  }
  return { sent, skipped };
}

// ---------- Customers ----------
export type Customer = { id: string; name: string; phone: string; email: string; address: string; source: string; status: string; stage: string | null; since: string; last: string;
  jobs: number; spent: number; owed: number; open_quote: number | null; line: string };
/** Everyone who ever got in touch, newest activity first, with what they've bought and what they owe. */
export async function loadCustomers(sql: Sql, c: Client): Promise<Customer[]> {
  const rows = await sql`SELECT t.id, t.customer_name, t.customer_phone, t.customer_email, t.source, t.status, t.stage, t.details, t.created_at, coalesce(t.last_in_at, t.updated_at) AS last,
      coalesce(w.jobs, 0)::int AS jobs, coalesce(w.spent, 0)::float AS spent, coalesce(o.owed, 0)::float AS owed, oq.amount::float AS open_quote
    FROM public.client_threads t
    LEFT JOIN LATERAL (SELECT count(*) AS jobs, sum(coalesce(amount, 0)) AS spent FROM public.client_quotes q WHERE q.project_id = t.project_id AND q.status = 'won'
      AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10)) w ON true
    LEFT JOIN LATERAL (SELECT sum(total) AS owed FROM public.client_invoices i WHERE i.thread_id = t.id AND i.status = 'sent') o ON true
    LEFT JOIN LATERAL (SELECT amount FROM public.client_quotes q WHERE q.project_id = t.project_id AND q.kind = 'quote' AND q.status IN ('open', 'replied')
      AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10) ORDER BY q.created_at DESC LIMIT 1) oq ON true
    WHERE t.project_id = ${c.projectId}::uuid AND t.source NOT IN ('review', 'due') AND t.hidden_at IS NULL
    ORDER BY coalesce(t.last_in_at, t.updated_at) DESC LIMIT 1000` as Record<string, unknown>[];
  return rows.map(r => { const d = cleanDetails(c.setup.trade, r.details); return {
    id: String(r.id), name: String(r.customer_name || ""), phone: String(r.customer_phone), email: String(r.customer_email ?? ""), address: String(d.address ?? ""), source: String(r.source), status: String(r.status),
    stage: r.stage ? String(r.stage) : null, since: new Date(String(r.created_at)).toISOString(), last: new Date(String(r.last)).toISOString(),
    jobs: Number(r.jobs), spent: Number(r.spent), owed: Number(r.owed), open_quote: r.open_quote == null ? null : Number(r.open_quote), line: detailLine(c.setup.trade, d) }; });
}

/** Every invoice, newest first, for the Invoices view. */
export async function loadInvoices(sql: Sql, c: Client): Promise<(Invoice & { thread_id: string; customer: string; phone: string })[]> {
  const rows = await sql`SELECT i.*, t.customer_name, t.customer_phone FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
    WHERE i.project_id = ${c.projectId}::uuid AND i.status <> 'void' ORDER BY i.created_at DESC LIMIT 300` as Record<string, unknown>[];
  return rows.map(r => ({ ...asInvoice(r), thread_id: String(r.thread_id), customer: String(r.customer_name || ""), phone: String(r.customer_phone) }));
}
/** The latest invoice on each won card. */
export async function invoicesByThread(sql: Sql, c: Client): Promise<Record<string, Invoice>> {
  const rows = await sql`SELECT DISTINCT ON (thread_id) * FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid AND status <> 'void' AND plan_id IS NULL ORDER BY thread_id, created_at DESC` as Record<string, unknown>[];
  return Object.fromEntries(rows.map(r => [String(r.thread_id), asInvoice(r)]));
}
