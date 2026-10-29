import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  WEB_SEARCH_TOOL, parseAuditOutput, collectSourceUrls, effectiveConfidence, extractLabeledLines, buildUserPrompt,
} from "@/lib/business-audit";

// The Business Audit engine, shared by the audit page (/api/business-audit) and overnight pre-audits (/api/cron/pre-audit).
const MAX_CONTINUATIONS = 3;

export const systemPrompt = `You are Cinder's independent business-audit analyst for an AI agency. Audit the whole business; do not justify selling our current offer. Use web search across first-party website pages, service pages, reviews, social/public listings, contact and booking paths, and relevant competitors. Do not invent facts, tools, ads, complaints, metrics or operational behavior. Public research cannot prove private metrics such as missed calls, speed-to-lead, margins, close rate or capacity. Label these UNKNOWN and turn them into discovery questions.

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

export class ProviderHttpError extends Error {
  constructor(public httpStatus: number, public errorType: unknown, public providerMessage: unknown) { super("provider_http_error"); }
}

/** One audit = one or more Messages calls; pause_turn is continued with the paused content, per the server-tools docs. */
export async function runResearch(apiKey: string, model: string, userPrompt: string, deadline: number) {
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


export type AuditRunInput = {
  sql: NeonQueryFunction<false, false>; ownerId: string; apiKey: string; model: string;
  companyName: string; website: string | null; location: string; context: string;
  contactId: string | null; dealId: string | null; deadline: number;
};

/** Research one business and save the audit under ownerId. Throws ProviderHttpError / TimeoutError; returns null when the model wrote no report. */
export async function researchAndSave(i: AuditRunInput) {
  const { sql, ownerId, companyName, website, contactId, dealId } = i;
  const title = ("Business audit — " + companyName).slice(0, 240);
  const { blocks, stopReason } = await runResearch(i.apiKey, i.model, buildUserPrompt({ companyName, website, location: i.location, context: i.context }), i.deadline);
  const text = (blocks as Array<{ type?: string; text?: unknown }>).filter(b => b?.type === "text" && typeof b.text === "string").map(b => b.text as string).join("").trim();
  const { report, meta } = parseAuditOutput(text);
  if (!report) return { ok: false as const, stopReason, blocks: blocks.length };
  const sourceUrls = collectSourceUrls(blocks, report);
  const fallback = extractLabeledLines(report);
  const facts = meta?.verifiedFacts.length ? meta.verifiedFacts : fallback.facts;
  const hypotheses = meta?.hypotheses.length ? meta.hypotheses : fallback.hypotheses;
  const confidence = effectiveConfidence(meta, sourceUrls.length);
  const truncated = stopReason === "max_tokens" || stopReason === "pause_turn";
  const content = (truncated ? "> ⚠️ This report may be incomplete: research stopped before finishing.\n\n" : "") + report;
  const saved = await sql`INSERT INTO public.research_artifacts
    (owner_id, contact_id, deal_id, artifact_type, title, source_urls, verified_facts, hypotheses, confidence, content, status, researched_at)
    VALUES (${ownerId}, ${contactId}::uuid, ${dealId}::uuid, 'audit_prep',
      ${title}, ${JSON.stringify(sourceUrls)}::jsonb,
      ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(hypotheses)}::jsonb,
      ${confidence}, ${content.slice(0, 20000)}, 'draft', now())
    RETURNING id, created_at`;
  return { ok: true as const, id: String(saved[0].id), createdAt: saved[0].created_at, title, content, sourceUrls, facts, hypotheses, confidence, meta, truncated, stopReason };
}
