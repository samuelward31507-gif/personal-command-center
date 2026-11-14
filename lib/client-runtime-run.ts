// Client runtime, I/O: what happens when a client's customer calls or texts their Cinder number,
// plus quote follow-ups and review requests. Every send is logged on the customer's thread.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { claudeText } from "@/lib/ai-text";
import { sendSms } from "@/lib/twilio";
import { recordConsent } from "@/lib/client-consent";
import { PAID, type Lead } from "@/lib/lead-sources";
import { cleanMessages } from "@/lib/client-ops";
import { digits10, fill, wording, FALLBACK, isStop, isStart, isHelp, isPlainOptOut, OPTOUT_TEXT, replySystem, replyUser, parseDecision, ownerAlert, quoteStepDue, SEQUENCES, isRepeatTrade, REVIEW_TEXT, NUDGE_TEXTS, nudgeStep, inTextingHours, handoffAction, parseOwnerQuote, OWNER_HELP, sameNumber, DUE_TEXTS, DUE_GAP_DAYS, withOptOut, automatedRoom, type Vars } from "@/lib/client-runtime";
import { bookingRules, detectLang, ES, EN, existingBookingRules, freeSlots, isOpen, mondayText, parseHours, pickedSlot, slotLabel, type Lang, type Slot } from "@/lib/client-booking";
import { busyTimes, clientCalendar, createEvent, deleteEvent } from "@/lib/client-calendar";
import { syncBookingToJobber } from "@/lib/jobber";
import { sendAlert } from "@/lib/notify";
import { paymentLinkFor } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";
import { pushFromAlert, pushToProject } from "@/lib/client-push";

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
const tzOf = (c: Client) => c.setup.timezone || "America/Denver";
/** Approved wording in English; the Spanish version when the customer writes in Spanish. */
const say = (c: Client, key: string, english: string, lang: Lang) => (lang === "es" && ES[key] ? ES[key] : wording(c.messages, key, english));

