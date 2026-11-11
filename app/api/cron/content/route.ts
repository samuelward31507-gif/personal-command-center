import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendAlert, alertsConfigured } from "@/lib/notify";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { dayDate, weekStart } from "@/lib/content-engine";
import { generateWeek } from "@/lib/content-engine-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/cron/content — Vercel Cron, Sunday morning. Writes next week's posts from this week's real numbers. */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (sql && /vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await logRun(sql, "content", "cron", "unauthorized", { reason: "authorization header did not match CRON_SECRET" }, started);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const o = process.env.CINDER_OWNER_ID?.trim();
  if (!o || !sql || !process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Not configured" }, { status: 503 });
  try {
    const ws = await loadWorkspace(o);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: ws.timezone || "America/Denver" }).format(started);
    const week = dayDate(weekStart(today), 7); // the coming Monday
    const r = await generateWeek(sql, o, week);
    if (r.written && alertsConfigured()) {
      await sendAlert({ subject: `Next week's posts are written (${r.written})`, lines: [`Cinder wrote ${r.written} posts for the week of ${week}: Facebook and Instagram, TikTok and Reels, LinkedIn and groups, each with its image.`, "Read them, tweak anything, and post each one on its day."], link: { label: "Open Content", path: "/crm/content" } }).catch(() => false);
    }
    await logRun(sql, "content", "cron", r.error && !r.written ? "error" : "ok", { week, written: r.written, error: r.error ?? null }, started);
    return Response.json({ ok: true, week, ...r });
  } catch (e) {
    console.error("Content cron failed", e instanceof Error ? e.message : e);
    await logRun(sql, "content", "cron", "error", { reason: "exception" }, started);
    return Response.json({ error: "Content cron failed" }, { status: 500 });
  }
}
