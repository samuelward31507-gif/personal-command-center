import { appSession, clientFor, db, json } from "@/lib/client-app-run";
import { liveFor } from "@/lib/client-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?p=<project>&thread=<id> — the signed-in owner's business: numbers, every lead, estimates, one conversation. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const q = new URL(req.url).searchParams;
  try {
    const sql = db();
    const c = await clientFor(sql, s, q.get("p"));
    if (!c) return json({ error: "Sign in" }, 401);
    const th = q.get("thread");
    if (th && /^[0-9a-f-]{36}$/i.test(th)) {
      const [t] = await sql`SELECT id, customer_name, customer_phone, source, status, lang FROM public.client_threads WHERE id = ${th}::uuid AND project_id = ${c.projectId}::uuid` as Record<string, unknown>[];
      if (!t) return json({ error: "Not found" }, 404);
      const texts = await sql`SELECT id, direction, author, body, at, media FROM public.client_texts WHERE thread_id = ${th}::uuid ORDER BY at LIMIT 400`;
      return json({ thread: t, texts });
    }
    const [live, biz, appts, unread, msgs] = await Promise.all([
      liveFor(sql, c.projectId, 80),
      sql`SELECT o.project_id, coalesce(o.setup->>'display_name', p.client_name, p.name) AS name, o.portal_token FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id WHERE o.project_id = ANY(${s.projects}::uuid[])`,
      sql`SELECT a.id, a.starts_at, a.status, t.id AS thread_id, t.customer_name, t.customer_phone FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
        WHERE a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND a.starts_at > now() - interval '12 hours' ORDER BY a.starts_at LIMIT 30`.catch(() => []),
      sql`SELECT count(*)::int AS n FROM public.client_messages WHERE project_id = ${c.projectId}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => [{ n: 0 }]),
      sql`SELECT author, body, created_at FROM public.client_messages WHERE project_id = ${c.projectId}::uuid ORDER BY created_at DESC LIMIT 60`.catch(() => []),
    ]);
    if (q.get("tab") === "sam") await sql`UPDATE public.client_messages SET read_at = now() WHERE project_id = ${c.projectId}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => null);
    return json({
      project: c.projectId, business: c.setup.display_name || "", number: c.setup.texting_number || "", canCall: !!(c.setup.owner_cell && c.setup.texting_number),
      businesses: biz, live, appointments: appts, messages: (msgs as Record<string, unknown>[]).reverse(), unreadFromSam: (unread as { n: number }[])[0]?.n ?? 0,
    });
  } catch (e) { console.error("App data failed", e instanceof Error ? e.message : e); return json({ error: "Couldn't load." }, 500); }
}
