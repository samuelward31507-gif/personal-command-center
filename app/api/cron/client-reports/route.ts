import { neon } from "@neondatabase/serverless";
import { lastMonth, periodLabel } from "@/lib/client-report";
import { monthlyFigures, monthlyReport, readDiscovery, readReviews, type Booking } from "@/lib/founding-offer";
import { logRun } from "@/lib/pre-audit";
import { bearerMatches } from "@/lib/bearer";
import { replyLine, replySecs, replySummary } from "@/lib/reply-times";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/client-reports — Vercel Cron, the 1st of each month. Drafts last month's one-page report for every
 * founding client and every client with a go-live date. Drafts only: nothing is sent. An existing report is never overwritten.
 */
export async function GET(request: Request) {
  const started = new Date();
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (sql && /vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await logRun(sql, "client-reports", "cron", "unauthorized", {}, started);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owner = process.env.CINDER_OWNER_ID?.trim();
  if (!owner || !sql) return Response.json({ error: "Not configured" }, { status: 503 });
  try {
    const period = lastMonth(new Date());
    const clients = await sql`
      SELECT p.id, p.name, p.client_name, c.company, c.discovery, o.reviews
      FROM public.projects p
      LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
      LEFT JOIN public.client_ops o ON o.project_id = p.id AND o.owner_id = p.owner_id
      WHERE p.owner_id = ${owner} AND p.status NOT IN ('cancelled','completed')
        AND (p.offer = 'founding' OR coalesce(o.delivery->>'goLiveDate', '') <> '')`;
    let drafted = 0;
    for (const c of clients) {
      const rows = await sql`SELECT booked_on, source FROM public.client_bookings WHERE owner_id = ${owner} AND project_id = ${c.id}::uuid AND to_char(booked_on, 'YYYY-MM') = ${period}`;
      const bookings: Booking[] = rows.map(r => ({ bookedOn: r.booked_on instanceof Date ? r.booked_on.toISOString().slice(0, 10) : String(r.booked_on).slice(0, 10), source: String(r.source) }));
      const disc = readDiscovery(c.discovery);
      const rev = readReviews(c.reviews);
      const f = monthlyFigures({ bookings, avgJobValue: disc.avgJobValue, closeRatePct: disc.closeRate, reviewRequests: rev.requestsSent || undefined });
      const name = String(c.company || c.client_name || c.name || "Client");
      const r = monthlyReport(name, periodLabel(period), f);
      // What the live system did this month: estimates it put on their calendar, and the 60-second guarantee, measured.
      const from = `${period}-01T00:00:00Z`, to = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1)).toISOString();
      const reply = replySummary(await replySecs(sql, String(c.id), from, to).catch(() => []));
      const [ap] = await sql`SELECT count(*)::int AS n FROM public.client_appointments WHERE project_id = ${c.id}::uuid AND status <> 'canceled' AND created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz`.catch(() => [{ n: 0 }]) as { n: number }[];
      const text = [r.text, `Estimates Cinder booked on your calendar: ${ap?.n ?? 0}.`, replyLine(reply)].join("\n\n");
      const ins = await sql`INSERT INTO public.client_reports (owner_id, project_id, period, figures, content, status)
        VALUES (${owner}, ${c.id}::uuid, ${period}, ${JSON.stringify({ estimates: f.booked, sprint: f, runtimeBooked: ap?.n ?? 0, reply })}::jsonb, ${text}, 'draft')
        ON CONFLICT (owner_id, project_id, period) DO NOTHING RETURNING id`;
      drafted += ins.length;
    }
    await logRun(sql, "client-reports", "cron", "ok", { period, clients: clients.length, drafted }, started);
    return Response.json({ ok: true, period, drafted });
  } catch (error) {
    console.error("Client report cron failed", { name: error instanceof Error ? error.name : typeof error });
    await logRun(sql, "client-reports", "cron", "error", { reason: "exception" }, started);
    return Response.json({ error: "Client reports failed" }, { status: 500 });
  }
}
