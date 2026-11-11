import assert from "node:assert/strict";
import { createECDH, createHmac, createDecipheriv, createPublicKey, verify, randomBytes } from "node:crypto";
const W = await import("./lib/web-push.ts");
const hmac = (k, d) => createHmac("sha256", k).update(d).digest();

// Stable keys from the secret; none without one.
assert.equal(W.vapidKeys(""), null);
const k1 = W.vapidKeys("secret-0123456789abcdef"), k2 = W.vapidKeys("secret-0123456789abcdef");
assert.equal(k1.publicKey, k2.publicKey); assert.equal(Buffer.from(k1.publicKey, "base64url").length, 65);
assert.notEqual(W.vapidKeys("another-secret-0123456789").publicKey, k1.publicKey);

// Encrypt as the server, decrypt as the browser would (RFC 8291).
const ua = createECDH("prime256v1"); ua.generateKeys();
const auth = randomBytes(16);
const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
const msg = Buffer.from(JSON.stringify({ title: "Needs you", body: "Tom asked about financing", url: "/app" }));
const enc = W.encryptPayload(sub, msg);
const salt = enc.subarray(0, 16), rs = enc.readUInt32BE(16), idlen = enc[20], asPub = enc.subarray(21, 21 + idlen), ct = enc.subarray(21 + idlen);
assert.equal(rs, 4096); assert.equal(idlen, 65);
const shared = ua.computeSecret(asPub);
const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPub, Buffer.from([1])]));
const prk = hmac(salt, ikm);
const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
const d = createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
assert.equal(plain[plain.length - 1], 2, "last-record delimiter");
assert.deepEqual(plain.subarray(0, -1), msg);

// VAPID header: a valid ES256 JWT for the endpoint's origin, verifiable with the public key.
const h = W.vapidAuth(sub.endpoint, k1, "mailto:x@y.z", 1_700_000_000_000);
const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
assert.ok(m); assert.equal(m[4], k1.publicKey);
const payload = JSON.parse(Buffer.from(m[2], "base64url").toString());
assert.equal(payload.aud, "https://fcm.googleapis.com"); assert.equal(payload.exp, 1_700_000_000 + 43200);
const pub = Buffer.from(k1.publicKey, "base64url");
const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") }, format: "jwk" });
assert.ok(verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3], "base64url")));
console.log("web push ok");
