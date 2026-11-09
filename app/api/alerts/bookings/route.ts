import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?since=ISO: meetings booked through your Cal.com link since that time (newest first), for the in-app alert. */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ bookings: [] });
  const raw = new URL(req.url).searchParams.get("since") ?? "";
  const t = Date.parse(raw);
  const since = new Date(Number.isFinite(t) ? Math.max(t, Date.now() - 7 * 86400000) : Date.now() - 3600000).toISOString();
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT e.id, e.title, e.starts_at, e.created_at, e.contact_id,
      trim(concat_ws(' ', c.first_name, c.last_name)) AS name, c.company
    FROM public.calendar_events e LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
    WHERE e.owner_id = ${o} AND e.provider = 'cal_ai' AND e.status <> 'cancelled' AND e.created_at > ${since}::timestamptz
    ORDER BY e.created_at DESC LIMIT 20`;
  return Response.json({
    now: new Date().toISOString(),
    bookings: rows.map(x => ({ id: String(x.id), title: String(x.title ?? ""), startsAt: new Date(x.starts_at as string).toISOString(),
      createdAt: new Date(x.created_at as string).toISOString(), contactId: x.contact_id ? String(x.contact_id) : null,
      who: String(x.company || x.name || "").trim() })),
  });
}
