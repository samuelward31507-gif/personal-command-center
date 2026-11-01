import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { cleanFigures, renderReport, isPeriod } from "@/lib/client-report";
import { loadWorkspace } from "@/lib/workspace-data";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

/** GET /api/client-reports — clients (projects) and their saved monthly reports. */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const sql = neon(process.env.DATABASE_URL);
    const [clients, reports] = await Promise.all([
      sql`SELECT p.id, p.client_name, p.name, p.status, c.email, c.first_name FROM public.projects p
          LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
          WHERE p.owner_id = ${user.id} AND p.status NOT IN ('cancelled') ORDER BY p.created_at DESC LIMIT 200`,
      sql`SELECT id, project_id, period, figures, content, status, updated_at FROM public.client_reports WHERE owner_id = ${user.id} ORDER BY period DESC, updated_at DESC LIMIT 500`,
    ]);
    return Response.json({
      clients: clients.map(c => ({ id: String(c.id), name: String(c.client_name || c.name), status: String(c.status), email: c.email ? String(c.email) : "", firstName: c.first_name ? String(c.first_name) : "" })),
      reports: reports.map(r => ({ id: String(r.id), projectId: String(r.project_id), period: String(r.period), figures: r.figures ?? {}, content: String(r.content), status: String(r.status), updatedAt: iso(r.updated_at) })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Client reports GET failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not load reports.", 500);
  }
}

/** POST /api/client-reports { projectId, period, figures } — save (or update) a client's report for a month. */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const b = await request.json().catch(() => ({}));
    if (typeof b.projectId !== "string" || !UUID.test(b.projectId)) return fail("Pick a client.", 400);
    if (!isPeriod(b.period)) return fail("Pick a month.", 400);
    const f = cleanFigures(b.figures);
    if ("error" in f) return fail(f.error, 400);
    const sql = neon(process.env.DATABASE_URL);
    const p = await sql`SELECT client_name, name FROM public.projects WHERE id = ${b.projectId}::uuid AND owner_id = ${user.id} LIMIT 1`;
    if (!p.length) return fail("Client not found.", 404);
    const wsp = await loadWorkspace(user.id);
    const { subject, body } = renderReport(String(p[0].client_name || p[0].name), b.period, f.ok, wsp.ownerFirstName, wsp.businessName);
    const content = `Subject: ${subject}\n\n${body}`;
    const rows = await sql`INSERT INTO public.client_reports (owner_id, project_id, period, figures, content)
      VALUES (${user.id}, ${b.projectId}::uuid, ${b.period}, ${JSON.stringify(f.ok)}::jsonb, ${content})
      ON CONFLICT (owner_id, project_id, period) DO UPDATE SET figures = EXCLUDED.figures, content = EXCLUDED.content, updated_at = now()
      RETURNING id, status`;
    return Response.json({ id: String(rows[0].id), status: String(rows[0].status), subject, body }, { status: 201 });
  } catch (error) {
    console.error("Client report save failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not save the report.", 500);
  }
}

/** PATCH /api/client-reports { id, status: "sent" } — mark a report sent (you send it yourself). */
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const b = await request.json().catch(() => ({}));
    if (typeof b.id !== "string" || !UUID.test(b.id) || !["draft", "sent"].includes(b.status)) return fail("Invalid request.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`UPDATE public.client_reports SET status = ${b.status}, updated_at = now() WHERE id = ${b.id}::uuid AND owner_id = ${user.id} RETURNING id`;
    if (!rows.length) return fail("Report not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Client report PATCH failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not update the report.", 500);
  }
}
