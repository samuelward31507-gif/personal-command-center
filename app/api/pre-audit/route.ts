import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { sanitizeForLog } from "@/lib/business-audit";
import { runPreAudit, logRun } from "@/lib/pre-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/pre-audit — the last runs of the overnight audit job (cron and manual). */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT trigger, status, started_at, finished_at, summary FROM public.cron_runs WHERE job = 'pre-audit' ORDER BY started_at DESC LIMIT 7`;
    return Response.json({ runs: rows.map(r => ({ trigger: r.trigger, status: r.status, startedAt: new Date(String(r.started_at)).toISOString(), summary: r.summary ?? {} })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Pre-audit status failed", { name: error instanceof Error ? error.name : typeof error });
    return fail("Could not load audit runs.", 500);
  }
}

/** POST /api/pre-audit — run the pre-audit now for today's call list. Research only; same spend cap as the cron. */
export async function POST() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("Audits need ANTHROPIC_API_KEY in the deployment environment.", 503);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  const sql = neon(process.env.DATABASE_URL);
  const started = new Date();
  try {
    const result = await runPreAudit({ sql, owner: user.id, apiKey, tz: process.env.CINDER_TIMEZONE?.trim() || "America/Denver" });
    await logRun(sql, "pre-audit", "manual", result.status, result, started);
    return Response.json(result);
  } catch (error) {
    const message = sanitizeForLog(error instanceof Error ? error.message : "");
    console.error("Manual pre-audit failed", { name: error instanceof Error ? error.name : typeof error, message });
    await logRun(sql, "pre-audit", "manual", "error", { reason: message.slice(0, 300) }, started);
    return fail("The audit run failed. Try again in a minute.", 500);
  }
}
