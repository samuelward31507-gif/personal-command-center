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
  assert.match(source, /body\.stage === "won" && agreementStatus === "active" && !signedDate/);
  assert.match(source, /A deal cannot be marked won until its agreement is explicitly signed/);
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


const conversion = readFileSync(new URL("./app/api/deals/convert/route.ts", import.meta.url), "utf8");
const calendar = readFileSync(new URL("./app/api/calendar-events/route.ts", import.meta.url), "utf8");

test("signed-deal handoff rejects deals without an active, signed agreement", () => {
  assert.match(conversion, /deal\.stage !== "won" \|\| deal\.agreement_status !== "active" \|\| !deal\.signed_at/);
  assert.match(conversion, /Mark the deal won only after the agreement is signed/);
});

test("signed-deal handoff prevents duplicate projects and duplicate expected receivables", () => {
  assert.match(conversion, /ON CONFLICT \(owner_id, deal_id\) WHERE deal_id IS NOT NULL/);
  assert.match(conversion, /ON CONFLICT \(owner_id, source_key\) WHERE source_key <> '' DO NOTHING/);
  assert.match(conversion, /deal:" \+ deal\.id \+ ":setup/);
  assert.match(conversion, /deal:" \+ deal\.id \+ ":first_month/);
  assert.match(conversion, /No payment was recorded/);
});

test("calendar event reads are owner-scoped and require a valid increasing time range", () => {
  assert.match(calendar, /WHERE e\.owner_id = \$\{user\.id\}/);
  assert.match(calendar, /new Date\(toAt\)\.getTime\(\) <= new Date\(fromAt\)\.getTime\(\)/);
  assert.match(calendar, /SELECT id FROM public\.contacts WHERE id = \$\{contactId\}::uuid AND owner_id = \$\{ownerId\} LIMIT 1/);
  assert.match(calendar, /SELECT id FROM public\.deals WHERE id = \$\{dealId\}::uuid AND owner_id = \$\{ownerId\} LIMIT 1/);
});

test("calendar create, update, and delete require an authenticated owner", () => {
  assert.equal((calendar.match(/if \(!user\) return fail\("Unauthorized", 401\)/g) || []).length, 4);
  assert.match(calendar, /WHERE id=\$\{body\.id\}::uuid AND owner_id=\$\{user\.id\}/);
  assert.match(calendar, /DELETE FROM public\.calendar_events WHERE id=\$\{body\.id\}::uuid AND owner_id=\$\{user\.id\}/);
});

const needsYou = readFileSync(new URL("./app/crm/needs-you/page.tsx", import.meta.url), "utf8");

test("Needs You surfaces upcoming scheduled meetings and calls that have no prep notes", () => {
  assert.match(needsYou, /fetch\("\/api\/calendar-events\?from=/);
  assert.match(needsYou, /e\.status!=="scheduled"\|\|!\(\["meeting","call"\]\.includes\(e\.type\)\)/);
  assert.match(needsYou, /String\(e\.description\|\|""\)\.trim\(\)/);
  assert.match(needsYou, /hoursUntil<=24\?1:2/);
  assert.match(needsYou, /action:"Review calendar"/);
});

const researchArtifacts = readFileSync(new URL("./app/api/research-artifacts/route.ts", import.meta.url), "utf8");
const preparation = readFileSync(new URL("./app/crm/preparation/page.tsx", import.meta.url), "utf8");

test("proposal drafts are owner-scoped preparation records and are not sent automatically", () => {
  assert.match(researchArtifacts, /"proposal_draft"/);
  assert.match(researchArtifacts, /WHERE r\.owner_id = \$\{user\.id\}/);
  assert.match(researchArtifacts, /WHERE id = \$\{body\.id\}::uuid AND owner_id = \$\{user\.id\}/);
  assert.match(preparation, /proposal_draft:"Proposal draft"/);
  assert.match(preparation, /PROPOSAL DRAFT — REVIEW BEFORE SHARING/);
  assert.match(preparation, /Nothing has been sent or accepted/);
  assert.match(preparation, /type === "proposal_draft"/);
  assert.match(preparation, /params\.get\("proposal"\)!=="1"\|\|deals\.length===0/);
  assert.match(preparation, /dealId:deal\.id,contactId:deal\.contactId\|\|""/);
  const pipeline = readFileSync(new URL("./app/crm/pipeline/page.tsx", import.meta.url), "utf8");
  assert.match(pipeline, /crm\/preparation\?proposal=1&dealId=/);
  assert.doesNotMatch(preparation, /sendProposal|sendEmail|sendSms|fetch\("\/api\/send-message/);
});

test("meeting preparation remains a manual review cue and does not send invitations or messages", () => {
  assert.match(needsYou, /This queue is advisory/);
  assert.match(needsYou, /It does not send messages, make calls, or change record status automatically/);
  assert.doesNotMatch(needsYou, /sendInvite|sendEmail|sendSms|fetch\("\/api\/send-message/);
});
