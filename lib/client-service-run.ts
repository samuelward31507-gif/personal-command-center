// Service plans, change orders and crew hours on the server. Every write is scoped to the signed-in owner's business;
// every text is logged on the customer's thread. Money still only moves through the owner's own pay link.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { cleanItems, totals, dollars, type Item } from "@/lib/billing";
import { inTextingHours } from "@/lib/client-runtime";
import { alertOwner, appOrigin, clientById, sendToCustomer, type Client } from "@/lib/client-runtime-run";
import { sendInvoice } from "@/lib/client-billing-run";
import { qboSyncInvoice } from "@/lib/qbo";
import { addInterval, changeOrderLines, changeOrderText, cleanChangeOrder, cleanPlan, CO_TOKEN, visitReminderText, type ChangeOrder, type Plan, type TimeEntry, tappedAt } from "@/lib/service";

type Sql = NeonQueryFunction<false, false>;
const tz = (c: Client) => c.setup.timezone || "America/Denver";
const todayIn = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: tz(c) });
const first = (s: string) => (s || "").trim().split(" ")[0] || "";
const iso = (v: unknown) => v ? new Date(String(v)).toISOString() : null;
const day = (v: unknown) => v ? String(v).slice(0, 10) : null;
const UUID = /^[0-9a-f-]{36}$/i;
const note = (sql: Sql, c: Client, thread: string, body: string) => sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${thread}::uuid, 'out', 'system', ${body})`;
export const changeOrderUrl = (token: string) => `${appOrigin()}/c/${token}`;

// ---------- Invoices made here (a plan's visit, one per visit) ----------
async function newInvoice(sql: Sql, c: Client, threadId: string, items: Item[], taxRate: number, note: string, planId: string): Promise<string | null> {
  const days = Number(c.setup.invoice_days ?? 7) || 0;
  const due = new Date(Date.parse(todayIn(c) + "T12:00:00Z") + days * 86400000).toISOString().slice(0, 10);
  const { total } = totals(items, taxRate);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [r] = await sql`INSERT INTO public.client_invoices (owner_id, project_id, thread_id, number, items, tax_rate, total, due_on, note, plan_id)
        VALUES (${c.owner}, ${c.projectId}::uuid, ${threadId}::uuid, (SELECT coalesce(max(number), 1000) + 1 FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid),
          ${JSON.stringify(items)}::jsonb, ${taxRate}, ${total}, ${due}::date, ${note}, ${planId}::uuid) RETURNING id` as { id: string }[];
      return r.id;
    } catch (e) { if (attempt) { console.error("Visit invoice failed", e instanceof Error ? e.message : e); return null; } }
  }
  return null;
}

// ---------- Service plans ----------
const asPlan = (r: Record<string, unknown>): Plan => ({
  id: String(r.id), thread_id: String(r.thread_id), customer: String(r.customer_name ?? ""), phone: String(r.customer_phone ?? ""), name: String(r.name ?? ""),
  items: cleanItems(r.items), tax_rate: Number(r.tax_rate ?? 0), total: Number(r.total ?? 0), every: Number(r.every_n ?? 1), unit: r.every_unit === "week" ? "week" : "month",
  next_on: day(r.next_on), time: r.visit_time ? String(r.visit_time) : null, ends_on: day(r.ends_on), status: r.status === "paused" ? "paused" : r.status === "ended" ? "ended" : "active",
  remind: !!r.remind, invoice: !!r.auto_invoice, crew_member: String(r.crew_member ?? ""), visits_done: Number(r.visits_done ?? 0), last_on: day(r.last_on), created_at: iso(r.created_at) ?? "",
});
export async function loadPlans(sql: Sql, c: Client): Promise<Plan[]> {
  const rows = await sql`SELECT p.*, p.next_on::text AS next_on, p.ends_on::text AS ends_on, p.last_on::text AS last_on, t.customer_name, t.customer_phone
    FROM public.client_plans p JOIN public.client_threads t ON t.id = p.thread_id
    WHERE p.project_id = ${c.projectId}::uuid ORDER BY (p.status = 'active') DESC, p.next_on NULLS LAST, p.created_at DESC LIMIT 300` as Record<string, unknown>[];
  return rows.map(asPlan);
}
/** A new plan for a customer, or changes to one. Changing the first visit day moves the next visit. */
export async function savePlan(sql: Sql, c: Client, threadId: string, planId: string | undefined, input: unknown): Promise<{ ok: boolean; id?: string; error?: string }> {
  const p = cleanPlan(input);
  if (!p.ok) return { ok: false, error: p.error };
  const v = p.plan;
  const [t] = await sql`SELECT id FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string }[];
  if (!t) return { ok: false, error: "Not found." };
  if (planId) {
    if (!UUID.test(planId)) return { ok: false, error: "Which plan?" };
    const r = await sql`UPDATE public.client_plans SET name = ${v.name}, items = ${JSON.stringify(v.items)}::jsonb, tax_rate = ${v.tax_rate}, total = ${v.total}, every_n = ${v.every}, every_unit = ${v.unit},
        next_on = ${v.next_on}::date, visit_time = ${v.time}, ends_on = ${v.ends_on}::date, remind = ${v.remind}, auto_invoice = ${v.invoice}, crew_member = ${v.crew_member},
        reminded_for = CASE WHEN next_on = ${v.next_on}::date THEN reminded_for ELSE NULL END, updated_at = now()
      WHERE id = ${planId}::uuid AND project_id = ${c.projectId}::uuid AND thread_id = ${t.id}::uuid RETURNING id` as { id: string }[];
    return r.length ? { ok: true, id: r[0].id } : { ok: false, error: "That plan isn't here." };
  }
  const [r] = await sql`INSERT INTO public.client_plans (owner_id, project_id, thread_id, name, items, tax_rate, total, every_n, every_unit, next_on, visit_time, ends_on, remind, auto_invoice, crew_member)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, ${v.name}, ${JSON.stringify(v.items)}::jsonb, ${v.tax_rate}, ${v.total}, ${v.every}, ${v.unit}, ${v.next_on}::date, ${v.time}, ${v.ends_on}::date, ${v.remind}, ${v.invoice}, ${v.crew_member})
    RETURNING id` as { id: string }[];
  await note(sql, c, t.id, `Service plan started: ${v.name}, ${dollars(v.total)} a visit. First visit ${v.next_on}.`);
  return { ok: true, id: r.id };
}
export async function setPlan(sql: Sql, c: Client, planId: string, what: "pause" | "resume" | "end"): Promise<{ ok: boolean; error?: string }> {
  const status = what === "pause" ? "paused" : what === "resume" ? "active" : "ended";
  const r = await sql`UPDATE public.client_plans SET status = ${status}, updated_at = now(),
      next_on = CASE WHEN ${what === "resume"}::boolean AND next_on < ${todayIn(c)}::date THEN ${todayIn(c)}::date ELSE next_on END
    WHERE id = ${planId}::uuid AND project_id = ${c.projectId}::uuid AND status <> 'ended' RETURNING thread_id, name` as { thread_id: string; name: string }[];
  if (!r.length) return { ok: false, error: "That plan was already ended." };
  await note(sql, c, r[0].thread_id, `Service plan ${what === "pause" ? "paused" : what === "resume" ? "resumed" : "ended"}: ${r[0].name}.`);
  return { ok: true };
}
/**
 * The next visit happened (or was skipped). Done: logged, and with "invoice after each visit" on, an invoice for the visit
 * is made and texted. Either way the plan moves to its next visit day; past the end date it ends.
 */
