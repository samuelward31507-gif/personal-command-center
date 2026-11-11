import { neon } from "@neondatabase/serverless";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { publishDue } from "@/lib/content-publish-run";
import { metaConfig } from "@/lib/meta-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/cron/publish — Vercel Cron, five times a day: posts whatever is queued for now to Facebook and Instagram. */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (sql && /vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await logRun(sql, "publish", "cron", "unauthorized", { reason: "authorization header did not match CRON_SECRET" }, started);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const o = process.env.CINDER_OWNER_ID?.trim();
  if (!o || !sql) return Response.json({ error: "Not configured" }, { status: 503 });
  if (!metaConfig()) return Response.json({ ok: true, skipped: "Meta not connected" });
  const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  try {
    const r = await publishDue(sql, o, origin, 6);
    await logRun(sql, "publish", "cron", r.failed && !r.posted ? "error" : "ok", r, started);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("Publish cron failed", e instanceof Error ? e.message : e);
    await logRun(sql, "publish", "cron", "error", { reason: "exception" }, started);
    return Response.json({ error: "Publish failed" }, { status: 500 });
  }
}
