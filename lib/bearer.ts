import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time check of an `Authorization: Bearer <secret>` header. False when the secret isn't set. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const a = createHash("sha256").update(header ?? "").digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}
