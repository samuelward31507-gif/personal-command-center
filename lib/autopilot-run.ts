// Autopilot run: check replies, then send today's personal intros across the rotating inboxes.
// Shared by the weekday crons and the "Run now" button on the Email page.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { claudeText } from "@/lib/ai-text";
import { syncReplies } from "@/lib/gmail-sync";
import { sortNewMail } from "@/lib/gmail-inbox";
import { sendColdEmail } from "@/lib/gmail-send";
import { fillTemplate, mergeFor, TEMPLATE_SETS, trackOf } from "@/lib/email-outreach";
import { fetchPage, htmlToText } from "@/lib/website-text";
import { findEmails } from "@/lib/find-emails-run";
import { insertLine, parseLines, personalPrompt, PERSONAL_SYSTEM, runAllowance } from "@/lib/autopilot";
import type { WorkspaceSettings } from "@/lib/workspace";

type Sql = NeonQueryFunction<false, false>;
export type RunSummary = { at: string; sent: { company: string; email: string; personal: boolean }[]; skipped: number; stopped?: string; replies?: number; note?: string };

export async function autopilotSettings(sql: Sql, o: string): Promise<{ enabled: boolean; perDay: number; lastRun: RunSummary | null }> {
  const [a] = await sql`SELECT enabled, per_day, last_run FROM public.autopilot WHERE owner_id = ${o}` as { enabled: boolean; per_day: number; last_run: RunSummary | null }[];
  return { enabled: !!a?.enabled, perDay: a?.per_day ?? 40, lastRun: a?.last_run ?? null };
}

export async function runAutopilot(sql: Sql, o: string, ws: WorkspaceSettings, opts: { budgetMs: number; force?: boolean }): Promise<RunSummary> {
  const started = Date.now();
  const s = await autopilotSettings(sql, o);
  const out: RunSummary = { at: new Date().toISOString(), sent: [], skipped: 0 };
  const save = async () => { await sql`INSERT INTO public.autopilot (owner_id, last_run) VALUES (${o}, ${JSON.stringify(out)}::jsonb)
    ON CONFLICT (owner_id) DO UPDATE SET last_run = EXCLUDED.last_run, updated_at = now()`.catch(() => {}); return out; };
  if (!s.enabled && !opts.force) { out.stopped = "Autopilot is off."; return out; }
  if (!ws.address.trim()) { out.stopped = "Add your business mailing address in Settings. Every cold email needs it."; return save(); }

  // 1. Replies first, so nobody who answered gets another email.
  const sync = await syncReplies(sql, o).catch(() => null);
  if (!sync || sync.error) { out.stopped = sync?.error ?? "Couldn't check Gmail for replies, so nothing was sent."; return save(); }
  out.replies = (sync.replies ?? 0);
  await sortNewMail(sql, o).catch(() => null);

  // 2. How many intros today.
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM public.contact_activities WHERE owner_id = ${o} AND notes LIKE 'Email sent: intro%' AND occurred_at > now() - interval '24 hours'` as { n: number }[];
  let allowance = runAllowance(s.perDay, n);
  if (!allowance) { out.note = `Today's goal of ${s.perDay} intros is already met.`; return save(); }

  // 2b. Find emails for contacts that only have a website, so there is always someone new to email.
  await findEmails(sql, o, { limit: 20, budgetMs: opts.budgetMs * 0.15 }).catch(() => null);

  // 3. Who: a valid email, never emailed, never spoken to (anyone you've talked to is yours to follow up), not parked or suppressed.
  const rows = await sql`SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company, c.location, c.niche, c.email, c.website
    FROM public.contacts c
    WHERE c.owner_id = ${o} AND c.email ~* '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$'
      AND lower(coalesce(c.status, '')) <> 'customer'
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND (a.notes LIKE 'Email sent: %' OR a.notes LIKE 'Email reply:%' OR a.notes LIKE 'Email bounced:%' OR a.notes LIKE 'Email undeliverable:%'))
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.channel = 'call'
        AND a.outcome IN ('answered','connected','interested','meeting_booked','not_a_fit','not_interested','send_info','callback_requested','do_not_contact','wrong_contact','wrong_number'))
      AND NOT EXISTS (SELECT 1 FROM public.contact_suppressions x WHERE x.owner_id = c.owner_id AND (x.contact_id = c.id OR x.email_normalized = lower(c.email)))
      AND NOT EXISTS (SELECT 1 FROM public.contact_outreach co WHERE co.owner_id = c.owner_id AND co.contact_id = c.id AND co.status = 'parked')
      AND NOT EXISTS (SELECT 1 FROM public.gmail_inbox g WHERE g.owner_id = c.owner_id AND g.contact_id = c.id)
    ORDER BY (coalesce(c.website, '') <> '') DESC, c.created_at DESC LIMIT ${Math.min(allowance, 60)}` as { id: string; name: string; company: string; location: string; niche: string; email: string; website: string | null }[];
  if (!rows.length) { out.note = "Nobody new to email. Run Find emails, or import more contacts."; return save(); }

  // 4. Personal first lines, 10 businesses per Claude call.
  const lines = new Map<string, string>();
  if (process.env.ANTHROPIC_API_KEY) {
    for (let i = 0; i < rows.length && Date.now() - started < opts.budgetMs * 0.4; i += 10) {
      const chunk = rows.slice(i, i + 10);
      const sites = await Promise.all(chunk.map(async c => c.website ? htmlToText(await fetchPage(/^https?:\/\//i.test(c.website) ? c.website : "https://" + c.website, 6000)) : ""));
      try {
        const text = await claudeText({ apiKey: process.env.ANTHROPIC_API_KEY, system: PERSONAL_SYSTEM, label: "Autopilot first lines", model: "claude-haiku-5-5", maxTokens: 900, timeoutMs: 30_000,
          user: personalPrompt(chunk.map((c, k) => ({ company: c.company || c.name, niche: c.niche, city: (c.location || "").split(",")[0]?.trim() ?? "", site: sites[k] }))) });
        parseLines(text, chunk.length).forEach((l, k) => { if (l) lines.set(chunk[k].id, l); });
      } catch (e) { console.error("Autopilot lines failed", e instanceof Error ? e.message : e); }
    }
  }

  // 5. Send, spaced out, until the goal, the inboxes or the time budget runs out.
  for (const c of rows) {
    if (!allowance || Date.now() - started > opts.budgetMs) break;
    const t = TEMPLATE_SETS[trackOf(c.niche)].intro, m = mergeFor(c, ws);
    const line = lines.get(c.id) ?? "";
    const r = await sendColdEmail(sql, o, ws, { contactId: c.id, step: "intro", subject: fillTemplate(t.subject, m), body: insertLine(fillTemplate(t.body, m), line) });
    if (r.ok) { out.sent.push({ company: c.company || c.name, email: c.email, personal: !!line }); allowance--; }
    else if (r.status === 429) { out.stopped = r.error; break; }
    else if (r.status === 400 || r.status >= 500) { out.stopped = r.error; break; }
    else { out.skipped++; continue; }
    await new Promise(res => setTimeout(res, 3000 + Math.floor(Math.random() * 4000)));
  }
  return save();
}
