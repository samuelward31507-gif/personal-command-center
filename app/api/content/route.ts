import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { ALL_POSTS } from "@/lib/content-posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function owner() {
  const r = await getAllowedSession();
  return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
}
function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
const iso = (v: unknown) => new Date(v as string).toISOString();

/** GET: what you posted in the last 90 days, newest first. */
export async function GET() {
  const o = await owner();
  if (!o) return jsonError("Unauthorized", 401);
  try {
    const rows = await db()`SELECT post_key, channel, posted_at FROM public.content_posts
      WHERE owner_id = ${o} AND posted_at > now() - interval '90 days' ORDER BY posted_at DESC LIMIT 1000`;
    return Response.json({ posted: rows.map(r => ({ key: String(r.post_key), channel: String(r.channel), at: iso(r.posted_at) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Content GET failed", e); return jsonError("Couldn't load your posts.", 500); }
}

/** POST { key }: log that you posted it. The channel comes from the post itself. */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return jsonError("Unauthorized", 401);
  try {
    const b = await req.json().catch(() => ({}));
    const post = ALL_POSTS.find(p => p.key === b?.key);
    if (!post) return jsonError("Unknown post.", 400);
    await db()`INSERT INTO public.content_posts (owner_id, post_key, channel) VALUES (${o}, ${post.key}, ${post.channel})`;
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { console.error("Content POST failed", e); return jsonError("Couldn't save that.", 500); }
}

/**
 * DELETE ?key=&since=: undo today's post of that key (the newest one).
 * `since` is the start of your local day as an ISO time; without it, the last 24 hours count as today.
 */
export async function DELETE(req: Request) {
  const o = await owner();
  if (!o) return jsonError("Unauthorized", 401);
  try {
    const q = new URL(req.url).searchParams;
    const key = q.get("key") ?? "";
    if (!ALL_POSTS.some(p => p.key === key)) return jsonError("Unknown post.", 400);
    const s = Date.parse(q.get("since") ?? "");
    // Never reach back further than 36 hours, whatever the client sends.
    const since = new Date(Number.isFinite(s) ? Math.max(s, Date.now() - 36 * 3600000) : Date.now() - 24 * 3600000).toISOString();
    const rows = await db()`DELETE FROM public.content_posts WHERE id = (
        SELECT id FROM public.content_posts WHERE owner_id = ${o} AND post_key = ${key} AND posted_at >= ${since}::timestamptz
        ORDER BY posted_at DESC LIMIT 1) AND owner_id = ${o} RETURNING id`;
    if (!rows.length) return jsonError("Nothing posted today to undo.", 404);
    return Response.json({ ok: true });
  } catch (e) { console.error("Content DELETE failed", e); return jsonError("Couldn't undo that.", 500); }
}