export async function thread(sql: Sql, c: Client, phone: string, source: string) {
  const [t] = await sql`INSERT INTO public.client_threads (owner_id, project_id, customer_phone, source)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${e164(phone)}, ${source})
    ON CONFLICT (project_id, customer_phone) DO UPDATE SET updated_at = now()
    RETURNING id, status, customer_name, lang, (xmax = 0) AS fresh` as { id: string; status: string; customer_name: string; lang: Lang; fresh: boolean }[];
  return t;
}
export type Media = { url: string; type: string };
async function log(sql: Sql, c: Client, threadId: string, direction: "in" | "out", author: string, body: string, ok = true, media: Media[] = []) {
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body, ok, media) VALUES (${c.owner}, ${threadId}::uuid, ${direction}, ${author}, ${body}, ${ok}, ${JSON.stringify(media)}::jsonb)`;
  if (direction === "in") await sql`UPDATE public.client_threads SET last_in_at = now(), updated_at = now() WHERE id = ${threadId}::uuid`;
  else await sql`UPDATE public.client_threads SET last_out_at = now(), updated_at = now() WHERE id = ${threadId}::uuid`;
}
/**
 * Text the customer from the client's number and log it. The first text in a conversation, or the first after a
 * quiet month (a follow-up round or campaign starting), carries "Reply STOP to opt out." Carriers check for it.
 */
export async function sendToCustomer(sql: Sql, c: Client, threadId: string, phone: string, body: string, author: string): Promise<boolean> {
  const [p] = await sql`SELECT t.lang, EXISTS (SELECT 1 FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'out' AND x.ok
      AND x.author <> 'system' AND x.at > now() - interval '30 days') AS recent
    FROM public.client_threads t WHERE t.id = ${threadId}::uuid` as { lang: string; recent: boolean }[];
  if (!p?.recent) body = withOptOut(body, p?.lang === "es" ? "es" : "en");
  const ok = await sendSms(e164(phone), c.setup.texting_number || "", body);
  await log(sql, c, threadId, "out", author, body, ok);
  return ok;
}
/** Room for one more automated text to this conversation (at most 3 a day unless they're texting back). */
async function roomFor(sql: Sql, threadId: string): Promise<boolean> {
  const [r] = await sql`SELECT
      count(*) FILTER (WHERE direction = 'out' AND ok AND author <> 'system')::int AS out24,
      count(*) FILTER (WHERE direction = 'in' AND author = 'customer')::int AS in24
    FROM public.client_texts WHERE thread_id = ${threadId}::uuid AND at > now() - interval '24 hours'` as { out24: number; in24: number }[];
  return automatedRoom({ outLast24h: r?.out24 ?? 0, inLast24h: r?.in24 ?? 0 });
}
/** Tell the owner: a text to their cell, and a push to the Cinder app on every device they turned it on for. */
async function alertOwner(c: Client, text: string, threadId?: string, sql?: Sql) {
  const cell = e164(c.setup.owner_cell || "");
  // Remember who this alert was about, so the owner can answer it by text ("QUOTE 4200").
  if (sql && threadId) await sql`UPDATE public.client_threads SET owner_alerted_at = now() WHERE id = ${threadId}::uuid`.catch(() => {});
  await Promise.all([
    cell ? sendSms(cell, c.setup.texting_number || "", text) : Promise.resolve(false),
    pushToProject(c.projectId, { ...pushFromAlert(text), url: threadId ? `/app?thread=${threadId}` : "/app", tag: threadId }),
  ]);
}

/** A call to the client's number went unanswered: text the caller back right away and tell the owner. */
export async function clientMissedCall(sql: Sql, c: Client, caller: string): Promise<void> {
  const t = await thread(sql, c, caller, "missed_call");
  if (t.fresh) await recordConsent(sql, c, e164(caller), "inbound_call", "phone", `Called ${c.setup.texting_number || "the business number"}`);
  if (t.status === "opted_out") return;
  const lang: Lang = t.lang === "es" ? "es" : "en";
  // After hours: the client's approved after-hours wording, else a reply that still starts the conversation now.
  const open = isOpen(parseHours(c.setup.hours, tzOf(c)));
  const body = fill(open ? say(c, "missed_call", FALLBACK.missed_call, lang) : lang === "es" ? ES.after_hours_call : wording(c.messages, "after_hours", EN.after_hours_call), varsFor(c));
  await log(sql, c, t.id, "in", "system", open ? "Missed call" : "Missed call (after hours)");
  await sql`UPDATE public.client_threads SET contact_at = now() WHERE id = ${t.id}::uuid`;
  await sendToCustomer(sql, c, t.id, caller, body, "template");
  await alertOwner(c, ownerAlert("missed", e164(caller), "They got your text back. Replies are handled for you."), t.id, sql);
}

/** Open estimate times on the client's calendar, or null when it isn't connected (then the booking link is used). */
async function openSlots(sql: Sql, c: Client, lang: Lang): Promise<Slot[] | null> {
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (!cal) return null;
  const now = new Date();
  try {
    const busy = await busyTimes(cal, now, new Date(now.getTime() + 14 * 86400000));
    return freeSlots(busy, parseHours(c.setup.hours, tzOf(c), cal.slotMin), now, { max: 6, lang });
  } catch (e) { console.error("Client calendar read failed", e instanceof Error ? e.message : e); return null; }
}

/** The reply engine's next text, or null when it should hand off. Never throws. */
export async function draftReply(sql: Sql, c: Client, threadId: string, customerName: string, slots: Slot[] | null = null, extra = "") {
  const history = await sql`SELECT direction, body FROM public.client_texts WHERE thread_id = ${threadId}::uuid ORDER BY at DESC LIMIT 20` as { direction: string; body: string }[];
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const system = replySystem(c.setup, c.messages) + (slots ? bookingRules(slots) : "") + extra;
    const text = await claudeText({ apiKey: key, system, user: replyUser(history.reverse(), customerName), label: "Client reply", model: process.env.CINDER_REPLY_MODEL?.trim() || "claude-haiku-5-5", maxTokens: 500, timeoutMs: 20000 });
    return parseDecision(text);
  } catch (e) { console.error("Client reply failed", e instanceof Error ? e.message : e); return null; }
}

/** They picked an offered time: put it on the owner's calendar and keep a record for the reminder. */
async function book(sql: Sql, c: Client, threadId: string, phone: string, who: string, slot: Slot, summary: string): Promise<boolean> {
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (!cal) return false;
  try {
    const eventId = await createEvent(cal, { start: slot.start, end: slot.end, tz: tzOf(c), title: `Estimate: ${who}`, details: `${summary}\nPhone: ${phone}\nBooked by Cinder by text.` });
    const [ap] = await sql`INSERT INTO public.client_appointments (owner_id, project_id, thread_id, starts_at, ends_at, event_id) VALUES (${c.owner}, ${c.projectId}::uuid, ${threadId}::uuid, ${slot.start}::timestamptz, ${slot.end}::timestamptz, ${eventId}) RETURNING id` as { id: string }[];
    // Shops on Jobber get the estimate there too, on the customer's record. Never undoes the booking if Jobber fails.
    if (ap) await syncBookingToJobber(sql, c.projectId, ap.id, { name: who, phone: e164(phone), start: slot.start, end: slot.end, tz: tzOf(c), summary });
    if (ap) await firstBookingBilling(sql, c).catch(e => console.error("First-booking alert failed", e instanceof Error ? e.message : e));
    return true;
  } catch (e) { console.error("Booking failed", e instanceof Error ? e.message : e); return false; }
}

/** The agreement starts the monthly fee on the first booked appointment, so the first booking tells Sam to send the monthly link. */
async function firstBookingBilling(sql: Sql, c: Client): Promise<void> {
  const [n] = await sql`SELECT count(*)::int AS n FROM public.client_appointments WHERE project_id = ${c.projectId}::uuid` as { n: number }[];
  if (!n || n.n !== 1) return;
  const [d] = await sql`SELECT coalesce(nullif(p.client_name, ''), p.name) AS name, d.service_type, d.monthly_fee, c.email, c.first_name FROM public.projects p
    LEFT JOIN public.deals d ON d.id = p.deal_id AND d.owner_id = p.owner_id
    LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    WHERE p.id = ${c.projectId}::uuid` as { name: string; service_type: string | null; monthly_fee: number | null; email: string | null; first_name: string | null }[];
  const ws = await loadWorkspace(c.owner);
  const fee = Number(d?.monthly_fee ?? 0);
  const link = paymentLinkFor(ws, d?.service_type ?? null, "monthly_retainer", fee).link;
  await sendAlert({ subject: `First booking: start ${d?.name ?? "the client"}'s monthly`, lines: [
    `${d?.name ?? "A client"} just got their first booked appointment. Under the agreement, the monthly fee${fee ? ` ($${fee.toLocaleString("en-US")})` : ""} starts today.`,
    link ? `Send ${d?.first_name || "them"} the monthly link${d?.email ? ` at ${d.email}` : ""}: ${link}` : "No monthly payment link is set for this plan. Add one in Settings, then send it.",
  ], link: { label: "Open Money", path: "/crm/finance" } });
}

