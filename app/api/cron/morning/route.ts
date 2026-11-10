import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendAlert, lastAlertError } from "@/lib/notify";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { syncReplies } from "@/lib/gmail-sync";
import { sortNewMail } from "@/lib/gmail-inbox";
import { sendColdEmail } from "@/lib/gmail-send";
import { dueContacts, fillTemplate, mergeFor, TEMPLATE_SETS, trackOf } from "@/lib/email-outreach";
import { USEFUL } from "@/lib/inbox-sort";
import { auditLinkFor, withAuditLine } from "@/lib/auto-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Auto follow-ups per morning. Small on purpose: a new inbox that sends a burst looks like a spammer. */
export const AUTO_FOLLOW_UPS_PER_DAY = 15;

/**
 * GET /api/cron/morning (Vercel Cron, ~6am Denver). In order:
 *  1. check cold-email threads for replies and bounces (so nobody who replied gets a follow-up)
 *  2. weekdays: send the email follow-ups and last tries that are due, from Gmail, in-thread
 *  3. sort new inbox mail
 *  4. email the morning brief: what went out, what needs you, what's on today
 */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (sql && /vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await logRun(sql, "morning", "cron", "unauthorized", { reason: "authorization header did not match CRON_SECRET" }, started);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const o = process.env.CINDER_OWNER_ID?.trim();
  if (!o || !sql) return Response.json({ error: "Not configured" }, { status: 503 });
  const ws = await loadWorkspace(o);
  const tz = ws.timezone || "America/Denver";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(started);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const result: Record<string, unknown> = {};
  const sentTo: string[] = [];
  const problems: string[] = [];

  // 1. Replies and bounces first.
  const sync = await syncReplies(sql, o).catch(() => null);
  result.sync = sync;
  if (sync?.needsReconnect) problems.push("Gmail needs reconnecting (Email page) before replies can be tracked.");
  else if (sync?.error) problems.push(`${sync.error} No follow-ups went out.`);
  else if (!sync) problems.push("Couldn't check Gmail for replies, so no follow-ups went out.");

  // 2. Due follow-ups, weekdays only, only when Gmail is connected and replies were checked.
  const [acc] = await sql`SELECT email FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string }[];
  if (acc && !isWeekend && sync && !sync.error) {
    const rows = await sql`SELECT contact_id, notes, occurred_at FROM public.contact_activities WHERE owner_id = ${o}
      AND (notes LIKE 'Email sent: %' OR notes LIKE 'Email reply:%' OR notes LIKE 'Email bounced:%') ORDER BY occurred_at DESC LIMIT 6000`;
    const sent = rows.filter(r => String(r.notes).startsWith("Email sent: ")).map(r => ({ contactId: String(r.contact_id), step: String(r.notes).slice(12).split(/\s|\n/)[0], at: new Date(r.occurred_at as string).toISOString() }));
    const heard = rows.filter(r => !String(r.notes).startsWith("Email sent: ")).map(r => ({ contactId: String(r.contact_id) }));
    // The job runs once each morning, so count gaps in calendar days: an intro sent any time 3 days ago is due today,
    // not tomorrow because it went out in the afternoon. Contacts that can't be sent (suppressed, booked, already
    // replied) don't use up the daily allowance, or they would sit at the front of the queue and block everyone forever.
    const due = dueContacts(sent, heard, started.getTime() + 18 * 3600000);
    for (const d of due) {
      if (sentTo.length >= AUTO_FOLLOW_UPS_PER_DAY || Date.now() - started.getTime() > 35_000) break;
      const [c] = await sql`SELECT id, trim(concat_ws(' ', first_name, last_name)) AS name, company, location, niche, website FROM public.contacts WHERE id = ${d.contactId}::uuid AND owner_id = ${o}` as { id: string; name: string; company: string; location: string; niche: string; website: string | null }[];
      if (!c) continue;
      const t = TEMPLATE_SETS[trackOf(c.niche)][d.step], m = mergeFor(c, ws);
      // The follow-up carries a free audit of their site when there's something real to show.
      const audit = d.step === "follow_up" ? await auditLinkFor(sql, o, c).catch(() => null) : null;
      const body = audit ? withAuditLine(fillTemplate(t.body, m), m.company, audit) : fillTemplate(t.body, m);
      const r = await sendColdEmail(sql, o, ws, { contactId: c.id, step: d.step, subject: fillTemplate(t.subject, m), body });
      if (r.ok) sentTo.push(`${c.company || c.name} (${d.step === "breakup" ? "last try" : "follow-up"})`);
      else if (r.status === 401) { problems.push(r.error); continue; } // one inbox lost access: the others keep sending
      else if (r.status === 429 || r.status === 500 || /mailing address|Connect Gmail first/i.test(r.error)) { problems.push(r.error); break; }
      else continue;
      await new Promise(res => setTimeout(res, 1200));
    }
  }
  result.autoSent = sentTo.length;

  // 3. Sort new inbox mail.
  // Skip it when the sends ran long, so the brief still goes out inside the 60 second limit (the Email page sorts on open).
  const sort = acc && Date.now() - started.getTime() < 15_000 ? await sortNewMail(sql, o).catch(() => null) : null;
  result.sort = sort;

  // 4. The brief.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(started);
  const [counts] = await sql`SELECT
      (SELECT count(*)::int FROM public.tasks t WHERE t.owner_id = ${o} AND t.status IN ('todo','in_progress') AND (t.title LIKE 'Call back%' OR t.title LIKE 'Redial%')
         AND (t.due_at AT TIME ZONE ${tz})::date <= ${today}::date) AS calls_due,
      (SELECT count(*)::int FROM public.tasks t WHERE t.owner_id = ${o} AND t.status IN ('todo','in_progress') AND t.title LIKE 'Follow up on info%'
         AND (t.due_at AT TIME ZONE ${tz})::date <= ${today}::date) AS texts_due,
      (SELECT count(*)::int FROM public.inbox_messages m WHERE m.owner_id = ${o} AND m.seen_at IS NULL) AS dms,
      (SELECT count(*)::int FROM public.contact_activities a WHERE a.owner_id = ${o} AND a.channel = 'call' AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated'
         AND (a.occurred_at AT TIME ZONE ${tz})::date = ${today}::date - 1) AS dials_yesterday,
      (SELECT count(*)::int FROM public.contacts c WHERE c.owner_id = ${o} AND c.status = 'lead' AND c.phone <> ''
         AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id)) AS fresh_leads` as Record<string, number>[];
  const warm = await sql`WITH last AS (SELECT DISTINCT ON (a.contact_id) a.contact_id, a.outcome, a.occurred_at FROM public.contact_activities a
        WHERE a.owner_id = ${o} AND a.channel = 'call' AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated' ORDER BY a.contact_id, a.occurred_at DESC)
      SELECT c.company, c.first_name FROM last l JOIN public.contacts c ON c.id = l.contact_id AND c.owner_id = ${o}
      WHERE l.outcome IN ('interested','send_info') AND l.occurred_at > now() - interval '30 days' AND c.phone <> ''
        AND NOT EXISTS (SELECT 1 FROM public.contact_activities t WHERE t.owner_id = c.owner_id AND t.contact_id = c.id AND t.action = 'outbound_text' AND t.occurred_at >= l.occurred_at)
      LIMIT 10` as { company: string; first_name: string }[];
  const meetings = await sql`SELECT e.title, e.starts_at FROM public.calendar_events e WHERE e.owner_id = ${o} AND e.status = 'scheduled'
      AND e.starts_at > now() AND e.starts_at < now() + interval '36 hours' ORDER BY e.starts_at LIMIT 6` as { title: string; starts_at: string }[];
  const mail = await sql`SELECT from_name, from_addr, summary, category FROM public.gmail_inbox WHERE owner_id = ${o} AND handled_at IS NULL
      AND category = ANY(${USEFUL}::text[]) AND received_at > now() - interval '30 days' ORDER BY received_at DESC LIMIT 5` as { from_name: string; from_addr: string; summary: string; category: string }[];

  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const lines: string[] = [`Good morning ${ws.ownerFirstName || ""}. Today is ${ws.dailyCallTarget || 150} dials.`.replace("  ", " ")];
  lines.push(`Call mode: ${counts.calls_due} callbacks and redials due, ${counts.fresh_leads} fresh leads ready. Yesterday: ${counts.dials_yesterday} dials.`);
  if (meetings.length) lines.push(`Meetings next 36 hours: ${meetings.map(m => `${m.title} (${time(m.starts_at)})`).join("; ")}. Text each one to confirm from Today.`);
  if (warm.length) lines.push(`${warm.length} warm lead${warm.length === 1 ? "" : "s"} still waiting on the info text: ${warm.map(w => w.company || w.first_name).join(", ")}. One tap each on Today.`);
  if (counts.texts_due) lines.push(`${counts.texts_due} follow-up text${counts.texts_due === 1 ? "" : "s"} due today (on Today).`);
  if (mail.length) lines.push(`Emails that need you: ${mail.map(m => `${m.from_name || m.from_addr}${m.summary ? ` (${m.summary})` : ""}`).join("; ")}.`);
  if (counts.dms) lines.push(`${counts.dms} unread Instagram/Facebook DM${counts.dms === 1 ? "" : "s"}.`);
  if (sentTo.length) lines.push(`Sent for you this morning: ${sentTo.length} email follow-up${sentTo.length === 1 ? "" : "s"} (${sentTo.slice(0, 8).join(", ")}${sentTo.length > 8 ? "…" : ""}).`);
  if (sync && sync.replies) lines.push(`New email replies found: ${sync.replies}. Their follow-ups stopped.`);
  for (const p of problems) lines.push(`Heads up: ${p}`);
  const sentBrief = await sendAlert({ subject: `Today: ${counts.calls_due} callbacks, ${warm.length + (counts.texts_due || 0)} texts, ${mail.length} emails`, lines, link: { label: "Open Today", path: "/crm/needs-you" } });
  result.brief = sentBrief;
  if (!sentBrief) result.briefError = lastAlertError;
  await logRun(sql, "morning", "cron", problems.length ? "error" : "ok", result, started);
  return Response.json({ ok: true, ...result });
}
