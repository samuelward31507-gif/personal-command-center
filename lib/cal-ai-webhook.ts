import { createHmac, timingSafeEqual } from "node:crypto";

export function validCalAiDate(value: string): boolean {
  return !!value && !Number.isNaN(Date.parse(value));
}

export function unwrapCalAiPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  const nested = envelope.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return {
      ...(nested as Record<string, unknown>),
      triggerEvent: envelope.triggerEvent,
      createdAt: envelope.createdAt,
    };
  }
  return envelope;
}

export function verifyCalAiSignature(raw: string, supplied: string, secret: string): boolean {
  const normalized = supplied.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(normalized)) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const actual = Buffer.from(normalized, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
