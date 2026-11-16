// Client runtime, I/O: what happens when a client's customer calls or texts their Cinder number,
// plus quote follow-ups and review requests. Every send is logged on the customer's thread.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { claudeText } from "@/lib/ai-text";
import { sendSms, sendSmsDetailed } from "@/lib/twilio";
import { recordConsent } from "@/lib/client-consent";
import { PAID, type Lead } from "@/lib/lead-sources";
import { cleanMessages } from "@/lib/client-ops";
import { ballpark, cleanDetails, detailLine, intakeRules, parsePriceBook, rangeText } from "@/lib/crm";
import { emitEvent } from "@/lib/client-webhook";
import { digits10, fill, wording, FALLBACK, isStop, isStart, isHelp, isPlainOptOut, OPTOUT_TEXT, replySystem, replyUser, parseDecision, ownerAlert, quoteStepDue, quoteChaseDue, QUOTE_MONTHLY_TEXT, SEQUENCES, isRepeatTrade, REVIEW_TEXT, NUDGE_TEXTS, nudgeStep, inTextingHours, handoffAction, parseOwnerQuote, parseOnMyWay, OWNER_HELP, CREW_HELP, sameNumber, DUE_TEXTS, DUE_GAP_DAYS, withOptOut, automatedRoom, quoteDaysFor, nudgeHoursFor, isDoNotText, type Vars } from "@/lib/client-runtime";
import { bookingRules, detectLang, ES, EN, existingBookingRules, freeSlots, isOpen, mondayText, parseHours, pickedSlot, slotLabel, withBookingPrefs, type Lang, type Slot } from "@/lib/client-booking";
import { busyTimes, clientCalendar, createEvent, deleteEvent, moveEvent } from "@/lib/client-calendar";
import { syncBookingToJobber } from "@/lib/jobber";
import { sendAlert } from "@/lib/notify";
import { paymentLinkFor } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";
import { pushFromAlert, pushToProject } from "@/lib/client-push";
import { liveFor } from "@/lib/client-live";
import { onMyWayText } from "@/lib/client-schedule";
import { parseTeam } from "@/lib/crm";

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

