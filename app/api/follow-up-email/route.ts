import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { buildEmailPrompt, cleanDiscovery, isEmailPurpose, parseEmailDraft, EMAIL_PURPOSES } from "@/lib/deal-workspace";
import { sanitizeForLog } from "@/lib/business-audit";
import { claudeText, AiTextError } from "@/lib/ai-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/**
 * POST /api/follow-up-email { dealId, purpose, notes? } — drafts one follow-up EMAIL for the founder to send himself.
 * Email only: Cinder never drafts SMS and never sends anything. Saved as a follow_up_draft for history.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail("Email drafting needs ANTHROPIC_API_KEY in the deployment environment.", 503);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.dealId !== "string" || !UUID.test(body.dealId)) return fail("Valid deal id is required.", 400);
    if (!isEmailPurpose(body.purpose)) return fail("Pick what the email is for.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT d.id, d.title, d.stage, d.discovery, d.next_step, d.proposal_sent_at, d.contact_id, c.first_name, c.company, c.email
      FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.id = ${body.dealId}::uuid AND d.owner_id = ${user.id}`;
    if (!rows.length) return fail("Deal not found.", 404);
    const d = rows[0];
    const company = String(d.company || d.title);
    const { system, user: prompt } = buildEmailPrompt({
      purpose: body.purpose, company, firstName: String(d.first_name ?? ""), senderName: "Samuel", stage: String(d.stage),
      discovery: cleanDiscovery(d.discovery), nextStep: String(d.next_step ?? ""),
      proposalSentAt: d.proposal_sent_at ? new Date(String(d.proposal_sent_at)).toISOString() : null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : "",
    });
    const draft = parseEmailDraft(await claudeText({ apiKey, system, user: prompt, maxTokens: 1200, timeoutMs: 50_000, label: "Follow-up email" }));
    const saved = await sql`
      INSERT INTO public.research_artifacts (owner_id, contact_id, deal_id, artifact_type, title, content, confidence, status, researched_at)
      VALUES (${user.id}, ${d.contact_id}, ${d.id}, 'follow_up_draft', ${(`Email · ${EMAIL_PURPOSES[body.purpose as keyof typeof EMAIL_PURPOSES].label} — ${company}`).slice(0, 240)},
        ${`Subject: ${draft.subject}\n\n${draft.body}`}, 'medium', 'draft', now())
      RETURNING id`;
    return Response.json({ id: saved[0].id, subject: draft.subject, body: draft.body, to: String(d.email ?? "") }, { status: 201 });
  } catch (error) {
    if (error instanceof AiTextError) return fail(error.message, error.status);
    console.error("Follow-up email draft failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not draft the email.", 500);
  }
}
