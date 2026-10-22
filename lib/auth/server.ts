import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuthClient = ReturnType<typeof createNeonAuth>;

let client: NeonAuthClient | undefined;

function getAuthClient(): NeonAuthClient {
  if (client) return client;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (!baseUrl || !cookieSecret) {
    throw new Error("Neon Auth environment is not configured.");
  }

  client = createNeonAuth({
    baseUrl,
    cookies: { secret: cookieSecret },
  });

  return client;
}

// Keep configuration checks at request time rather than module import time.
// Next.js imports route modules during build, when preview-only env vars may
// not be present. Missing auth config still fails closed when a route is used.
export const auth = new Proxy({} as NeonAuthClient, {
  get(_target, property) {
    const value = Reflect.get(getAuthClient(), property);
    return typeof value === "function" ? value.bind(getAuthClient()) : value;
  },
});
