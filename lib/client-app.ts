// The Cinder app (client owners): sign-in by text code or portal link, and a signed 90-day session cookie.
// The session lists the businesses this owner may see; every API checks the project against it.
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const APP_COOKIE = "cinder_app";
export const SESSION_DAYS = 90;
export type AppSession = { projects: string[]; phone: string; exp: number };

const key = () => process.env.CINDER_TOKEN_KEY?.trim() || "";
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", key()).update("app." + body).digest("base64url");

export const phone10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);

export function makeSession(projects: string[], phone: string, now = Date.now()): string {
  const body = b64(JSON.stringify({ projects: [...new Set(projects)].slice(0, 20), phone, exp: now + SESSION_DAYS * 86400000 }));
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined | null, now = Date.now()): AppSession | null {
  if (!token || !key()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sign(body)), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as AppSession;
    if (!Array.isArray(s.projects) || typeof s.exp !== "number" || s.exp < now) return null;
    return s;
  } catch { return null; }
}

export function cookieFrom(header: string | null): string | null {
  const m = (header || "").match(new RegExp(`(?:^|;\\s*)${APP_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function sessionCookie(token: string, secure = true): string {
  return `${APP_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
export const clearCookie = `${APP_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hashCode = (phone: string, code: string) => createHash("sha256").update(`${key()}|${phone10(phone)}|${code.trim()}`).digest("hex");
export const CODE_MINUTES = 10, CODE_TRIES = 5;
