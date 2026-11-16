// The customer's own page and the job sign-off, on the server.
// Customer page: one private link per customer with everything they have with the business: quotes to approve, invoices to
// pay (through the owner's own pay link), change orders, upcoming visits, the install date, after photos and the sign-off.
// Sign-off: at the end of a job the customer signs on the crew's phone; the job's install and walk-through steps tick.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { changeRequest } from "@/lib/records";
import { alertOwner, appOrigin, clientById, quoteUrl, type Client } from "@/lib/client-runtime-run";
import { invoiceUrl } from "@/lib/client-billing-run";
import { changeOrderUrl } from "@/lib/client-service-run";
import { cleanSignoff, visitDays, type Signoff } from "@/lib/service";

type Sql = NeonQueryFunction<false, false>;
export const PORTAL_TOKEN = /^[A-Za-z0-9_-]{24}$/;
export const portalUrl = (token: string) => `${appOrigin()}/p/${token}`;
const first = (s: string) => (s || "").trim().split(" ")[0] || "";
const iso = (v: unknown) => v ? new Date(String(v)).toISOString() : null;
const todayIn = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });

/** The customer's page link, made the first time it's asked for. */
export async function portalLink(sql: Sql, c: Client, threadId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const [t] = await sql`SELECT id, portal_token FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; portal_token: string | null }[];
  if (!t) return { ok: false, error: "Not found." };
  let token = t.portal_token ?? "";
  if (!token) {
    token = randomBytes(18).toString("base64url");
    const [r] = await sql`UPDATE public.client_threads SET portal_token = coalesce(portal_token, ${token}) WHERE id = ${t.id}::uuid RETURNING portal_token` as { portal_token: string }[];
    token = r.portal_token;
  }
  return { ok: true, url: portalUrl(token) };
}

export type PublicPortal = {
  business: string; owner: string; phone: string; customer: string; payLink: string; address: string;
  quotes: { amount: number | null; status: "open" | "approved" | "declined" | "closed"; sent: string; url: string | null; line: string }[];
  invoices: { number: number; total: number; balance: number; status: string; due_on: string | null; url: string | null; issued: string }[];
  changeOrders: { number: number; title: string; total: number; status: string; url: string | null }[];
  coming: { kind: "estimate" | "install" | "visit"; date: string; time: string | null; what: string }[];
  photos: string[]; signoff: { signed_by: string; at: string } | null;
  /** The job is done (signed off, paid, or after photos): the customer can rate it. Their rating, if they did. */
  canRate?: boolean; rating?: number | null; reviewLink?: string;
};
export async function publicPortal(sql: Sql, token: string): Promise<{ portal: PublicPortal; threadId: string; projectId: string } | null> {
  if (!PORTAL_TOKEN.test(token)) return null;
  const [t] = await sql`SELECT id, owner_id, project_id, customer_name, customer_phone, details, install_on::text AS install_on, install_time, install_days FROM public.client_threads WHERE portal_token = ${token} LIMIT 1` as Record<string, unknown>[];
  if (!t) return null;
  const c = await clientById(sql, String(t.owner_id), String(t.project_id));
  if (!c) return null;
  const tid = String(t.id), phone10 = String(t.customer_phone).replace(/\D/g, "").slice(-10);
  const [quotes, invoices, cos, appts, plans, photos, [so], [fb]] = await Promise.all([
    sql`SELECT amount::float AS amount, status, sent_on::text AS sent_on, token, approved_at, declined_at, link_sent_at FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote'
      AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${phone10} AND token IS NOT NULL ORDER BY created_at DESC LIMIT 10` as Promise<Record<string, unknown>[]>,
    sql`SELECT number, total::float AS total, paid_amount::float AS paid, status, due_on::text AS due_on, token, created_at FROM public.client_invoices WHERE thread_id = ${tid}::uuid AND status IN ('sent', 'paid') ORDER BY created_at DESC LIMIT 24` as Promise<Record<string, unknown>[]>,
    sql`SELECT number, title, total::float AS total, status, token FROM public.client_change_orders WHERE thread_id = ${tid}::uuid AND status IN ('sent', 'approved', 'declined') ORDER BY number` as Promise<Record<string, unknown>[]>,
    sql`SELECT starts_at FROM public.client_appointments WHERE thread_id = ${tid}::uuid AND status = 'booked' AND starts_at > now() ORDER BY starts_at LIMIT 3` as unknown as Promise<{ starts_at: string }[]>,
    sql`SELECT name, every_n, every_unit, next_on::text AS next_on, ends_on::text AS ends_on, visit_time, status FROM public.client_plans WHERE thread_id = ${tid}::uuid AND status = 'active'` as Promise<Record<string, unknown>[]>,
    sql`SELECT id FROM public.client_photos WHERE thread_id = ${tid}::uuid AND (kind = 'after' OR shared) ORDER BY created_at DESC LIMIT 12` as unknown as Promise<{ id: string }[]>,
    sql`SELECT signed_by, created_at FROM public.client_signoffs WHERE thread_id = ${tid}::uuid ORDER BY created_at DESC LIMIT 1` as unknown as Promise<{ signed_by: string; created_at: string }[]>,
    sql`SELECT rating FROM public.client_feedback WHERE thread_id = ${tid}::uuid`.catch(() => []) as unknown as Promise<{ rating: number }[]>,
  ]);
  const tz = c.setup.timezone || "America/Denver", today = todayIn(c), horizon = new Date(Date.parse(today + "T12:00:00Z") + 120 * 86400000).toISOString().slice(0, 10);
  const coming: PublicPortal["coming"] = [];
  for (const a of appts) { const d = new Date(a.starts_at); coming.push({ kind: "estimate", date: d.toLocaleDateString("en-CA", { timeZone: tz }), time: d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }), what: "Estimate visit" }); }
  if (t.install_on && String(t.install_on) >= today) coming.push({ kind: "install", date: String(t.install_on), time: t.install_time ? String(t.install_time) : null, what: Number(t.install_days) > 1 ? `Install, ${t.install_days} days` : "Install day" });
  for (const p of plans) for (const day of visitDays({ next_on: p.next_on ? String(p.next_on) : null, every: Number(p.every_n), unit: p.every_unit === "week" ? "week" : "month", ends_on: p.ends_on ? String(p.ends_on) : null, status: "active" }, today, horizon, 3))
    coming.push({ kind: "visit", date: day, time: p.visit_time ? String(p.visit_time) : null, what: String(p.name) });
  coming.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  return { threadId: tid, projectId: c.projectId, portal: {
    business: c.setup.display_name || "", owner: first(c.setup.owner_name || ""), phone: c.setup.texting_number || "", customer: first(String(t.customer_name ?? "")), payLink: c.setup.pay_link || "",
    address: String((t.details as Record<string, unknown> | null)?.address ?? ""),
    quotes: quotes.map(q => ({ amount: q.amount == null ? null : Number(q.amount), status: q.approved_at ? "approved" : q.declined_at ? "declined" : q.status === "won" || q.status === "lost" ? "closed" : "open", sent: String(q.sent_on ?? ""), url: q.token ? quoteUrl(String(q.token)) : null, line: "" })),
    invoices: invoices.map(i => ({ number: Number(i.number), total: Number(i.total), balance: i.status === "paid" ? 0 : Math.max(0, Math.round((Number(i.total) - Number(i.paid ?? 0)) * 100) / 100), status: String(i.status), due_on: i.due_on ? String(i.due_on) : null, url: i.token ? invoiceUrl(String(i.token)) : null, issued: iso(i.created_at) ?? "" })),
    changeOrders: cos.map(x => ({ number: Number(x.number), title: String(x.title), total: Number(x.total), status: String(x.status), url: x.token ? changeOrderUrl(String(x.token)) : null })),
    coming: coming.slice(0, 8), photos: photos.map(p => p.id), signoff: so ? { signed_by: so.signed_by, at: iso(so.created_at)! } : null,
    canRate: !!so || photos.length > 0 || invoices.some(i => i.status === "paid"), rating: fb ? Number(fb.rating) : null, reviewLink: c.setup.review_link || "",
  } };
}
/** A photo on the customer's page: only an after (or shared) photo of that customer's own job. */
export async function portalPhoto(sql: Sql, token: string, id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!PORTAL_TOKEN.test(token) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await sql`SELECT p.mime, p.bytes FROM public.client_photos p JOIN public.client_threads t ON t.id = p.thread_id
    WHERE p.id = ${id}::uuid AND t.portal_token = ${token} AND (p.kind = 'after' OR p.shared)` as { mime: string; bytes: Buffer }[];
  return r ?? null;
}

// ---------- Sign-off ----------
/** The customer signed: kept with the job, and the job's "installed" and "walk-through" steps tick for today. */
export async function saveSignoff(sql: Sql, c: Client, threadId: string, input: unknown, member: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const v = cleanSignoff(input);
  if (!v.ok) return { ok: false, error: v.error };
  const day = todayIn(c);
  const [t] = await sql`UPDATE public.client_threads SET job_steps = job_steps || jsonb_build_object('installed', coalesce(job_steps->>'installed', ${day}::text), 'walk', coalesce(job_steps->>'walk', ${day}::text)), updated_at = now()
    WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid RETURNING id` as { id: string }[];
  if (!t) return { ok: false, error: "Not found." };
  const [r] = await sql`INSERT INTO public.client_signoffs (owner_id, project_id, thread_id, signed_by, signature, checklist, note, member)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, ${v.signedBy}, ${v.signature}, ${JSON.stringify(v.checklist)}::jsonb, ${v.note}, ${member}) RETURNING id` as { id: string }[];
  const open = v.checklist.filter(x => !x.done).length;
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'in', 'system',
    ${`Job signed off by ${v.signedBy}${v.checklist.length ? `, ${v.checklist.length - open} of ${v.checklist.length} checks done` : ""}${v.note ? `. Note: ${v.note.slice(0, 200)}` : ""}`})`;
  return { ok: true, id: r.id };
}
export async function signoffsByThread(sql: Sql, c: Client): Promise<Record<string, Signoff>> {
  const rows = await sql`SELECT DISTINCT ON (thread_id) id, thread_id, signed_by, note, checklist, member, created_at FROM public.client_signoffs WHERE project_id = ${c.projectId}::uuid ORDER BY thread_id, created_at DESC` as Record<string, unknown>[];
  return Object.fromEntries(rows.map(r => [String(r.thread_id), { id: String(r.id), thread_id: String(r.thread_id), signed_by: String(r.signed_by), at: iso(r.created_at)!, note: String(r.note ?? ""),
    checklist: Array.isArray(r.checklist) ? (r.checklist as { label: string; done: boolean }[]) : [], member: String(r.member ?? "") }]));
}
export async function signatureImage(sql: Sql, projects: string[], id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await sql`SELECT signature FROM public.client_signoffs WHERE id = ${id}::uuid AND project_id = ANY(${projects}::uuid[])` as { signature: string }[];
  return r?.signature ?? null;
}