/** Where customer-facing links point: the app's own domain. */
export const appOrigin = () => (process.env.CINDER_APP_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "https://personal-command-center-ten-ruby.vercel.app")).replace(/\/$/, "");
export const quoteUrl = (token: string) => `${appOrigin()}/q/${token}`;

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
async function log(sql: Sql, c: Client, threadId: string, direction: "in" | "out", author: string, body: string, ok = true, media: Media[] = [], sid = "") {
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body, ok, media, sid, status) VALUES (${c.owner}, ${threadId}::uuid, ${direction}, ${author}, ${body}, ${ok}, ${JSON.stringify(media)}::jsonb, ${sid || null}, ${sid ? "sent" : ""})`;
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
  // The owner's do-not-text list wins over everything, including the owner's own replies.
  if (isDoNotText(c.setup, phone)) { await log(sql, c, threadId, "out", "system", "Not sent: this number is on your do-not-text list.", false); return false; }
  const sent = await sendSmsDetailed(e164(phone), c.setup.texting_number || "", body, true);
  await log(sql, c, threadId, "out", author, body, sent.ok, [], sent.sid);
  return sent.ok;
}

/**
 * The owner moved an estimate (dragged it on the calendar). The appointment and the Google event move, and the
 * customer gets one text with the new time. The old time's reminder is forgotten so the new one goes out.
 */
const fname = (s: string) => (s || "").trim().split(" ")[0] || "there";
export async function rescheduleAppointment(sql: Sql, c: Client, appointmentId: string, startIso: string): Promise<{ ok: boolean; error?: string; texted?: boolean; when?: string }> {
  const start = new Date(startIso);
  if (!Number.isFinite(start.getTime())) return { ok: false, error: "Pick a time." };
  if (start.getTime() < Date.now() - 3600000) return { ok: false, error: "That time has passed." };
  const [a] = await sql`SELECT a.id, a.thread_id, a.starts_at, a.ends_at, a.event_id, t.customer_name, t.customer_phone, t.status, t.lang, t.details FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
    WHERE a.id = ${appointmentId}::uuid AND a.project_id = ${c.projectId}::uuid AND a.status = 'booked'` as { id: string; thread_id: string; starts_at: string; ends_at: string; event_id: string; customer_name: string; customer_phone: string; status: string; lang: Lang; details: unknown }[];
  if (!a) return { ok: false, error: "That estimate isn't open." };
  const len = Math.max(1800000, Date.parse(a.ends_at) - Date.parse(a.starts_at));
  const end = new Date(start.getTime() + len);
  const who = a.customer_name || a.customer_phone;
  let eventId = a.event_id;
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (cal) { try { eventId = await moveEvent(cal, a.event_id, { start: start.toISOString(), end: end.toISOString(), tz: tzOf(c), title: `Estimate: ${who}`, details: `${detailLine(c.setup.trade, cleanDetails(c.setup.trade, a.details))}\nPhone: ${a.customer_phone}\nMoved by ${c.setup.owner_name || "the owner"} in the Cinder app.` }); } catch (e) { console.error("Move failed", e instanceof Error ? e.message : e); } }
  await sql`UPDATE public.client_appointments SET starts_at = ${start.toISOString()}::timestamptz, ends_at = ${end.toISOString()}::timestamptz, event_id = ${eventId}, reminded_at = NULL WHERE id = ${a.id}::uuid`;
  const label = slotLabel(start.toISOString(), tzOf(c), a.lang === "es" ? "es" : "en");
  await log(sql, c, a.thread_id, "out", "system", `Estimate moved to ${label}.`);
  let texted = false;
  if (a.status !== "opted_out") {
    const body = a.lang === "es" ? `Hola ${fname(a.customer_name)}, ${c.setup.display_name} aquí. Movimos su presupuesto a ${label}. Si no le funciona, responda y buscamos otra hora.`
      : `Hi ${fname(a.customer_name)}, ${c.setup.display_name} here. We've moved your estimate to ${label}. If that doesn't work, reply and we'll find another time.`;
    texted = await sendToCustomer(sql, c, a.thread_id, a.customer_phone, body, "owner");
  }
  return { ok: true, texted, when: label };
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
export async function alertOwner(c: Client, text: string, threadId?: string, sql?: Sql) {
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
  void emitEvent(c.setup, c.projectId, "lead.new", { customer: { id: t.id, name: "", phone: e164(caller) }, source: "missed_call" });
}

/** Open estimate times on the client's calendar, or null when it isn't connected (then the booking link is used). */
async function openSlots(sql: Sql, c: Client, lang: Lang): Promise<Slot[] | null> {
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (!cal) return null;
  const now = new Date();
  try {
    const busy = await busyTimes(cal, now, new Date(now.getTime() + 14 * 86400000));
    return freeSlots(busy, withBookingPrefs(parseHours(c.setup.hours, tzOf(c), cal.slotMin), c.setup), now, { max: 6, lang });
  } catch (e) { console.error("Client calendar read failed", e instanceof Error ? e.message : e); return null; }
}

/** Times a customer can pick on the public booking page: the same rules as the texts, more of them. Null without a calendar. */
export async function bookingSlots(sql: Sql, c: Client, max = 24): Promise<Slot[] | null> {
  const cal = await clientCalendar(sql, c.projectId).catch(() => null);
  if (!cal) return null;
  const now = new Date();
  try {
    const busy = await busyTimes(cal, now, new Date(now.getTime() + 15 * 86400000));
    return freeSlots(busy, withBookingPrefs(parseHours(c.setup.hours, tzOf(c), cal.slotMin), c.setup), now, { days: 14, max, lang: "en" });
  } catch (e) { console.error("Booking page calendar read failed", e instanceof Error ? e.message : e); return null; }
}

/**
 * A customer booked on the public booking page: their conversation, consent, the estimate on the calendar when they
 * picked a time, a confirmation text, and the owner hears about it. Without a time it's a request the agent follows up.
 */
