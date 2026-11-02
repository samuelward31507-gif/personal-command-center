import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { newSigningToken } from "@/lib/esign";
import { publishable } from "@/lib/testimonial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const origin = (request: Request) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(request.url).origin;
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
function view(r: Record<string, unknown>, base: string) {
  const t = { status: String(r.status), permission: r.permission === true, quote: String(r.quote), name: String(r.name), role: String(r.role), company: String(r.company) };
  return { id: String(r.id), ...t, result: String(r.result), link: `${base}/testimonial/${r.token}`, submittedAt: r.submitted_at ? String(r.submitted_at) : null, publishable: publishable(t) };
}

/** GET /api/testimonials?project=… — this client's testimonial link and answer. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const id = new URL(request.url).searchParams.get("project") ?? "";
  if (!UUID.test(id)) return reply({ testimonials: [] });
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM public.testimonials WHERE owner_id = ${user.id} AND project_id = ${id}::uuid ORDER BY created_at DESC LIMIT 5` as Record<string, unknown>[];
  return reply({ testimonials: rows.map(r => view(r, origin(request))) });
}

/** POST /api/testimonials {project} — creates a private testimonial link for the client. Nothing is sent. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof b?.project === "string" && UUID.test(b.project) ? b.project : null;
  if (!id) return reply({ error: "Valid project id is required." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const own = await sql`SELECT 1 FROM public.projects WHERE id = ${id}::uuid AND owner_id = ${user.id}`;
  if (!own.length) return reply({ error: "Client not found." }, 404);
  const rows = await sql`INSERT INTO public.testimonials (owner_id, project_id, token) VALUES (${user.id}, ${id}::uuid, ${newSigningToken()}) RETURNING *` as Record<string, unknown>[];
  return reply({ testimonial: view(rows[0], origin(request)) });
}
