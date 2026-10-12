import { createNeonAuth } from "@neondatabase/auth/next/server";

if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error("Neon Auth preview environment is not configured.");
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET },
});
