import { neon } from "@neondatabase/serverless";
import { isTokenShape } from "@/lib/esign";
import { validateTestimonial } from "@/lib/testimonial";
import { sendAlert } from "@/lib/notify";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

async function find(token: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT t.id, t.owner_id, t.status, t.project_id, COALESCE(NULLIF(c.company,''), p.client_name, p.name) AS client, c.first_name
    FROM public.testimonials t LEFT JOIN public.projects p ON p.id = t.project_id AND p.owner_id = t.owner_id
    LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id WHERE t.token = ${token} LIMIT 1` as Record<string, unknown>[];
  return { sql, row: rows[0] ?? null };
}

/** GET /api/testimonial?token=… — public: who's asking, and whether it's already been answered. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  const { row } = await find(token);
  if (!row) return reply({ error: "This link is no longer active." }, 404);
  const ws = await loadWorkspace(String(row.owner_id));
  return reply({ client: String(row.client ?? ""), firstName: String(row.first_name ?? ""), from: { name: ws.businessName, owner: ws.ownerFirstName }, done: row.status === "submitted" });
}

/** POST /api/testimonial — public: the client's words, and whether they may be published. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = body?.token;
  if (!isTokenShape(token)) return reply({ error: "This link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  const v = validateTestimonial(body);
  if ("error" in v) return reply(v, 400);
  const { sql, row } = await find(token);
  if (!row) return reply({ error: "This link is no longer active." }, 404);
  await sql`UPDATE public.testimonials SET status = 'submitted', quote = ${v.quote}, result = ${v.result}, name = ${v.name}, role = ${v.role}, company = ${v.company}, permission = ${v.permission}, submitted_at = now() WHERE token = ${token}`;
  await sendAlert({ subject: `${v.company || row.client} left a testimonial`, lines: [`“${v.quote.slice(0, 400)}”`, `${v.name}${v.role ? ", " + v.role : ""}`, v.permission ? "They said you can publish it." : "They did NOT give permission to publish it."], link: { label: "Open the client", path: `/crm/client-success/${row.project_id}` } });
  return reply({ ok: true });
}
