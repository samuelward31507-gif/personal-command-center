import { appSession, db } from "@/lib/client-app-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?id=<photo id> — one job photo, for the signed-in owner or crew of that business. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return new Response("Sign in", { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [r] = await db()`SELECT mime, bytes FROM public.client_photos WHERE id = ${id}::uuid AND project_id = ANY(${s.projects}::uuid[])` as { mime: string; bytes: Buffer }[];
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r.bytes), { headers: { "Content-Type": r.mime || "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
}
