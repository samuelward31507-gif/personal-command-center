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
  assert.match(source, /body\.stage === "won" && agreementStatus !== "active"/);
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