export async function planVisit(sql: Sql, c: Client, planId: string, o: { skip?: boolean; member?: string }): Promise<{ ok: boolean; next?: string | null; invoice?: string | null; sent?: boolean; warn?: string; error?: string }> {
  const [p] = await sql`SELECT p.*, p.next_on::text AS next_on, p.ends_on::text AS ends_on FROM public.client_plans p WHERE p.id = ${planId}::uuid AND p.project_id = ${c.projectId}::uuid AND p.status = 'active'` as Record<string, unknown>[];
  if (!p || !p.next_on) return { ok: false, error: "That plan isn't active." };
  const plan = asPlan(p), on = plan.next_on!;
  let next: string | null = addInterval(on, plan.every, plan.unit);
  if (plan.ends_on && next > plan.ends_on) next = null;
  // Claim the visit: two taps at once move it only once.
  const moved = await sql`UPDATE public.client_plans SET next_on = ${next}::date, status = CASE WHEN ${next === null}::boolean THEN 'ended' ELSE status END, reminded_for = NULL,
      visits_done = visits_done + ${o.skip ? 0 : 1}, last_on = CASE WHEN ${!!o.skip}::boolean THEN last_on ELSE ${on}::date END, updated_at = now()
    WHERE id = ${plan.id}::uuid AND next_on = ${on}::date RETURNING id`;
  if (!moved.length) return { ok: false, error: "That visit was already marked." };
  let invoiceId: string | null = null, sent = false, warn = "";
  if (!o.skip && plan.invoice) {
    invoiceId = await newInvoice(sql, c, plan.thread_id, plan.items, plan.tax_rate, `${plan.name}, visit on ${on}`, plan.id);
    if (invoiceId) { const s = await sendInvoice(sql, c, invoiceId); sent = s.sent; warn = s.warn ?? s.error ?? ""; }
  }
  await sql`INSERT INTO public.client_visits (owner_id, project_id, plan_id, thread_id, on_date, status, invoice_id, member) VALUES (${c.owner}, ${c.projectId}::uuid, ${plan.id}::uuid, ${plan.thread_id}::uuid, ${on}::date, ${o.skip ? "skipped" : "done"}, ${invoiceId}::uuid, ${o.member ?? ""})`;
  await note(sql, c, plan.thread_id, o.skip ? `${plan.name}: visit on ${on} skipped.` : `${plan.name}: visit on ${on} done.${invoiceId ? ` Invoice for ${dollars(plan.total)} ${sent ? "texted" : "drafted"}.` : ""}`);
  return { ok: true, next, invoice: invoiceId, sent, warn };
}
export async function loadVisits(sql: Sql, c: Client, days = 120): Promise<{ id: string; plan_id: string; thread_id: string; on_date: string; status: string; invoice_id: string | null }[]> {
  const rows = await sql`SELECT id, plan_id, thread_id, on_date::text AS on_date, status, invoice_id FROM public.client_visits WHERE project_id = ${c.projectId}::uuid AND on_date > current_date - ${days}::int ORDER BY on_date DESC LIMIT 400` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), plan_id: String(r.plan_id), thread_id: String(r.thread_id), on_date: String(r.on_date), status: String(r.status), invoice_id: r.invoice_id ? String(r.invoice_id) : null }));
}
/** The day before each visit: one reminder text, inside texting hours. */
export async function runPlanReminders(sql: Sql, limit = 80): Promise<{ sent: number; skipped: number }> {
  const rows = await sql`SELECT p.id, p.owner_id, p.project_id, p.thread_id, p.name, p.visit_time, p.next_on::text AS next_on, t.customer_phone, t.customer_name, t.status AS thread_status
    FROM public.client_plans p JOIN public.client_threads t ON t.id = p.thread_id
    WHERE p.status = 'active' AND p.remind AND p.next_on BETWEEN current_date AND current_date + 2 AND (p.reminded_for IS NULL OR p.reminded_for <> p.next_on) LIMIT 400` as Record<string, unknown>[];
  const clients = new Map<string, Client | null>();
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (sent >= limit) break;
    const key = String(r.owner_id) + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, String(r.owner_id), String(r.project_id)));
    const c = clients.get(key);
    if (!c?.setup.texting_number || r.thread_status === "opted_out") { skipped++; continue; }
    const tomorrow = new Date(Date.parse(todayIn(c) + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
    if (String(r.next_on) !== tomorrow) continue;
    if (!inTextingHours(tz(c))) { skipped++; continue; }
    const [claimed] = await sql`UPDATE public.client_plans SET reminded_for = next_on WHERE id = ${String(r.id)}::uuid AND next_on = ${tomorrow}::date AND (reminded_for IS NULL OR reminded_for <> next_on) RETURNING id`;
    if (!claimed) continue;
    const ok = await sendToCustomer(sql, c, String(r.thread_id), String(r.customer_phone), visitReminderText({ first: first(String(r.customer_name ?? "")), business: c.setup.display_name || "", plan: String(r.name), time: r.visit_time ? String(r.visit_time) : null }), "template");
    if (ok) sent++; else skipped++;
  }
  return { sent, skipped };
}

