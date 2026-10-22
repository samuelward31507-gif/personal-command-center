// DB-free regression checks for the signed-agreement gate in the deal API.
// These guard the critical contract without requiring production credentials.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./app/api/deals/route.ts", import.meta.url), "utf8");

function test(name, check) {
  try {
    check();
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name);
    console.error(error);
    process.exitCode = 1;
  }
}

test("creating a won deal requires an explicitly active agreement and signed date", () => {
  assert.match(source, /stage === "won" && requestedAgreementStatus !== "active"/);
  assert.match(source, /requestedAgreementStatus === "active" && !signedDate/);
});

test("activating an agreement without a recorded signature is rejected", () => {
  assert.match(source, /Record the agreement signed date before activating the agreement\./);
  assert.match(source, /if \(agreementStatus === "active" && !signedDate\)/);
});

test("moving a deal to won requires an already active, signed agreement", () => {
  assert.match(source, /body\.stage === "won" && agreementStatus !== undefined && agreementStatus !== "active"/);
  assert.match(source, /A deal cannot be marked won while its agreement is not active/);
  assert.match(source, /existing\[0\]\.agreement_status !== "active" \|\| !\(signedDate \|\| existing\[0\]\.signed_at\)/);
});

test("won stage no longer silently signs or activates agreements", () => {
  assert.doesNotMatch(source, /stage === "won" \? "active" : "pending"/);
  assert.doesNotMatch(source, /THEN COALESCE\(signed_at, now\(\)\)/);
  assert.doesNotMatch(source, /WHEN \$\{body\.stage\} = 'won' AND stage <> 'won' THEN 'active'/);
});

test("signed and effective dates are validated as calendar dates", () => {
  assert.match(source, /const signedDate = validDate\(body\.signedAt\)/);
  assert.match(source, /const effectiveDate = validDate\(body\.effectiveAt\)/);
  assert.match(source, /Agreement dates must use valid YYYY-MM-DD dates\./);
});

const pipeline = readFileSync(new URL("./app/crm/pipeline/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./app/page.tsx", import.meta.url), "utf8");
const finance = readFileSync(new URL("./app/crm/finance/page.tsx", import.meta.url), "utf8");
const authServer = readFileSync(new URL("./lib/auth/server.ts", import.meta.url), "utf8");

test("Neon Auth handler is lazy and does not eagerly read environment at module import", () => {
  assert.match(authServer, /const lazyHandlers = new Proxy/);
  assert.match(authServer, /if \(property === "handler"\)/);
  assert.match(authServer, /return \(\) => lazyHandlers/);
  assert.match(authServer, /const handlers = getAuthClient\(\)\.handler\(\)/);
});

test("sales pipeline exposes agreement status and signed/effective date fields", () => {
  assert.match(pipeline, /value=\{draft\.agreementStatus\}/);
  assert.match(pipeline, /value=\{draft\.signedAt\}/);
  assert.match(pipeline, /value=\{draft\.effectiveAt\}/);
});

test("pipeline updates normalize stored timestamps to YYYY-MM-DD before sending them", () => {
  assert.match(pipeline, /signedAt:d\.signedAt\?String\(d\.signedAt\)\.slice\(0,10\):null/);
  assert.match(pipeline, /effectiveAt:d\.effectiveAt\?String\(d\.effectiveAt\)\.slice\(0,10\):null/);
});

test("finance dashboards do not label manually entered paid statuses as verified collection", () => {
  assert.match(home, /MANUALLY MARKED PAID/);
  assert.match(home, /Manual entries · not processor-verified/);
  assert.match(home, /Manually marked paid less logged expenses/);
  assert.match(finance, /Amounts marked paid are manual bookkeeping entries, not processor-verified collection/);
});
