/**
 * Cinder is a single-owner workspace. Sign-ups are closed: a session only counts if it belongs to the
 * configured owner (CINDER_OWNER_ID) or to an account created before sign-ups were closed. Everyone else
 * gets treated as signed out, so a stranger who creates an account can't read data or spend AI credits.
 */

export function isAllowedUser(user: { id?: string | null; createdAt?: unknown } | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const SIGNUPS_CLOSED_AT = Date.parse(env.CINDER_SIGNUPS_CLOSED_AT || "2026-11-02T10:00:00Z");
  if (!user?.id) return false;
  const owners = String(env.CINDER_OWNER_ID || "").split(",").map(s => s.trim()).filter(Boolean);
  if (owners.includes(user.id)) return true;
  const created = user.createdAt instanceof Date ? user.createdAt.getTime() : typeof user.createdAt === "string" ? Date.parse(user.createdAt) : NaN;
  // Accounts that existed before sign-ups closed keep working. With no creation time we can't tell, so fail
  // closed: the owner-id list above already lets the owner in.
  if (!Number.isFinite(created) || !Number.isFinite(SIGNUPS_CLOSED_AT)) return false;
  return created <= SIGNUPS_CLOSED_AT;
}
