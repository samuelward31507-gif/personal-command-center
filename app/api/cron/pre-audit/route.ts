import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendAlert } from "@/lib/notify";
import { sanitizeForLog } from "@/lib/business-audit";
import { runPreAudit, logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { findEmails } from "@/lib/find-emails-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/pre-audit — runs from Vercel Cron overnight. Audits the prospects in today's call list that
 * don't have an audit yet, so every call opens with a brief. Research only: no one is contacted.
 * Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically).
 * Every invocation from Vercel Cron is recorded in cron_runs — including refused ones — so a silent night is visible.
 */
export async function GET(request: Request) {
  const started = new Date();
  const secret = process.env.CRON_SECRET;
  const fromVercelCron = /vercel-cron/i.test(request.headers.get("user-agent") ?? "");
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    if (sql && fromVercelCron) {
      await logRun(sql, "pre-audit", "cron", "unauthorized", { reason: secret ? "authorization header did not match CRON_SECRET" : "CRON_SECRET is not set" }, started);
      await sendAlert({ subject: "Overnight audits didn't run", lines: ["The overnight audit job was refused: its secret didn't match.", "Run them by hand from Settings → Overnight audits → Run now."], link: { label: "Open Settings", path: "/crm/settings" } });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owner = process.env.CINDER_OWNER_ID?.trim();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!owner || !apiKey || !sql) {
    console.error("Pre-audit skipped: not configured", { owner: !!owner, apiKey: !!apiKey, db: !!sql });
    if (sql) await logRun(sql, "pre-audit", "cron", "error", { reason: "not configured", owner: !!owner, apiKey: !!apiKey }, started);
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  try {
    const result = await runPreAudit({ sql, owner, apiKey, tz: (await loadWorkspace(owner)).timezone });
    // Then find emails for new contacts, so tomorrow's calls and Autopilot have someone to email.
    const emails = await findEmails(sql, owner, { limit: 80, budgetMs: 60_000 }).catch(e => ({ error: e instanceof Error ? e.message : "failed" }));
    console.info("Overnight email finder", emails);
    console.info("Pre-audit run", result);
    await logRun(sql, "pre-audit", "cron", result.status, result, started);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = sanitizeForLog(error instanceof Error ? error.message : "");
    console.error("Pre-audit failed", { name: error instanceof Error ? error.name : typeof error, message });
    await logRun(sql, "pre-audit", "cron", "error", { reason: (error instanceof Error ? error.name : "error") + ": " + message.slice(0, 300) }, started);
    await sendAlert({ subject: "Overnight audits failed", lines: ["The overnight audit job hit an error.", "Run them by hand from Settings → Overnight audits → Run now."], link: { label: "Open Settings", path: "/crm/settings" } });
    return Response.json({ error: "Pre-audit failed" }, { status: 500 });
  }
}
