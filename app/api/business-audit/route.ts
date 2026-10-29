import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { DEFAULT_AUDIT_MODEL, normalizeWebsite, classifyProviderError, sanitizeForLog } from "@/lib/business-audit";
import { ProviderHttpError, researchAndSave } from "@/lib/audit-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Web research with several searches routinely exceeds 60s; Fluid compute allows up to 300s.
export const maxDuration = 300;
const RESEARCH_BUDGET_MS = 240_000;

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
    const result = await researchAndSave({ sql, ownerId: user.id, apiKey, model, companyName, website, location, context, contactId, dealId, deadline: startedAt + RESEARCH_BUDGET_MS });
    stage = "persist";
    if (!result.ok) {
      console.error("Business audit empty report", { stopReason: result.stopReason, model, blocks: result.blocks });
      return fail(result.stopReason === "max_tokens" ? "Research ran out of output budget before writing the report. Try again with less context." : "Research returned no usable report. Try again.", 502);
    }
    const { content, sourceUrls, facts, hypotheses, confidence, meta, truncated, stopReason } = result;
    const saved = [{ id: result.id, created_at: result.createdAt }];
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
