import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import {
  DEFAULT_AUDIT_MODEL, WEB_SEARCH_TOOL, normalizeWebsite, classifyProviderError, sanitizeForLog,
  parseAuditOutput, collectSourceUrls, effectiveConfidence, extractLabeledLines, buildUserPrompt,
} from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Web research with several searches routinely exceeds 60s; Fluid compute allows up to 300s.
export const maxDuration = 300;
const RESEARCH_BUDGET_MS = 240_000;
const MAX_CONTINUATIONS = 3;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

const systemPrompt = `You are Cinder's independent business-audit analyst for an AI agency. Audit the whole business; do not justify selling our current offer. Use web search across first-party website pages, service pages, reviews, social/public listings, contact and booking paths, and relevant competitors. Do not invent facts, tools, ads, complaints, metrics or operational behavior. Public research cannot prove private metrics such as missed calls, speed-to-lead, margins, close rate or capacity. Label these UNKNOWN and turn them into discovery questions.

Research the whole business, but WRITE A SHORT REPORT: under 450 words, bullets not paragraphs, no tables, no methodology notes. The founder reads this right before a call. Use exactly these Markdown headings, in this order:
## Verdict — one line: Fit / Conditional fit / No fit, the offer tier, and the single biggest reason. No sale is a valid outcome.
## Business — 3–4 bullets: what they do, where, official website and how it was verified, likely decision-maker (or UNKNOWN). If similarly named businesses exist, one bullet naming them as "not this company".
## Top opportunities — at most 3, ranked. Each: the gap, the public evidence (with URL), and confidence.
## Red flags — at most 3 bullets, only if real (walk-away signals, conflicting data).
## Call plan — the opener (2 sentences, for a call the founder places manually), the meeting objective (1 line), and the 5 discovery questions that matter most.
## Future upsells — 2–4 bullets of things to offer LATER if they become a client (higher tier once eligible, reactivation add-on, non-catalog services like Google Business Profile or website/form fixes). Each with the evidence that suggests it. Label these clearly as later, not part of the first pitch.
## Next CRM action — one line.
Skip anything not decision-relevant: no full ten-area audit, competitor deep dives, economics speculation, evidence-gap lists or source tables (sources are captured separately).
Clearly distinguish VERIFIED FACT, OBSERVATION, HYPOTHESIS and UNKNOWN. Other services may be recommended only as potential opportunities, not current capabilities. Never invent client results.

Current offer catalog (options, never predetermined conclusions):
Tier 1 — Speed to Lead for fence companies: $1,500 setup + $997/mo. Website/Facebook lead form instant email response day one; texting only after 10DLC approval; missed-call text-back; AI scope qualification (new/repair, footage, material, gates, timeline, ZIP); owner-approved ballpark and small-job rules; request photos/sketches; real calendar availability/booking; reminders; owner alerts; monthly lead/reply/booking/missed-call report.
Tier 2 — Revenue System for pool builders: $3,000 setup + $1,500/mo (setup fallback $2,500, monthly never drops). Tier 1 plus budget/timeline/location qualification; under-minimum handling/financing; financing branch; one quote follow-up with genuine reason; long-cycle nurture that stops on reply/booking/STOP; review/referral requests; daily summary and full monthly report.
Tier 3 — AI Front Office: $5,000 setup + $2,500/mo; WAITLIST ONLY until Tier 1/2 has been delivered twice. Includes voice receptionist, call screening, AI FB/IG DMs and reactivation. Add-on reactivation of old quotes/past customers: $500–$1,500 one-time.
Terms: monthly starts at go-live; 3-month minimum then month-to-month with 30 days notice; live within 21 business days of kickoff info or setup refunded. Phase 1 around 1–2 weeks; texting only after 10DLC approval. Outbound follow-ups only 9am–7pm lead-local time.
Ideal fence fit: 2–5 crews, roughly $40k+/mo, competitive US suburban/metro markets, paying for leads and admitting missed/delayed follow-up. Ideal pool fit: $30k+ projects (often $50k–$250k), long sales cycle/tire-kicker issue. Walk away: mostly word-of-mouth/rural low competition, one-person shop with few jobs, owner answers everything and closes most bids, repair-only small tickets, outside US, competitor/vendor.
Discovery questions include average job, what they clear per job, what happens to missed calls, wasted trips out of 10, first contact to signed, and review last 7 days of call log where relevant. Never promise day-one texting, Tier 3 features in Tier 1/2, a number of leads/sales, zero mistakes, or guaranteed outcomes.

Website identification comes first. If no website is supplied, find it. If a supplied website does not clearly belong to this business (name, location, phone or services do not match), say so. Never fabricate a URL. If several similarly named businesses exist, list them with the evidence that distinguishes them and choose only when location/contact evidence supports it.

Do not draft SMS or text messages. Do not invent statistics or promise results.

After the Markdown report, append exactly one fenced block tagged cinder-meta containing valid JSON with these keys:
\`\`\`cinder-meta
{"officialWebsite": "https://... or null", "websiteStatus": "verified|likely|ambiguous|not_found", "websiteEvidence": "why this site belongs to the business", "candidates": ["other similarly named businesses, if any"], "fitDecision": "fit|conditional_fit|no_fit|needs_clarification", "confidence": "low|medium|high", "confidenceRationale": "one or two sentences", "decisionMaker": "name and role, or UNKNOWN", "verifiedFacts": ["short fact — source URL"], "hypotheses": ["HYPOTHESIS or UNKNOWN items"], "nextCrmAction": "one concrete next step", "futureUpsells": ["short upsell idea — evidence"]}
\`\`\``;

