// Security and data-integrity checks from the platform audit. Run with: node --experimental-strip-types test-integrity.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isAllowedUser } from "./lib/owner-gate.ts";
import { bearerMatches } from "./lib/bearer.ts";
import { validatePractice, parseScore, ownerPrompt } from "./lib/practice.ts";
import { weightedPipeline, DEAL_STAGES, STAGE_PROBABILITY } from "./lib/offers.ts";
let n = 0; const ok = fn => { fn(); n++; };
const read = p => readFileSync(p, "utf8");
const env = { CINDER_OWNER_ID: "owner-1", CINDER_SIGNUPS_CLOSED_AT: "2026-11-02T10:00:00Z" };

// Owner gate: owner always in, old accounts in, new sign-ups out.
ok(() => assert.equal(isAllowedUser({ id: "owner-1", createdAt: "2027-01-01T00:00:00Z" }, env), true));
ok(() => assert.equal(isAllowedUser({ id: "x", createdAt: "2026-10-01T00:00:00Z" }, env), true));
ok(() => assert.equal(isAllowedUser({ id: "x", createdAt: "2026-11-03T00:00:00Z" }, env), false));
ok(() => assert.equal(isAllowedUser({ id: "x", createdAt: new Date("2026-12-01") }, env), false));
ok(() => assert.equal(isAllowedUser(null, env), false));
// Every API route goes through the gated session, never the raw one.
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const routes = walk("app/api").filter(p => p.endsWith(".ts"));
ok(() => assert.deepEqual(routes.filter(p => read(p).includes("auth.getSession()")), [], "routes must use getAllowedSession()"));
ok(() => assert.doesNotMatch(read("app/sign-in/page.tsx"), /signUp/, "no public sign-up"));

// Won never invents a signature: only e-sign or the explicit "Signed" action set signed_at.
for (const f of ["app/api/deals/route.ts", "app/api/deal-workspace/route.ts", "app/api/ask/execute/route.ts"]) {
  ok(() => assert.doesNotMatch(read(f), /stage\}? = 'won' THEN COALESCE\(signed_at, now\(\)\)/i, f));
}
ok(() => assert.match(read("app/api/deal-workspace/route.ts"), /\$\{contractStatus\} = 'signed' THEN COALESCE\(signed_at, now\(\)\)/));
ok(() => assert.doesNotMatch(read("app/api/deal-workspace/route.ts"), /WHEN \$\{stage\} = 'won' THEN 'signed'/));

// Any reply stops the call/text sequence.
ok(() => assert.match(read("app/api/prospect-queue/route.ts"), /kind === "replied"[\s\S]*UPDATE public\.contact_outreach SET status/));
const cal = read("app/api/webhooks/cal-ai/route.ts");
ok(() => assert.match(cal, /UPDATE public\.contact_outreach SET status = 'meeting_booked'/));
ok(() => assert.match(cal, /CINDER_OWNER_ID is not configured/));
ok(() => assert.match(cal, /duplicate: true/));
ok(() => assert.doesNotMatch(cal, /GROUP BY id, owner_id/, "no cross-account contact matching"));
ok(() => assert.match(cal, /Follow up after the call/));

// Public endpoints: rate limits and one-time submissions.
ok(() => assert.match(read("app/api/inbound-lead/route.ts"), /allowEvent\("inbound-ip"/));
ok(() => assert.match(read("app/api/testimonial/route.ts"), /AND status = 'requested' RETURNING id/));
ok(() => assert.match(read("app/api/approve/route.ts"), /if \(row\.approved_at\) return reply/));
for (const f of ["ask", "business-audit", "proposals", "follow-up-email", "pre-audit"]) ok(() => assert.match(read(`app/api/${f}/route.ts`), /aiAllowed\(user\.id\)/, f));
ok(() => assert.match(read("app/api/contacts/route.ts"), /duplicateId/));

// Cron secret: constant-time compare.
ok(() => assert.equal(bearerMatches("Bearer s3cret", "s3cret"), true));
ok(() => assert.equal(bearerMatches("Bearer nope", "s3cret"), false));
ok(() => assert.equal(bearerMatches(null, "s3cret"), false));
ok(() => assert.equal(bearerMatches("Bearer ", undefined), false));
for (const f of ["pre-audit", "weekly-review"]) ok(() => assert.match(read(`app/api/cron/${f}/route.ts`), /bearerMatches\(/));

// Pipeline: directive stages exist; weighting uses the deal's own probability over the stage default.
ok(() => { for (const st of ["qualified", "interested", "negotiation"]) assert.ok(DEAL_STAGES.includes(st), st); });
ok(() => assert.ok(DEAL_STAGES.every(st => st in STAGE_PROBABILITY)));
ok(() => assert.deepEqual(weightedPipeline([{ stage: "proposal", setupFee: 1000, monthlyFee: 1000 }]), { setup: 600, monthly: 600 }));
ok(() => assert.deepEqual(weightedPipeline([{ stage: "proposal", setupFee: 1000, monthlyFee: 1000, probability: 90 }]), { setup: 900, monthly: 900 }));
ok(() => assert.deepEqual(weightedPipeline([{ stage: "won", setupFee: 1000, monthlyFee: 1000 }, { stage: "lost", setupFee: 9, monthlyFee: 9 }]), { setup: 0, monthly: 0 }));
ok(() => assert.match(readFileSync("db/migrations/0032_pipeline_stages_probability.sql", "utf8"), /'negotiation'/));

// Practice calls: validation, scoring parse, and the owner never breaks character or coaches.
ok(() => assert.equal(validatePractice({ persona: "nope", turns: [] }).persona, "fence_busy"));
ok(() => assert.match(validatePractice({ action: "score", turns: [] }).error, /Say something first/));
ok(() => assert.equal(validatePractice({ turns: Array.from({ length: 60 }, () => ({ who: "you", text: "hi" })) }).turns.length, 40));
ok(() => assert.equal(parseScore('noise {"score": 140, "verdict": "ok", "wins": ["a"], "fixes": [], "betterLine": "x"} tail').score, 100));
ok(() => assert.equal(parseScore("no json"), null));
ok(() => assert.match(ownerPrompt("pool_skeptic", { company: "Cinder", repName: "Sam" }).system, /Never say you're an AI/));
ok(() => assert.match(read("app/api/practice/route.ts"), /aiAllowed\(user\.id\)/));

console.log(`integrity: ${n} checks passed`);
