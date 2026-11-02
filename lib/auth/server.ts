import { createNeonAuth } from "@neondatabase/auth/next/server";

if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error("Neon Auth preview environment is not configured.");
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET },
});

import { isAllowedUser } from "@/lib/owner-gate";

export { isAllowedUser };

export async function getAllowedSession() {
  const result = await auth.getSession();
  const user = result?.data?.user as { id?: string; createdAt?: unknown } | undefined;
  if (user && !isAllowedUser(user)) return null;
  return result;
}
