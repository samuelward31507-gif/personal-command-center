import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { replyLine, replySecs, replySummary } from "@/lib/reply-times";
import { lastWeek, weeklyText } from "@/lib/weekly-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/client-success/weekly — last week's check-in for every live client, as text to copy. Read-only: nothing is sent. */
export async function GET() {
  const s = await getAllowedSession();
  const owner = s?.data?.session && s?.data?.user?.id ? String(s.data.user.id) : null;
  if (!owner) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  try {
    const wk = lastWeek(new Date());
    const clients = await sql`SELECT p.id, p.name, p.client_name, c.company, c.name AS contact
      FROM public.projects p LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
      WHERE p.owner_id = ${owner} AND p.status NOT IN ('cancelled','completed')`;
    const out = [];
    for (const c of clients) {
      const reply = replySummary(await replySecs(sql, String(c.id), wk.from, wk.to).catch(() => []));
      const [ap] = await sql`SELECT count(*)::int AS n FROM public.client_appointments WHERE project_id = ${c.id}::uuid AND status <> 'canceled' AND created_at >= ${wk.from}::timestamptz AND created_at < ${wk.to}::timestamptz`.catch(() => [{ n: 0 }]);
      const [bk] = await sql`SELECT count(*)::int AS n FROM public.client_bookings WHERE owner_id = ${owner} AND project_id = ${c.id}::uuid AND booked_on >= ${wk.from.slice(0, 10)}::date AND booked_on < ${wk.to.slice(0, 10)}::date`.catch(() => [{ n: 0 }]);
      const first = String(c.contact || "").trim().split(/\s+/)[0] || "";
      const name = String(c.company || c.client_name || c.name || "Client");
      const figures = { estimates: Number(ap?.n ?? 0), jobsLogged: Number(bk?.n ?? 0), replyText: replyLine(reply) };
      out.push({ projectId: String(c.id), name, label: wk.label, reply, ...figures, text: weeklyText(first || name, wk.label, figures) });
    }
    return Response.json({ week: wk.label, clients: out });
  } catch (e) {
    console.error("Weekly report preview failed", { name: e instanceof Error ? e.name : typeof e });
    return Response.json({ error: "Couldn't build this week's reports." }, { status: 500 });
  }
}
