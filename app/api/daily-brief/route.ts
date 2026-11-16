import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { loadWorkspace } from "@/lib/workspace-data";
import { aiAllowed, AI_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { logRun } from "@/lib/pre-audit";
import { runBrief } from "@/lib/brief";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const localDay = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** GET /api/daily-brief — today's written brief, or { brief: null } if the overnight job hasn't written one yet. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const tz = (await loadWorkspace(user.id)).timezone || "America/Denver";
    const rows = await sql`SELECT day::text AS day, brief, calls, generated_at FROM public.daily_briefs WHERE owner_id = ${user.id} AND day = ${localDay(tz)}::date LIMIT 1`;
    const r = rows[0];
    return Response.json({ brief: r ? { day: String(r.day), text: String(r.brief), calls: r.calls ?? [], generatedAt: new Date(String(r.generated_at)).toISOString() } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Daily brief load failed", { name: error instanceof Error ? error.name : typeof error });
    return Response.json({ brief: null }, { headers: { "Cache-Control": "no-store" } });
  }
}

/** POST /api/daily-brief — write today's brief (and look for follow-ups) now, instead of waiting for the morning job. */
export async function POST() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!(await aiAllowed(user.id))) return fail(AI_LIMIT_MESSAGE, 429);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("The brief needs ANTHROPIC_API_KEY in the deployment environment.", 503);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  const sql = neon(process.env.DATABASE_URL);
  const started = new Date();
  try {
    const ws = await loadWorkspace(user.id);
    const r = await runBrief({ sql, owner: user.id, apiKey, tz: ws.timezone || "America/Denver", firstName: ws.ownerFirstName, signOff: `${ws.ownerFirstName} with ${ws.shortName || ws.businessName}` });
    await logRun(sql, "brief", "manual", "ok", r, started);
    return Response.json(r);
  } catch (error) {
    const message = sanitizeForLog(error instanceof Error ? error.message : "");
    console.error("Manual brief failed", { message });
    await logRun(sql, "brief", "manual", "error", { reason: message.slice(0, 300) }, started);
    return fail("Couldn't write the brief. Try again in a minute.", 500);
  }
}
