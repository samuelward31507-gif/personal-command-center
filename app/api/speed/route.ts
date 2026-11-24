import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { assess, summary, type SpeedClient } from "@/lib/speed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/speed: every client's speed-to-lead health, for Sam only (the client app never calls this).
 * A client is any project with a client app set up (client_ops). Live = it has a texting number and the
 * project isn't completed or cancelled. Leads are new conversations (not quote, review or owner threads).
 * ?summary=1 returns just the counts the sidebar badge needs.
 */
const NOT_LEADS = ["quote", "rehash", "review", "due", "owner"];
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }

export async function GET(request: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  const onlySummary = new URL(request.url).searchParams.get("summary") === "1";
  try {
    const [clients, leads, events] = await Promise.all([
      sql`SELECT p.id, coalesce(nullif(o.setup->>'display_name',''), p.client_name, p.name) AS name, p.status,
          nullif(o.setup->>'texting_number','') AS texting_number,
          EXISTS (SELECT 1 FROM public.client_calendars c WHERE c.project_id = p.id AND c.refresh_token_enc IS NOT NULL) AS calendar,
          (SELECT count(*)::int FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
            WHERE t.project_id = p.id AND x.direction = 'out' AND NOT x.ok AND x.author <> 'system' AND x.at > now() - interval '24 hours') AS failed,
          (SELECT count(*)::int FROM public.client_threads t WHERE t.project_id = p.id AND t.status = 'auto'
            AND EXISTS (SELECT 1 FROM public.client_texts i WHERE i.thread_id = t.id AND i.direction = 'in' AND i.author = 'customer'
              AND i.at > now() - interval '24 hours' AND i.at < now() - interval '15 minutes'
              AND NOT EXISTS (SELECT 1 FROM public.client_texts r WHERE r.thread_id = t.id AND r.direction = 'out' AND r.author <> 'system' AND r.at >= i.at))) AS unanswered,
          (SELECT max(t.created_at) FROM public.client_threads t WHERE t.project_id = p.id AND t.source <> ALL(${NOT_LEADS})) AS last_lead
        FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id
        WHERE o.owner_id = ${o} ORDER BY name` as Promise<Row[]>,
      sql`SELECT t.project_id, t.created_at, t.source, coalesce(t.customer_name, '') AS name,
          (SELECT min(r.at) FROM public.client_texts r WHERE r.thread_id = t.id AND r.direction = 'out' AND r.ok AND r.author <> 'system' AND r.at >= t.created_at) AS first_out
        FROM public.client_threads t
        WHERE t.owner_id = ${o} AND t.source <> ALL(${NOT_LEADS}) AND t.created_at > now() - interval '30 days'` as Promise<Row[]>,
      onlySummary ? Promise.resolve([] as Row[]) :
        sql`SELECT t.project_id, x.at, x.direction, x.author, x.ok, coalesce(x.status, '') AS status, coalesce(t.customer_name, '') AS name, t.source, t.created_at AS lead_at,
            (x.direction = 'out' AND x.at = (SELECT min(r.at) FROM public.client_texts r WHERE r.thread_id = t.id AND r.direction = 'out' AND r.author <> 'system')) AS first_out
          FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
          WHERE t.owner_id = ${o} AND x.author <> 'system' AND x.at > now() - interval '30 days' ORDER BY x.at DESC LIMIT 120` as Promise<Row[]>,
    ]);
    const now = Date.now();
    const rows = clients.map(c => {
      const id = String(c.id);
      const client: SpeedClient = {
        id, name: String(c.name),
        live: !!c.texting_number && !["completed", "cancelled"].includes(String(c.status)),
        textingNumber: c.texting_number ? String(c.texting_number) : null,
        calendar: c.calendar === true, failed24h: Number(c.failed), unanswered: Number(c.unanswered),
        lastLeadAt: iso(c.last_lead),
        leads: leads.filter(l => String(l.project_id) === id).map(l => ({ at: iso(l.created_at)!, firstOut: iso(l.first_out), source: String(l.source ?? ""), name: String(l.name) })),
      };
      return assess(client, now);
    });
    const sum = summary(rows);
    if (onlySummary) return Response.json({ broken: sum.broken, watch: sum.watch }, { headers: { "Cache-Control": "no-store" } });
    const log = events.map(e => {
      const pid = String(e.project_id);
      const sec = e.first_out === true && e.lead_at ? Math.max(0, (Date.parse(String(iso(e.at))) - Date.parse(String(iso(e.lead_at)))) / 1000) : null;
      const failed = e.direction === "out" && e.ok === false;
      return {
        clientId: pid, at: iso(e.at)!, name: String(e.name),
        level: failed ? "fail" : e.direction === "in" ? "in" : "ok",
        what: failed ? `Text to ${e.name || "a customer"} failed${e.status ? ` (${e.status})` : ""}`
          : e.direction === "in" ? `${e.name || "A customer"} texted` : sec != null ? `First reply to ${e.name || "a new lead"}` : `${e.author === "owner" ? "Owner" : "Sent for them"}: reply to ${e.name || "a customer"}`,
        sec,
      };
    });
    return Response.json({ now: new Date(now).toISOString(), summary: sum, clients: rows, log }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("speed failed", e);
    return Response.json({ error: "Couldn't load client health. Try again." }, { status: 500 });
  }
}
