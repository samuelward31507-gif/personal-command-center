// Web Push for the Cinder app, built on node:crypto only (no package, no new env vars).
// - VAPID keys are derived from CINDER_TOKEN_KEY, so they're stable across deploys and nothing new needs setting up.
// - Payloads are encrypted per RFC 8291 (aes128gcm), signed per RFC 8292 (ES256 JWT).
import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign as edSign, createHash } from "node:crypto";

export type PushSub = { endpoint: string; p256dh: string; auth: string };
const b64u = (b: Buffer) => b.toString("base64url");
const unb64u = (s: string) => Buffer.from(s, "base64url");
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

/** The server's VAPID key pair, derived from the app secret. Returns null when the secret isn't set. */
export function vapidKeys(secret = process.env.CINDER_TOKEN_KEY?.trim() || ""): { publicKey: string; d: Buffer; pub: Buffer } | null {
  if (secret.length < 16) return null;
  for (let i = 0; i < 8; i++) {
    const d = createHash("sha256").update(`cinder-vapid-${i}|${secret}`).digest();
    try { const ecdh = createECDH("prime256v1"); ecdh.setPrivateKey(d); const pub = ecdh.getPublicKey(); return { publicKey: b64u(pub), d, pub }; } catch { /* out of range: try the next */ }
  }
  return null;
}

/** RFC 8291 aes128gcm body for one subscription. `salt` and `ephemeral` are injectable for tests. */
export function encryptPayload(sub: PushSub, payload: Buffer, salt = randomBytes(16), ephemeral = createECDH("prime256v1")): Buffer {
  try { ephemeral.getPrivateKey(); } catch { ephemeral.generateKeys(); } // a fresh key pair per message
  const asPublic = ephemeral.getPublicKey();
  const uaPublic = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const shared = ephemeral.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** RFC 8292 VAPID Authorization header for an endpoint. */
export function vapidAuth(endpoint: string, keys: NonNullable<ReturnType<typeof vapidKeys>>, subject = "mailto:alerts@cinderrevenue.com", now = Date.now()): string {
  const aud = new URL(endpoint).origin;
  const head = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64u(keys.d), x: b64u(keys.pub.subarray(1, 33)), y: b64u(keys.pub.subarray(33, 65)) }, format: "jwk" });
  const sig = edSign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** Send one notification. Returns "ok", "gone" (subscription expired: delete it) or "error". */
export async function sendPush(sub: PushSub, message: { title: string; body: string; url?: string; tag?: string }): Promise<"ok" | "gone" | "error"> {
  const keys = vapidKeys();
  if (!keys) return "error";
  try {
    const r = await fetch(sub.endpoint, {
      method: "POST",
      headers: { Authorization: vapidAuth(sub.endpoint, keys), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" },
      body: new Uint8Array(encryptPayload(sub, Buffer.from(JSON.stringify(message)))), signal: AbortSignal.timeout(8000),
    });
    if (r.status === 404 || r.status === 410) return "gone";
    if (!r.ok) { console.error("Push failed", { status: r.status, host: new URL(sub.endpoint).host }); return "error"; }
    return "ok";
  } catch (e) { console.error("Push failed", e instanceof Error ? e.name : e); return "error"; }
}
