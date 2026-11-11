import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { runAutopilot } from "@/lib/autopilot-run";
import { runQuoteFollowUps } from "@/lib/client-runtime-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/cron/autopilot (Vercel Cron, weekday mornings and midday, Denver): one Autopilot run. */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const o = process.env.CINDER_OWNER_ID?.trim();
  if (!o || !sql) return Response.json({ error: "Not configured" }, { status: 503 });
  const ws = await loadWorkspace(o);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: ws.timezone || "America/Denver", weekday: "short" }).format(started);
  if (day === "Sat" || day === "Sun") return Response.json({ skipped: "weekend" });
  // Clients' quote follow-ups and revive texts go first, in daytime hours (these runs are 8:27am to 2:27pm Denver).
  const clients = await runQuoteFollowUps(sql, started.toISOString().slice(0, 10)).catch(e => { console.error("Client follow-ups failed", e); return null; });
  const r = await runAutopilot(sql, o, ws, { budgetMs: 240_000 });
  await logRun(sql, "autopilot", "cron", r.stopped === "Autopilot is off." ? "off" : r.stopped && !r.sent.length ? "error" : "ok", r as unknown as Record<string, unknown>, started).catch(() => {});
  return Response.json({ ...r, clients });
}