/** The owner texted their Cinder number: "QUOTE 4200 [name]" starts quote follow-up; anything else gets a pointer to the app. */
async function ownerText(sql: Sql, c: Client, body: string): Promise<void> {
  const cell = e164(c.setup.owner_cell || ""), from = c.setup.texting_number || "";
  const app = (process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || "https://cinderrevenue.com") + "/app";
  const q = parseOwnerQuote(body);
  if (!q) { await sendSms(cell, from, OWNER_HELP.replace("{app}", app)); return; }
  const [t] = q.name
    ? await sql`SELECT id, customer_phone, customer_name FROM public.client_threads WHERE project_id = ${c.projectId}::uuid AND status <> 'opted_out'
        AND customer_name ILIKE ${q.name.split(" ")[0] + "%"} ORDER BY coalesce(owner_alerted_at, updated_at) DESC LIMIT 1` as { id: string; customer_phone: string; customer_name: string }[]
    : await sql`SELECT id, customer_phone, customer_name FROM public.client_threads WHERE project_id = ${c.projectId}::uuid AND status <> 'opted_out'
        AND owner_alerted_at > now() - interval '30 days' ORDER BY owner_alerted_at DESC LIMIT 1` as { id: string; customer_phone: string; customer_name: string }[];
  if (!t) { await sendSms(cell, from, q.name ? `I couldn't find a customer named ${q.name}. Start the follow-up from the Cinder app: ${app}` : `I'm not sure which customer that's for. Add their name, like QUOTE 4200 Dana, or use the app: ${app}`); return; }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tzOf(c) });
  const [open] = await sql`SELECT id FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open','replied')
    AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(t.customer_phone)} ORDER BY created_at DESC LIMIT 1` as { id: string }[];
  if (open) await sql`UPDATE public.client_quotes SET amount = coalesce(${q.amount}, amount), sent_on = ${today}::date, status = 'open', steps_sent = 0 WHERE id = ${open.id}::uuid`;
  else await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.customer_phone}, ${t.customer_name}, ${q.amount}, ${today}::date)`;
  await sql`UPDATE public.client_appointments SET status = 'done' WHERE thread_id = ${t.id}::uuid AND status = 'booked' AND starts_at < now()`;
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'out', 'system', ${`Quote sent${q.amount ? `: $${q.amount.toLocaleString("en-US")}` : ""}. Cinder follows up until they answer.`})`;
  const who = t.customer_name || e164(t.customer_phone);
  await sendSms(cell, from, `Got it. Following up with ${who} on the ${q.amount ? "$" + q.amount.toLocaleString("en-US") + " " : ""}quote: days 2, 5, 10 and 21, until they answer.`);
}

/** Marks an estimate canceled and removes it from the owner's Google Calendar. True when the calendar is clean. */
async function cancelAppointment(sql: Sql, c: Client, appointmentId: string, eventId: string): Promise<boolean> {
  await sql`UPDATE public.client_appointments SET status = 'canceled' WHERE id = ${appointmentId}::uuid AND status = 'booked'`;
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (!cal) return false;
  try { await deleteEvent(cal, eventId); return true; } catch (e) { console.error("Calendar delete failed", e instanceof Error ? e.message : e); return false; }
}