export async function bookingPageLead(sql: Sql, c: Client, b: { name: string; phone: string; address: string; message: string; start: string | null }, ip: string): Promise<{ ok: boolean; booked: boolean; when?: string; error?: string }> {
  const t = await thread(sql, c, b.phone, "booking page");
  await recordConsent(sql, c, b.phone, "web_form", "booking page", `Booked on the online booking page and agreed to texts${b.name ? ` as ${b.name}` : ""}`, ip);
  if (t.status === "opted_out") return { ok: false, booked: false, error: "This number opted out of texts. Call the business instead." };
  await sql`UPDATE public.client_threads SET customer_name = CASE WHEN customer_name = '' THEN ${b.name} ELSE customer_name END, source = 'booking page', contact_at = now(),
      details = details || ${JSON.stringify(b.address ? { address: b.address } : {})}::jsonb WHERE id = ${t.id}::uuid`;
  await log(sql, c, t.id, "in", "system", `Booked online${b.message ? `: "${b.message.slice(0, 300)}"` : ""}`);
  let booked = false, when = "";
  if (b.start) {
    const slots = await bookingSlots(sql, c, 60);
    const slot = slots?.find(s => s.start === b.start);
    if (!slot) return { ok: false, booked: false, error: "That time was just taken. Pick another." };
    booked = await book(sql, c, t.id, b.phone, b.name || b.phone, slot, [b.address, b.message].filter(Boolean).join("\n") || "Booked online");
    if (!booked) return { ok: false, booked: false, error: "Couldn't hold that time. Pick another, or text us." };
    when = slotLabel(slot.start, tzOf(c), "en");
    await sql`UPDATE public.client_threads SET status = 'booked', stage = coalesce(stage, 'booked'), stage_at = now(), updated_at = now() WHERE id = ${t.id}::uuid`;
  }
  const first = (b.name || "").split(" ")[0];
  const text = booked
    ? `Hi${first ? " " + first : ""}, you're booked with ${c.setup.display_name || "us"}: ${when}${b.address ? ` at ${b.address}` : ""}. ${c.setup.owner_name ? c.setup.owner_name.split(" ")[0] + " will see you then." : "See you then."} Need to change it? Just reply here.`
    : `Hi${first ? " " + first : ""}, thanks for reaching out to ${c.setup.display_name || "us"}. We got your request and will text you shortly to set a time.`;
  await sendToCustomer(sql, c, t.id, b.phone, text, "template");
  await alertOwner(c, ownerAlert(booked ? "booked" : "new", b.name || e164(b.phone), `${booked ? when + ", " : ""}from your booking page${b.message ? `: ${b.message.slice(0, 100)}` : ""}`), t.id, sql);
  void emitEvent(c.setup, c.projectId, "lead.new", { customer: { id: t.id, name: b.name, phone: e164(b.phone) }, source: "booking page", message: b.message.slice(0, 1000) });
  return { ok: true, booked, when };
}

/** The reply engine's next text, or null when it should hand off. Never throws. */
export async function draftReply(sql: Sql, c: Client, threadId: string, customerName: string, slots: Slot[] | null = null, extra = "") {
  const history = await sql`SELECT direction, body FROM public.client_texts WHERE thread_id = ${threadId}::uuid ORDER BY at DESC LIMIT 20` as { direction: string; body: string }[];
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    // Estimate-ready intake: what's known about the job, what to ask next, and a ballpark from the owner's own prices.
    const [row] = await sql`SELECT details FROM public.client_threads WHERE id = ${threadId}::uuid`.catch(() => []) as { details?: unknown }[];
    const known = cleanDetails(c.setup.trade, row?.details);
    const bp = c.setup.share_ballpark === "no" ? null : ballpark(parsePriceBook(c.setup.price_book), known);
    const system = replySystem(c.setup, c.messages) + intakeRules(c.setup.trade, known, bp) + (slots ? bookingRules(slots) : "") + extra;
    const text = await claudeText({ apiKey: key, system, user: replyUser(history.reverse(), customerName), label: "Client reply", model: process.env.CINDER_REPLY_MODEL?.trim() || "claude-haiku-5-5", maxTokens: 600, timeoutMs: 20000 });
    const d = parseDecision(text);
    if (d?.job) {
      const learned = cleanDetails(c.setup.trade, d.job);
      if (Object.keys(learned).length) await sql`UPDATE public.client_threads SET details = details || ${JSON.stringify(learned)}::jsonb WHERE id = ${threadId}::uuid`.catch(e => console.error("Saving job details failed", e instanceof Error ? e.message : e));
    }
    return d;
  } catch (e) { console.error("Client reply failed", e instanceof Error ? e.message : e); return null; }
}

