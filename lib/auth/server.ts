import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuthClient = ReturnType<typeof createNeonAuth>;
type AuthHandlers = ReturnType<NeonAuthClient["handler"]>;

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

// Next.js evaluates route modules during build, when preview-only auth env
// vars may not be present. Defer both client creation and handler creation
// until an actual HTTP handler is invoked; missing config still fails closed
// at request time.
const lazyHandlers = new Proxy({} as AuthHandlers, {
  get(_target, property) {
    return (...args: Parameters<AuthHandlers[keyof AuthHandlers]>) => {
      const handlers = getAuthClient().handler();
      const handler = Reflect.get(handlers, property);
      if (typeof handler !== "function") {
        throw new Error(`Neon Auth handler ${String(property)} is unavailable.`);
      }
      return handler.apply(handlers, args);
    };
  },
});

export const auth = new Proxy({} as NeonAuthClient, {
  get(_target, property) {
    if (property === "handler") {
      return () => lazyHandlers;
    }

    const value = Reflect.get(getAuthClient(), property);
    return typeof value === "function" ? value.bind(getAuthClient()) : value;
  },
});