/** A customer texted the client's number. */
export async function clientInboundText(sql: Sql, c: Client, from: string, body: string, media: Media[] = []): Promise<void> {
  // The owner texting their own Cinder number (often replying to an alert) is never treated as a customer.
  if (c.setup.owner_cell && sameNumber(from, c.setup.owner_cell)) { await ownerText(sql, c, body); return; }
  const t = await thread(sql, c, from, "text");
  if (t.fresh) await recordConsent(sql, c, e164(from), "inbound_text", "text", `First text: "${body.slice(0, 200)}"`);
  // A photo with no words still reads as something the reply engine and the owner can follow.
  if (!body.trim() && media.length) body = media.length === 1 ? "(sent a photo)" : `(sent ${media.length} photos)`;
  await log(sql, c, t.id, "in", "customer", body, true, media);
  let lang: Lang = t.lang === "es" ? "es" : "en";
  if (lang === "en" && detectLang(body) === "es") { lang = "es"; await sql`UPDATE public.client_threads SET lang = 'es' WHERE id = ${t.id}::uuid`; }
  const [{ n: inbound }] = await sql`SELECT count(*)::int AS n FROM public.client_texts WHERE thread_id = ${t.id}::uuid AND direction = 'in' AND author = 'customer'` as { n: number }[];
  const firstText = inbound <= 1;
  // Any reply stops the quote follow-ups for that number: a person is talking now.
  await sql`UPDATE public.client_quotes SET status = 'replied' WHERE project_id = ${c.projectId}::uuid AND status = 'open' AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(from)}`;
  if (isStop(body)) {
    const was = t.status;
    await sql`UPDATE public.client_threads SET status = 'opted_out', updated_at = now() WHERE id = ${t.id}::uuid`;
    await recordConsent(sql, c, e164(from), "opt_out", isPlainOptOut(body) ? "plain words" : "keyword", body.slice(0, 200));
    await sql`UPDATE public.client_quotes SET status = 'stopped' WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(from)} AND status IN ('open','replied')`;
    // STOP and the other keywords: the carrier confirms. Plain words ("stop texting me"): we confirm, once.
    if (isPlainOptOut(body) && was !== "opted_out") await sendToCustomer(sql, c, t.id, from, fill(OPTOUT_TEXT, varsFor(c)), "template");
    return;
  }
  if (isHelp(body)) { await recordConsent(sql, c, e164(from), "help", "keyword", body); return; } // the carrier sends the HELP reply
  if (t.status === "opted_out") {
    if (!isStart(body)) return;
    await sql`UPDATE public.client_threads SET status = 'auto' WHERE id = ${t.id}::uuid`;
    await recordConsent(sql, c, e164(from), "opt_in", "keyword", body.slice(0, 60));
    return;
  }
  if (t.status === "paused" || t.status === "closed") { await alertOwner(c, ownerAlert("handoff", t.customer_name || e164(from), `They texted: "${body.slice(0, 160)}"`), t.id, sql); return; }
  const slots = await openSlots(sql, c, lang);
  // Already booked? The reply engine needs to know, so "can we do Friday instead?" moves the estimate, not doubles it.
  const [current] = await sql`SELECT id, starts_at, event_id FROM public.client_appointments WHERE thread_id = ${t.id}::uuid AND status = 'booked' AND starts_at > now() ORDER BY starts_at LIMIT 1` as { id: string; starts_at: string; event_id: string }[];
  const d = await draftReply(sql, c, t.id, t.customer_name, slots, current ? existingBookingRules(slotLabel(new Date(current.starts_at).toISOString(), tzOf(c), lang)) : "");
  const who = t.customer_name || e164(from);
  if (!d || d.handoff) {
    if (d?.reply) await sendToCustomer(sql, c, t.id, from, d.reply, "ai");
    await sendToCustomer(sql, c, t.id, from, fill(say(c, "handoff", FALLBACK.handoff, lang), varsFor(c)), "template");
    await sql`UPDATE public.client_threads SET status = 'paused', handoff_at = now(), handoff_nudged_at = NULL, handoff_held_at = NULL, updated_at = now() WHERE id = ${t.id}::uuid`;
    await alertOwner(c, ownerAlert("handoff", who, d?.summary || `They texted: "${body.slice(0, 160)}"`), t.id, sql);
    return;
  }
  await sendToCustomer(sql, c, t.id, from, d.reply, "ai");
  const picked = slots ? pickedSlot(d.book, slots) : null;
  if (picked) {
    const ok = await book(sql, c, t.id, e164(from), who, picked, d.summary);
    await sql`UPDATE public.client_threads SET status = 'booked', updated_at = now() WHERE id = ${t.id}::uuid`;
    // A repeat customer booked: their next "you're due" counts from this visit.
    const day = new Date(picked.start).toLocaleDateString("en-CA", { timeZone: tzOf(c) });
    await sql`UPDATE public.client_customers SET last_service = ${day}::date, next_due = ${day}::date + interval_days, due_steps = 0, due_texted_at = NULL
      WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(from)}`.catch(() => {});
    if (current && ok) {
      // They moved it: take the old estimate off the calendar so there's one appointment, not two.
      const removed = await cancelAppointment(sql, c, current.id, current.event_id);
      await alertOwner(c, ownerAlert("moved", who, `from ${slotLabel(new Date(current.starts_at).toISOString(), tzOf(c))} to ${slotLabel(picked.start, tzOf(c))}${removed ? "" : ". Delete the old one from your calendar, it didn't come off"}.`), t.id, sql);
    } else await alertOwner(c, ownerAlert("booked", who, `${slotLabel(picked.start, tzOf(c))}${ok ? ", on your calendar" : " (add it to your calendar, it didn't save)"}. ${d.summary}`), t.id, sql);
  } else if (d.stage === "canceled" && current) {
    const removed = await cancelAppointment(sql, c, current.id, current.event_id);
    await sql`UPDATE public.client_threads SET status = 'auto', updated_at = now() WHERE id = ${t.id}::uuid`;
    await alertOwner(c, ownerAlert("canceled", who, `${slotLabel(new Date(current.starts_at).toISOString(), tzOf(c))}${removed ? ", taken off your calendar" : ". Delete it from your calendar, it didn't come off"}.`), t.id, sql);
  } else if (d.stage === "booked") {
    await sql`UPDATE public.client_threads SET status = 'booked', updated_at = now() WHERE id = ${t.id}::uuid`;
    await alertOwner(c, ownerAlert("booked", who, d.summary), t.id, sql);
  } else if (d.stage === "not_fit" || d.stage === "done") {
    // Not a job they take, or the customer is done: close it so nothing else (like a follow-up nudge) goes out.
    await sql`UPDATE public.client_threads SET status = 'closed', updated_at = now() WHERE id = ${t.id}::uuid`;
    if (firstText) await alertOwner(c, ownerAlert("new", who, d.summary), t.id, sql);
  } else if (firstText) await alertOwner(c, ownerAlert("new", who, d.summary), t.id, sql);
}

/**
 * Leads that went quiet: up to three friendly nudges (about 2 hours, next day, day 3) inside 8 AM to 8 PM in the
 * client's time zone. Only threads still on autopilot: a reply, booking, handoff, close or opt-out stops them.
 */
