// Pure parts of the Jobber connection (no network, no database), so they can be tested on their own.
import { createHmac, timingSafeEqual } from "node:crypto";

export const JOBBER_API = "https://api.getjobber.com/api";
export const JOBBER_VERSION = "2025-04-16";

export function jobberConfigured(): boolean {
  return !!(process.env.JOBBER_CLIENT_ID?.trim() && process.env.JOBBER_CLIENT_SECRET?.trim() && (process.env.CINDER_TOKEN_KEY?.trim().length ?? 0) >= 32);
}
export const jobberRedirect = (origin: string) => `${origin.replace(/\/$/, "")}/api/client-jobber/callback`;

const sign = (s: string) => createHmac("sha256", process.env.CINDER_TOKEN_KEY?.trim() || "").update(s).digest("base64url").slice(0, 32);
/** "jb.<project>.<expires>.<sig>", good for 7 days so the owner can open the link later. */
export function jobberState(projectId: string, now = Date.now()): string {
  const body = `jb.${projectId}.${Math.floor(now / 1000) + 7 * 86400}`;
  return `${body}.${sign(body)}`;
}
export function readJobberState(state: string, now = Date.now()): string | null {
  const m = state.match(/^(jb\.([0-9a-f-]{36})\.(\d+))\.([A-Za-z0-9_-]+)$/i);
  if (!m || +m[3] * 1000 < now) return null;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[4]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[2] : null;
}
export function jobberAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({ client_id: process.env.JOBBER_CLIENT_ID!.trim(), redirect_uri: jobberRedirect(origin), response_type: "code", state });
  return `${JOBBER_API}/oauth/authorize?${p}`;
}

// ---------- What goes into Jobber (pure, tested) ----------
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (!parts.length) return { firstName: "New", lastName: "Lead" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}
export function clientInput(name: string, phone: string): Record<string, unknown> {
  const n = splitName(name);
  const input: Record<string, unknown> = { firstName: n.firstName, phones: [{ number: phone, primary: true, description: "MAIN" }] };
  if (n.lastName) input.lastName = n.lastName;
  return input;
}
/** Request title: what and when, so it reads right in Jobber's request list even without the details. */
export function requestTitle(when: string, tz: string, summary: string): string {
  const t = new Date(when).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const what = summary.split("\n")[0].replace(/\s+/g, " ").trim().slice(0, 60);
  return `Estimate ${t}${what ? ` · ${what}` : ""} (booked by Cinder)`.slice(0, 140);
}

