// Gmail sending for cold email: OAuth (send + read headers for replies), token encryption, and the RFC 2822 message. node:crypto only.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** gmail.send to send; gmail.metadata to see who replied or bounced (headers only, never message bodies). */
export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.metadata"];
export const DAILY_SEND_CAP = 50;

function key(): Buffer {
  const raw = process.env.CINDER_TOKEN_KEY?.trim();
  if (!raw || raw.length < 32) throw new Error("CINDER_TOKEN_KEY is not configured.");
  return createHash("sha256").update(raw).digest();
}
export function encryptToken(plain: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map(b => b.toString("base64url")).join(".");
}
export function decryptToken(enc: string): string {
  const [iv, tag, body] = enc.split(".").map(s => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

export function gmailConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && (process.env.CINDER_TOKEN_KEY?.trim().length ?? 0) >= 32);
}
export const redirectUri = (origin: string) => `${origin.replace(/\/$/, "")}/api/gmail/callback`;

export function authUrl(origin: string, state: string): string {
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!.trim(), redirect_uri: redirectUri(origin), response_type: "code",
    scope: GMAIL_SCOPES.join(" "), access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Email address from a Google id_token (we just received it from Google over TLS, so the payload is trusted). */
export function emailFromIdToken(idToken: string): string {
  try { const p = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")); return typeof p.email === "string" ? p.email.toLowerCase() : ""; } catch { return ""; }
}

export async function exchangeCode(code: string, origin: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!.trim(), client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(), redirect_uri: redirectUri(origin), grant_type: "authorization_code" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || "Google sign-in failed.");
  return j as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}
export async function accessToken(refreshToken: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID!.trim(), client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(), grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error === "invalid_grant" ? "Gmail access was revoked. Reconnect Gmail." : "Couldn't reach Gmail.");
  return j.access_token as string;
}

const header = (v: string) => /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
/** Display name for From: quoted when it has RFC 5322 specials (a comma in "Cinder, LLC" would otherwise split it into two addresses). */
const displayName = (v: string) => /^[\x20-\x7e]*$/.test(v) && /[()<>[\]:;@\\,."]/.test(v) ? `"${v.replace(/["\\]/g, "\\$&")}"` : header(v);

/** The compliance footer every cold email carries: who you are, where you are, how to stop. */
export function complianceFooter(business: string, address: string): string {
  return `--\n${business}\n${address}\nNot interested? Reply "unsubscribe" and you won't hear from me again.`;
}

/** RFC 2822 message, base64url-encoded for the Gmail API. Replies thread with In-Reply-To/References. */
export function buildRaw(m: { from: string; fromName: string; to: string; subject: string; body: string; inReplyTo?: string }): string {
  const lines = [
    `From: ${displayName(clean(m.fromName))} <${clean(m.from)}>`,
    `To: <${clean(m.to)}>`,
    `Subject: ${header(clean(m.subject))}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`, `References: ${clean(m.inReplyTo)}`] : []),
  ];
  const body = Buffer.from(m.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return Buffer.from(lines.join("\r\n") + "\r\n\r\n" + body, "utf8").toString("base64url");
}

export const isEmail = (v: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);

// ---- replies and bounces ----

export type ThreadMessage = { from: string; snippet?: string; internalDate?: string; labelIds?: string[] };
export type ThreadVerdict = { kind: "reply" | "bounce" | "unsubscribe"; from: string; snippet: string; at: string } | null;
const BOUNCER = /mailer-daemon|postmaster|mail delivery (subsystem|system)/i;
const STOP_WORDS = /\b(unsubscribe|remove me|stop emailing|take me off|not interested)\b/i;

/** What happened in a cold-email thread: a bounce, an unsubscribe, a reply, or nothing yet. Pure. */
export function classifyThread(messages: ThreadMessage[], myEmail: string | string[]): ThreadVerdict {
  const mine = (Array.isArray(myEmail) ? myEmail : [myEmail]).map(e => e.trim().toLowerCase()).filter(Boolean);
  // Gmail labels everything you sent SENT, whatever address it shows (a renamed Gmail keeps the old one as an alias).
  const others = messages.filter(m => m.from && !(m.labelIds ?? []).includes("SENT") && !mine.some(e => m.from.toLowerCase().includes(e)));
  if (!others.length) return null;
  const at = (m: ThreadMessage) => (m.internalDate && /^\d+$/.test(m.internalDate) ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString());
  const bounce = others.find(m => BOUNCER.test(m.from));
  if (bounce) return { kind: "bounce", from: bounce.from, snippet: (bounce.snippet ?? "").slice(0, 300), at: at(bounce) };
  const first = others[0];
  const stop = others.find(m => STOP_WORDS.test(m.snippet ?? ""));
  if (stop) return { kind: "unsubscribe", from: stop.from, snippet: (stop.snippet ?? "").slice(0, 300), at: at(stop) };
  return { kind: "reply", from: first.from, snippet: (first.snippet ?? "").slice(0, 300), at: at(first) };
}