export async function runLeadNudges(sql: Sql, now = new Date(), limit = 80): Promise<{ sent: number; skipped: number }> {
  const rows = await sql`SELECT t.id, t.owner_id, t.project_id, t.customer_phone, t.customer_name, t.lang, t.nudges_sent, t.nudge_anchor,
      coalesce(t.contact_at, t.created_at) AS contact_at,
      (SELECT max(x.at) FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'in' AND x.author = 'customer') AS last_customer,
      (SELECT max(x.at) FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'out' AND x.ok) AS last_out
    FROM public.client_threads t
    WHERE t.status = 'auto' AND t.source NOT IN ('quote', 'review', 'due') AND t.updated_at > now() - interval '8 days'
    ORDER BY t.updated_at LIMIT 1000` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; lang: Lang; nudges_sent: number; nudge_anchor: string | null; contact_at: string; last_customer: string | null; last_out: string | null }[];
  const ms = (v: string | null) => (v ? new Date(v).getTime() : null);
  const clients = new Map<string, Client | null>();
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (sent >= limit) break;
    const anchorMs = Math.max(ms(r.contact_at) ?? 0, ms(r.last_customer) ?? 0) || null;
    const step = nudgeStep({ anchor: anchorMs, lastOut: ms(r.last_out), nudgeAnchor: ms(r.nudge_anchor), nudgesSent: r.nudges_sent, now: now.getTime() });
    if (step === null) continue;
    const key = r.owner_id + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, r.owner_id, r.project_id));
    const c = clients.get(key);
    if (!c?.setup.texting_number || !inTextingHours(tzOf(c), now)) { skipped++; continue; }
    if (!(await roomFor(sql, r.id))) { skipped++; continue; }
    // Claim the step first, so two overlapping runs can never send the same nudge twice.
    const anchorIso = new Date(anchorMs!).toISOString();
    const [claimed] = await sql`UPDATE public.client_threads SET nudges_sent = ${step + 1}, nudge_anchor = ${anchorIso}::timestamptz
      WHERE id = ${r.id}::uuid AND status = 'auto' AND (CASE WHEN nudge_anchor = ${anchorIso}::timestamptz THEN nudges_sent ELSE 0 END) = ${step} RETURNING id`;
    if (!claimed) continue;
    const lang: Lang = r.lang === "es" ? "es" : "en";
    const body = fill(say(c, `nudge_${step + 1}`, NUDGE_TEXTS[step], lang), varsFor(c, (r.customer_name || "").split(" ")[0]));
    const ok = await sendToCustomer(sql, c, r.id, r.customer_phone, body, "template");
    if (ok) sent++; else skipped++;
  }
  return { sent, skipped };
}

/** Morning job: send every quote follow-up that's due today, across all clients. */
export async function runQuoteFollowUps(sql: Sql, today: string, limit = 60): Promise<{ sent: number; skipped: number }> {
  // Book & Close's launch revival texts old leads once. With the Reactivation add-on (a repeat service set on the client),
  // an old lead who never answered gets another 3-text round each quarter, up to 4 rounds a year.
  // Anyone who replied, booked or opted out is never re-queued.
  await sql`UPDATE public.client_quotes q SET status = 'open', steps_sent = 0, sent_on = ${today}::date, rounds = q.rounds + 1
    WHERE q.kind = 'rehash' AND q.status = 'lost' AND q.rounds < 4 AND q.last_step_at < now() - interval '90 days'
      AND EXISTS (SELECT 1 FROM public.client_ops o WHERE o.project_id = q.project_id AND coalesce(o.setup->>'repeat_service', '') <> '')
      AND NOT EXISTS (SELECT 1 FROM public.client_threads t WHERE t.project_id = q.project_id AND t.status IN ('opted_out', 'booked')
        AND right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10))`.catch(e => console.error("Reactivation re-queue failed", e));
  const quotes = await sql`SELECT q.id, q.owner_id, q.project_id, q.customer_phone, q.customer_name, q.sent_on, q.steps_sent, q.kind
    FROM public.client_quotes q WHERE q.status = 'open' ORDER BY q.sent_on LIMIT 1000` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; sent_on: string; steps_sent: number; kind: string }[];
  let sent = 0, skipped = 0;
  const clients = new Map<string, Client | null>();
  for (const q of quotes) {
    if (sent >= limit) break;
    const key = q.owner_id + q.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, q.owner_id, q.project_id));
    const c = clients.get(key);
    // Old leads for contractors; past customers for repeat-service trades (they bought before, so the wording differs).
    const seqKey = q.kind === "rehash" ? (isRepeatTrade(c?.setup.trade) ? "reactivate" : "rehash") : "quote";
    const seq = SEQUENCES[seqKey];
    const step = quoteStepDue(String(q.sent_on).slice(0, 10), q.steps_sent, today, seq.days);
    if (step === null) continue;
    // Daytime only in the client's time zone; a step that's due stays due for the next run.
    if (!c?.setup.texting_number || !inTextingHours(tzOf(c))) { skipped++; continue; }
    const t = await thread(sql, c, q.customer_phone, "quote");
    if (t.status === "opted_out" || t.status === "paused") { skipped++; continue; }
    if (!(await roomFor(sql, t.id))) { skipped++; continue; }
    const k = `${seqKey}_${step + 1}`;
    const body = fill(say(c, k, seq.texts[step], t.lang === "es" ? "es" : "en"), varsFor(c, q.customer_name.split(" ")[0]));
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
  if (!inTextingHours(tzOf(c))) return { ok: false, error: "It's outside texting hours (8 AM to 8 PM). Send the review request in the morning." };
  const [dup] = await sql`SELECT 1 FROM public.client_reviews WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(phone)} LIMIT 1`;
  if (dup) return { ok: false, error: "That customer already got a review request." };
  const t = await thread(sql, c, phone, "review");
  if (t.status === "opted_out") return { ok: false, error: "That customer opted out of texts." };
  const ok = await sendToCustomer(sql, c, t.id, phone, fill(say(c, "review", REVIEW_TEXT, t.lang === "es" ? "es" : "en"), varsFor(c, name.split(" ")[0])), "template");
  if (ok) await sql`INSERT INTO public.client_reviews (owner_id, project_id, customer_phone, customer_name) VALUES (${c.owner}, ${c.projectId}::uuid, ${e164(phone)}, ${name})`;
  return ok ? { ok } : { ok, error: "The text didn't send. Check the texting number and registration." };
}

