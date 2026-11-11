import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { consentCsv } from "@/lib/client-consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?project=<id> : the client's texting consent log as a CSV, for carrier registration or a complaint. */
export async function GET(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return new Response("Sign in first.", { status: 401 });
  const project = new URL(req.url).searchParams.get("project") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(project) || !process.env.DATABASE_URL) return new Response("Which client?", { status: 400 });
  const sql = neon(process.env.DATABASE_URL);
  const [p] = await sql`SELECT coalesce(client_name, name) AS name FROM public.projects WHERE id = ${project}::uuid AND owner_id = ${o}` as { name: string }[];
  if (!p) return new Response("Unknown client.", { status: 404 });
  const rows = await sql`SELECT at, phone, event, source, evidence, ip FROM public.client_consent WHERE project_id = ${project}::uuid ORDER BY at DESC LIMIT 20000` as { at: string; phone: string; event: string; source: string; evidence: string; ip: string }[];
  const file = `${String(p.name || "client").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-texting-consent-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(consentCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } });
}
