import { neon } from "@neondatabase/serverless";
import { parseMetaWebhook, verifyMetaSignature } from "@/lib/meta-inbox";
import { CHANNEL_LABEL } from "@/lib/inbox-links";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Meta's one-time check when you add the webhook (hub.verify_token must match META_VERIFY_TOKEN). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.META_VERIFY_TOKEN?.trim();
  if (u.searchParams.get("hub.mode") === "subscribe" && token && u.searchParams.get("hub.verify_token") === token)
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

/** Look up who sent it (best-effort; needs META_PAGE_TOKEN). */
async function senderName(channel: "instagram" | "facebook", id: string): Promise<string> {
  const token = process.env.META_PAGE_TOKEN?.trim();
  if (!token) return "";
  try {
    const fields = channel === "instagram" ? "username,name" : "name";
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(id)}?fields=${fields}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return "";
    const j = await r.json() as { username?: string; name?: string };
    return j.username ? `@${j.username}` : j.name ?? "";
  } catch { return ""; }
}

/** POST: a new DM to your Instagram business account or Facebook Page. Stored, then emailed to you. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET?.trim() ?? "";
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("Bad signature", { status: 401 });
  const owner = process.env.CINDER_OWNER_ID?.trim();
  if (!owner || !process.env.DATABASE_URL) return new Response("OK", { status: 200 });
  let body: unknown; try { body = JSON.parse(raw); } catch { return new Response("OK", { status: 200 }); }
  const sql = neon(process.env.DATABASE_URL);
  for (const m of parseMetaWebhook(body)) {
    try {
      // One alert per person per 10 minutes, so a burst of messages is one email.
      const [recent] = await sql`SELECT 1 FROM public.inbox_messages WHERE owner_id = ${owner} AND channel = ${m.channel} AND sender_id = ${m.senderId} AND received_at > now() - interval '10 minutes' LIMIT 1`;
      const name = await senderName(m.channel, m.senderId);
      const ins = await sql`INSERT INTO public.inbox_messages (owner_id, channel, sender_id, sender_name, body, mid, received_at)
        VALUES (${owner}, ${m.channel}, ${m.senderId}, ${name}, ${m.text}, ${m.mid}, ${m.at}::timestamptz) ON CONFLICT (owner_id, mid) DO NOTHING RETURNING id`;
      if (ins.length && !recent) {
        await sendAlert({
          subject: `New ${CHANNEL_LABEL[m.channel]} DM${name ? ` from ${name}` : ""}`,
          lines: [`${name || "Someone"} messaged you on ${CHANNEL_LABEL[m.channel]}:`, `"${m.text.slice(0, 400)}"`, "Reply fast. A lead answered in the first 5 minutes is far more likely to book."],
          link: { label: "Open in Cinder", path: "/crm/needs-you" },
        });
      }
    } catch (e) { console.error("Meta DM store failed", e instanceof Error ? e.message : e); }
  }
  return new Response("OK", { status: 200 });
}