/** Day-before reminders for every booked estimate tomorrow (client's time zone), once each. */
export async function sendReminders(sql: Sql, limit = 80): Promise<{ sent: number }> {
  const rows = await sql`SELECT a.id, a.owner_id, a.project_id, a.starts_at, t.customer_phone, t.customer_name, t.lang, t.status
    FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
    WHERE a.status = 'booked' AND a.reminded_at IS NULL AND a.starts_at > now() + interval '10 hours' AND a.starts_at < now() + interval '40 hours'
    ORDER BY a.starts_at LIMIT ${limit}` as { id: string; owner_id: string; project_id: string; starts_at: string; customer_phone: string; customer_name: string; lang: Lang; status: string }[];
  let sent = 0;
  for (const r of rows) {
    if (r.status === "opted_out") continue;
    const c = await clientById(sql, r.owner_id, r.project_id);
    if (!c?.setup.texting_number || !inTextingHours(tzOf(c))) continue; // a later run the same day sends it
    const tz = tzOf(c), start = new Date(r.starts_at);
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(Date.now() + 86400000));
    if (new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(start) !== tomorrow) continue;
    const t = await thread(sql, c, r.customer_phone, "text");
    const time = slotLabel(start.toISOString(), tz, r.lang);
    const ok = await sendToCustomer(sql, c, t.id, r.customer_phone, fill(say(c, "reminder", EN.reminder, r.lang), { ...varsFor(c, r.customer_name.split(" ")[0]), time }), "template");
    await sql`UPDATE public.client_appointments SET reminded_at = now() WHERE id = ${r.id}::uuid`;
    if (ok) sent++;
  }
  return { sent };
}

/** The owner marked a no-show: text to rebook, and let the reply engine take it from there. */
export async function markNoShow(sql: Sql, c: Client, appointmentId: string): Promise<{ ok: boolean; error?: string }> {
  const [a] = await sql`UPDATE public.client_appointments SET status = 'no_show' WHERE id = ${appointmentId}::uuid AND project_id = ${c.projectId}::uuid AND status = 'booked' RETURNING thread_id` as { thread_id: string }[];
  if (!a) return { ok: false, error: "That appointment isn't open." };
  const [t] = await sql`UPDATE public.client_threads SET status = 'auto', updated_at = now() WHERE id = ${a.thread_id}::uuid AND status <> 'opted_out' RETURNING customer_phone, customer_name, lang` as { customer_phone: string; customer_name: string; lang: Lang }[];
  if (!t) return { ok: false, error: "That customer opted out of texts." };
  const ok = await sendToCustomer(sql, c, a.thread_id, t.customer_phone, fill(say(c, "noshow", EN.noshow, t.lang), varsFor(c, t.customer_name.split(" ")[0])), "template");
  return ok ? { ok } : { ok, error: "The text didn't send." };
}

/** A new lead from a web form: text them right away from the client's number, the reply engine takes the replies. */
export async function webLead(sql: Sql, c: Client, lead: Lead | { name: string; phone: string; email: string; message: string; source: string; via?: string }, ip = ""): Promise<{ ok: boolean; threadId: string }> {
  const paid = (PAID as string[]).includes(lead.source);
  const t = await thread(sql, c, lead.phone, lead.source || "web form");
  await recordConsent(sql, c, lead.phone, paid ? "paid_lead" : "web_form", lead.source,
    `${paid ? `Requested a quote on ${lead.via || lead.source}` : "Submitted a form asking to be contacted"}${"smsConsent" in lead && lead.smsConsent === true ? ", opted in to promo texts" : "smsConsent" in lead && lead.smsConsent === false ? ", did not opt in to promo texts" : ""}${lead.name ? ` as ${lead.name}` : ""}${lead.email ? ` <${lead.email}>` : ""}${lead.message ? `: "${lead.message.slice(0, 200)}"` : ""}`, ip);
  if (t.status === "opted_out") return { ok: false, threadId: t.id };
  const lang: Lang = detectLang(lead.message) === "es" ? "es" : "en";
  await sql`UPDATE public.client_threads SET customer_name = CASE WHEN customer_name = '' THEN ${lead.name} ELSE customer_name END, lang = ${lang}, source = ${lead.source}, contact_at = now() WHERE id = ${t.id}::uuid`;
  await log(sql, c, t.id, "in", "system", `New ${lead.source} lead${lead.message ? `: "${lead.message.slice(0, 300)}"` : ""}${lead.email ? ` · ${lead.email}` : ""}`);
  const via = lead.via || "";
  const afterHours = lang === "en" && !isOpen(parseHours(c.setup.hours, tzOf(c))) && c.messages.some(m => m.key === "after_hours" && m.status === "approved");
  const text = afterHours ? wording(c.messages, "after_hours", EN.web_lead) : paid ? say(c, "paid_lead", EN.paid_lead, lang).split("{via}").join(via) : say(c, "web_lead", EN.web_lead, lang);
  const ok = await sendToCustomer(sql, c, t.id, lead.phone, fill(text, varsFor(c, lead.name.split(" ")[0])), "template");
  await alertOwner(c, ownerAlert("new", lead.name || lead.phone, `${paid ? via : lead.source}${lead.message ? `: ${lead.message.slice(0, 120)}` : ""}. Texted back.`), t.id, sql);
  return { ok, threadId: t.id };
}

