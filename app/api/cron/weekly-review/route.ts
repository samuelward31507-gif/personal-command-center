import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendAlert, alertsConfigured } from "@/lib/notify";
import { buildWeeklyReview } from "@/lib/weekly-review";
import { loadReviewData } from "@/lib/weekly-review-data";
import { logRun } from "@/lib/pre-audit";
import { sanitizeForLog } from "@/lib/business-audit";
import { bearerMatches } from "@/lib/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/cron/weekly-review — Vercel Cron, Sunday morning. Emails the week's numbers and top 5 moves. Read-only. */
export async function GET(request: Request) {
  const started = new Date();
  const secret = process.env.CRON_SECRET;
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    if (sql && /vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await logRun(sql, "weekly-review", "cron", "unauthorized", { reason: secret ? "authorization header did not match CRON_SECRET" : "CRON_SECRET is not set" }, started);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owner = process.env.CINDER_OWNER_ID?.trim();
  if (!owner || !sql || !alertsConfigured()) {
    if (sql) await logRun(sql, "weekly-review", "cron", "error", { reason: "not configured", owner: !!owner, email: alertsConfigured() }, started);
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  try {
    const data = await loadReviewData(sql, owner);
    const wsp = await loadWorkspace(owner);
    const weekOf = new Intl.DateTimeFormat("en-US", { timeZone: wsp.timezone, month: "long", day: "numeric" }).format(new Date());
    const sent = await sendAlert(buildWeeklyReview(data, weekOf, { niche: wsp.niche, firstName: wsp.ownerFirstName }));
    await logRun(sql, "weekly-review", "cron", sent ? "ok" : "error", { sent }, started);
    return Response.json({ ok: sent });
  } catch (error) {
    console.error("Weekly review failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    await logRun(sql, "weekly-review", "cron", "error", { reason: "exception" }, started);
    return Response.json({ error: "Weekly review failed" }, { status: 500 });
  }
}
