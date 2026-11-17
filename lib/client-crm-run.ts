// The client CRM on the server: the board, moving a customer between stages, editing a card, adding a lead by hand,
// and the owner's own setup. Every write is scoped to the signed-in owner's business.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { AGENT_KEYS, parseTeam, ballpark, cleanDetails, cleanEmail, cleanOwnerSetup, detailLine, parsePriceBook, stageFor, STAGES, cleanJob, cleanCosts, cleanLostReason, jobSteps, type Card, type Stage } from "@/lib/crm";
import { digits10 } from "@/lib/client-runtime";
import { cleanImportRows, importAs, type ImportAs } from "@/lib/customer-import";
import { emitEvent } from "@/lib/client-webhook";
import { cleanFieldLabels, cleanFieldValues, cleanTags } from "@/lib/records";
import { quoteUrl, type Client } from "@/lib/client-runtime-run";
import { invoicesByThread } from "@/lib/client-billing-run";
import { nextChaseDay, quoteDaysFor } from "@/lib/client-runtime";
import { changeOrdersByThread } from "@/lib/client-service-run";
import { signoffsByThread } from "@/lib/client-portal-run";
import { propertiesByThread } from "@/lib/client-parity-run";
import { cleanLogo, hexOk, readableAccent } from "@/lib/brand";
import { cleanItems } from "@/lib/billing";

type Sql = NeonQueryFunction<false, false>;
export type { Card };

const today = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });

/** Every customer worth a card: active in the last 120 days, or still booked or quoted. Review and "you're due" texts aren't leads. */
export async function loadBoard(sql: Sql, c: Client): Promise<Card[]> {
  const [invoices, photos, cos] = await Promise.all([invoicesByThread(sql as never, c).catch(() => ({} as Record<string, Card["invoice"]>)), photosByThread(sql, c).catch(() => ({} as Record<string, NonNullable<Card["photos"]>>)),
    changeOrdersByThread(sql, c).catch(() => ({} as Record<string, NonNullable<Card["changeOrders"]>>))]);
  const [signoffs, props] = await Promise.all([signoffsByThread(sql, c).catch(() => ({} as Record<string, NonNullable<Card["signoff"]>>)), propertiesByThread(sql, c).catch(() => ({} as Record<string, NonNullable<Card["properties"]>>))]);
  const rows = await sql`SELECT t.id, t.customer_name, t.customer_phone, t.source, t.status, t.stage, t.details, t.value::float AS value, t.notes,
      coalesce(t.last_in_at, t.updated_at) AS at, q.id AS quote_id, q.amount::float AS quote_amount, q.status AS quote_status, q.steps_sent AS quote_steps,
      q.token AS quote_token, q.link_sent_at IS NOT NULL AS quote_linked, q.items AS quote_items, q.tax_rate::float AS quote_tax,
      t.install_time, t.install_days, t.install_event_id IS NOT NULL AS on_calendar, q.viewed_at AS quote_viewed, q.note AS quote_note, q.view_count AS quote_views, q.last_viewed_at AS quote_last_viewed, q.chase_paused AS quote_chase_paused, q.valid_until::text AS quote_valid_until, q.sent_on::text AS quote_sent_on, a.starts_at AS next_appt,
      t.install_on::text AS install_on, t.review_auto, rv.sent_at AS review_sent, t.job_steps, t.job_costs,
      (t.winback_at IS NOT NULL AND t.last_in_at > t.winback_at AND (t.stage_at IS NULL OR t.stage_at < t.winback_at)) AS winback_replied,
      t.stage_at, lr.body AS lost_note, t.crew_notes, t.crew_member, q.deposit::float AS quote_deposit, t.customer_email, t.remind_at, t.remind_note, t.remind_sent_at, t.review_after, t.checklist, t.tags, t.referred_by, t.custom
    FROM public.client_threads t
    LEFT JOIN LATERAL (SELECT id, amount, status, steps_sent, token, link_sent_at, viewed_at, note, items, tax_rate, view_count, last_viewed_at, chase_paused, sent_on FROM public.client_quotes x WHERE x.project_id = t.project_id AND x.kind = 'quote'
      AND right(regexp_replace(x.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10)
      ORDER BY x.created_at DESC LIMIT 1) q ON true
    LEFT JOIN LATERAL (SELECT sent_at FROM public.client_reviews r WHERE r.project_id = t.project_id
      AND right(regexp_replace(r.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10) ORDER BY sent_at DESC LIMIT 1) rv ON true
    LEFT JOIN LATERAL (SELECT starts_at FROM public.client_appointments y WHERE y.thread_id = t.id AND y.status = 'booked' AND y.starts_at > now() - interval '12 hours'
      ORDER BY y.starts_at LIMIT 1) a ON true
    LEFT JOIN LATERAL (SELECT body FROM public.client_texts z WHERE z.thread_id = t.id AND z.author = 'system' AND z.body LIKE 'Marked lost%' ORDER BY z.at DESC LIMIT 1) lr ON t.stage = 'lost'
    WHERE t.project_id = ${c.projectId}::uuid AND t.source NOT IN ('review', 'due') AND t.hidden_at IS NULL
      AND (t.updated_at > now() - interval '120 days' OR t.stage IN ('booked', 'quoted') OR q.status IN ('open', 'replied'))
      -- Imported past customers live in Customers, not on the board, until they text in or the owner moves them (a move stamps stage_at after created_at).
      AND NOT (t.source = 'import' AND t.stage IN ('won', 'lost') AND t.last_in_at IS NULL AND t.last_out_at IS NULL AND t.stage_at < t.created_at)
    ORDER BY coalesce(t.last_in_at, t.updated_at) DESC LIMIT 300` as Record<string, unknown>[];
  const book = parsePriceBook(c.setup.price_book);
  const share = c.setup.share_ballpark !== "no";
  return rows.map(r => {
    const details = cleanDetails(c.setup.trade, r.details);
    const bp = share ? ballpark(book, details) : null;
    const quote = r.quote_id ? { id: String(r.quote_id), amount: r.quote_amount == null ? null : Number(r.quote_amount), status: String(r.quote_status), steps: Number(r.quote_steps ?? 0),
      linked: !!r.quote_linked, url: r.quote_token ? quoteUrl(String(r.quote_token)) : null, viewed: r.quote_viewed ? new Date(String(r.quote_viewed)).toISOString() : null, note: String(r.quote_note ?? ""),
      views: Number(r.quote_views ?? 0), lastViewed: r.quote_last_viewed ? new Date(String(r.quote_last_viewed)).toISOString() : null, chasePaused: !!r.quote_chase_paused, validUntil: r.quote_valid_until ? String(r.quote_valid_until) : null,
      nextChase: r.quote_status === "open" && !r.quote_chase_paused && r.quote_sent_on ? nextChaseDay(String(r.quote_sent_on), Number(r.quote_steps ?? 0), quoteDaysFor(c.setup)) : null,
      items: cleanItems(r.quote_items), tax: Number(r.quote_tax ?? 0), deposit: r.quote_deposit == null ? null : Number(r.quote_deposit) } : null;
    const next = r.next_appt ? new Date(String(r.next_appt)).toISOString() : null;
    // A past customer answered a win-back text: a new job, so it starts over in New (or Booked once Cinder books it).
    const again = !!r.winback_replied;
    return {
      id: String(r.id), name: String(r.customer_name || ""), phone: String(r.customer_phone), source: String(r.source), status: String(r.status),
      stage: again ? (r.status === "booked" || next ? "booked" : "new") : stageFor({ stage: r.stage as string | null, status: String(r.status), quote_status: quote?.status ?? null, next_appt: next }),
      details, line: detailLine(c.setup.trade, details), value: again ? null : r.value != null ? Number(r.value) : quote?.amount ?? null,
      ballpark: bp ? { low: bp.low, high: bp.high } : null, notes: String(r.notes ?? ""), quote: again ? null : quote, next, at: new Date(String(r.at)).toISOString(),
      install: r.install_on ? String(r.install_on) : null, installTime: r.install_time ? String(r.install_time) : null, installDays: Number(r.install_days ?? 1) || 1, onCalendar: !!r.on_calendar,
      invoice: invoices[String(r.id)] ?? null, reviewAuto: !!r.review_auto, reviewSent: r.review_sent ? new Date(String(r.review_sent)).toISOString() : null, pastCustomer: again,
      job: again ? {} : cleanJob(r.job_steps), costs: again ? cleanCosts({}) : cleanCosts(r.job_costs),
      stageAt: r.stage_at ? new Date(String(r.stage_at)).toISOString() : null, crew: String(r.crew_notes ?? ""), email: String(r.customer_email ?? ""),
      photos: photos[String(r.id)] ?? [], crewMember: String(r.crew_member ?? ""), custom: r.custom && typeof r.custom === "object" ? r.custom as Record<string, string> : {}, tags: Array.isArray(r.tags) ? (r.tags as string[]) : [], referredBy: r.referred_by ? String(r.referred_by) : null, changeOrders: again ? [] : cos[String(r.id)] ?? [],
      reviewAfter: r.review_after && !r.review_sent ? new Date(String(r.review_after)).toISOString() : null, signoff: signoffs[String(r.id)] ?? null, properties: props[String(r.id)] ?? [], checklist: r.checklist && typeof r.checklist === "object" ? r.checklist as Card["checklist"] : null,
      remind: r.remind_at ? { at: new Date(String(r.remind_at)).toISOString(), note: String(r.remind_note ?? ""), sent: !!r.remind_sent_at } : null,
      lostReason: typeof r.lost_note === "string" ? (r.lost_note.match(/^Marked lost: (.+?)\. Follow-ups stopped\.$/)?.[1] ?? "") : "",
    };
  });
}

