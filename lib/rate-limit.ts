import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/** Hashes a key (an IP or user id) so the rate table never stores it raw. */
export const keyHash = (scope: string, key: string) => createHash("sha256").update(`cinder-${scope}:${key}`).digest("hex").slice(0, 32);

/** Client IP from the proxy headers, or "unknown". */
export const clientIp = (request: Request) => (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

/** Pure decision, so the limits can be tested without a database. */
export function overLimit(count: number, limit: number): boolean {
  return !Number.isFinite(count) || count >= limit;
}

/**
 * Records one event and says whether it was allowed. Counts events of this kind and key inside the window.
 * If the database is unreachable the request is allowed: rate limiting must never take the app down.
 */
export async function allowEvent(kind: string, key: string, limit: number, windowMinutes: number): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const hash = keyHash(kind, key);
    const rows = await sql`SELECT count(*)::int AS n FROM public.rate_events WHERE kind = ${kind} AND key_hash = ${hash} AND at > now() - make_interval(mins => ${windowMinutes}::int)` as { n: number }[];
    if (overLimit(rows[0]?.n ?? 0, limit)) return false;
    await sql`INSERT INTO public.rate_events (kind, key_hash) VALUES (${kind}, ${hash})`;
    return true;
  } catch {
    return true;
  }
}

/** Daily ceiling on AI calls per signed-in owner. Generous for one person, a hard stop for runaway loops. */
export const AI_DAILY_LIMIT = 300;
export const aiAllowed = (ownerId: string) => allowEvent("ai", ownerId, AI_DAILY_LIMIT, 24 * 60);
export const AI_LIMIT_MESSAGE = "You've hit today's AI limit. It resets within 24 hours.";