// ---------- Change orders ----------
const asCo = (r: Record<string, unknown>): ChangeOrder => ({
  id: String(r.id), thread_id: String(r.thread_id), number: Number(r.number), title: String(r.title ?? ""), items: cleanItems(r.items), tax_rate: Number(r.tax_rate ?? 0), total: Number(r.total ?? 0),
  note: String(r.note ?? ""), status: (["draft", "sent", "approved", "declined", "void"].includes(String(r.status)) ? String(r.status) : "draft") as ChangeOrder["status"],
  url: r.token ? changeOrderUrl(String(r.token)) : null, sent_at: iso(r.sent_at), viewed_at: iso(r.viewed_at), decided_at: iso(r.decided_at), signed_by: String(r.signed_by ?? ""), invoiced: !!r.invoice_id,
});
export async function changeOrdersByThread(sql: Sql, c: Client): Promise<Record<string, ChangeOrder[]>> {
  const rows = await sql`SELECT * FROM public.client_change_orders WHERE project_id = ${c.projectId}::uuid AND status <> 'void' ORDER BY thread_id, number` as Record<string, unknown>[];
  const out: Record<string, ChangeOrder[]> = {};
  for (const r of rows) (out[String(r.thread_id)] ??= []).push(asCo(r));
  return out;
}
export async function saveChangeOrder(sql: Sql, c: Client, threadId: string, coId: string | undefined, input: unknown): Promise<{ ok: boolean; id?: string; error?: string }> {
  const v = cleanChangeOrder(input);
  if (!v.ok) return { ok: false, error: v.error };
  const [t] = await sql`SELECT id FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string }[];
  if (!t) return { ok: false, error: "Not found." };
  if (coId) {
    if (!UUID.test(coId)) return { ok: false, error: "Which change order?" };
    const r = await sql`UPDATE public.client_change_orders SET title = ${v.title}, items = ${JSON.stringify(v.items)}::jsonb, tax_rate = ${v.tax_rate}, total = ${v.total}, note = ${v.note}
      WHERE id = ${coId}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('draft', 'sent') RETURNING id` as { id: string }[];
    return r.length ? { ok: true, id: r[0].id } : { ok: false, error: "That change order was already answered." };
  }
  const [r] = await sql`INSERT INTO public.client_change_orders (owner_id, project_id, thread_id, number, title, items, tax_rate, total, note)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, (SELECT coalesce(max(number), 0) + 1 FROM public.client_change_orders WHERE thread_id = ${t.id}::uuid), ${v.title}, ${JSON.stringify(v.items)}::jsonb, ${v.tax_rate}, ${v.total}, ${v.note})
    RETURNING id` as { id: string }[];
  return { ok: true, id: r.id };
}
/** Text the customer the change order's link. Owner-initiated, inside texting hours; otherwise the link is ready to copy. */
export async function sendChangeOrder(sql: Sql, c: Client, coId: string): Promise<{ ok: boolean; sent: boolean; url?: string; warn?: string; error?: string }> {
  const [r] = await sql`SELECT co.*, t.customer_phone, t.customer_name, t.status AS thread_status FROM public.client_change_orders co JOIN public.client_threads t ON t.id = co.thread_id
    WHERE co.id = ${coId}::uuid AND co.project_id = ${c.projectId}::uuid AND co.status IN ('draft', 'sent')` as Record<string, unknown>[];
  if (!r) return { ok: false, sent: false, error: "That change order was already answered." };
  let token = r.token ? String(r.token) : "";
  if (!token) { token = randomBytes(18).toString("base64url"); await sql`UPDATE public.client_change_orders SET token = ${token} WHERE id = ${coId}::uuid AND token IS NULL`; }
  const url = changeOrderUrl(token);
  await sql`UPDATE public.client_change_orders SET status = 'sent', sent_at = coalesce(sent_at, now()) WHERE id = ${coId}::uuid`;
  if (r.thread_status === "opted_out") return { ok: true, sent: false, url, warn: "They opted out of texts. Copy the link and email it instead." };
  if (!c.setup.texting_number) return { ok: true, sent: false, url, warn: "Your texting number isn't connected yet. Copy the link and send it yourself." };
  if (!inTextingHours(tz(c))) return { ok: true, sent: false, url, warn: "It's outside texting hours (8 AM to 8 PM). Copy the link, or send it in the morning." };
  const ok = await sendToCustomer(sql, c, String(r.thread_id), String(r.customer_phone), changeOrderText({ first: first(String(r.customer_name ?? "")), business: c.setup.display_name || "", number: Number(r.number), title: String(r.title), total: Number(r.total), url }), "owner");
  return ok ? { ok: true, sent: true, url } : { ok: false, sent: false, url, error: "The text didn't send. Copy the link and send it yourself." };
}
/**
 * Approved: the work is added. Its lines go on the open invoice when there is one (a new invoice picks them up
 * otherwise). The job's price counts it on top of the job value until then (jobPrice), so profit stays right.
 */
async function applyApproved(sql: Sql, c: Client, co: Record<string, unknown>) {
  const lines = changeOrderLines({ number: Number(co.number), items: cleanItems(co.items) });
  const [inv] = await sql`SELECT id, items, tax_rate::float AS tax_rate FROM public.client_invoices WHERE thread_id = ${String(co.thread_id)}::uuid AND status IN ('draft', 'sent') AND plan_id IS NULL ORDER BY created_at DESC LIMIT 1` as { id: string; items: unknown; tax_rate: number }[];
  if (inv) {
    const items = [...cleanItems(inv.items), ...lines].slice(0, 30);
    await sql`UPDATE public.client_invoices SET items = ${JSON.stringify(items)}::jsonb, total = ${totals(items, Number(inv.tax_rate)).total}, paid_amount = paid_amount WHERE id = ${inv.id}::uuid`;
    await sql`UPDATE public.client_change_orders SET invoice_id = ${inv.id}::uuid WHERE id = ${String(co.id)}::uuid`;
    await qboSyncInvoice(sql, c.projectId, inv.id);
  }
  await sql`UPDATE public.client_threads SET updated_at = now() WHERE id = ${String(co.thread_id)}::uuid`;
}
/** The owner's own call: they said yes on site (approved), or it's dropped (void). */
export async function setChangeOrder(sql: Sql, c: Client, coId: string, what: "approved" | "void"): Promise<{ ok: boolean; error?: string }> {
  const [co] = await sql`UPDATE public.client_change_orders SET status = ${what}, decided_at = CASE WHEN ${what === "approved"}::boolean THEN now() ELSE decided_at END
    WHERE id = ${coId}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('draft', 'sent') RETURNING *` as Record<string, unknown>[];
  if (!co) return { ok: false, error: "That change order was already answered." };
  if (what === "approved") await applyApproved(sql, c, co);
  await note(sql, c, String(co.thread_id), what === "approved" ? `Change order #${co.number} approved in person: ${co.title}, ${dollars(Number(co.total))}.` : `Change order #${co.number} dropped.`);
  return { ok: true };
}
export type PublicChangeOrder = { business: string; owner: string; phone: string; customer: string; number: number; title: string; items: Item[]; tax_rate: number; total: number; note: string; sent: string;
  state: "open" | "approved" | "declined" | "closed"; answeredAt: string | null; signedBy: string; terms: string };