/** The owner's answers from the setup flow, merged into their setup. Sam's fields are never touched. */
export async function saveOwnerSetup(sql: Sql, c: Client, input: unknown): Promise<Record<string, string>> {
  const patch = cleanOwnerSetup(input);
  // The business's own look: the logo, and its color made readable on white (4.5:1) before it's kept.
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (o.brand_color !== undefined) { const h = hexOk(o.brand_color); patch.brand_color = h ? readableAccent(h) : ""; }
  if (o.brand_logo !== undefined) patch.brand_logo = cleanLogo(o.brand_logo);
  if (o.show_powered !== undefined) patch.show_powered = o.show_powered === "yes" ? "yes" : "no";
  await sql`UPDATE public.client_ops SET setup = setup || ${JSON.stringify(patch)}::jsonb, updated_at = now() WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
  return patch;
}

async function threadOf(sql: Sql, c: Client, id: string) {
  const [t] = await sql`SELECT id, customer_name, customer_phone, status, details FROM public.client_threads WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; customer_name: string; customer_phone: string; status: string; details: unknown }[];
  return t ?? null;
}
const event = (c: Client, t: { id: string; customer_name: string; customer_phone: string }, extra: Record<string, unknown> = {}) =>
  ({ customer: { id: t.id, name: t.customer_name, phone: t.customer_phone }, ...extra });

/**
 * Move a customer to a stage. Quoted starts (or restarts) the quote follow-up; won and lost close the quote and stop
 * the follow-ups; booked and new only change the card. Amount is the quote or job value.
 */
