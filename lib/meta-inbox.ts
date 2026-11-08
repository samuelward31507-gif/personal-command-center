// Instagram + Facebook Page DMs from Meta's webhook. Pure helpers (no I/O) so they can be tested.
import { createHmac, timingSafeEqual } from "node:crypto";

export type InboxMessage = { channel: "instagram" | "facebook"; senderId: string; recipientId: string; text: string; mid: string; at: string };

/** Meta signs every webhook body with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export function verifyMetaSignature(raw: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(raw, "utf8").digest("hex"));
  const actual = Buffer.from(header.slice(7));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Pull the inbound messages out of a webhook body. Skips our own replies (echoes), reads, reactions and deliveries. */
export function parseMetaWebhook(body: unknown): InboxMessage[] {
  const b = body as { object?: string; entry?: { messaging?: { sender?: { id?: string }; recipient?: { id?: string }; timestamp?: number; message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: { type?: string }[] } }[] }[] };
  const channel = b?.object === "instagram" ? "instagram" : b?.object === "page" ? "facebook" : null;
  if (!channel) return [];
  const out: InboxMessage[] = [];
  for (const e of b.entry ?? []) for (const m of e.messaging ?? []) {
    if (!m.message || m.message.is_echo || !m.message.mid || !m.sender?.id) continue;
    const text = (m.message.text ?? "").trim() || (m.message.attachments?.length ? `[${m.message.attachments[0].type ?? "attachment"}]` : "");
    out.push({ channel, senderId: m.sender.id, recipientId: m.recipient?.id ?? "", text: text.slice(0, 2000), mid: m.message.mid, at: new Date(m.timestamp ?? Date.now()).toISOString() });
  }
  return out;
}

