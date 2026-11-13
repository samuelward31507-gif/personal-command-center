import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { agreementTier, buildProposal } from "@/lib/agreement-template";
import { paymentLinkFor } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** POST /api/proposals { dealId, addon? } — builds the proposal from the deal's plan and price, with the Stripe setup link. Instant, no AI. Saved as a draft to review. */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.dealId !== "string" || !UUID.test(body.dealId)) return fail("Valid deal id is required.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT d.id, d.title, d.service_type, d.setup_fee, d.monthly_fee, d.contact_id,
        c.first_name, c.last_name, c.company
      FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.id = ${body.dealId}::uuid AND d.owner_id = ${user.id}`;
    if (!rows.length) return fail("Deal not found.", 404);
    const d = rows[0];
    const tier = agreementTier(d.service_type ? String(d.service_type) : null);
    if (!tier) return fail("Pick the plan first (Never Miss a Lead or Book & Close) in the price editor at the top.", 400);
    const ws = await loadWorkspace(user.id);
    const company = String(d.company || String(d.title).split(" — ")[0]);
    const setupFee = Number(d.setup_fee), monthlyFee = Number(d.monthly_fee);
    const content = buildProposal({
      tier, company, ownerName: [d.first_name, d.last_name].filter(Boolean).join(" "),
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Denver" }),
      setupFee, monthlyFee, addon: body.addon === true,
      payLink: paymentLinkFor(ws, String(d.service_type), "setup_fee", setupFee).link || undefined,
      senderName: ws.ownerFullName, senderPhone: process.env.CINDER_OWNER_PHONE?.trim() || "(205) 837-0211", senderEmail: ws.contactEmail,
    });
    const saved = await sql`
      INSERT INTO public.research_artifacts (owner_id, contact_id, deal_id, artifact_type, title, content, confidence, status, researched_at)
      VALUES (${user.id}, ${d.contact_id}, ${d.id}, 'proposal', ${("Proposal — " + company).slice(0, 240)}, ${content}, 'high', 'draft', now())
      RETURNING id`;
    await sql`UPDATE public.deals SET proposal_status = 'draft', updated_at = now() WHERE id = ${d.id} AND owner_id = ${user.id} AND proposal_status = 'none'`;
    return Response.json({ id: saved[0].id, content }, { status: 201 });
  } catch (error) {
    console.error("Proposal build failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not create the proposal.", 500);
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
