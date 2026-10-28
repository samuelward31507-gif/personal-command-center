import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

Return readable, specific Markdown with these headings:
1. Executive verdict (fit / conditional fit / no fit; no sale is a valid outcome)
2. Business snapshot
3. Verified public evidence (inline URLs and what each supports)
4. Full business audit: marketing & demand; lead capture and speed-to-lead; qualification and sales conversion; estimates/quotes and follow-up; customer experience; reviews/referrals/retention; scheduling/admin/operations; website/conversion; competitive position; economics/capacity
5. Ranked opportunities (rank, evidence, confidence, potential impact, difficulty, validation needed)
6. Offer fit decision
7. Discovery plan
8. Tailored first-meeting brief
9. Evidence gaps and follow-up research.
Clearly distinguish VERIFIED FACT, OBSERVATION, HYPOTHESIS and UNKNOWN. Other services may be recommended only as potential opportunities, not current capabilities. Never invent client results.

Current offer catalog (options, never predetermined conclusions):
Tier 1 — Speed to Lead for fence companies: $1,500 setup + $997/mo. Website/Facebook lead form instant email response day one; texting only after 10DLC approval; missed-call text-back; AI scope qualification (new/repair, footage, material, gates, timeline, ZIP); owner-approved ballpark and small-job rules; request photos/sketches; real calendar availability/booking; reminders; owner alerts; monthly lead/reply/booking/missed-call report.
Tier 2 — Revenue System for pool builders: $3,000 setup + $1,500/mo (setup fallback $2,500, monthly never drops). Tier 1 plus budget/timeline/location qualification; under-minimum handling/financing; financing branch; one quote follow-up with genuine reason; long-cycle nurture that stops on reply/booking/STOP; review/referral requests; daily summary and full monthly report.
Tier 3 — AI Front Office: $5,000 setup + $2,500/mo; WAITLIST ONLY until Tier 1/2 has been delivered twice. Includes voice receptionist, call screening, AI FB/IG DMs and reactivation. Add-on reactivation of old quotes/past customers: $500–$1,500 one-time.
Terms: monthly starts at go-live; 3-month minimum then month-to-month with 30 days notice; live within 21 business days of kickoff info or setup refunded. Phase 1 around 1–2 weeks; texting only after 10DLC approval. Outbound follow-ups only 9am–7pm lead-local time.
Ideal fence fit: 2–5 crews, roughly $40k+/mo, competitive US suburban/metro markets, paying for leads and admitting missed/delayed follow-up. Ideal pool fit: $30k+ projects (often $50k–$250k), long sales cycle/tire-kicker issue. Walk away: mostly word-of-mouth/rural low competition, one-person shop with few jobs, owner answers everything and closes most bids, repair-only small tickets, outside US, competitor/vendor.
Discovery questions include average job, what they clear per job, what happens to missed calls, wasted trips out of 10, first contact to signed, and review last 7 days of call log where relevant. Never promise day-one texting, Tier 3 features in Tier 1/2, a number of leads/sales, zero mistakes, or guaranteed outcomes.`;

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.ANTHROPIC_API_KEY) return fail("Business Audit requires ANTHROPIC_API_KEY in the Cinder deployment environment.", 503);
    const body = await request.json();
    const companyName = clean(body.companyName, 200);
    const website = clean(body.website, 2000);
    const location = clean(body.location, 300);
    const context = clean(body.context, 4000);
    const contactId = body.contactId == null || body.contactId === "" ? null : clean(body.contactId, 80);
    const dealId = body.dealId == null || body.dealId === "" ? null : clean(body.dealId, 80);
    if (!companyName) return fail("A business name is required.", 400);
    if (contactId && !uuid.test(contactId)) return fail("Invalid contact id.", 400);
    if (dealId && !uuid.test(dealId)) return fail("Invalid deal id.", 400);
    if (website) {
      try {
        const parsed = new URL(website);
        if (!["http:", "https:"].includes(parsed.protocol)) return fail("Website must be an HTTP(S) URL.", 400);
      } catch { return fail("Enter a valid website URL.", 400); }
    }

    const sql = db();
    if (contactId) {
      const rows = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!rows.length) return fail("Contact not found in your workspace.", 404);
    }
    if (dealId) {
      const rows = await sql`SELECT id FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!rows.length) return fail("Deal not found in your workspace.", 404);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.CINDER_AUDIT_MODEL || "claude-sonnet-4-5",
        max_tokens: 7000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Independently audit this business; do not assume our offer fits.
Business: ${companyName}
Website: ${website || "Find and verify the official website"}
Location/service area: ${location || "Research if publicly available"}
CRM context: ${context || "None supplied"}
Use web search, prioritize first-party sources, cite URLs inline, and make a clear evidence-based fit/no-fit decision.` }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }]
      }),
      signal: AbortSignal.timeout(55000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Business audit provider error", response.status, payload?.error?.type ?? "unknown");
      return fail(response.status === 429 ? "Research is temporarily rate-limited. Try again shortly." : "The research provider could not complete this audit. Check server configuration and try again.", response.status === 429 ? 429 : 502);
    }

    const blocks = Array.isArray(payload.content) ? payload.content : [];
    const report = blocks.filter((b: any) => b?.type === "text" && typeof b.text === "string").map((b: any) => b.text).join("\n\n").trim();
    if (!report) return fail("Research returned no usable report. Try again.", 502);
    const urls = new Set<string>();
    for (const block of blocks) {
      if (Array.isArray(block?.citations)) for (const c of block.citations) if (typeof c?.url === "string" && /^https?:\/\//i.test(c.url)) urls.add(c.url);
    }
    for (const match of report.matchAll(/https?:\/\/[^\s)\]>]+/g)) {
      const url = match[0].replace(/[.,;]+$/, "");
      try { if (["http:", "https:"].includes(new URL(url).protocol)) urls.add(url); } catch {}
    }
    const sourceUrls = [...urls].slice(0, 30);
    const facts = report.split("\n").filter((line: string) => /VERIFIED FACT|verified public evidence/i.test(line)).map((line: string) => line.replace(/^\s*[-*#\d.]+\s*/, "").trim()).filter(Boolean).slice(0, 50);
    const hypotheses = report.split("\n").filter((line: string) => /HYPOTHESIS|UNKNOWN|fit decision|no sale/i.test(line)).map((line: string) => line.replace(/^\s*[-*#\d.]+\s*/, "").trim()).filter(Boolean).slice(0, 50);

    const saved = await sql`INSERT INTO public.research_artifacts
      (owner_id, contact_id, deal_id, artifact_type, title, source_urls, verified_facts, hypotheses, confidence, content, status, researched_at)
      VALUES (${user.id}, ${contactId}::uuid, ${dealId}::uuid, 'audit_prep',
        ${("Business audit — " + companyName).slice(0, 240)}, ${JSON.stringify(sourceUrls)}::jsonb,
        ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(hypotheses)}::jsonb,
        ${sourceUrls.length >= 3 ? "medium" : "low"}, ${report.slice(0, 20000)}, 'draft', now())
      RETURNING id, created_at`;
    return Response.json({ audit: { id: String(saved[0].id), title: `Business audit — ${companyName}`, companyName, content: report, sourceUrls, verifiedFacts: facts, hypotheses, confidence: sourceUrls.length >= 3 ? "medium" : "low", status: "draft", createdAt: saved[0].created_at } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return fail("The audit timed out while researching. Try again with a more specific website.", 504);
    console.error("Business audit failed", error);
    return fail("Unable to complete the business audit.", 500);
  }
}
