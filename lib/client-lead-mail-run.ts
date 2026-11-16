// Leads by email, the server side. Resend receives mail for <website key>@<CINDER_INBOUND_DOMAIN> and posts an
// email.received webhook; the route verifies it and hands the email here. Lead sites and website forms go through the same
// path as their webhooks (saved, texted back from the business number, the owner alerted). A customer who wrote in
// directly is saved and the owner is alerted, but Cinder doesn't text them first. Emails without a phone wait for the owner.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { mailAddress, mailKey, readMail, type MailIn, type MailLead } from "@/lib/lead-mail";
import { cleanMessages } from "@/lib/client-ops";
import { alertOwner, thread, webLead, type Client } from "@/lib/client-runtime-run";
import { ownerAlert } from "@/lib/client-runtime";
import { emitEvent } from "@/lib/client-webhook";
import { allowEvent } from "@/lib/rate-limit";

type Sql = NeonQueryFunction<false, false>;

export const inboundDomain = () => (process.env.CINDER_INBOUND_DOMAIN || "").trim().toLowerCase().replace(/^@/, "");
/** All three are needed: where mail arrives, the webhook's signing secret, and the key that reads the email. */
export const leadMailReady = () => !!(inboundDomain() && process.env.RESEND_WEBHOOK_SECRET?.trim() && process.env.RESEND_API_KEY?.trim());
export const leadMailAddressFor = (chatKey: string) => (leadMailReady() ? mailAddress(chatKey, inboundDomain()) : "");

/** Lead sites and website forms: the customer asked to be contacted there, so they get the instant text like a webhook lead. */
const TEXT_BACK = new Set(["angi", "thumbtack", "facebook", "google", "yelp", "houzz", "nextdoor", "bark", "porch", "networx", "web form"]);

async function clientByKey(sql: Sql, key: string): Promise<Client | null> {
  const [r] = await sql`SELECT project_id, owner_id, setup, messages FROM public.client_ops WHERE lower(chat_key) = ${key.toLowerCase()} LIMIT 1` as Record<string, unknown>[];
  return r ? { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup && typeof r.setup === "object" ? r.setup : {}) as Record<string, string>, messages: cleanMessages(r.messages) } : null;
}

/** The full email from Resend's Receiving API (the webhook itself carries only its ID). */
export async function fetchReceived(emailId: string): Promise<(MailIn & { messageId: string }) | null> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !/^[A-Za-z0-9_-]{6,80}$/.test(emailId)) return null;
  const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Resend answered ${r.status}`);
  const j = await r.json() as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
  return {
    from: String(j.from ?? ""), to: list(j.to), subject: String(j.subject ?? ""), text: typeof j.text === "string" ? j.text : null, html: typeof j.html === "string" ? j.html : null,
    replyTo: list(j.reply_to), receivedFor: list(j.received_for), headers: (j.headers && typeof j.headers === "object" ? j.headers : {}) as Record<string, string>,
    messageId: String(j.message_id || j.id || emailId).slice(0, 300),
  };
}

/** The business's own numbers: never read as the customer's (signatures, the Cinder number in a forwarded alert). */
function ownNumbers(c: Client): string[] {
  const team = (() => { try { const t = JSON.parse(c.setup.team || "[]"); return Array.isArray(t) ? t.map((m: { phone?: string }) => String(m?.phone ?? "")) : []; } catch { return []; } })();
  return [c.setup.texting_number, c.setup.owner_cell, c.setup.office_phone, c.setup.main_phone, ...team].filter((x): x is string => !!x);
}

/** A lead from an email, onto the board. Returns the thread. `textBack` false: saved and the owner alerted, nobody texted. */
export async function leadFromMail(sql: Sql, c: Client, lead: MailLead, textBack: boolean, how = "Lead email"): Promise<string> {
  let id: string;
  if (textBack && c.setup.texting_number) {
    id = (await webLead(sql, c, { name: lead.name, phone: lead.phone, email: lead.email, message: lead.message, source: lead.source, via: lead.via })).threadId;
  } else {
    const t = await thread(sql, c, lead.phone, lead.source);
    id = t.id;
    await sql`UPDATE public.client_threads SET customer_name = CASE WHEN customer_name = '' THEN ${lead.name} ELSE customer_name END,
        notes = CASE WHEN coalesce(notes, '') = '' THEN ${lead.message} ELSE notes END,
        status = CASE WHEN ${t.fresh}::boolean THEN 'paused' ELSE status END,
        stage = CASE WHEN ${t.fresh}::boolean THEN 'new' ELSE stage END, stage_at = CASE WHEN ${t.fresh}::boolean THEN now() ELSE stage_at END,
        last_in_at = now(), updated_at = now()
      WHERE id = ${id}::uuid`;
    await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${id}::uuid, 'in', 'system',
      ${`${how} from ${lead.via}${lead.message ? `: "${lead.message.slice(0, 300)}"` : ""}${lead.email ? ` · ${lead.email}` : ""}`})`;
    await alertOwner(c, ownerAlert("new", lead.name || lead.phone, `${lead.via === "email" ? "Emailed you" : `${lead.via}, by email`}${lead.message ? `: ${lead.message.slice(0, 110)}` : ""}. Not texted yet, it's yours.`), id, sql);
    void emitEvent(c.setup, c.projectId, "lead.new", { customer: { id, name: lead.name, phone: lead.phone, email: lead.email }, source: lead.source, message: lead.message.slice(0, 1000) });
  }
  if (lead.email) await sql`UPDATE public.client_threads SET customer_email = ${lead.email} WHERE id = ${id}::uuid AND coalesce(customer_email, '') = ''`.catch(() => null);
  return id;
}

