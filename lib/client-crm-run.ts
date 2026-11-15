// The client CRM on the server: the board, moving a customer between stages, editing a card, adding a lead by hand,
// and the owner's own setup. Every write is scoped to the signed-in owner's business.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { ballpark, cleanDetails, cleanOwnerSetup, detailLine, parsePriceBook, stageFor, STAGES, cleanJob, cleanCosts, cleanLostReason, jobSteps, type Card, type Stage } from "@/lib/crm";
import { digits10 } from "@/lib/client-runtime";
import { cleanImportRows, importAs, type ImportAs } from "@/lib/customer-import";
import { emitEvent } from "@/lib/client-webhook";
import { quoteUrl, type Client } from "@/lib/client-runtime-run";
import { invoicesByThread } from "@/lib/client-billing-run";
import { cleanItems } from "@/lib/billing";

type Sql = NeonQueryFunction<false, false>;
export type { Card };

const today = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });

/** Every customer worth a card: active in the last 120 days, or still booked or quoted. Review and "you're due" texts aren't leads. */
export async function loadBoard(sql: Sql, c: Client): Promise<Card[]> {
  const invoices = await invoicesByThread(sql as never, c).catch(() => ({} as Record<string, Card["invoice"]>));
  const rows = await sql`SELECT t.id, t.customer_name, t.customer_phone, t.source, t.status, t.stage, t.details, t.value::float AS value, t.notes,
      coalesce(t.last_in_at, t.updated_at) AS at, q.id AS quote_id, q.amount::float AS quote_amount, q.status AS quote_status, q.steps_sent AS quote_steps,
      q.token AS quote_token, q.link_sent_at IS NOT NULL AS quote_linked, q.items AS quote_items, q.tax_rate::float AS quote_tax,
      t.install_time, t.install_days, t.install_event_id IS NOT NULL AS on_calendar, q.viewed_at AS quote_viewed, q.note AS quote_note, a.starts_at AS next_appt,
      t.install_on::text AS install_on, t.review_auto, rv.sent_at AS review_sent, t.job_steps, t.job_costs,
      (t.winback_at IS NOT NULL AND t.last_in_at > t.winback_at AND (t.stage_at IS NULL OR t.stage_at < t.winback_at)) AS winback_replied,
      t.stage_at, lr.body AS lost_note
    FROM public.client_threads t
    LEFT JOIN LATERAL (SELECT id, amount, status, steps_sent, token, link_sent_at, viewed_at, note, items, tax_rate FROM public.client_quotes x WHERE x.project_id = t.project_id AND x.kind = 'quote'
      AND right(regexp_replace(x.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10)
      ORDER BY x.created_at DESC LIMIT 1) q ON true
    LEFT JOIN LATERAL (SELECT sent_at FROM public.client_reviews r WHERE r.project_id = t.project_id
      AND right(regexp_replace(r.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10) ORDER BY sent_at DESC LIMIT 1) rv ON true
    LEFT JOIN LATERAL (SELECT starts_at FROM public.client_appointments y WHERE y.thread_id = t.id AND y.status = 'booked' AND y.starts_at > now() - interval '12 hours'
      ORDER BY y.starts_at LIMIT 1) a ON true
    LEFT JOIN LATERAL (SELECT body FROM public.client_texts z WHERE z.thread_id = t.id AND z.author = 'system' AND z.body LIKE 'Marked lost%' ORDER BY z.at DESC LIMIT 1) lr ON t.stage = 'lost'
    WHERE t.project_id = ${c.projectId}::uuid AND t.source NOT IN ('review', 'due')
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
      items: cleanItems(r.quote_items), tax: Number(r.quote_tax ?? 0) } : null;
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
      stageAt: r.stage_at ? new Date(String(r.stage_at)).toISOString() : null,
      lostReason: typeof r.lost_note === "string" ? (r.lost_note.match(/^Marked lost: (.+?)\. Follow-ups stopped\.$/)?.[1] ?? "") : "",
    };
  });
}

/** The owner's answers from the setup flow, merged into their setup. Sam's fields are never touched. */
export async function saveOwnerSetup(sql: Sql, c: Client, input: unknown): Promise<Record<string, string>> {
  const patch = cleanOwnerSetup(input);
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
export async function saveCard(sql: Sql, c: Client, threadId: string, input: { details?: unknown; value?: number | null; notes?: string; name?: string; install?: unknown; review?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const t = await threadOf(sql, c, threadId);
  if (!t) return { ok: false, error: "Not found." };
  const details = input.details === undefined ? null : cleanDetails(c.setup.trade, input.details);
  const notes = typeof input.notes === "string" ? input.notes.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").slice(0, 2000) : null;
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : null;
  const value = input.value === undefined ? undefined : input.value;
  await sql`UPDATE public.client_threads SET
      details = CASE WHEN ${details === null}::boolean THEN details ELSE ${JSON.stringify(details ?? {})}::jsonb END,
      notes = coalesce(${notes}, notes), customer_name = coalesce(${name}, customer_name),
      value = CASE WHEN ${value === undefined}::boolean THEN value ELSE ${value ?? null}::numeric END, updated_at = now()
    WHERE id = ${t.id}::uuid`;
  if (input.review !== undefined) await sql`UPDATE public.client_threads SET review_auto = ${!!input.review && !!c.setup.review_link} WHERE id = ${t.id}::uuid`;
  void emitEvent(c.setup, c.projectId, "lead.updated", event(c, { ...t, customer_name: name ?? t.customer_name }, { details: details ?? undefined, notes: notes ?? undefined, value }));
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
  const k = ["display_name", "owner_name", "website", "trade", "service_area", "team_size", "years", "leads_month", "lead_sources", "software", "price_book", "share_ballpark", "priority", "onboarded_at"];
  return { ...Object.fromEntries([...k, "pay_link", "tax_rate", "invoice_days"].map(x => [x, setup[x] ?? ""])), has_calendar: "", has_review_link: setup.review_link ? "yes" : "", has_number: setup.texting_number ? "yes" : "",
    // Read-only for the System screen: what Sam has wired. Values that could identify a person stay out.
    has_cell: setup.owner_cell ? "yes" : "", has_booking_link: setup.booking_link ? "yes" : "", hours: setup.hours ?? "" };
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
  if (opts.consent === true) {
    const evidence = `Owner confirmed on import from ${from}: existing customer, opted in to promo texts`;
    await sql`INSERT INTO public.client_consent (owner_id, project_id, phone, event, source, evidence)
      SELECT ${c.owner}, ${c.projectId}::uuid, p, 'owner_import', 'import', ${evidence} FROM unnest(${phones}::text[]) AS t(p)`.catch(e => console.error("Consent log failed", e instanceof Error ? e.message : e));
  }
  return { ok: true, added, existing: out.length - added, as };
}
