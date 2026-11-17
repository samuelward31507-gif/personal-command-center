import { appSession, clientFor, db } from "@/lib/client-app-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?p=<project>&id=<file id>: one document kept with a job, for the signed-in owner, office or crew of that business. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return new Response("Sign in", { status: 401 });
  const q = new URL(req.url).searchParams, id = q.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const sql = db(), c = await clientFor(sql, s, q.get("p"));
  if (!c) return new Response("Not found", { status: 404 });
  const [r] = await sql`SELECT name, mime, bytes FROM public.client_files WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid` as { name: string; mime: string; bytes: Buffer }[];
  if (!r) return new Response("Not found", { status: 404 });
  const safe = r.name.replace(/[^\w .()-]/g, "_").slice(0, 120) || "document";
  return new Response(new Uint8Array(r.bytes), { headers: { "Content-Type": r.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${safe}"`, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
