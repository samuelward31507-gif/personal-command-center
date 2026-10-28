// Regression tests for Business Audit helpers and route guardrails.
// Run with: node --experimental-strip-types test-business-audit.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeWebsite, classifyProviderError, sanitizeForLog, parseAuditOutput,
  collectSourceUrls, effectiveConfidence, buildUserPrompt, reportSection, DEFAULT_AUDIT_MODEL, WEB_SEARCH_TOOL,
} from "./lib/business-audit.ts";

let n = 0;
const ok = (fn, msg) => { fn(); n++; void msg; };

// --- Website normalization: incomplete URLs from CRM imports must not be fatal ---
ok(() => assert.equal(normalizeWebsite(""), null), "blank website is allowed (discovery)");
ok(() => assert.equal(normalizeWebsite("   "), null));
ok(() => assert.deepEqual(normalizeWebsite("acmefence.com"), { url: "https://acmefence.com/" }), "bare domain gets https");
ok(() => assert.deepEqual(normalizeWebsite("www.acmefence.com/contact"), { url: "https://www.acmefence.com/contact" }));
ok(() => assert.deepEqual(normalizeWebsite("http://acme.com#top"), { url: "http://acme.com/" }), "hash stripped, http kept");
ok(() => assert.ok("error" in normalizeWebsite("ftp://acme.com")), "non-http rejected");
ok(() => assert.ok("error" in normalizeWebsite("not a website")), "garbage rejected");
ok(() => assert.ok("error" in normalizeWebsite("localhost:3000")), "localhost rejected");
ok(() => assert.ok("error" in normalizeWebsite("http://10.0.0.1")), "private IP rejected");

// --- Provider error classification: each failure mode gets a distinct, safe message ---
const c = (s, t, m) => classifyProviderError(s, t, m);
ok(() => assert.equal(c(401, "authentication_error", "invalid x-api-key").category, "provider_auth"));
ok(() => assert.equal(c(403, "permission_error", "").category, "provider_permission"));
ok(() => assert.equal(c(404, "not_found_error", "model: claude-x").category, "provider_model"));
ok(() => { const r = c(429, "rate_limit_error", ""); assert.equal(r.status, 429); assert.equal(r.retryable, true); });
ok(() => assert.equal(c(400, "invalid_request_error", "Your credit balance is too low").category, "provider_billing"));
ok(() => assert.equal(c(400, "invalid_request_error", "web search is not enabled for this organization").category, "provider_tool"));
ok(() => assert.equal(c(400, "invalid_request_error", "model does not support X").category, "provider_model"));
ok(() => assert.equal(c(400, "invalid_request_error", "messages: field required").category, "provider_bad_request"));
ok(() => assert.equal(c(529, "overloaded_error", "").category, "provider_unavailable"));
ok(() => assert.equal(c(500, "api_error", "").status, 503));
ok(() => {
  for (const s of [400, 401, 403, 404, 429, 500, 529]) {
    const msg = c(s, "x", "key sk-ant-api03-SECRET postgres://u:p@h/db").clientMessage;
    assert.doesNotMatch(msg, /sk-ant|postgres:\/\/|SECRET/, "client message never echoes provider text");
    assert.doesNotMatch(msg, /Check server configuration and try again/, "old generic message is gone");
  }
});

// --- Log sanitization ---
ok(() => {
  const s = sanitizeForLog("bad key sk-ant-api03-abcDEF_123 at postgresql://user:pw@ep-x.neon.tech/db Bearer abc.def");
  assert.doesNotMatch(s, /abcDEF|user:pw|abc\.def/);
});
ok(() => assert.equal(sanitizeForLog("x".repeat(1000)).length, 300));
ok(() => assert.equal(sanitizeForLog(undefined), ""));

// --- Meta parsing ---
const metaText = `## Report\nVERIFIED FACT: Family owned — https://acme.com/about\n\n\`\`\`cinder-meta
{"officialWebsite":"acme.com","websiteStatus":"verified","websiteEvidence":"Name and phone match","candidates":["Acme Fence TX"],"fitDecision":"conditional_fit","confidence":"high","confidenceRationale":"r","decisionMaker":"UNKNOWN","verifiedFacts":["Family owned — https://acme.com/about"],"hypotheses":["HYPOTHESIS: slow follow-up"],"nextCrmAction":"Call owner","futureUpsells":["Reactivation add-on — 8 permits in 2y","GBP cleanup — unclaimed Yelp","x","y","z"]}
\`\`\``;
ok(() => {
  const { report, meta } = parseAuditOutput(metaText);
  assert.doesNotMatch(report, /cinder-meta/, "meta block stripped from saved report");
  assert.equal(meta.officialWebsite, "https://acme.com/");
  assert.equal(meta.fitDecision, "conditional_fit");
  assert.deepEqual(meta.candidates, ["Acme Fence TX"]);
  assert.equal(meta.futureUpsells.length, 4, "upsells capped at 4");
});
ok(() => {
  const { meta } = parseAuditOutput("```cinder-meta\n{\"officialWebsite\":\"made up\",\"websiteStatus\":\"bogus\",\"confidence\":\"certain\"}\n```");
  assert.equal(meta.officialWebsite, null, "unusable URL never stored as official site");
  assert.equal(meta.websiteStatus, "not_found");
  assert.equal(meta.confidence, "low");
});
ok(() => assert.equal(parseAuditOutput("no meta here").meta, null));
ok(() => assert.equal(parseAuditOutput("```cinder-meta\n{broken\n```").meta, null), "invalid JSON tolerated");

