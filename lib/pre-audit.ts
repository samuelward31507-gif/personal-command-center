import type { NeonQueryFunction } from "@neondatabase/serverless";
import { DEFAULT_AUDIT_MODEL, normalizeWebsite, sanitizeForLog } from "@/lib/business-audit";
import { researchAndSave } from "@/lib/audit-engine";
import { loadMyDay } from "@/lib/my-day-data";
import { isPlaceholder } from "@/lib/contact-import";

type Sql = NeonQueryFunction<false, false>;

/** How many audits one run does (in parallel inside one 5-minute function). */
export const PER_RUN = 6;
/** Hard ceiling: no run once 20 audits (manual or automatic) exist in the last 20 hours. Caps API spend. */
export const DAILY_CAP = 20;

export type PreAuditResult = { status: "ok" | "skipped" | "error"; audited: number; attempted: number; candidates: number; reason?: string; failed?: string[]; ms: number };

function localDay(tz: string, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Record a run so the founder (and we) can see whether the overnight job fired and what it did. */
export async function logRun(sql: Sql, job: string, trigger: string, status: string, summary: Record<string, unknown>, startedAt?: Date) {
  try {
    await sql`INSERT INTO public.cron_runs (job, trigger, status, started_at, finished_at, summary)
      VALUES (${job}, ${trigger.slice(0, 40)}, ${status.slice(0, 40)}, ${(startedAt ?? new Date()).toISOString()}::timestamptz, now(), ${JSON.stringify(summary)}::jsonb)`;
  } catch (e) {
    console.error("cron_runs insert failed", { name: e instanceof Error ? e.name : typeof e });
  }
}

/**
 * Audit the prospects in today's call list that don't have an audit yet, so every call opens with a brief.
 * Research only: no one is contacted. Shared by the overnight cron and the "Run now" button.
 */
export async function runPreAudit(opts: { sql: Sql; owner: string; apiKey: string; tz: string; deadlineMs?: number }): Promise<PreAuditResult> {
  const { sql, owner, apiKey, tz } = opts;
  const started = Date.now();
  const recent = await sql`SELECT count(*)::int AS n FROM public.research_artifacts
    WHERE owner_id = ${owner} AND artifact_type = 'audit_prep' AND researched_at > now() - interval '20 hours'`;
  const budget = Math.max(0, Math.min(PER_RUN, DAILY_CAP - Number(recent[0]?.n ?? 0)));
  if (!budget) return { status: "skipped", audited: 0, attempted: 0, candidates: 0, reason: "daily cap reached", ms: Date.now() - started };

  const today = localDay(tz);
  const dayEnd = new Date(Date.parse(localDay(tz, 1) + "T12:00:00Z")).toISOString();
  const windowEnd = new Date(Date.parse(dayEnd) + 86_400_000).toISOString();
  const { items } = await loadMyDay(sql, owner, today, dayEnd, windowEnd);
  const ids = [...new Set(items.filter(i => i.callable && i.contact && !/Audit:/.test(i.why) && (i.group === "prospects" || i.group === "revenue")).map(i => i.contact!.id))];
  if (!ids.length) return { status: "skipped", audited: 0, attempted: 0, candidates: 0, reason: "every queued prospect already has an audit", ms: Date.now() - started };

  const contacts = await sql`
    SELECT c.id, c.company, c.first_name, c.last_name, c.website, c.location, c.notes FROM public.contacts c
    WHERE c.owner_id = ${owner} AND c.id = ANY(${ids}::uuid[])
      AND NOT EXISTS (SELECT 1 FROM public.research_artifacts r WHERE r.owner_id = c.owner_id AND r.contact_id = c.id AND r.artifact_type = 'audit_prep' AND r.status <> 'archived')`;
  const order = new Map(ids.map((id, i) => [id, i]));
  const batch = contacts.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0)).slice(0, budget);
  const model = process.env.CINDER_AUDIT_MODEL?.trim() || DEFAULT_AUDIT_MODEL;
  const deadline = started + (opts.deadlineMs ?? 270_000);

  const results = await Promise.allSettled(batch.map(async c => {
    const company = String(c.company || [c.first_name, c.last_name].filter(Boolean).join(" ")).slice(0, 200);
    const site = normalizeWebsite(String(c.website ?? "").slice(0, 2000));
    const r = await researchAndSave({
      sql, ownerId: owner, apiKey, model, companyName: company,
      website: site && !("error" in site) ? site.url : null, location: isPlaceholder(c.location) ? "" : String(c.location ?? "").slice(0, 300),
      context: ["Pre-audit before a cold call the founder will place himself.", c.notes ? `CRM notes: ${String(c.notes).slice(0, 1500)}` : ""].filter(Boolean).join("\n"),
      contactId: String(c.id), dealId: null, deadline,
    });
    return r.ok;
  }));
  const audited = results.filter(r => r.status === "fulfilled" && r.value).length;
  const failed = results.filter(r => r.status === "rejected").map(r => sanitizeForLog((r as PromiseRejectedResult).reason?.name ?? "error", 40));
  return { status: "ok", audited, attempted: batch.length, candidates: ids.length, failed, ms: Date.now() - started };
}
