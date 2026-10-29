// Regression tests for agreement e-signatures. Run with: node --experimental-strip-types test-esign.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newSigningToken, hashToken, contentHash, isTokenShape, validateSignature, clientIp } from "./lib/esign.ts";
import { countBlanks } from "./lib/deal-workspace.ts";

let n = 0;
const ok = fn => { fn(); n++; };
const t = newSigningToken();
ok(() => assert.ok(isTokenShape(t), "tokens are URL-safe and long"));
ok(() => assert.notEqual(newSigningToken(), t, "tokens are random"));
ok(() => assert.equal(hashToken(t).length, 64));
ok(() => assert.ok(!isTokenShape("short") && !isTokenShape("../../etc/passwd") && !isTokenShape(null)));
ok(() => assert.equal(contentHash("a\r\nb"), contentHash("a\nb"), "line endings don't change the hash"));
ok(() => assert.notEqual(contentHash("$1,500"), contentHash("$1,600"), "any edit changes the hash"));
ok(() => assert.equal(countBlanks("Fees [amount] due in [X] days"), 2));
ok(() => assert.equal(countBlanks("Provider: Cinder Revenue Company"), 0));
ok(() => assert.deepEqual(validateSignature({ name: "  Dana   Whitfield ", email: "Dana@X.test", consent: true }), { ok: { name: "Dana Whitfield", title: "", email: "dana@x.test" } }));
ok(() => assert.match(validateSignature({ name: "Dana Whitfield", email: "dana@x.test" }).error, /agree to sign electronically/, "consent is required"));
ok(() => assert.match(validateSignature({ name: "Dana", email: "dana@x.test", consent: true }).error, /full name/, "first and last name"));
ok(() => assert.match(validateSignature({ name: "Dana Whitfield", email: "nope", consent: true }).error, /valid email/));
ok(() => assert.equal(clientIp("203.0.113.9, 10.0.0.1"), "203.0.113.9"));

const sign = readFileSync("app/api/sign/route.ts", "utf8");
const link = readFileSync("app/api/agreements/sign-link/route.ts", "utf8");
ok(() => assert.match(sign, /token_hash = \$\{hashToken\(token\)\}/, "lookups by token hash only"));
ok(() => assert.match(sign, /contentHash\(content\) !== row\.content_hash/, "an edited agreement can't be signed on an old link"));
ok(() => assert.match(sign, /WHERE id = \$\{row\.id\}::uuid AND status = 'open'/, "a link can only be signed once"));
ok(() => assert.match(sign, /signed_content = \$\{content\}/, "the exact signed text is kept"));
ok(() => assert.match(sign, /runDealHandoff/, "signing starts onboarding"));
ok(() => assert.doesNotMatch(sign + link, /'paid'|DELETE FROM/i, "never marks paid, never deletes"));
ok(() => assert.doesNotMatch(link, /token_hash\b[^;]*RETURNING|"token":/, "the token is never stored or read back"));
ok(() => assert.match(link, /if \(blanks\) return fail/, "no signing links for drafts with blanks"));
ok(() => assert.match(link, /status = 'void'/, "a new link voids the old one"));
ok(() => assert.match(link, /if \(!user\) return fail\("Unauthorized", 401\)/));
const proxy = readFileSync("proxy.ts", "utf8");
ok(() => assert.doesNotMatch(proxy.match(/matcher:[^\]]*\]/)[0], /\/sign(?!-)/, "the signing page is public (no CRM login)"));
console.log(`E-signature regression checks passed (${n} assertions).`);
