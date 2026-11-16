import { neon } from "@neondatabase/serverless";
import { loadWorkspace } from "@/lib/workspace-data";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { runBrief } from "@/lib/brief";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/cron/brief (Vercel Cron, ~4:47am Denver, after the overnight audits): follow-up drafts, then the written brief. */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const owner = process.env.CINDER_OWNER_ID?.trim();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!owner || !sql || !apiKey) return Response.json({ error: "Not configured" }, { status: 503 });
  try {
    const ws = await loadWorkspace(owner);
    const r = await runBrief({ sql, owner, apiKey, tz: ws.timezone || "America/Denver", firstName: ws.ownerFirstName, signOff: `${ws.ownerFirstName} with ${ws.shortName || ws.businessName}` });
    await logRun(sql, "brief", "cron", "ok", r, started);
    return Response.json(r);
  } catch (error) {
    const message = sanitizeForLog(error instanceof Error ? error.message : "");
    await logRun(sql, "brief", "cron", "error", { reason: message.slice(0, 300) }, started);
    return Response.json({ error: "Brief failed" }, { status: 500 });
  }
}