export type TakeResult = { status: "lead" | "no_phone" | "confirm" | "ignored" | "duplicate" | "unknown" | "limited" | "failed"; threadId?: string };

/** One received email for one business. Safe to call twice for the same email: the message ID is kept. */
export async function takeMail(sql: Sql, mail: MailIn & { messageId: string }): Promise<TakeResult> {
  const domain = inboundDomain();
  const key = mailKey([...mail.to, ...(mail.receivedFor ?? [])], domain);
  if (!key) return { status: "unknown" };
  const c = await clientByKey(sql, key);
  if (!c) return { status: "unknown" };
  if (!(await allowEvent("lead-mail", c.projectId, 120, 60))) return { status: "limited" };
  const [row] = await sql`INSERT INTO public.client_lead_mail (owner_id, project_id, message_id, from_addr, subject)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${mail.messageId}, ${mail.from.slice(0, 300)}, ${mail.subject.slice(0, 300)})
    ON CONFLICT (project_id, message_id) DO NOTHING RETURNING id` as { id: string }[];
  if (!row) return { status: "duplicate" };
  const r = readMail(mail, ownNumbers(c), domain);
  try {
    if (r.kind === "confirm") {
      await sql`UPDATE public.client_lead_mail SET status = 'confirm', code = ${r.code}, link = ${r.link.slice(0, 1000)} WHERE id = ${row.id}::uuid`;
      await alertOwner(c, `Cinder: your email forwarding needs one click to finish.${r.code ? ` Code ${r.code}.` : ""} Open Settings, Connections, Lead emails.`);
      return { status: "confirm" };
    }
    if (r.kind === "ignored") { await sql`UPDATE public.client_lead_mail SET status = 'ignored', why = ${r.why} WHERE id = ${row.id}::uuid`; return { status: "ignored" }; }
    const l = r.lead;
    await sql`UPDATE public.client_lead_mail SET source = ${l.source}, name = ${l.name}, phone = ${l.phone}, email = ${l.email}, message = ${l.message} WHERE id = ${row.id}::uuid`;
    if (r.kind === "no_phone") {
      await sql`UPDATE public.client_lead_mail SET status = 'no_phone' WHERE id = ${row.id}::uuid`;
      await alertOwner(c, ownerAlert("new", l.name || l.email || l.via, `${l.via === "email" ? "Emailed you" : `${l.via}, by email`}, no phone in it.${l.email ? ` Reply to ${l.email}.` : ""} It's in Settings, Connections, Lead emails.`));
      return { status: "no_phone" };
    }
    const threadId = await leadFromMail(sql, c, l, TEXT_BACK.has(l.source));
    await sql`UPDATE public.client_lead_mail SET status = 'lead', thread_id = ${threadId}::uuid WHERE id = ${row.id}::uuid`;
    return { status: "lead", threadId };
  } catch (e) {
    const why = e instanceof Error ? e.message.slice(0, 200) : "Failed";
    console.error("Lead email failed", why);
    await sql`UPDATE public.client_lead_mail SET status = 'new', why = ${why} WHERE id = ${row.id}::uuid`.catch(() => null);
    return { status: "failed" };
  }
}

