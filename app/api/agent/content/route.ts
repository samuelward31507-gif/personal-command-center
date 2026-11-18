import { dateParam, parseContentUpdate, weekAndDay } from "@/lib/agent-api";
import { agentGuard, agentJson, todayIn } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/content?date=YYYY-MM-DD: the posts Sam's content plan has for that day. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const date = dateParam(new URL(request.url).searchParams.get("date"), todayIn());
  if (!date) return agentJson({ error: "date must be YYYY-MM-DD." }, 400);
  const { week, day } = weekAndDay(date);
  try {
    const rows = await g.sql`SELECT id, platform, pillar, format, hook, body, card, slides, shoot, status, url, views, comments, leads
      FROM public.content_drafts WHERE owner_id = ${g.owner} AND week = ${week}::date AND day = ${day} ORDER BY platform, created_at` as Record<string, unknown>[];
    return agentJson({ date, posts: rows.map(r => ({ id: String(r.id), platform: String(r.platform), pillar: String(r.pillar ?? ""), format: String(r.format), hook: String(r.hook ?? ""),
      body: String(r.body ?? ""), card: r.card ?? {}, slides: r.slides ?? [], shoot: String(r.shoot ?? ""), status: String(r.status), url: String(r.url ?? ""),
      views: r.views ?? null, comments: r.comments ?? null, leads: r.leads ?? null })) });
  } catch (e) {
    console.error("Agent content failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not load the content plan." }, 500);
  }
}

/** POST /api/agent/content: mark a planned post posted (with its url) or skipped, or record its numbers later. */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseContentUpdate(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const u = parsed.update;
  try {
    const rows = await g.sql`UPDATE public.content_drafts SET
        status = coalesce(${u.status}, status),
        posted_at = CASE WHEN ${u.status} = 'posted' AND posted_at IS NULL THEN now() ELSE posted_at END,
        url = CASE WHEN ${u.url} <> '' THEN ${u.url} ELSE url END,
        views = coalesce(${u.views}::int, views), comments = coalesce(${u.comments}::int, comments), leads = coalesce(${u.leads}::int, leads)
      WHERE owner_id = ${g.owner} AND id = ${u.id}::uuid RETURNING id`;
    if (!rows.length) return agentJson({ error: "No planned post with that id." }, 404);
    return agentJson({ ok: true });
  } catch (e) {
    console.error("Agent content update failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not update the post." }, 500);
  }
}
