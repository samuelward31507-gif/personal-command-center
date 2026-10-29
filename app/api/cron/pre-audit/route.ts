import { neon } from "@neondatabase/serverless";
import { DEFAULT_AUDIT_MODEL, normalizeWebsite, sanitizeForLog } from "@/lib/business-audit";
import { researchAndSave } from "@/lib/audit-engine";
import { loadMyDay } from "@/lib/my-day-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How many audits one overnight run does (they run in parallel inside one 5-minute function). */
const PER_RUN = 6;
/** Hard ceiling: no automatic run once 20 audits (manual or automatic) exist in the last 20 hours. Caps API spend. */
const DAILY_CAP = 20;

function localDay(tz: string, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * GET /api/cron/pre-audit — runs from Vercel Cron overnight. Audits the prospects in today's call list that
 * don't have an audit yet, so every call opens with a brief. Research only: no one is contacted.
 * Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const owner = process.env.CINDER_OWNER_ID?.trim();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!owner || !apiKey || !process.env.DATABASE_URL) {
    console.error("Pre-audit skipped: not configured", { owner: !!owner, apiKey: !!apiKey, db: !!process.env.DATABASE_URL });
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  const started = Date.now();
  try {
    const sql = neon(process.env.DATABASE_URL);
    const recent = await sql`SELECT count(*)::int AS n FROM public.research_artifacts
      WHERE owner_id = ${owner} AND artifact_type = 'audit_prep' AND researched_at > now() - interval '20 hours'`;
    const budget = Math.max(0, Math.min(PER_RUN, DAILY_CAP - Number(recent[0]?.n ?? 0)));
    if (!budget) return Response.json({ ok: true, audited: 0, reason: "daily cap reached" });

    const tz = process.env.CINDER_TIMEZONE?.trim() || "America/Denver";
    const today = localDay(tz);
    const dayEnd = new Date(Date.parse(localDay(tz, 1) + "T12:00:00Z")).toISOString();
    const windowEnd = new Date(Date.parse(dayEnd) + 86_400_000).toISOString();
    const { items } = await loadMyDay(sql, owner, today, dayEnd, windowEnd);
    const ids = [...new Set(items.filter(i => i.callable && i.contact && !/Audit:/.test(i.why) && (i.group === "prospects" || i.group === "revenue")).map(i => i.contact!.id))];
    if (!ids.length) return Response.json({ ok: true, audited: 0, reason: "every queued prospect already has an audit" });

    const contacts = await sql`
      SELECT c.id, c.company, c.first_name, c.last_name, c.website, c.location, c.notes FROM public.contacts c
      WHERE c.owner_id = ${owner} AND c.id = ANY(${ids}::uuid[])
        AND NOT EXISTS (SELECT 1 FROM public.research_artifacts r WHERE r.owner_id = c.owner_id AND r.contact_id = c.id AND r.artifact_type = 'audit_prep' AND r.status <> 'archived')`;
    const order = new Map(ids.map((id, i) => [id, i]));
    const batch = contacts.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0)).slice(0, budget);
    const model = process.env.CINDER_AUDIT_MODEL?.trim() || DEFAULT_AUDIT_MODEL;
    const deadline = started + 270_000;

    const results = await Promise.allSettled(batch.map(async c => {
      const company = String(c.company || [c.first_name, c.last_name].filter(Boolean).join(" ")).slice(0, 200);
      const site = normalizeWebsite(String(c.website ?? "").slice(0, 2000));
      const r = await researchAndSave({
        sql, ownerId: owner, apiKey, model, companyName: company,
        website: site && !("error" in site) ? site.url : null, location: String(c.location ?? "").slice(0, 300),
        context: ["Overnight pre-audit before a cold call the founder will place himself.", c.notes ? `CRM notes: ${String(c.notes).slice(0, 1500)}` : ""].filter(Boolean).join("\n"),
        contactId: String(c.id), dealId: null, deadline,
      });
      return r.ok;
    }));
    const audited = results.filter(r => r.status === "fulfilled" && r.value).length;
    const failed = results.filter(r => r.status === "rejected").map(r => sanitizeForLog((r as PromiseRejectedResult).reason?.name ?? "error", 40));
    console.info("Pre-audit run", { candidates: ids.length, attempted: batch.length, audited, failed, ms: Date.now() - started });
    return Response.json({ ok: true, audited, attempted: batch.length });
  } catch (error) {
    console.error("Pre-audit failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return Response.json({ error: "Pre-audit failed" }, { status: 500 });
  }
}
