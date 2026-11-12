import { neon } from "@neondatabase/serverless";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { publishDue } from "@/lib/content-publish-run";
import { metaConfig } from "@/lib/meta-publish";
import { runDueTexts, runHandoffChecks, runLeadNudges, sendMondayReports, sendReminders } from "@/lib/client-runtime-run";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/publish — Vercel Cron, five times a day. Posts whatever is queued to Facebook and Instagram.
 * The same runs send clients' day-before estimate reminders and, on Mondays, each owner's weekly text, but only
 * between 9 AM and 7 PM local time, inside texting quiet-hour rules. Every run also nudges new leads that went quiet.
 */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (sql && /vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await logRun(sql, "publish", "cron", "unauthorized", { reason: "authorization header did not match CRON_SECRET" }, started);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const o = process.env.CINDER_OWNER_ID?.trim();
  if (!o || !sql) return Response.json({ error: "Not configured" }, { status: 503 });
  const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  try {
    const tz = (await loadWorkspace(o)).timezone || "America/Denver";
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(started));
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(started);
    const texts: Record<string, unknown> = {};
    // Lead nudges check each client's own texting hours (8 AM to 8 PM their time), so they run on every pass.
    texts.nudges = await runLeadNudges(sql, started).catch(e => { console.error("Lead nudges failed", e); return null; });
    texts.due = await runDueTexts(sql, started).catch(e => { console.error("Due texts failed", e); return null; });
    texts.handoffs = await runHandoffChecks(sql, started).catch(e => { console.error("Handoff checks failed", e); return null; });
    if (hour >= 9 && hour < 19) {
      texts.reminders = await sendReminders(sql).catch(e => { console.error("Reminders failed", e); return null; });
      if (weekday === "Mon") texts.mondayReports = await sendMondayReports(sql, origin, new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(started)).catch(e => { console.error("Monday reports failed", e); return null; });
    }
    const r = metaConfig() ? await publishDue(sql, o, origin, 6) : { posted: 0, failed: 0, skipped: "Meta not connected" };
    await logRun(sql, "publish", "cron", "failed" in r && r.failed && !r.posted ? "error" : "ok", { ...r, ...texts }, started);
    return Response.json({ ok: true, ...r, ...texts });
  } catch (e) {
    console.error("Publish cron failed", e instanceof Error ? e.message : e);
    await logRun(sql, "publish", "cron", "error", { reason: "exception" }, started);
    return Response.json({ error: "Publish failed" }, { status: 500 });
  }
}
