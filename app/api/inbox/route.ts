import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }

/** GET: DMs you haven't opened yet, newest first. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ messages: [] });
  try {
    const rows = await neon(process.env.DATABASE_URL)`SELECT id, channel, sender_name, body, received_at FROM public.inbox_messages
      WHERE owner_id = ${o} AND seen_at IS NULL ORDER BY received_at DESC LIMIT 50`;
    return Response.json({ messages: rows.map(r => ({ id: String(r.id), channel: String(r.channel), from: String(r.sender_name ?? ""), body: String(r.body ?? ""), at: new Date(r.received_at as string).toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Inbox GET failed", e); return Response.json({ messages: [] }); }
}

/** POST { channel }: mark that channel's DMs as seen (you opened the inbox). */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.channel !== "instagram" && b.channel !== "facebook") return Response.json({ error: "Channel is required." }, { status: 400 });
  if (!process.env.DATABASE_URL) return Response.json({ ok: true });
  await neon(process.env.DATABASE_URL)`UPDATE public.inbox_messages SET seen_at = now() WHERE owner_id = ${o} AND channel = ${b.channel} AND seen_at IS NULL`;
  return Response.json({ ok: true });
}