type ProviderPayload = { content?: unknown[]; stop_reason?: string; error?: { type?: string; message?: string } };

class ProviderHttpError extends Error {
  constructor(public httpStatus: number, public errorType: unknown, public providerMessage: unknown) { super("provider_http_error"); }
}

/** One audit = one or more Messages calls; pause_turn is continued with the paused content, per the server-tools docs. */
async function runResearch(apiKey: string, model: string, userPrompt: string, deadline: number) {
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [{ role: "user", content: userPrompt }];
  const allBlocks: unknown[] = [];
  let stopReason = "";
  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) { const e = new Error("Research budget exhausted"); e.name = "TimeoutError"; throw e; }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        // Adaptive thinking counts against max_tokens on current models; leave room for it plus the report.
        max_tokens: 16000,
        system: systemPrompt,
        messages,
        tools: [{ type: WEB_SEARCH_TOOL, name: "web_search", max_uses: 8 }],
      }),
      signal: AbortSignal.timeout(remaining),
    });
    const payload: ProviderPayload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ProviderHttpError(response.status, payload?.error?.type, payload?.error?.message);
    const content = Array.isArray(payload.content) ? payload.content : [];
    allBlocks.push(...content);
    stopReason = String(payload.stop_reason ?? "");
    if (stopReason !== "pause_turn") break;
    messages.push({ role: "assistant", content });
  }
  return { blocks: allBlocks, stopReason };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let stage = "auth";
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail("Business Audit requires ANTHROPIC_API_KEY in the Cinder deployment environment.", 503);
    stage = "validate";
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid request body.", 400);
    const companyName = clean(body.companyName, 200);
    const location = clean(body.location, 300);
    const context = clean(body.context, 4000);
    const contactId = body.contactId == null || body.contactId === "" ? null : clean(body.contactId, 80);
    const dealId = body.dealId == null || body.dealId === "" ? null : clean(body.dealId, 80);
    if (!companyName) return fail("A business name is required.", 400);
    if (contactId && !uuid.test(contactId)) return fail("Invalid contact id.", 400);
    if (dealId && !uuid.test(dealId)) return fail("Invalid deal id.", 400);
    // A missing website is not an error: the research step discovers it.
    const site = normalizeWebsite(clean(body.website, 2000));
    if (site && "error" in site) return fail(site.error, 400);
    const website = site ? site.url : null;

    stage = "database";
    const sql = db();
    if (contactId) {
      const rows = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!rows.length) return fail("Contact not found in your workspace.", 404);
    }
    if (dealId) {
      const rows = await sql`SELECT id FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!rows.length) return fail("Deal not found in your workspace.", 404);
    }

    // Idempotency: a retry of the same audit within 10 minutes returns the saved report
    // instead of paying for a second run and saving a duplicate. force=true re-runs.
    const title = ("Business audit — " + companyName).slice(0, 240);
    if (body.force !== true) {
      const recent = await sql`SELECT id, content, source_urls, verified_facts, hypotheses, confidence, created_at
        FROM public.research_artifacts
        WHERE owner_id = ${user.id} AND artifact_type = 'audit_prep' AND title = ${title}
          AND contact_id IS NOT DISTINCT FROM ${contactId}::uuid AND status <> 'archived'
          AND created_at > now() - interval '10 minutes'
        ORDER BY created_at DESC LIMIT 1`;
      if (recent.length) {
        const r = recent[0];
        const content = String(r.content ?? "");
        const verdict = content.toLowerCase();
        const fitDecision = /\bno fit\b/.test(verdict) ? "no_fit" : /\bconditional fit\b/.test(verdict) ? "conditional_fit" : /\bfit\b/.test(verdict) ? "fit" : null;
        return Response.json({ audit: {
          id: String(r.id), title, companyName, content, sourceUrls: r.source_urls ?? [], verifiedFacts: r.verified_facts ?? [],
          hypotheses: r.hypotheses ?? [], confidence: String(r.confidence), officialWebsite: website, websiteStatus: website ? "likely" : "not_found",
          candidates: [], fitDecision, nextCrmAction: "", contactId, status: "draft", createdAt: r.created_at, incomplete: false, reused: true,
        } }, { status: 200, headers: { "Cache-Control": "no-store" } });
      }
    }

    stage = "provider";
    const model = process.env.CINDER_AUDIT_MODEL?.trim() || DEFAULT_AUDIT_MODEL;
    const { blocks, stopReason } = await runResearch(apiKey, model, buildUserPrompt({ companyName, website, location, context }), startedAt + RESEARCH_BUDGET_MS);

    stage = "parse";
    const text = (blocks as Array<{ type?: string; text?: unknown }>).filter(b => b?.type === "text" && typeof b.text === "string").map(b => b.text as string).join("").trim();
    const { report, meta } = parseAuditOutput(text);
    if (!report) {
      console.error("Business audit empty report", { stopReason, model, blocks: blocks.length });
      return fail(stopReason === "max_tokens" ? "Research ran out of output budget before writing the report. Try again with less context." : "Research returned no usable report. Try again.", 502);
    }
    const sourceUrls = collectSourceUrls(blocks, report);
    const fallback = extractLabeledLines(report);
    const facts = meta?.verifiedFacts.length ? meta.verifiedFacts : fallback.facts;
    const hypotheses = meta?.hypotheses.length ? meta.hypotheses : fallback.hypotheses;
    const confidence = effectiveConfidence(meta, sourceUrls.length);
    const truncated = stopReason === "max_tokens" || stopReason === "pause_turn";
    const content = (truncated ? "> ⚠️ This report may be incomplete: research stopped before finishing.\n\n" : "") + report;

    stage = "persist";
    const saved = await sql`INSERT INTO public.research_artifacts
      (owner_id, contact_id, deal_id, artifact_type, title, source_urls, verified_facts, hypotheses, confidence, content, status, researched_at)
      VALUES (${user.id}, ${contactId}::uuid, ${dealId}::uuid, 'audit_prep',
        ${title}, ${JSON.stringify(sourceUrls)}::jsonb,
        ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(hypotheses)}::jsonb,
        ${confidence}, ${content.slice(0, 20000)}, 'draft', now())
      RETURNING id, created_at`;
    console.info("Business audit saved", { model, stopReason, sources: sourceUrls.length, websiteStatus: meta?.websiteStatus ?? "unparsed", ms: Date.now() - startedAt });
    return Response.json({ audit: {
      id: String(saved[0].id), title, companyName, content, sourceUrls, verifiedFacts: facts, hypotheses, confidence,
      officialWebsite: meta?.officialWebsite ?? website, websiteStatus: meta?.websiteStatus ?? (website ? "likely" : "not_found"),
      candidates: meta?.candidates ?? [], fitDecision: meta?.fitDecision ?? null, nextCrmAction: meta?.nextCrmAction ?? "", futureUpsells: meta?.futureUpsells ?? [],
      contactId, status: "draft", createdAt: saved[0].created_at, incomplete: truncated,
    } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProviderHttpError) {
      const f = classifyProviderError(error.httpStatus, error.errorType, error.providerMessage);
      console.error("Business audit provider error", { upstreamStatus: error.httpStatus, type: sanitizeForLog(error.errorType, 60), category: f.category, message: sanitizeForLog(error.providerMessage) });
      return fail(f.clientMessage, f.status);
    }
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      console.error("Business audit timeout", { stage, ms: Date.now() - startedAt });
      return fail("The audit timed out while researching. Try again, or add the website/location to narrow the search.", 504);
    }
    const message = error instanceof Error ? sanitizeForLog(error.message) : "unknown";
    console.error("Business audit failed", { stage, name: error instanceof Error ? error.name : typeof error, message });
    if (stage === "database" || stage === "persist") {
      return fail(/connection string|DATABASE_URL/i.test(message)
        ? "Cinder's database connection is misconfigured for this deployment (DATABASE_URL). The audit was not run."
        : "Cinder could not reach its database. The audit was not saved.", 503);
    }
    return fail("Unable to complete the business audit.", 500);
  }
}