/** Monday morning: each live client's owner gets last week's numbers by text, once a week. */
export async function sendMondayReports(sql: Sql, origin: string, week: string): Promise<{ sent: number }> {
  const clients = await sql`SELECT o.project_id, o.owner_id, o.portal_token FROM public.client_ops o
    WHERE coalesce(o.setup->>'texting_number','') <> '' AND coalesce(o.setup->>'owner_cell','') <> ''
      AND NOT EXISTS (SELECT 1 FROM public.client_weekly w WHERE w.project_id = o.project_id AND w.week = ${week}::date)` as { project_id: string; owner_id: string; portal_token: string | null }[];
  let sent = 0;
  for (const r of clients) {
    const c = await clientById(sql, r.owner_id, r.project_id);
    if (!c) continue;
    const [k] = await sql`WITH t AS (SELECT t.id, t.created_at, t.last_out_at, t.status, t.updated_at,
        (SELECT extract(epoch FROM (min(o.at) - t.created_at)) FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out') AS first_sec
        FROM public.client_threads t WHERE t.project_id = ${r.project_id}::uuid AND t.source NOT IN ('quote','rehash','review'))
      SELECT count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS leads,
        count(*) FILTER (WHERE created_at > now() - interval '7 days' AND last_out_at IS NOT NULL)::int AS answered,
        count(*) FILTER (WHERE status = 'booked' AND updated_at > now() - interval '7 days')::int AS booked,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY first_sec) FILTER (WHERE created_at > now() - interval '7 days' AND first_sec IS NOT NULL) AS reply_sec FROM t` as Record<string, unknown>[];
    const [q] = await sql`SELECT count(*) FILTER (WHERE last_step_at > now() - interval '7 days')::int AS chased,
        coalesce(sum(amount) FILTER (WHERE status = 'open' AND kind = 'quote'), 0)::float AS open_value,
        count(*) FILTER (WHERE status = 'won' AND last_step_at > now() - interval '14 days')::int AS won,
        coalesce(sum(amount) FILTER (WHERE status = 'won' AND last_step_at > now() - interval '14 days'), 0)::float AS won_value
      FROM public.client_quotes WHERE project_id = ${r.project_id}::uuid` as Record<string, unknown>[];
    const [rv] = await sql`SELECT count(*)::int AS n FROM public.client_reviews WHERE project_id = ${r.project_id}::uuid AND sent_at > now() - interval '7 days'` as { n: number }[];
    const n = (v: unknown) => Number(v) || 0;
    const w = { leads: n(k?.leads), answered: n(k?.answered), replySec: k?.reply_sec == null ? null : Math.round(n(k.reply_sec)), booked: n(k?.booked), quotesChased: n(q?.chased), openQuoteValue: n(q?.open_value), won: n(q?.won), wonValue: n(q?.won_value), reviews: n(rv?.n) };
    if (!w.leads && !w.quotesChased && !w.reviews) { await sql`INSERT INTO public.client_weekly (project_id, week) VALUES (${r.project_id}::uuid, ${week}::date) ON CONFLICT DO NOTHING`; continue; }
    const link = r.portal_token ? `${origin}/portal/${r.portal_token}` : origin;
    const ok = await sendSms(e164(c.setup.owner_cell), c.setup.texting_number, mondayText(c.setup.display_name || "your business", w, link));
    if (ok) { sent++; await sql`INSERT INTO public.client_weekly (project_id, week) VALUES (${r.project_id}::uuid, ${week}::date) ON CONFLICT DO NOTHING`; }
  }
  return { sent };
}

/**
 * Customers handed to the owner who haven't heard back. The owner gets one reminder after 45 minutes (7 AM to
 * 9 PM their time); after 3 hours the customer gets one "sorry for the wait" so they don't think they were dropped.
 * Any reply or call-back from the owner, or the owner turning the automation back on, ends it.
 */
export async function runHandoffChecks(sql: Sql, now = new Date(), limit = 80): Promise<{ reminded: number; held: number }> {
  const rows = await sql`SELECT t.id, t.owner_id, t.project_id, t.customer_phone, t.customer_name, t.lang, t.handoff_at, t.handoff_nudged_at, t.handoff_held_at
    FROM public.client_threads t
    WHERE t.status = 'paused' AND t.handoff_at > now() - interval '3 days' AND (t.handoff_nudged_at IS NULL OR t.handoff_held_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'out' AND x.at > t.handoff_at
        AND (x.author = 'owner' OR (x.author = 'system' AND x.body = 'You called them back')))
    ORDER BY t.handoff_at LIMIT 300` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; lang: Lang; handoff_at: string; handoff_nudged_at: string | null; handoff_held_at: string | null }[];
  const clients = new Map<string, Client | null>();
  let reminded = 0, held = 0;
  for (const r of rows) {
    if (reminded + held >= limit) break;
    const key = r.owner_id + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, r.owner_id, r.project_id));
    const c = clients.get(key);
    if (!c?.setup.texting_number) continue;
    const tz = tzOf(c);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
    const act = handoffAction({ handoffAt: new Date(r.handoff_at).getTime(), nudgedAt: r.handoff_nudged_at ? new Date(r.handoff_nudged_at).getTime() : null,
      heldAt: r.handoff_held_at ? new Date(r.handoff_held_at).getTime() : null, now: now.getTime(), ownerHours: hour >= 7 && hour < 21, textingHours: inTextingHours(tz, now) });
    const who = r.customer_name || e164(r.customer_phone);
    if (act === "remind") {
      const [claimed] = await sql`UPDATE public.client_threads SET handoff_nudged_at = now() WHERE id = ${r.id}::uuid AND handoff_nudged_at IS NULL RETURNING id`;
      if (!claimed) continue;
      await alertOwner(c, ownerAlert("waiting", who, "They're still waiting for you. Reply or call them back from the Cinder app."), r.id, sql);
      reminded++;
    } else if (act === "hold") {
      const [claimed] = await sql`UPDATE public.client_threads SET handoff_held_at = now(), handoff_nudged_at = coalesce(handoff_nudged_at, now()) WHERE id = ${r.id}::uuid AND handoff_held_at IS NULL RETURNING id`;
      if (!claimed) continue;
      if (!(await roomFor(sql, r.id))) continue;
      const lang: Lang = r.lang === "es" ? "es" : "en";
      const ok = await sendToCustomer(sql, c, r.id, r.customer_phone, fill(say(c, "handoff_hold", lang === "es" ? ES.handoff_hold : EN.handoff_hold, lang), varsFor(c, (r.customer_name || "").split(" ")[0])), "template");
      await alertOwner(c, ownerAlert("waiting", who, "We told them you'll reach out soon. Call them back from the Cinder app."), r.id, sql);
      if (ok) held++;
    }
  }
  return { reminded, held };
}