// --- Sources & confidence ---
ok(() => {
  const urls = collectSourceUrls([{ type: "text", citations: [{ url: "https://a.com/x" }, { url: "javascript:alert(1)" }] }], "See https://b.com/y. and (https://a.com/x)");
  assert.deepEqual(urls.sort(), ["https://a.com/x", "https://b.com/y"]);
});
const meta = (o) => ({ ...parseAuditOutput(metaText).meta, ...o });
ok(() => assert.equal(effectiveConfidence(meta({}), 1), "low"), "<2 sources is always low");
ok(() => assert.equal(effectiveConfidence(meta({ websiteStatus: "ambiguous" }), 10), "low"), "ambiguous business is low");
ok(() => assert.equal(effectiveConfidence(meta({ websiteStatus: "not_found" }), 10), "low"));
ok(() => assert.equal(effectiveConfidence(meta({ confidence: "high" }), 3), "medium"), "high needs ≥4 sources");
ok(() => assert.equal(effectiveConfidence(meta({ confidence: "high" }), 5), "high"));
ok(() => assert.equal(effectiveConfidence(null, 3), "medium"));

// --- Prompt: discovery vs supplied website ---
ok(() => {
  const p = buildUserPrompt({ companyName: "Acme", website: null, location: "Denver, CO", context: "" });
  assert.match(p, /NOT SUPPLIED/); assert.match(p, /do not invent a URL/); assert.match(p, /Denver, CO/);
});
ok(() => assert.match(buildUserPrompt({ companyName: "Acme", website: "https://acme.com/", location: "", context: "" }), /Verify it belongs to this business/));
ok(() => assert.equal(DEFAULT_AUDIT_MODEL, "claude-sonnet-5-5"));
ok(() => assert.equal(WEB_SEARCH_TOOL, "web_search_20250305"));

// --- Route source guards ---
const route = readFileSync("app/api/business-audit/route.ts", "utf8");
ok(() => assert.doesNotMatch(route, /Check server configuration and try again/, "generic provider error removed"));
ok(() => assert.match(route, /classifyProviderError\(/));
ok(() => assert.match(route, /stopReason !== "pause_turn"/, "pause_turn is continued"));
ok(() => assert.match(route, /owner_id = \$\{user\.id\}/, "contact lookup stays owner-scoped"));
ok(() => assert.match(route, /VALUES \(\$\{user\.id\}/, "artifact saved under authenticated owner"));
ok(() => assert.doesNotMatch(route, /console\.\w+\([^)]*apiKey/, "API key never logged"));
ok(() => assert.doesNotMatch(route, /console\.\w+\([^)]*DATABASE_URL\b(?! is)/, "DB URL never logged"));
ok(() => assert.match(route, /Do not draft SMS or text messages/, "no SMS drafting in audit output"));
ok(() => assert.match(route, /under 450 words/, "report kept short"));
ok(() => assert.match(route, /## Future upsells/, "report includes future upsells"));
ok(() => assert.doesNotMatch(route, /Full business audit:/, "ten-area audit section removed"));
ok(() => assert.match(route, /futureUpsells: meta\?\.futureUpsells/, "upsells returned to the UI"));
const ui = readFileSync("app/crm/audit/page.tsx", "utf8");
ok(() => assert.doesNotMatch(ui, /type="url"/, "browser URL validation no longer blocks bare domains"));

// --- Contact panel: section extraction from saved reports ---
const shortReport = "## Verdict\nConditional fit — Tier 2\n## Future upsells\n- Reactivation add-on\n- GBP cleanup\n## Next CRM action\nCall Daniel.";
ok(() => assert.equal(reportSection(shortReport, "Verdict"), "Conditional fit — Tier 2"));
ok(() => assert.equal(reportSection(shortReport, "Future upsells"), "- Reactivation add-on\n- GBP cleanup"));
ok(() => assert.equal(reportSection(shortReport, "Next CRM action"), "Call Daniel."));
ok(() => assert.equal(reportSection("## Verdict — No fit — rural\n## Business", "Verdict"), "No fit — rural"), "inline heading form");
ok(() => assert.equal(reportSection("## 1. Executive verdict\nx", "Verdict"), ""), "old long reports fall back cleanly");
const artifactsApi = readFileSync("app/api/research-artifacts/route.ts", "utf8");
ok(() => assert.match(artifactsApi, /r\.contact_id = \$\{contactFilter/, "artifacts can be filtered by contact"));
ok(() => assert.match(artifactsApi, /WHERE r\.owner_id = \$\{user\.id\}/, "contact filter stays owner-scoped"));
const contactsUi = readFileSync("app/crm/page.tsx", "utf8");
ok(() => assert.match(contactsUi, /type=audit_prep&contactId=/, "contact detail loads its audits"));
ok(() => assert.match(contactsUi, /Latest audit/, "contact detail shows latest audit"));

const reportUi = readFileSync("app/crm/audit/audit-report.tsx", "utf8");
ok(() => assert.match(readFileSync("app/crm/audit/page.tsx", "utf8"), /<AuditReport audit=\{audit\} \/>/, "results use the structured report view"));
ok(() => assert.doesNotMatch(readFileSync("app/crm/audit/page.tsx", "utf8"), /whiteSpace: "pre-wrap"[^\n]*\{audit\.content\}/, "raw markdown dump removed"));
ok(() => assert.doesNotMatch(reportUi, /dangerouslySetInnerHTML/, "report renderer never injects HTML"));
ok(() => assert.match(reportUi, /<details/, "sources are collapsed by default"));
ok(() => assert.match(reportUi, /LATER — NOT THE FIRST PITCH/, "upsells clearly marked as later"));

console.log(`Business audit regression checks passed (${n} assertions).`);