// ---------- From the customer's page: a rating for the finished job, and a request for more work ----------
async function byToken(sql: Sql, token: string) {
  if (!PORTAL_TOKEN.test(token)) return null;
  const [t] = await sql`SELECT id, owner_id, project_id, customer_name, customer_phone FROM public.client_threads WHERE portal_token = ${token}` as Record<string, unknown>[];
  if (!t) return null;
  const c = await clientById(sql, String(t.owner_id), String(t.project_id));
  return c ? { c, t: { id: String(t.id), name: String(t.customer_name ?? ""), phone: String(t.customer_phone ?? "") } } : null;
}
const words = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
/**
 * The customer asks to move or cancel something coming up. It lands on their conversation, as a to-do for today, and
 * as an alert to the owner. The calendar doesn't change on its own: the owner moves it and texts them back.
 */
export async function requestChange(sql: Sql, token: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const page = await publicPortal(sql, token);
  const x = page ? await byToken(sql, token) : null;
  if (!page || !x) return { ok: false, error: "This link isn't valid." };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: x.c.setup.timezone || "America/Denver" });
  const r = changeRequest(input, page.portal.coming, today);
  if ("error" in r) return { ok: false, error: r.error };
  const who = x.t.name || "A customer";
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${x.c.owner}, ${x.t.id}::uuid, 'in', 'customer', ${`From their page: ${r.text}`})`;
  await sql`UPDATE public.client_threads SET last_in_at = now(), updated_at = now(), status = CASE WHEN status IN ('auto', 'closed') THEN 'paused' ELSE status END WHERE id = ${x.t.id}::uuid`;
  await sql`INSERT INTO public.client_tasks (owner_id, project_id, title, due_on, thread_id, created_by) VALUES (${x.c.owner}, ${x.c.projectId}::uuid, ${`${who}: ${r.text}`.slice(0, 200)}, current_date, ${x.t.id}::uuid, 'customer')`.catch(() => null);
  await alertOwner(x.c, `Cinder: ${who} ${r.text.replace(/^Asked/, "asked")}`.slice(0, 300), x.t.id, sql);
  return { ok: true };
}
/** 1 to 5 and a comment; a rating of 3 or less goes straight to the owner. Rating again replaces the first. */
export async function rateJob(sql: Sql, token: string, rating: unknown, comment: unknown): Promise<{ ok: boolean; error?: string }> {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return { ok: false, error: "Pick 1 to 5 stars." };
  const x = await byToken(sql, token);
  if (!x) return { ok: false, error: "This link isn't valid." };
  const note = words(comment, 1000);
  await sql`INSERT INTO public.client_feedback (owner_id, project_id, thread_id, rating, comment) VALUES (${x.c.owner}, ${x.c.projectId}::uuid, ${x.t.id}::uuid, ${r}, ${note})
    ON CONFLICT (thread_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()`;
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${x.c.owner}, ${x.t.id}::uuid, 'in', 'system', ${`Rated the job ${r} of 5${note ? `: "${note.slice(0, 300)}"` : "."}`})`;
  if (r <= 3) await alertOwner(x.c, `Cinder: ${x.t.name || "A customer"} rated the job ${r} of 5${note ? `: "${note.slice(0, 140)}"` : ""}. Worth a call today.`, x.t.id, sql);
  return { ok: true };
}
/** "Need something else?": the owner gets it as an alert, a to-do for today, and a note on the customer's record. */
export async function requestWork(sql: Sql, token: string, text: unknown): Promise<{ ok: boolean; error?: string }> {
  const what = words(text, 1000);
  if (what.length < 3) return { ok: false, error: "Say what you need." };
  const x = await byToken(sql, token);
  if (!x) return { ok: false, error: "This link isn't valid." };
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${x.c.owner}, ${x.t.id}::uuid, 'in', 'customer', ${`Request from their page: ${what}`})`;
  await sql`UPDATE public.client_threads SET last_in_at = now(), updated_at = now(), status = CASE WHEN status IN ('auto', 'closed') THEN 'paused' ELSE status END WHERE id = ${x.t.id}::uuid`;
  await sql`INSERT INTO public.client_tasks (owner_id, project_id, title, due_on, thread_id, created_by) VALUES (${x.c.owner}, ${x.c.projectId}::uuid, ${`${x.t.name || "Customer"} asked: ${what.slice(0, 150)}`}, current_date, ${x.t.id}::uuid, 'customer')`.catch(() => null);
  await alertOwner(x.c, `Cinder: ${x.t.name || "A customer"} asked for more work on their page: "${what.slice(0, 160)}"`, x.t.id, sql);
  return { ok: true };
}
