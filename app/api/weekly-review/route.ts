import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { auth } from "@/lib/auth/server";
import { sendAlert, alertsConfigured } from "@/lib/notify";
import { buildWeeklyReview } from "@/lib/weekly-review";
import { loadReviewData } from "@/lib/weekly-review-data";
import { logRun } from "@/lib/pre-audit";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/weekly-review — preview this week's review (no email). POST — email it now. */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const wsp = await loadWorkspace(user.id);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const sql = neon(process.env.DATABASE_URL);
    const review = buildWeeklyReview(await loadReviewData(sql, user.id), new Intl.DateTimeFormat("en-US", { timeZone: wsp.timezone, month: "long", day: "numeric" }).format(new Date()), { niche: wsp.niche, firstName: wsp.ownerFirstName });
    const runs = await sql`SELECT status, started_at FROM public.cron_runs WHERE job = 'weekly-review' ORDER BY started_at DESC LIMIT 3`;
    return Response.json({ review, runs: runs.map(r => ({ status: String(r.status), at: new Date(String(r.started_at)).toISOString() })), email: alertsConfigured() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Weekly review preview failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not build the review.", 500);
  }
}

export async function POST() {
  const started = new Date();
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const wsp = await loadWorkspace(user.id);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    if (!alertsConfigured()) return fail("Email alerts aren't set up (RESEND_API_KEY and CINDER_ALERT_EMAIL).", 503);
    const sql = neon(process.env.DATABASE_URL);
    const sent = await sendAlert(buildWeeklyReview(await loadReviewData(sql, user.id), new Intl.DateTimeFormat("en-US", { timeZone: wsp.timezone, month: "long", day: "numeric" }).format(new Date()), { niche: wsp.niche, firstName: wsp.ownerFirstName }));
    await logRun(sql, "weekly-review", "manual", sent ? "ok" : "error", { sent }, started);
    if (!sent) return fail("The email didn't go through. Check the Resend key.", 502);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Weekly review send failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not send the review.", 500);
  }
}
