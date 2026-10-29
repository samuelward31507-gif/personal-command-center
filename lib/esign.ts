// E-signature helpers for service agreements. Pure (node:crypto only): safe to unit test.
import { createHash, randomBytes } from "node:crypto";

/** A new signing token (URL-safe, 256 bits). Only its hash is stored. */
export function newSigningToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
export function contentHash(content: string): string {
  return createHash("sha256").update(content.replace(/\r/g, ""), "utf8").digest("hex");
}
export const isTokenShape = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(t);


export const CONSENT_TEXT = "I agree to sign this agreement electronically. Typing my name below is my signature and has the same effect as signing on paper.";

export type SignatureInput = { name: string; title: string; email: string };

/** Validate what the client typed. Returns an error message, or the cleaned signature. */
export function validateSignature(body: unknown): { error: string } | { ok: SignatureInput } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim() : "";
  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (b.consent !== true) return { error: "Tick the box to agree to sign electronically." };
  if (name.length < 3 || !/\s/.test(name) || name.length > 120) return { error: "Type your full name (first and last) to sign." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return { error: "Enter a valid email so you get a copy." };
  return { ok: { name, title, email } };
}

/** First address in x-forwarded-for (Vercel sets it), for the signing record. */
export function clientIp(forwardedFor: string | null): string {
  return (forwardedFor ?? "").split(",")[0].trim().slice(0, 64);
}
