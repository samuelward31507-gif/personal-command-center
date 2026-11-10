import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { loadWorkspace } from "@/lib/workspace-data";
import { autopilotSettings, runAutopilot } from "@/lib/autopilot-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }

/** GET: Autopilot on/off, intros per day, the last run. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ enabled: false, perDay: 40, lastRun: null });
  return Response.json(await autopilotSettings(neon(process.env.DATABASE_URL), o), { headers: { "Cache-Control": "no-store" } });
}

/** POST { enabled?, perDay? } saves settings. POST { run: true } runs it now (up to ~4 minutes). */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  const b = await req.json().catch(() => ({}));
  if (b.run) return Response.json(await runAutopilot(sql, o, await loadWorkspace(o), { budgetMs: 240_000, force: true }));
  const perDay = Math.max(5, Math.min(200, Math.round(Number(b.perDay) || 40)));
  await sql`INSERT INTO public.autopilot (owner_id, enabled, per_day) VALUES (${o}, ${!!b.enabled}, ${perDay})
    ON CONFLICT (owner_id) DO UPDATE SET enabled = EXCLUDED.enabled, per_day = EXCLUDED.per_day, updated_at = now()`;
  return Response.json(await autopilotSettings(sql, o));
}
