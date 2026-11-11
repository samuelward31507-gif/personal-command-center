import { appSession, clientFor, db, json } from "@/lib/client-app-run";
import { liveFor } from "@/lib/client-live";
import { calState, clientCalendar, listEvents, type CalEvent } from "@/lib/client-calendar";
import { SEQUENCES } from "@/lib/client-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?p=<project>&thread=<id>&tab=cal|sam — the signed-in owner's business: numbers, every lead, estimates, quotes, their calendar, one conversation. */
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
    const [live, biz, appts, unread, msgs, quotes, calRow] = await Promise.all([
      liveFor(sql, c.projectId, 80),
      sql`SELECT o.project_id, coalesce(o.setup->>'display_name', p.client_name, p.name) AS name, o.portal_token FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id WHERE o.project_id = ANY(${s.projects}::uuid[])`,
      // Booked estimates still waiting on an outcome (up to two weeks back) and everything coming up.
      sql`SELECT a.id, a.starts_at, a.status, a.event_id, t.id AS thread_id, t.customer_name, t.customer_phone FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
        WHERE a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND a.starts_at > now() - interval '14 days' ORDER BY a.starts_at LIMIT 60`.catch(() => []),
      sql`SELECT count(*)::int AS n FROM public.client_messages WHERE project_id = ${c.projectId}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => [{ n: 0 }]),
      sql`SELECT author, body, created_at FROM public.client_messages WHERE project_id = ${c.projectId}::uuid ORDER BY created_at DESC LIMIT 60`.catch(() => []),
      sql`SELECT id, customer_name, customer_phone, amount::float AS amount, sent_on::text AS sent_on, steps_sent, status FROM public.client_quotes
        WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open','replied') ORDER BY sent_on DESC LIMIT 40`.catch(() => []),
      sql`SELECT google_email FROM public.client_calendars WHERE project_id = ${c.projectId}::uuid`.catch(() => []),
    ]);
    // Their real calendar, read only on the Calendar tab (it's a Google call).
    let events: CalEvent[] = [], calError = "";
    const connected = (calRow as unknown[]).length > 0;
    if (connected && q.get("tab") === "cal") {
      const cal = await clientCalendar(sql, c.projectId).catch(() => null);
      if (!cal) calError = "Reconnect your calendar: Google stopped letting Cinder read it.";
      else events = await listEvents(cal, new Date(Date.now() - 12 * 3600_000), new Date(Date.now() + 8 * 86400_000)).catch(() => { calError = "Couldn't read your calendar just now."; return []; });
    }
    const links = new Map(events.map(e => [e.id, e.link]));
    const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
    const calendar = { connected, email: String((calRow as { google_email?: string }[])[0]?.google_email ?? ""), events, error: calError,
      connectUrl: `${origin}/api/client-calendar?state=${encodeURIComponent(calState(c.projectId))}` };
    if (q.get("tab") === "sam") await sql`UPDATE public.client_messages SET read_at = now() WHERE project_id = ${c.projectId}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => null);
    return json({
      project: c.projectId, business: c.setup.display_name || "", number: c.setup.texting_number || "", canCall: !!(c.setup.owner_cell && c.setup.texting_number),
      owner: c.setup.owner_name || "", businesses: biz, live,
      appointments: (appts as { event_id?: string }[]).map(a => ({ ...a, link: (a.event_id && links.get(a.event_id)) || "" })), quotes, quoteSteps: SEQUENCES.quote.days.length, calendar, messages: (msgs as Record<string, unknown>[]).reverse(), unreadFromSam: (unread as { n: number }[])[0]?.n ?? 0,
    });
  } catch (e) { console.error("App data failed", e instanceof Error ? e.message : e); return json({ error: "Couldn't load." }, 500); }
}