export async function moveStage(sql: Sql, c: Client, threadId: string, stage: string, amount: number | null, opts: { install?: unknown; review?: boolean; reason?: unknown } = {}): Promise<{ ok: boolean; error?: string }> {
  if (!(STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown stage." };
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const phone10 = digits10(t.customer_phone);
  const [open] = await sql`SELECT id FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open','replied')
    AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${phone10} ORDER BY created_at DESC LIMIT 1` as { id: string }[];
  const note = (body: string) => sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'out', 'system', ${body})`;
  const usd = amount ? `: $${amount.toLocaleString("en-US")}` : "";
  if (stage === "quoted") {
    if (t.status === "opted_out") return { ok: false, error: "They opted out of texts, so Cinder can't follow up. Keep the quote in your notes." };
    if (open) await sql`UPDATE public.client_quotes SET amount = coalesce(${amount}, amount), sent_on = ${today(c)}::date, status = 'open', steps_sent = 0 WHERE id = ${open.id}::uuid`;
    else await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.customer_phone}, ${t.customer_name}, ${amount}, ${today(c)}::date)`;
    await note(`Quote sent${usd}. Cinder follows up until they answer.`);
    void emitEvent(c.setup, c.projectId, "quote.sent", event(c, t, { amount }));
  } else if (stage === "won" || stage === "lost") {
    if (open) await sql`UPDATE public.client_quotes SET status = ${stage}, amount = coalesce(${amount}, amount), last_step_at = now() WHERE id = ${open.id}::uuid`;
    else if (stage === "won") await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on, status, last_step_at) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.customer_phone}, ${t.customer_name}, ${amount}, ${today(c)}::date, 'won', now())`;
    await sql`UPDATE public.client_threads SET status = 'closed', updated_at = now() WHERE id = ${t.id}::uuid AND status <> 'opted_out'`;
    // Won: when the install is, and whether Cinder asks for the Google review the day after it.
    if (stage === "won") await sql`UPDATE public.client_threads SET review_auto = ${!!opts.review && !!c.setup.review_link} WHERE id = ${t.id}::uuid`;
    const why = cleanLostReason(opts.reason);
    await note(stage === "won" ? `Job won${usd}` : why ? `Marked lost: ${why}. Follow-ups stopped.` : "Marked lost. Follow-ups stopped.");
    void emitEvent(c.setup, c.projectId, stage === "won" ? "job.won" : "job.lost", event(c, t, { amount }));
  } else {
    // Back to new or booked: an open quote stays open (follow-ups keep going); Cinder takes replies again on "new".
    if (stage === "new" && t.status === "closed") await sql`UPDATE public.client_threads SET status = 'auto' WHERE id = ${t.id}::uuid`;
    void emitEvent(c.setup, c.projectId, "stage.changed", event(c, t, { stage }));
  }
  await sql`UPDATE public.client_threads SET stage = ${stage}, stage_at = now(), value = coalesce(${amount}, value), updated_at = now() WHERE id = ${t.id}::uuid`;
  return { ok: true };
}

/** Edit what the owner knows about the job: details in the trade's words, the job value, notes, the name. */
export async function saveCard(sql: Sql, c: Client, threadId: string, input: { custom?: unknown; tags?: unknown; referredBy?: unknown; details?: unknown; value?: number | null; notes?: string; crew?: string; name?: string; email?: string; install?: unknown; review?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const details = input.details === undefined ? null : cleanDetails(c.setup.trade, input.details);
  const notes = typeof input.notes === "string" ? input.notes.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").slice(0, 2000) : null;
  const crew = typeof input.crew === "string" ? input.crew.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").slice(0, 2000) : null;
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : null;
  const email = typeof input.email === "string" ? (input.email.trim() ? cleanEmail(input.email) : "") : null;
  if (typeof input.email === "string" && input.email.trim() && !email) return { ok: false, error: "That email doesn't look right." };
  const value = input.value === undefined ? undefined : input.value;
  await sql`UPDATE public.client_threads SET
      details = CASE WHEN ${details === null}::boolean THEN details ELSE ${JSON.stringify(details ?? {})}::jsonb END,
      notes = coalesce(${notes}, notes), crew_notes = coalesce(${crew}, crew_notes), customer_name = coalesce(${name}, customer_name), customer_email = coalesce(${email}, customer_email),
      value = CASE WHEN ${value === undefined}::boolean THEN value ELSE ${value ?? null}::numeric END, updated_at = now()
    WHERE id = ${t.id}::uuid`;
  if (input.review !== undefined) await sql`UPDATE public.client_threads SET review_auto = ${!!input.review && !!c.setup.review_link} WHERE id = ${t.id}::uuid`;
  if (input.custom !== undefined) await sql`UPDATE public.client_threads SET custom = ${JSON.stringify(cleanFieldValues(input.custom, cleanFieldLabels(c.setup.custom_fields)))}::jsonb WHERE id = ${t.id}::uuid`;
  if (input.tags !== undefined) await sql`UPDATE public.client_threads SET tags = ${cleanTags(input.tags)}::text[] WHERE id = ${t.id}::uuid`;
  if (input.referredBy !== undefined) {
    const ref = typeof input.referredBy === "string" && /^[0-9a-f-]{36}$/i.test(input.referredBy) && input.referredBy !== t.id ? input.referredBy : null;
    if (ref) { const [ok] = await sql`SELECT id FROM public.client_threads WHERE id = ${ref}::uuid AND project_id = ${c.projectId}::uuid`; if (!ok) return { ok: false, error: "That customer isn't here." }; }
    await sql`UPDATE public.client_threads SET referred_by = ${ref}::uuid WHERE id = ${t.id}::uuid`;
  }
  void emitEvent(c.setup, c.projectId, "lead.updated", event(c, { ...t, customer_name: name ?? t.customer_name }, { details: details ?? undefined, notes: notes ?? undefined, value }));
  return { ok: true };
}

/** The real number for a customer who came in without one. It can't be a number another customer already has. */
export async function setPhone(sql: Sql, c: Client, threadId: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  const d = digits10(String(phone ?? ""));
  if (d.length !== 10) return { ok: false, error: "Add a 10-digit phone number." };
  const [t] = await sql`SELECT id, customer_phone FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; customer_phone: string }[];
  if (!t) return { ok: false, error: "Not found." };
  if (!String(t.customer_phone).startsWith("nophone:")) return { ok: false, error: "This customer already has a number." };
  const [dup] = await sql`SELECT id, customer_name FROM public.client_threads WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${d} LIMIT 1` as { id: string; customer_name: string }[];
  if (dup) return { ok: false, error: `That number is already on ${dup.customer_name || "another customer"}.` };
  await sql`UPDATE public.client_threads SET customer_phone = ${"+1" + d}, updated_at = now() WHERE id = ${t.id}::uuid`;
  return { ok: true };
}

