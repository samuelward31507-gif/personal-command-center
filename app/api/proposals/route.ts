import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { buildProposalPrompt, cleanDiscovery } from "@/lib/deal-workspace";
import { OFFERS } from "@/lib/offers";
import { classifyProviderError, reportSection, sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** POST /api/proposals { dealId, notes? } — drafts a proposal from discovery notes, the audit and the deal's offer. Saved as a draft for the founder to edit. */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail("Proposal drafting needs ANTHROPIC_API_KEY in the deployment environment.", 503);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.dealId !== "string" || !UUID.test(body.dealId)) return fail("Valid deal id is required.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT d.id, d.title, d.service_type, d.setup_fee, d.monthly_fee, d.discovery, d.contact_id, d.notes,
        c.first_name, c.last_name, c.company, c.location
      FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.id = ${body.dealId}::uuid AND d.owner_id = ${user.id}`;
    if (!rows.length) return fail("Deal not found.", 404);
    const d = rows[0];
    const audit = d.contact_id ? await sql`SELECT content FROM public.research_artifacts WHERE owner_id = ${user.id} AND contact_id = ${d.contact_id} AND artifact_type = 'audit_prep' AND status <> 'archived' ORDER BY created_at DESC LIMIT 1` : [];
    const auditText = audit[0] ? [reportSection(String(audit[0].content), "Verdict"), reportSection(String(audit[0].content), "Top opportunities")].filter(Boolean).join("\n").slice(0, 2500) : "";
    const offer = Object.values(OFFERS).find(o => o.serviceType === d.service_type);
    const company = String(d.company || d.title);
    const { system, user: prompt } = buildProposalPrompt({
      company, contactName: [d.first_name, d.last_name].filter(Boolean).join(" "), location: String(d.location ?? ""),
      offerLabel: offer?.label ?? "Custom AI implementation", setupFee: Number(d.setup_fee), monthlyFee: Number(d.monthly_fee),
      discovery: cleanDiscovery(d.discovery), auditSummary: auditText,
      notes: [typeof body.notes === "string" ? body.notes.slice(0, 1500) : "", String(d.notes ?? "").slice(0, 1000)].filter(Boolean).join("\n"),
    });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.CINDER_ASK_MODEL?.trim() || "claude-sonnet-5-5", max_tokens: 6000, system, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(80_000),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const f = classifyProviderError(res.status, payload?.error?.type, payload?.error?.message);
      console.error("Proposal provider error", { status: res.status, type: payload?.error?.type, message: sanitizeForLog(payload?.error?.message) });
      return fail(f.clientMessage.replace(/research provider/g, "AI provider").replace(/audit request/g, "request"), f.status);
    }
    const content = (Array.isArray(payload.content) ? payload.content : []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
    if (!content) return fail("The draft came back empty. Try again.", 502);
    const saved = await sql`
      INSERT INTO public.research_artifacts (owner_id, contact_id, deal_id, artifact_type, title, content, confidence, status, researched_at)
      VALUES (${user.id}, ${d.contact_id}, ${d.id}, 'proposal', ${("Proposal — " + company).slice(0, 240)}, ${content}, 'medium', 'draft', now())
      RETURNING id`;
    await sql`UPDATE public.deals SET proposal_status = 'draft', updated_at = now() WHERE id = ${d.id} AND owner_id = ${user.id} AND proposal_status = 'none'`;
    return Response.json({ id: saved[0].id, content }, { status: 201 });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("Proposal draft failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail(timeout ? "Drafting took too long. Try again." : "Could not draft the proposal.", timeout ? 504 : 500);
  }
}

/** PATCH /api/proposals { id, content } — save the founder's edits. */
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || !UUID.test(body.id)) return fail("Valid proposal id is required.", 400);
    if (typeof body.content !== "string" || !body.content.trim()) return fail("Proposal text can't be empty.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`UPDATE public.research_artifacts SET content = ${body.content.slice(0, 20000)}, status = 'reviewed', updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id} AND artifact_type = 'proposal' RETURNING id`;
    if (!rows.length) return fail("Proposal not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Proposal save failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not save the proposal.", 500);
  }
}