export async function publicChangeOrder(sql: Sql, token: string): Promise<PublicChangeOrder | null> {
  if (!CO_TOKEN.test(token)) return null;
  const [r] = await sql`SELECT co.*, t.customer_name FROM public.client_change_orders co JOIN public.client_threads t ON t.id = co.thread_id WHERE co.token = ${token} LIMIT 1` as Record<string, unknown>[];
  if (!r) return null;
  const c = await clientById(sql, String(r.owner_id), String(r.project_id));
  if (!c) return null;
  if (!r.viewed_at) await sql`UPDATE public.client_change_orders SET viewed_at = now() WHERE id = ${String(r.id)}::uuid AND viewed_at IS NULL`;
  const st = String(r.status);
  return { business: c.setup.display_name || "", owner: first(c.setup.owner_name || ""), phone: c.setup.texting_number || "", customer: first(String(r.customer_name ?? "")),
    number: Number(r.number), title: String(r.title), items: cleanItems(r.items), tax_rate: Number(r.tax_rate ?? 0), total: Number(r.total ?? 0), note: String(r.note ?? ""),
    sent: iso(r.sent_at) ?? iso(r.created_at) ?? "", state: st === "approved" ? "approved" : st === "declined" ? "declined" : st === "void" ? "closed" : "open",
    answeredAt: iso(r.decided_at), signedBy: String(r.signed_by ?? ""), terms: c.setup.quote_terms || "" };
}
export async function answerChangeOrder(sql: Sql, token: string, answer: "approve" | "decline", signedBy = ""): Promise<{ ok: boolean; state?: PublicChangeOrder["state"]; error?: string }> {
  if (!CO_TOKEN.test(token)) return { ok: false, error: "This link isn't valid." };
  const approve = answer === "approve", by = signedBy.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  if (approve && by.length < 2) return { ok: false, error: "Type your name to approve." };
  const [co] = await sql`UPDATE public.client_change_orders SET status = ${approve ? "approved" : "declined"}, decided_at = now(), signed_by = ${by}
    WHERE token = ${token} AND status = 'sent' RETURNING *` as Record<string, unknown>[];
  if (!co) { const now = await publicChangeOrder(sql, token); return now ? { ok: true, state: now.state } : { ok: false, error: "This link isn't valid." }; }
  const c = await clientById(sql, String(co.owner_id), String(co.project_id));
  if (!c) return { ok: true, state: approve ? "approved" : "declined" };
  if (approve) await applyApproved(sql, c, co);
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${String(co.thread_id)}::uuid, 'in', 'system',
    ${approve ? `Approved change order #${co.number} online as "${by}": ${co.title}, ${dollars(Number(co.total))}` : `Passed on change order #${co.number}: ${co.title}`})`;
  const [t] = await sql`SELECT customer_name FROM public.client_threads WHERE id = ${String(co.thread_id)}::uuid` as { customer_name: string }[];
  await alertOwner(c, `Cinder · Change order #${co.number} ${approve ? "approved" : "declined"}: ${t?.customer_name || "a customer"}, ${co.title}, ${dollars(Number(co.total))}.${approve ? " It's on the invoice." : ""}`, String(co.thread_id), sql);
  return { ok: true, state: approve ? "approved" : "declined" };
}

