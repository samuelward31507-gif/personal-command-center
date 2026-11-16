import { appSession, clientFor, db } from "@/lib/client-app-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?p=<project>&id=<expense id>: one receipt photo, for the owner or the office of that business. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return new Response("Sign in", { status: 401 });
  const q = new URL(req.url).searchParams, id = q.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const sql = db(), c = await clientFor(sql, s, q.get("p"));
  if (!c || s.role === "crew") return new Response("Not found", { status: 404 });
  const [r] = await sql`SELECT receipt_mime, receipt FROM public.client_expenses WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND receipt IS NOT NULL` as { receipt_mime: string; receipt: Buffer }[];
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r.receipt), { headers: { "Content-Type": r.receipt_mime || "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
}
