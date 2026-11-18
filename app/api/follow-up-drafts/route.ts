import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const UUID = /^[0-9a-f-]{36}$/i;

/** GET /api/follow-up-drafts — follow-ups Cinder found and wrote, waiting for a yes. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT f.id, f.contact_id, f.pattern, f.reason, f.body, f.channel, f.subject, f.author, f.created_at, c.email, c.company, c.first_name, c.last_name, c.phone, c.website
      FROM public.follow_up_drafts f JOIN public.contacts c ON c.id = f.contact_id
      WHERE f.owner_id = ${user.id} AND f.status = 'ready' AND (f.snooze_until IS NULL OR f.snooze_until < now())
      ORDER BY f.created_at DESC LIMIT 20`;
    return Response.json({ drafts: rows.map(r => ({ id: String(r.id), contactId: String(r.contact_id), pattern: String(r.pattern), reason: String(r.reason), body: String(r.body),
      channel: String(r.channel ?? "text"), subject: String(r.subject ?? ""), author: String(r.author ?? "cinder"), email: String(r.email ?? ""),
      company: String(r.company ?? ""), firstName: String(r.first_name ?? ""), phone: String(r.phone ?? ""), website: String(r.website ?? "") })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Follow-up drafts load failed", { name: error instanceof Error ? error.name : typeof error });
    return Response.json({ drafts: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

/** PATCH /api/follow-up-drafts { id, status: "sent" | "skipped" } — a skip snoozes that person for three days. */
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  const body = await request.json().catch(() => ({})) as { id?: string; status?: string };
  if (!body.id || !UUID.test(body.id) || (body.status !== "sent" && body.status !== "skipped")) return fail("id and status (sent or skipped) are required.", 400);
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`UPDATE public.follow_up_drafts SET status = ${body.status}, acted_at = now(),
      snooze_until = CASE WHEN ${body.status} = 'skipped' THEN now() + interval '3 days' ELSE NULL END
    WHERE id = ${body.id}::uuid AND owner_id = ${user.id} AND status = 'ready' RETURNING id`;
  return rows.length ? Response.json({ ok: true }) : fail("That draft is already handled.", 404);
}
