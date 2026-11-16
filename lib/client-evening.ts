// "While you worked": what happened while the owner was on a job, the one card that shows the app earned its keep.
// The last 24 hours: leads answered after hours (outside 8 AM to 6 PM, or a weekend), estimates booked, money in quotes
// that came back after follow-ups, invoices paid, review asks sent. At 6 PM the owner can also get it as one text.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { sendSms } from "@/lib/twilio";

type Sql = NeonQueryFunction<false, false>;
export type Evening = { since: string; leads: number; afterHours: number; replySec: number | null; booked: number; quotesBack: number; quotesBackValue: number; paid: number; reviews: number };

export async function eveningFor(sql: Sql, pid: string, tz: string): Promise<Evening> {
  const [r] = await sql`WITH t AS (SELECT t.id, t.created_at, t.created_at AT TIME ZONE ${tz} AS local,
        (SELECT extract(epoch FROM (min(o.at) - t.created_at)) FROM public.client_texts o WHERE o.thread_id = t.id AND o.direction = 'out' AND o.author <> 'system') AS first_sec
      FROM public.client_threads t WHERE t.project_id = ${pid}::uuid AND t.hidden_at IS NULL AND t.source NOT IN ('import', 'owner', 'quote', 'rehash', 'review', 'due') AND t.created_at > now() - interval '24 hours')
    SELECT (SELECT count(*)::int FROM t) AS leads,
      (SELECT count(*)::int FROM t WHERE first_sec IS NOT NULL AND (extract(hour FROM local) < 8 OR extract(hour FROM local) >= 18 OR extract(isodow FROM local) >= 6)) AS after_hours,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY first_sec) FROM t WHERE first_sec IS NOT NULL AND first_sec >= 0) AS reply_sec,
      (SELECT count(*)::int FROM public.client_appointments a WHERE a.project_id = ${pid}::uuid AND a.created_at > now() - interval '24 hours') AS booked,
      (SELECT count(*)::int FROM public.client_quotes q WHERE q.project_id = ${pid}::uuid AND q.status = 'won' AND q.steps_sent > 0 AND q.last_step_at > now() - interval '24 hours') AS quotes_back,
      (SELECT coalesce(sum(q.amount), 0)::float FROM public.client_quotes q WHERE q.project_id = ${pid}::uuid AND q.status = 'won' AND q.steps_sent > 0 AND q.last_step_at > now() - interval '24 hours') AS quotes_back_value,
      (SELECT coalesce(sum(p.amount), 0)::float FROM public.client_payments p WHERE p.project_id = ${pid}::uuid AND p.created_at > now() - interval '24 hours' AND p.import_id IS NULL)
        - (SELECT coalesce(sum(r.amount), 0)::float FROM public.client_refunds r WHERE r.project_id = ${pid}::uuid AND r.created_at > now() - interval '24 hours') AS paid,
      (SELECT count(*)::int FROM public.client_reviews v WHERE v.project_id = ${pid}::uuid AND v.sent_at > now() - interval '24 hours') AS reviews` as Record<string, unknown>[];
  return { since: new Date(Date.now() - 86400000).toISOString(), leads: Number(r?.leads ?? 0), afterHours: Number(r?.after_hours ?? 0), replySec: r?.reply_sec == null ? null : Math.round(Number(r.reply_sec)),
    booked: Number(r?.booked ?? 0), quotesBack: Number(r?.quotes_back ?? 0), quotesBackValue: Number(r?.quotes_back_value ?? 0), paid: Number(r?.paid ?? 0), reviews: Number(r?.reviews ?? 0) };
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
/** The 6 PM text, in one line. Null when the day had nothing worth a text. */
export function eveningText(e: Evening, business: string, app: string): string | null {
  const bits = [e.afterHours ? `${e.afterHours} ${e.afterHours === 1 ? "lead" : "leads"} answered after hours` : e.leads ? `${e.leads} ${e.leads === 1 ? "lead" : "leads"} answered${e.replySec != null ? ` in ${e.replySec < 60 ? e.replySec + "s" : Math.round(e.replySec / 60) + "m"}` : ""}` : "",
    e.booked ? `${e.booked} ${e.booked === 1 ? "estimate" : "estimates"} booked` : "", e.quotesBackValue ? `${usd(e.quotesBackValue)} in quotes back` : "", e.paid ? `${usd(e.paid)} paid` : "", e.reviews ? `${e.reviews} review ${e.reviews === 1 ? "ask" : "asks"} sent` : ""].filter(Boolean);
  if (!bits.length) return null;
  const biz = business.trim().replace(/\.+$/, "");
  return `${biz ? biz + ": w" : "W"}hile you worked today, ${bits.join(", ")}. ${app}`;
}

/** Each owner who asked for it gets the summary once, between 6 and 8 PM their time. */
export async function runEveningTexts(sql: Sql, now = new Date()): Promise<{ sent: number }> {
  const rows = await sql`SELECT project_id, owner_id, setup FROM public.client_ops WHERE setup->>'evening_text' = 'yes' AND coalesce(setup->>'texting_number', '') <> '' AND coalesce(setup->>'owner_cell', '') <> ''` as { project_id: string; owner_id: string; setup: Record<string, string> }[];
  const app = (process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || "https://cinderrevenue.com") + "/app";
  let sent = 0;
  for (const r of rows) {
    const tz = r.setup.timezone || "America/Denver";
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now)), day = now.toLocaleDateString("en-CA", { timeZone: tz });
    if (hour < 18 || hour >= 20 || r.setup.evening_sent === day) continue;
    const claimed = await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('evening_sent', ${day}::text) WHERE project_id = ${r.project_id}::uuid AND coalesce(setup->>'evening_sent', '') <> ${day} RETURNING project_id`;
    if (!claimed.length) continue;
    const text = eveningText(await eveningFor(sql, r.project_id, tz), r.setup.display_name || "", app);
    if (text && await sendSms(r.setup.owner_cell, r.setup.texting_number, text).catch(() => false)) sent++;
  }
  return { sent };
}