/**
 * Repeat Revenue: past customers whose next visit is due get a text from the business's number, with two open times
 * when the calendar is connected; 4 days later one reminder if they haven't answered. Replies go to the reply engine,
 * which books them. Inside texting hours in the client's time zone; opted-out numbers are never texted.
 */
export async function runDueTexts(sql: Sql, now = new Date(), limit = 120): Promise<{ sent: number; skipped: number }> {
  const rows = await sql`SELECT cu.id, cu.owner_id, cu.project_id, cu.customer_phone, cu.customer_name, cu.service, cu.due_steps, cu.due_texted_at, cu.next_due::text AS next_due
    FROM public.client_customers cu
    WHERE cu.status = 'active' AND cu.next_due <= current_date + 1 AND cu.due_steps < ${DUE_TEXTS.length}
      AND (cu.due_steps = 0 OR cu.due_texted_at < now() - make_interval(days => ${DUE_GAP_DAYS}))
    ORDER BY cu.next_due LIMIT 600` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; service: string; due_steps: number; due_texted_at: string | null; next_due: string }[];
  const clients = new Map<string, Client | null>(), slotsFor = new Map<string, Slot[] | null>();
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (sent >= limit) break;
    const key = r.owner_id + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, r.owner_id, r.project_id));
    const c = clients.get(key);
    if (!c?.setup.texting_number || !inTextingHours(tzOf(c), now)) { skipped++; continue; }
    if (r.next_due > now.toLocaleDateString("en-CA", { timeZone: tzOf(c) })) continue;   // due tomorrow in their zone, not yet
    const [t0] = await sql`SELECT id, status FROM public.client_threads WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${digits10(r.customer_phone)} LIMIT 1` as { id: string; status: string }[];
    if (t0?.status === "opted_out") { await sql`UPDATE public.client_customers SET status = 'opted_out' WHERE id = ${r.id}::uuid`; continue; }
    if (r.due_steps > 0 && t0) {
      // They answered the first text, or already booked: no reminder.
      const [answered] = await sql`SELECT 1 FROM public.client_texts WHERE thread_id = ${t0.id}::uuid AND direction = 'in' AND author = 'customer' AND at > ${r.due_texted_at}::timestamptz LIMIT 1`;
      if (answered || t0.status === "booked" || t0.status === "paused") { await sql`UPDATE public.client_customers SET due_steps = ${DUE_TEXTS.length} WHERE id = ${r.id}::uuid`; continue; }
    }
    if (t0 && !(await roomFor(sql, t0.id))) { skipped++; continue; }
    const [claimed] = await sql`UPDATE public.client_customers SET due_steps = due_steps + 1, due_texted_at = now()
      WHERE id = ${r.id}::uuid AND due_steps = ${r.due_steps} RETURNING id`;
    if (!claimed) continue;
    const t = await thread(sql, c, r.customer_phone, "due");
    await sql`UPDATE public.client_threads SET customer_name = CASE WHEN customer_name = '' THEN ${r.customer_name} ELSE customer_name END,
      status = CASE WHEN status IN ('closed', 'booked') THEN 'auto' ELSE status END, updated_at = now() WHERE id = ${t.id}::uuid`;
    const lang: Lang = t.lang === "es" ? "es" : "en";
    let slots = "";
    if (r.due_steps === 0) {
      if (!slotsFor.has(key)) slotsFor.set(key, await openSlots(sql, c, lang));
      const open = (slotsFor.get(key) ?? []).slice(0, 2);
      if (open.length === 2) slots = lang === "es" ? ` Tengo ${open[0].label} o ${open[1].label}.` : ` I have ${open[0].label} or ${open[1].label} open.`;
    }
    const service = r.service || c.setup.repeat_service || (lang === "es" ? "servicio" : "service");
    const body = fill(say(c, `due_${r.due_steps + 1}`, DUE_TEXTS[r.due_steps], lang).split("{slots}").join(slots).split("{service}").join(service), varsFor(c, (r.customer_name || "").split(" ")[0]));
    const ok = await sendToCustomer(sql, c, t.id, r.customer_phone, body, "template");
    if (ok) sent++; else skipped++;
  }
  return { sent, skipped };
}