/**
 * The owner tries the agent: one message from a made-up lead, the reply the agent would send. Nothing is saved and
 * nobody is texted. `overrides` are unsaved settings from the form, already cleaned, so he can preview before saving.
 */
export async function previewReply(c: Client, message: string, overrides: Record<string, string> = {}): Promise<{ reply: string; handoff: boolean } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const setup = { ...c.setup, ...overrides };
  const bp = setup.share_ballpark === "no" ? null : ballpark(parsePriceBook(setup.price_book), {});
  const system = replySystem(setup, c.messages) + intakeRules(setup.trade, {}, bp);
  try {
    const text = await claudeText({ apiKey: key, system, user: replyUser([{ direction: "in", body: message.slice(0, 500) }], "Lead"), label: "Client reply preview", model: process.env.CINDER_REPLY_MODEL?.trim() || "claude-haiku-5-5", maxTokens: 400, timeoutMs: 20000 });
    const d = parseDecision(text);
    return d ? { reply: d.reply ?? "", handoff: !!d.handoff } : null;
  } catch (e) { console.error("Preview failed", e instanceof Error ? e.message : e); return null; }
}

/** "150 ft · 6 ft cedar · 2 gates · HOA · ballpark $6,600–$8,500" for the owner's alerts, or "" when nothing's known yet. */
async function jobNote(sql: Sql, c: Client, threadId: string): Promise<string> {
  const [row] = await sql`SELECT details FROM public.client_threads WHERE id = ${threadId}::uuid`.catch(() => []) as { details?: unknown }[];
  const d = cleanDetails(c.setup.trade, row?.details);
  const line = detailLine(c.setup.trade, d);
  const bp = ballpark(parsePriceBook(c.setup.price_book), d);
  return [line, bp ? `ballpark ${rangeText(bp)}` : "", d.address ? String(d.address) : ""].filter(Boolean).join(" · ");
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

/**
 * On the first of the month: last month in one text to the owner, with what came in after hours and what it won.
 * Once per business per month, skipped when the owner turned it off or nothing happened.
 */
export async function sendMonthlyReports(sql: Sql, origin: string, today: string): Promise<{ sent: number }> {
  const month = today.slice(0, 7) + "-01"; // the month that just started; the report covers the one before
  const clients = await sql`SELECT o.project_id, o.owner_id, o.portal_token FROM public.client_ops o
    WHERE coalesce(o.setup->>'texting_number','') <> '' AND coalesce(o.setup->>'owner_cell','') <> '' AND coalesce(o.setup->>'monthly_report', '') <> 'no'
      AND NOT EXISTS (SELECT 1 FROM public.client_monthly m WHERE m.project_id = o.project_id AND m.month = ${month}::date)` as { project_id: string; owner_id: string; portal_token: string | null }[];
  let sent = 0;
  for (const r of clients) {
    const c = await clientById(sql, r.owner_id, r.project_id);
    if (!c) continue;
    const tz = tzOf(c);
    const [k] = await sql`WITH t AS (SELECT t.id, t.customer_phone, t.status, t.updated_at, t.created_at AT TIME ZONE ${tz} AS local FROM public.client_threads t
        WHERE t.project_id = ${r.project_id}::uuid AND t.source NOT IN ('import', 'owner', 'quote', 'rehash', 'review')
          AND t.created_at >= date_trunc('month', ${month}::date - interval '1 day') AND t.created_at < ${month}::date)
      SELECT count(*)::int AS leads, count(*) FILTER (WHERE status = 'booked')::int AS booked,
        count(*) FILTER (WHERE extract(hour FROM local) < 8 OR extract(hour FROM local) >= 18 OR extract(isodow FROM local) >= 6)::int AS after_hours FROM t` as Record<string, unknown>[];
    const [q] = await sql`SELECT count(*) FILTER (WHERE status = 'won')::int AS won, coalesce(sum(amount) FILTER (WHERE status = 'won'), 0)::float AS won_value,
        count(*) FILTER (WHERE kind = 'rehash' AND status = 'replied')::int AS revived
      FROM public.client_quotes WHERE project_id = ${r.project_id}::uuid AND last_step_at >= date_trunc('month', ${month}::date - interval '1 day') AND last_step_at < ${month}::date` as Record<string, unknown>[];
    const [rv] = await sql`SELECT count(*)::int AS n FROM public.client_reviews WHERE project_id = ${r.project_id}::uuid AND sent_at >= date_trunc('month', ${month}::date - interval '1 day') AND sent_at < ${month}::date` as { n: number }[];
    const n = (v: unknown) => Number(v) || 0;
    const w = { leads: n(k?.leads), booked: n(k?.booked), afterHours: n(k?.after_hours), won: n(q?.won), wonValue: n(q?.won_value), revived: n(q?.revived), reviews: n(rv?.n) };
    if (!w.leads && !w.won && !w.reviews) { await sql`INSERT INTO public.client_monthly (project_id, month) VALUES (${r.project_id}::uuid, ${month}::date) ON CONFLICT DO NOTHING`; continue; }
    const name = new Date(month + "T12:00:00Z"); name.setUTCMonth(name.getUTCMonth() - 1);
    const label = name.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
    const parts = [`${w.leads} lead${w.leads === 1 ? "" : "s"}${w.afterHours ? `, ${w.afterHours} after hours` : ""}`, `${w.booked} estimate${w.booked === 1 ? "" : "s"} booked`,
      w.won ? `${w.won} won, ${usd(w.wonValue)}` : "", w.revived ? `${w.revived} old lead${w.revived === 1 ? "" : "s"} revived` : "", w.reviews ? `${w.reviews} review request${w.reviews === 1 ? "" : "s"}` : ""].filter(Boolean);
    const link = r.portal_token ? `${origin}/portal/${r.portal_token}` : `${origin}/app`;
    const ok = await sendSms(e164(c.setup.owner_cell), c.setup.texting_number, `Cinder for ${c.setup.display_name || "your business"}, ${label}: ${parts.join(", ")}. The full report: ${link}`.slice(0, 600));
    if (ok) { sent++; await sql`INSERT INTO public.client_monthly (project_id, month) VALUES (${r.project_id}::uuid, ${month}::date) ON CONFLICT DO NOTHING`; }
  }
  return { sent };
}

/**
 * Ask Cinder: the owner's question answered from his own board, calendar and numbers. Short, names people, says
 * which screen to open when there's something to do. Nothing is stored and nobody is texted.
 */
export async function askCinder(sql: Sql, c: Client, question: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const tz = tzOf(c);
  const [cards, appts, inv, live] = await Promise.all([
    sql`SELECT t.customer_name AS name, t.source, t.status, t.stage, t.value::float AS value, t.details, t.notes, t.stage_at, t.last_in_at, t.created_at,
        (SELECT x.body FROM public.client_texts x WHERE x.thread_id = t.id AND x.direction = 'in' AND x.author <> 'system' ORDER BY x.at DESC LIMIT 1) AS last_in,
        q.amount::float AS quote, q.status AS quote_status, q.steps_sent, q.viewed_at IS NOT NULL AS quote_opened
      FROM public.client_threads t LEFT JOIN LATERAL (SELECT * FROM public.client_quotes q WHERE q.project_id = t.project_id AND q.kind = 'quote'
        AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10) ORDER BY q.created_at DESC LIMIT 1) q ON true
      WHERE t.project_id = ${c.projectId}::uuid AND t.source <> 'import' AND t.updated_at > now() - interval '60 days' ORDER BY t.updated_at DESC LIMIT 40`.catch(() => []) as Promise<Record<string, unknown>[]>,
    sql`SELECT a.starts_at, a.status, t.customer_name AS name FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
      WHERE a.project_id = ${c.projectId}::uuid AND a.starts_at > now() - interval '7 days' AND a.starts_at < now() + interval '14 days' ORDER BY a.starts_at LIMIT 30`.catch(() => []) as Promise<Record<string, unknown>[]>,
    sql`SELECT i.number, i.status, i.total::float AS total, i.due_on::text AS due_on, t.customer_name AS name FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
      WHERE i.project_id = ${c.projectId}::uuid AND i.status IN ('sent', 'draft') ORDER BY i.created_at DESC LIMIT 30`.catch(() => []) as Promise<Record<string, unknown>[]>,
    liveFor(sql, c.projectId, 1, tz).catch(() => null),
  ]);
  const when = (v: unknown) => v ? new Date(String(v)).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const lines = [
    `Business: ${c.setup.display_name || ""} (${c.setup.trade || "contractor"}), owner ${c.setup.owner_name || ""}. Now: ${new Date().toLocaleString("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
    live ? `Last 30 days: ${live.leads} leads, ${live.answered} answered, ${live.booked} estimates booked, ${live.won} won worth ${Math.round(live.wonValue)}, ${live.chasing} quotes open worth ${Math.round(live.chasingValue)}, ${live.afterHours.leads} leads after hours (${live.afterHours.won} won, ${Math.round(live.afterHours.wonValue)}), ${live.needs} conversations waiting on the owner.` : "",
    "Jobs (newest first):",
    ...cards.map(r => `- ${r.name || "Unknown"}: ${r.stage || "lead"}, source ${r.source}, texting ${r.status === "paused" ? "waiting on owner" : String(r.status)}${r.value ? `, value ${Math.round(Number(r.value))}` : ""}${r.quote ? `, quote ${Math.round(Number(r.quote))} ${r.quote_status}${r.quote_opened ? " (opened)" : ""}, ${r.steps_sent} follow-ups` : ""}${r.stage_at ? `, in stage since ${when(r.stage_at)}` : ""}${r.last_in ? `, last said: "${String(r.last_in).slice(0, 120)}"` : ""}${r.notes ? `, notes: ${String(r.notes).slice(0, 100)}` : ""}`),
    "Estimates:", ...appts.map(a => `- ${a.name}: ${when(a.starts_at)}, ${a.status}`),
    "Invoices:", ...inv.map(i => `- #${i.number} ${i.name}: ${Math.round(Number(i.total))}, ${i.status}${i.due_on ? `, due ${i.due_on}` : ""}`),
  ].filter(Boolean).join("\n").slice(0, 12000);
  const system = `You are Cinder, the assistant inside a contractor's CRM. Answer the owner's question from the data below only. Two to four short sentences, plain words, name the people and the dollar amounts. If the data can't answer, say what isn't tracked. When something should be done, say which screen (Inbox, Jobs, Calendar, Money, Reports, Settings). Never invent a customer or a number.\n\n${lines}`;
  try {
    return (await claudeText({ apiKey: key, system, user: question.slice(0, 500), label: "Ask Cinder", model: process.env.CINDER_ASK_MODEL?.trim() || "claude-sonnet-5-5", maxTokens: 400, timeoutMs: 25000 })).trim().slice(0, 1200);
  } catch (e) { console.error("Ask failed", e instanceof Error ? e.message : e); return null; }
}

/** "Remind me" reminders that are due: one text and one push to the owner, each once. */
export async function runOwnerReminders(sql: Sql, limit = 60): Promise<{ sent: number }> {
  const rows = await sql`SELECT t.id, t.owner_id, t.project_id, t.customer_name, t.customer_phone, t.remind_note FROM public.client_threads t
    WHERE t.remind_at IS NOT NULL AND t.remind_sent_at IS NULL AND t.remind_at <= now() ORDER BY t.remind_at LIMIT ${limit}` as { id: string; owner_id: string; project_id: string; customer_name: string; customer_phone: string; remind_note: string }[];
  let sent = 0;
  for (const r of rows) {
    const c = await clientById(sql, r.owner_id, r.project_id);
    await sql`UPDATE public.client_threads SET remind_sent_at = now() WHERE id = ${r.id}::uuid`;
    if (!c) continue;
    const who = r.customer_name || e164(r.customer_phone);
    await alertOwner(c, `Reminder: ${r.remind_note || "check in"}. ${who}.`, r.id, sql).catch(e => console.error("Reminder alert failed", e instanceof Error ? e.message : e));
    sent++;
  }
  return { sent };
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

/**
 * "OMW" from the owner's or a crew member's cell: the next booked estimate (or the named customer's) gets the
 * on-my-way text from the business number, and the sender hears who was told. Nothing else moves.
 */
async function onMyWay(sql: Sql, c: Client, cell: string, who: string, o: { name: string; minutes: number }): Promise<void> {
  const from = c.setup.texting_number || "";
  const [a] = o.name
    ? await sql`SELECT a.id, t.id AS thread_id, t.customer_name, t.customer_phone, t.status, a.starts_at FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
        WHERE a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND t.customer_name ILIKE ${o.name.split(" ")[0] + "%"} ORDER BY abs(extract(epoch FROM (a.starts_at - now()))) LIMIT 1` as { id: string; thread_id: string; customer_name: string; customer_phone: string; status: string; starts_at: string }[]
    : await sql`SELECT a.id, t.id AS thread_id, t.customer_name, t.customer_phone, t.status, a.starts_at FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
        WHERE a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND a.starts_at > now() - interval '2 hours' ORDER BY a.starts_at LIMIT 1` as { id: string; thread_id: string; customer_name: string; customer_phone: string; status: string; starts_at: string }[];
  if (!a) { await sendSms(cell, from, o.name ? `No booked estimate for ${o.name}.` : "Nothing is booked next. Open the Cinder app to see the calendar."); return; }
  if (a.status === "opted_out") { await sendSms(cell, from, `${a.customer_name || "They"} opted out of texts. Call them instead.`); return; }
  const ok = await sendToCustomer(sql, c, a.thread_id, a.customer_phone, onMyWayText(a.customer_name, who, c.setup.display_name || "", o.minutes), "owner");
  await sendSms(cell, from, ok ? `Told ${a.customer_name || e164(a.customer_phone)} you're on the way, about ${o.minutes} minutes.` : `The text to ${a.customer_name || "them"} didn't send.`);
}

/** A crew member texted the business number: OMW works, everything else points at the app. */
async function crewText(sql: Sql, c: Client, cell: string, name: string, body: string): Promise<void> {
  const app = (process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || "https://cinderrevenue.com") + "/app";
  const o = parseOnMyWay(body);
  if (o) await onMyWay(sql, c, cell, name, o);
  else await sendSms(cell, c.setup.texting_number || "", CREW_HELP.replace("{business}", c.setup.display_name || "the business").replace("{app}", app));
}

/** The owner texted their Cinder number: "QUOTE 4200 [name]" starts quote follow-up, "OMW" texts the next estimate; anything else gets a pointer to the app. */
async function ownerText(sql: Sql, c: Client, body: string): Promise<void> {
  const cell = e164(c.setup.owner_cell || ""), from = c.setup.texting_number || "";
  const app = (process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || "https://cinderrevenue.com") + "/app";
  const omw = parseOnMyWay(body);
  if (omw) { await onMyWay(sql, c, cell, c.setup.owner_name || "", omw); return; }
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
  // A team member's cell is never a customer either: crew can say OMW, an extra owner gets the owner's commands.
  const member = parseTeam(c.setup.team).find(m => sameNumber(from, m.cell));
  if (member) { if (member.role === "owner") await ownerText(sql, c, body); else await crewText(sql, c, e164(from), member.name, body); return; }
  const t = await thread(sql, c, from, "text");
  if (t.fresh) await recordConsent(sql, c, e164(from), "inbound_text", "text", `First text: "${body.slice(0, 200)}"`);
  // A photo with no words still reads as something the reply engine and the owner can follow.
  if (!body.trim() && media.length) body = media.length === 1 ? "(sent a photo)" : `(sent ${media.length} photos)`;
  await log(sql, c, t.id, "in", "customer", body, true, media);
  let lang: Lang = t.lang === "es" ? "es" : "en";
  if (lang === "en" && detectLang(body) === "es") { lang = "es"; await sql`UPDATE public.client_threads SET lang = 'es' WHERE id = ${t.id}::uuid`; }
  const [{ n: inbound }] = await sql`SELECT count(*)::int AS n FROM public.client_texts WHERE thread_id = ${t.id}::uuid AND direction = 'in' AND author = 'customer'` as { n: number }[];
  const firstText = inbound <= 1;
  if (firstText && t.status === "auto") void emitEvent(c.setup, c.projectId, "lead.new", { customer: { id: t.id, name: t.customer_name, phone: e164(from) }, source: "text", message: body.slice(0, 500) });
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
    } else { const job = await jobNote(sql, c, t.id); await alertOwner(c, ownerAlert("booked", who, `${slotLabel(picked.start, tzOf(c))}${ok ? ", on your calendar" : " (add it to your calendar, it didn't save)"}. ${job ? job + ". " : ""}${d.summary}`), t.id, sql); }
    void emitEvent(c.setup, c.projectId, "estimate.booked", { customer: { id: t.id, name: t.customer_name, phone: e164(from) }, start: picked.start, summary: d.summary });
  } else if (d.stage === "canceled" && current) {
    const removed = await cancelAppointment(sql, c, current.id, current.event_id);
    await sql`UPDATE public.client_threads SET status = 'auto', updated_at = now() WHERE id = ${t.id}::uuid`;
    await alertOwner(c, ownerAlert("canceled", who, `${slotLabel(new Date(current.starts_at).toISOString(), tzOf(c))}${removed ? ", taken off your calendar" : ". Delete it from your calendar, it didn't come off"}.`), t.id, sql);
  } else if (d.stage === "booked") {
    await sql`UPDATE public.client_threads SET status = 'booked', updated_at = now() WHERE id = ${t.id}::uuid`;
    const job = await jobNote(sql, c, t.id);
    await alertOwner(c, ownerAlert("booked", who, `${job ? job + ". " : ""}${d.summary}`), t.id, sql);
    void emitEvent(c.setup, c.projectId, "estimate.booked", { customer: { id: t.id, name: t.customer_name, phone: e164(from) }, summary: d.summary });
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
    const key = r.owner_id + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, r.owner_id, r.project_id));
    const step = nudgeStep({ anchor: anchorMs, lastOut: ms(r.last_out), nudgeAnchor: ms(r.nudge_anchor), nudgesSent: r.nudges_sent, now: now.getTime(), hours: nudgeHoursFor(clients.get(key)?.setup) });
    if (step === null) continue;
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
  const quotes = await sql`SELECT q.id, q.owner_id, q.project_id, q.customer_phone, q.customer_name, q.sent_on, q.steps_sent, q.kind, q.token
    FROM public.client_quotes q WHERE q.status = 'open' AND NOT q.chase_paused ORDER BY q.sent_on LIMIT 1000` as { id: string; owner_id: string; project_id: string; customer_phone: string; customer_name: string; sent_on: string; steps_sent: number; kind: string; token: string | null }[];
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
    const step = seqKey === "quote" ? quoteChaseDue(String(q.sent_on).slice(0, 10), q.steps_sent, today, quoteDaysFor(c?.setup)) : quoteStepDue(String(q.sent_on).slice(0, 10), q.steps_sent, today, seq.days);
    if (step === null) continue;
    // Daytime only in the client's time zone; a step that's due stays due for the next run.
    if (!c?.setup.texting_number || !inTextingHours(tzOf(c))) { skipped++; continue; }
    const t = await thread(sql, c, q.customer_phone, "quote");
    if (t.status === "opted_out" || t.status === "paused") { skipped++; continue; }
    if (!(await roomFor(sql, t.id))) { skipped++; continue; }
    const monthly = seqKey === "quote" && step >= seq.texts.length;
    const k = monthly ? "quote_monthly" : `${seqKey}_${step + 1}`;
    // A quote the customer can approve from a link: every follow-up carries it, so each one is a tap away from a yes.
    const link = q.kind === "quote" && q.token ? (t.lang === "es" ? ` Su cotización: ${quoteUrl(q.token)}` : ` Your quote: ${quoteUrl(q.token)}`) : "";
    const body = fill(say(c, k, monthly ? QUOTE_MONTHLY_TEXT : seq.texts[step], t.lang === "es" ? "es" : "en"), varsFor(c, q.customer_name.split(" ")[0])) + link;
    const ok = await sendToCustomer(sql, c, t.id, q.customer_phone, body, "template");
    await sql`UPDATE public.client_quotes SET steps_sent = steps_sent + 1, last_step_at = now(),
      status = CASE WHEN ${seqKey !== "quote"}::boolean AND steps_sent + 1 >= ${seq.days.length} THEN 'lost' ELSE status END WHERE id = ${q.id}::uuid`;
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
  void emitEvent(c.setup, c.projectId, "lead.new", { customer: { id: t.id, name: lead.name, phone: e164(lead.phone), email: lead.email }, source: lead.source, message: lead.message.slice(0, 1000) });
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