/**
 * A form lead that left an email but no phone: it waits with the lead emails for the owner to add a number or reply.
 * The ID is random, so two submissions are two rows.
 */
export async function queueWithoutPhone(sql: Sql, c: Client, lead: { name: string; email: string; message: string; source: string; via: string }): Promise<void> {
  await sql`INSERT INTO public.client_lead_mail (owner_id, project_id, message_id, from_addr, subject, source, status, name, email, message)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${"form:" + crypto.randomUUID()}, ${lead.email}, ${`Form on ${lead.via}`}, ${lead.source}, 'no_phone', ${lead.name}, ${lead.email}, ${lead.message.slice(0, 1000)})`;
  await alertOwner(c, ownerAlert("new", lead.name || lead.email, `Form on ${lead.via}, no phone in it. Reply to ${lead.email}. It's in your Inbox.`));
}

/** The owner found the number (a call, the lead site) for an email that came without one. Saved as theirs; nobody is texted. */
export async function addMailLead(sql: Sql, c: Client, id: string, phone: string, name?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const d = String(phone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (d.length !== 10) return { ok: false, error: "Add a 10-digit phone number." };
  const [m] = await sql`SELECT id, source, name, email, message FROM public.client_lead_mail WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('no_phone', 'new')` as Record<string, string>[];
  if (!m) return { ok: false, error: "That email is already on the board." };
  const via = m.source === "web form" ? "your website" : m.source === "email" || !m.source ? "email" : m.source.charAt(0).toUpperCase() + m.source.slice(1);
  const threadId = await leadFromMail(sql, c, { name: String(name || m.name || "").trim().slice(0, 80), phone: "+1" + d, email: m.email, message: m.message, source: m.source || "email", via, smsConsent: null }, false);
  await sql`UPDATE public.client_lead_mail SET status = 'added', phone = ${"+1" + d}, thread_id = ${threadId}::uuid WHERE id = ${id}::uuid`;
  return { ok: true, id: threadId };
}

export async function dismissMail(sql: Sql, c: Client, id: string): Promise<{ ok: boolean }> {
  await sql`UPDATE public.client_lead_mail SET status = 'ignored', why = 'Dismissed' WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('no_phone', 'new', 'confirm')`;
  return { ok: true };
}

export type MailRow = { id: string; at: string; from: string; subject: string; source: string; status: string; name: string; phone: string; email: string; message: string; code: string; link: string; thread: string; why: string };
export async function loadMail(sql: Sql, c: Client): Promise<MailRow[]> {
  const rows = await sql`SELECT id, received_at, from_addr, subject, source, status, name, phone, email, message, code, link, thread_id, why FROM public.client_lead_mail
    WHERE project_id = ${c.projectId}::uuid ORDER BY received_at DESC LIMIT 25` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), at: r.received_at instanceof Date ? r.received_at.toISOString() : String(r.received_at ?? ""), from: String(r.from_addr ?? ""), subject: String(r.subject ?? ""),
    source: String(r.source ?? ""), status: String(r.status ?? ""), name: String(r.name ?? ""), phone: String(r.phone ?? ""), email: String(r.email ?? ""), message: String(r.message ?? "").slice(0, 400),
    code: String(r.code ?? ""), link: String(r.link ?? ""), thread: r.thread_id ? String(r.thread_id) : "", why: String(r.why ?? "") }));
}
