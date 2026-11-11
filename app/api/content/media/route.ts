import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const db = () => { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); };
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
const isId = (v: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
const TYPES = new Set(["image/png", "image/jpeg", "video/mp4", "video/webm"]);
const MAX = 4_300_000; // Vercel caps a request body at 4.5 MB

/** GET ?id=&t= : the rendered image or video, public, so Meta can fetch it when posting. The token makes the URL unguessable. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id"), t = q.get("t") ?? "";
  if (!isId(id) || t.length < 20) return new Response("Not found", { status: 404 });
  try {
    const [r] = await db()`SELECT mime, encode(bytes, 'base64') AS b FROM public.content_media WHERE id = ${id}::uuid AND token = ${t}` as { mime: string; b: string }[];
    if (!r) return new Response("Not found", { status: 404 });
    const buf = Buffer.from(r.b, "base64");
    return new Response(buf, { headers: { "Content-Type": r.mime, "Content-Length": String(buf.length), "Cache-Control": "public, max-age=86400, immutable" } });
  } catch (e) { console.error("Media GET failed", e); return new Response("Error", { status: 500 }); }
}

/** POST ?draft=&idx= with the file as the body: save a rendered image (or carousel slide) or reel for a post. */
export async function POST(req: Request) {
  const o = await owner(); if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const draft = q.get("draft"), idx = Math.max(0, Math.min(9, Number(q.get("idx")) || 0));
  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!isId(draft)) return Response.json({ error: "Which post?" }, { status: 400 });
  if (!TYPES.has(mime)) return Response.json({ error: "Only PNG, JPEG, MP4 or WebM." }, { status: 415 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return Response.json({ error: "Empty file." }, { status: 400 });
  if (buf.length > MAX) return Response.json({ error: "That file is over 4.3 MB. Shorten the reel." }, { status: 413 });
  try {
    const sql = db();
    const [d] = await sql`SELECT 1 FROM public.content_drafts WHERE id = ${draft}::uuid AND owner_id = ${o}`;
    if (!d) return Response.json({ error: "Unknown post." }, { status: 404 });
    const token = randomBytes(18).toString("base64url");
    const [r] = await sql`INSERT INTO public.content_media (owner_id, draft_id, idx, mime, bytes, token)
      VALUES (${o}, ${draft}::uuid, ${idx}, ${mime}, decode(${buf.toString("base64")}, 'base64'), ${token})
      ON CONFLICT (draft_id, idx) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, token = EXCLUDED.token, created_at = now()
      RETURNING id, token` as { id: string; token: string }[];
    return Response.json({ ok: true, id: r.id, url: `${new URL(req.url).origin}/api/content/media?id=${r.id}&t=${r.token}` }, { status: 201 });
  } catch (e) { console.error("Media POST failed", e); return Response.json({ error: "Couldn't save the file." }, { status: 500 }); }
}