/**
 * A lead the owner took themselves (a call they answered, a walk-in, a referral). It goes on the board as theirs:
 * Cinder doesn't text it, so nothing reaches someone who never asked to be texted.
 */
export async function addLead(sql: Sql, c: Client, input: { name?: string; phone?: string; details?: unknown; notes?: string; stage?: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const d = digits10(String(input.phone ?? ""));
  if (d.length !== 10) return { ok: false, error: "Add a 10-digit phone number." };
  const name = String(input.name ?? "").trim().slice(0, 80);
  const details = cleanDetails(c.setup.trade, input.details);
  const notes = String(input.notes ?? "").slice(0, 2000);
  const stage = (STAGES as readonly string[]).includes(String(input.stage)) ? String(input.stage) : "new";
  const [t] = await sql`INSERT INTO public.client_threads (owner_id, project_id, customer_phone, customer_name, source, status, details, notes, stage, stage_at)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${"+1" + d}, ${name}, 'owner', 'paused', ${JSON.stringify(details)}::jsonb, ${notes}, ${stage}, now())
    ON CONFLICT (project_id, customer_phone) DO UPDATE SET customer_name = CASE WHEN EXCLUDED.customer_name <> '' THEN EXCLUDED.customer_name ELSE client_threads.customer_name END,
      details = client_threads.details || EXCLUDED.details, notes = CASE WHEN EXCLUDED.notes <> '' THEN EXCLUDED.notes ELSE client_threads.notes END, updated_at = now()
    RETURNING id, customer_name, customer_phone` as { id: string; customer_name: string; customer_phone: string }[];
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'in', 'system', 'Added by you')`;
  void emitEvent(c.setup, c.projectId, "lead.new", event(c, t, { source: "owner", details, notes }));
  return { ok: true, id: t.id };
}

/** For the setup flow: what the owner already told us (or Sam filled in), so nothing is asked twice. */
export function ownerSetupView(setup: Record<string, string>) {
  const k = ["display_name", "owner_name", "website", "trade", "service_area", "team_size", "years", "leads_month", "lead_sources", "software", "price_book", "share_ballpark", "priority", "onboarded_at", "quote_terms", "warranty", "financing_note", "financing_link", "review_on_paid", "labor_rate", "catalog", "evening_text", "golive", "golive_start", "software", "checklists", "crew_prices", "brand_color", "brand_logo", "show_powered", "agent_paused", "review_link", "crew_scope", "mileage_rate", "late_fee", "late_fee_days", "monthly_goal", "custom_fields", "quote_templates", "automations", "quote_valid_days", "days_off"];
  return { ...Object.fromEntries([...k, "pay_link", "tax_rate", "invoice_days"].map(x => [x, setup[x] ?? ""])), has_calendar: "", has_review_link: setup.review_link ? "yes" : "", has_number: setup.texting_number ? "yes" : "",
    // Read-only for the System screen: what Sam has wired. Values that could identify a person stay out.
    has_cell: setup.owner_cell ? "yes" : "", has_booking_link: setup.booking_link ? "yes" : "", hours: setup.hours ?? "",
    // The agent's own settings, all of them the owner's to change.
    ...Object.fromEntries(AGENT_KEYS.map(x => [x, setup[x] ?? ""])),
    timezone: setup.timezone ?? "", a2p_status: setup.a2p_status ?? "", a2p_submitted: setup.a2p_submitted ?? "", forwarding: setup.forwarding ?? "", booking_page: setup.booking_page ?? "", has_webhook: setup.webhook_url ? "yes" : "", alert_email: setup.alert_email ? "yes" : "" };
}

/** Each place leads come from, what it did lately, and the last time it failed. Plus the last texts that didn't go out and the consent log. */
export async function connectionsReport(sql: Sql, c: Client): Promise<{ sources: { source: string; leads: number; last: string | null; last30: number }[]; failures: { id: string; at: string; body: string; name: string; phone: string; thread: string; source: string }[]; log: { at: string; event: string; source: string; phone: string; evidence: string }[] }> {
  const [src, fails, log] = await Promise.all([
    sql`SELECT source, count(*)::int AS leads, count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last30, max(created_at) AS last
      FROM public.client_threads WHERE project_id = ${c.projectId}::uuid AND source <> 'import' GROUP BY 1 ORDER BY 4 DESC`.catch(() => []) as Promise<Record<string, unknown>[]>,
    sql`SELECT x.id, x.at, x.body, t.customer_name, t.customer_phone, t.source, t.id AS thread FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
      WHERE t.project_id = ${c.projectId}::uuid AND x.direction = 'out' AND NOT x.ok ORDER BY x.at DESC LIMIT 30`.catch(() => []) as Promise<Record<string, unknown>[]>,
    sql`SELECT at, event, source, phone, evidence FROM public.client_consent WHERE project_id = ${c.projectId}::uuid ORDER BY at DESC LIMIT 60`.catch(() => []) as Promise<Record<string, unknown>[]>,
  ]);
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    sources: src.map(r => ({ source: String(r.source), leads: Number(r.leads) || 0, last30: Number(r.last30) || 0, last: iso(r.last) })),
    failures: fails.map(r => ({ id: String(r.id), at: iso(r.at) || "", body: String(r.body ?? "").slice(0, 160), name: String(r.customer_name ?? ""), phone: String(r.customer_phone ?? ""), thread: String(r.thread), source: String(r.source ?? "") })),
    log: log.map(r => ({ at: iso(r.at) || "", event: String(r.event), source: String(r.source ?? ""), phone: String(r.phone ?? ""), evidence: String(r.evidence ?? "").slice(0, 200) })),
  };
}

/** A job photo the owner or crew took: resized on the phone first, kept with the record. At most 40 a customer. */
export async function addPhoto(sql: Sql, c: Client, threadId: string, input: { data?: unknown; kind?: unknown; caption?: unknown }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const m = String(input.data ?? "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, error: "That photo didn't come through. Try again." };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 900_000) return { ok: false, error: "That photo is too large." };
  const [n] = await sql`SELECT count(*)::int AS n FROM public.client_photos WHERE thread_id = ${t.id}::uuid` as { n: number }[];
  if ((n?.n ?? 0) >= 40) return { ok: false, error: "40 photos is the most for one customer. Remove one first." };
  const kind = ["before", "during", "after"].includes(String(input.kind)) ? String(input.kind) : "other";
  const caption = String(input.caption ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  const [p] = await sql`INSERT INTO public.client_photos (owner_id, project_id, thread_id, kind, caption, mime, bytes, size) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, ${kind}, ${caption}, ${m[1]}, ${bytes}, ${bytes.length}) RETURNING id` as { id: string }[];
  return { ok: true, id: p.id };
}
export async function removePhoto(sql: Sql, c: Client, photoId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await sql`DELETE FROM public.client_photos WHERE id = ${photoId}::uuid AND project_id = ${c.projectId}::uuid RETURNING id`;
  return r.length ? { ok: true } : { ok: false, error: "That photo was already removed." };
}
/** Photo ids by customer, for the board (the bytes load one at a time from /api/app/photo). */
export async function photosByThread(sql: Sql, c: Client): Promise<Record<string, { id: string; kind: "before" | "during" | "after" | "other"; caption: string; at: string; shared: boolean }[]>> {
  const rows = await sql`SELECT id, thread_id, kind, caption, shared, created_at FROM public.client_photos WHERE project_id = ${c.projectId}::uuid ORDER BY created_at` as Record<string, unknown>[];
  const out: Record<string, { id: string; kind: "before" | "during" | "after" | "other"; caption: string; at: string; shared: boolean }[]> = {};
  for (const r of rows) (out[String(r.thread_id)] ??= []).push({ id: String(r.id), kind: String(r.kind) as "before", caption: String(r.caption ?? ""), at: new Date(String(r.created_at)).toISOString(), shared: !!r.shared });
  return out;
}

/**
 * Put a team member on a job (its install) and on the job's upcoming estimate, or take them off ("" = the owner).
 * They get one text with the day, the address and the link to their day in the app.
 */
export async function assignCrew(sql: Sql, c: Client, threadId: string, member: unknown, notify: (to: string, body: string) => Promise<boolean>): Promise<{ ok: boolean; error?: string; texted?: boolean }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const team = parseTeam(c.setup.team);
  const m = typeof member === "string" && member ? team.find(x => digits10(x.cell) === digits10(member)) : null;
  if (member && !m) return { ok: false, error: "That person isn't on your team. Add them in Settings, Account." };
  const cell = m?.cell ?? "";
  const [row] = await sql`UPDATE public.client_threads SET crew_member = ${cell}, updated_at = now() WHERE id = ${t.id}::uuid RETURNING customer_name, details, install_on::text AS install_on, install_time` as { customer_name: string; details: unknown; install_on: string | null; install_time: string | null }[];
  const [ap] = await sql`UPDATE public.client_appointments SET crew_member = ${cell} WHERE thread_id = ${t.id}::uuid AND status = 'booked' AND starts_at > now() - interval '2 hours' RETURNING starts_at` as { starts_at: string }[];
  if (!m || !c.setup.texting_number) return { ok: true, texted: false };
  const addr = String((row?.details as Record<string, unknown> | null)?.address ?? "");
  const when = row?.install_on ? `install ${new Date(row.install_on + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${row.install_time ? " at " + row.install_time : ""}`
    : ap ? `estimate ${new Date(ap.starts_at).toLocaleString("en-US", { timeZone: c.setup.timezone || "America/Denver", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "the job";
  const app = (process.env.CINDER_APP_URL?.trim() || "").replace(/\/$/, "");
  const texted = await notify(m.cell, `${c.setup.display_name || "Cinder"}: you're on ${row?.customer_name || "a job"}, ${when}${addr ? `, ${addr}` : ""}.${app ? ` Your day: ${app}/app` : ""}`);
  await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'out', 'system', ${`${m.name || "Crew"} put on this job${texted ? " and texted" : ""}.`})`;
  return { ok: true, texted };
}

/** "Remind me": a time and a note on a job. The owner gets a text and a push when it's due. Null clears it. */
export async function setReminder(sql: Sql, c: Client, threadId: string, at: unknown, note: unknown): Promise<{ ok: boolean; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  if (at === null || at === "") { await sql`UPDATE public.client_threads SET remind_at = NULL, remind_note = '', remind_sent_at = NULL, updated_at = now() WHERE id = ${t.id}::uuid`; return { ok: true }; }
  const when = new Date(String(at));
  if (!Number.isFinite(when.getTime())) return { ok: false, error: "Pick a time." };
  if (when.getTime() < Date.now() - 60000) return { ok: false, error: "That time has passed." };
  const text = String(note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  await sql`UPDATE public.client_threads SET remind_at = ${when.toISOString()}::timestamptz, remind_note = ${text}, remind_sent_at = NULL, updated_at = now() WHERE id = ${t.id}::uuid`;
  return { ok: true };
}

/** Tick or untick one step of a won job. The day is the owner's today unless they give one. */
export async function setJobStep(sql: Sql, c: Client, threadId: string, step: unknown, done: unknown, on?: unknown): Promise<{ ok: boolean; error?: string; job?: Record<string, string> }> {
  const key = String(step ?? "");
  if (!jobSteps(c.setup.trade, { hoa: "Yes" }).some(s => s.key === key)) return { ok: false, error: "Unknown step." };
  const day = typeof on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : today(c);
  const rows = (done ? await sql`UPDATE public.client_threads SET job_steps = job_steps || jsonb_build_object(${key}::text, ${day}::text), updated_at = now()
      WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid RETURNING job_steps`
    : await sql`UPDATE public.client_threads SET job_steps = job_steps - ${key}::text, updated_at = now()
      WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid RETURNING job_steps`) as { job_steps: unknown }[];
  return rows[0] ? { ok: true, job: cleanJob(rows[0].job_steps) } : { ok: false, error: "That customer isn't on your board." };
}
/** What the job cost: materials, labor, anything else. */
export async function setJobCosts(sql: Sql, c: Client, threadId: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const costs = cleanCosts(input);
  const rows = await sql`UPDATE public.client_threads SET job_costs = ${JSON.stringify(costs)}::jsonb, updated_at = now()
    WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid RETURNING id` as unknown[];
  return rows[0] ? { ok: true } : { ok: false, error: "That customer isn't on your board." };
}

/**
 * The owner's existing customers, from a Jobber export or a spreadsheet. One upsert per batch, keyed on the phone, so
 * running the same file twice changes nothing and never overwrites a name or notes already here. Past customers land
 * as Won with a stage date in the past (their "since" date, or a month ago when the file has none): they show in
 * Customers and count for win-back, but stay off the board. Open leads land in New as the owner's, like Add lead.
 * Cinder texts nobody here. With the owner's say-so the opt-in for promo texts goes on each number's consent record.
 */
export async function importCustomers(sql: Sql, c: Client, input: unknown, opts: { as?: unknown; consent?: unknown; from?: unknown } = {}): Promise<{ ok: true; added: number; existing: number; as: ImportAs } | { ok: false; error: string }> {
  const rows = cleanImportRows(input, today(c));
  if (!rows.length) return { ok: false, error: "No rows with a phone number to import." };
  const as = importAs(opts.as);
  const from = opts.from === "jobber" ? "Jobber" : "a spreadsheet";
  const stamp = today(c);
  const stage = as === "leads" ? "new" : "won", status = as === "leads" ? "paused" : "closed";
  const phones = rows.map(r => r.phone), names = rows.map(r => r.name), details = rows.map(r => JSON.stringify(r.address ? { address: r.address } : {}));
  const notes = rows.map(r => [r.notes, `Imported from ${from} on ${stamp}`].filter(Boolean).join("\n").slice(0, 2000));
  // Won needs a stage date before today: the customer's own since date, else a month back so win-back can reach them.
  const since = rows.map(r => (as === "leads" ? null : r.since));
  const out = await sql`INSERT INTO public.client_threads (owner_id, project_id, customer_phone, customer_name, source, status, details, notes, stage, stage_at)
    SELECT ${c.owner}, ${c.projectId}::uuid, p, n, 'import', ${status}, d::jsonb, x, ${stage},
      CASE WHEN ${as === "leads"}::boolean THEN now() ELSE coalesce(s::date::timestamptz, now() - interval '31 days') END
    FROM unnest(${phones}::text[], ${names}::text[], ${details}::text[], ${notes}::text[], ${since}::text[]) AS t(p, n, d, x, s)
    ON CONFLICT (project_id, customer_phone) DO UPDATE SET
      customer_name = CASE WHEN client_threads.customer_name = '' THEN EXCLUDED.customer_name ELSE client_threads.customer_name END,
      details = EXCLUDED.details || client_threads.details,
      notes = CASE WHEN client_threads.notes = '' THEN EXCLUDED.notes ELSE client_threads.notes END
    RETURNING (xmax = 0) AS inserted` as { inserted: boolean }[];
  const added = out.filter(r => r.inserted).length;
  // Emails from the file go on the record when the record has none.
  const withEmail = rows.filter(r => r.email);
  if (withEmail.length) await sql`UPDATE public.client_threads t SET customer_email = e.email FROM unnest(${withEmail.map(r => r.phone)}::text[], ${withEmail.map(r => r.email)}::text[]) AS e(phone, email)
    WHERE t.project_id = ${c.projectId}::uuid AND t.customer_phone = e.phone AND t.customer_email = ''`.catch(e => console.error("Import emails failed", e instanceof Error ? e.message : e));
  if (opts.consent === true) {
    const evidence = `Owner confirmed on import from ${from}: existing customer, opted in to promo texts`;
    await sql`INSERT INTO public.client_consent (owner_id, project_id, phone, event, source, evidence)
      SELECT ${c.owner}, ${c.projectId}::uuid, p, 'owner_import', 'import', ${evidence} FROM unnest(${phones}::text[]) AS t(p)`.catch(e => console.error("Consent log failed", e instanceof Error ? e.message : e));
  }
  return { ok: true, added, existing: out.length - added, as };
}