// ---------- Crew hours ----------
const asTime = (r: Record<string, unknown>): TimeEntry => ({ id: String(r.id), thread_id: r.thread_id ? String(r.thread_id) : null, member: String(r.member ?? ""), started_at: iso(r.started_at)!, ended_at: iso(r.ended_at), note: String(r.note ?? ""), customer: String(r.customer_name ?? "") });
export async function loadTime(sql: Sql, c: Client, member: string | null, days = 45): Promise<TimeEntry[]> {
  const rows = member === null
    ? await sql`SELECT e.*, t.customer_name FROM public.client_time e LEFT JOIN public.client_threads t ON t.id = e.thread_id WHERE e.project_id = ${c.projectId}::uuid AND e.started_at > now() - make_interval(days => ${days}::int) ORDER BY e.started_at DESC LIMIT 600` as Record<string, unknown>[]
    : await sql`SELECT e.*, t.customer_name FROM public.client_time e LEFT JOIN public.client_threads t ON t.id = e.thread_id WHERE e.project_id = ${c.projectId}::uuid AND e.member = ${member} AND e.started_at > now() - make_interval(days => ${days}::int) ORDER BY e.started_at DESC LIMIT 200` as Record<string, unknown>[];
  return rows.map(asTime);
}
/** Start the clock on a job (or general time with no job). Anything still running for this person stops first. */
export async function clockIn(sql: Sql, c: Client, member: string, threadId: string | null, at?: unknown): Promise<{ ok: boolean; error?: string }> {
  if (threadId) { const [t] = await sql`SELECT id FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid`; if (!t) return { ok: false, error: "Not found." }; }
  const when = tappedAt(at);
  await sql`UPDATE public.client_time SET ended_at = greatest(started_at, least(${when}::timestamptz, started_at + interval '16 hours')) WHERE project_id = ${c.projectId}::uuid AND member = ${member} AND ended_at IS NULL`;
  await sql`INSERT INTO public.client_time (owner_id, project_id, thread_id, member, started_at) VALUES (${c.owner}, ${c.projectId}::uuid, ${threadId}::uuid, ${member}, ${when}::timestamptz)`;
  return { ok: true };
}
export async function clockOut(sql: Sql, c: Client, member: string, noteText?: string, at?: unknown): Promise<{ ok: boolean; minutes?: number; error?: string }> {
  const n = String(noteText ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  const when = tappedAt(at);
  const [r] = await sql`UPDATE public.client_time SET ended_at = greatest(started_at, least(${when}::timestamptz, started_at + interval '16 hours')), note = CASE WHEN ${n} = '' THEN note ELSE ${n} END
    WHERE project_id = ${c.projectId}::uuid AND member = ${member} AND ended_at IS NULL RETURNING round(extract(epoch FROM ended_at - started_at) / 60)::int AS minutes` as { minutes: number }[];
  return r ? { ok: true, minutes: r.minutes } : { ok: false, error: "You're not clocked in." };
}
/** The owner fixes the hours: a wrong entry goes, or its times change. */
export async function editTime(sql: Sql, c: Client, id: string, o: { remove?: boolean; start?: unknown; end?: unknown }): Promise<{ ok: boolean; error?: string }> {
  if (o.remove) { const r = await sql`DELETE FROM public.client_time WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid RETURNING id`; return r.length ? { ok: true } : { ok: false, error: "Already removed." }; }
  const s = Date.parse(String(o.start ?? "")), e = o.end ? Date.parse(String(o.end)) : NaN;
  if (!Number.isFinite(s) || (o.end && !Number.isFinite(e)) || (Number.isFinite(e) && (e <= s || e - s > 16 * 3600000))) return { ok: false, error: "Check the times: the end is after the start, at most 16 hours." };
  const r = await sql`UPDATE public.client_time SET started_at = ${new Date(s).toISOString()}::timestamptz, ended_at = ${Number.isFinite(e) ? new Date(e).toISOString() : null}::timestamptz WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid RETURNING id`;
  return r.length ? { ok: true } : { ok: false, error: "Not found." };
}
