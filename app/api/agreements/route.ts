import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { fillAgreement, agreementTier } from "@/lib/agreement-template";
import { sanitizeForLog } from "@/lib/business-audit";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/**
 * POST /api/agreements { dealId } — fills Cinder's service agreement template from the deal (tier, fees, client).
 * No AI: every agreement is the same reviewed text. Unknown details stay as [bracketed blanks] for the founder.
 * Saved as a draft. Cinder never sends it.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.dealId !== "string" || !UUID.test(body.dealId)) return fail("Valid deal id is required.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT d.id, d.title, d.service_type, d.setup_fee, d.monthly_fee, d.contact_id, c.first_name, c.last_name, c.company, c.location, c.email, c.phone
      FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.id = ${body.dealId}::uuid AND d.owner_id = ${user.id}`;
    if (!rows.length) return fail("Deal not found.", 404);
    const d = rows[0];
    const tier = agreementTier(d.service_type ? String(d.service_type) : null);
    if (!tier) return fail("Set the deal's service to Tier 1 or Tier 2 first. The agreement template covers those two plans.", 400);
    const company = String(d.company || d.title);
    const ws = await loadWorkspace(user.id);
    const today = new Intl.DateTimeFormat("en-US", { timeZone: ws.timezone, month: "long", day: "numeric", year: "numeric" }).format(new Date());
    const content = fillAgreement({
      tier, date: today,
      providerName: ws.legalName, providerAddress: ws.address, providerEmail: ws.contactEmail, signerName: ws.ownerFullName,
      company, ownerName: [d.first_name, d.last_name].filter(Boolean).join(" "), email: d.email ? String(d.email) : "", phone: d.phone ? String(d.phone) : "",
      location: d.location ? String(d.location) : "", setupFee: Number(d.setup_fee), monthlyFee: Number(d.monthly_fee), addon: body.addon === true,
    });
    const saved = await sql`
      INSERT INTO public.research_artifacts (owner_id, contact_id, deal_id, artifact_type, title, content, confidence, status, researched_at)
      VALUES (${user.id}, ${d.contact_id}, ${d.id}, 'agreement', ${("Agreement — " + company).slice(0, 240)}, ${content}, 'high', 'draft', now())
      RETURNING id`;
    await sql`UPDATE public.deals SET contract_status = 'draft', updated_at = now() WHERE id = ${d.id} AND owner_id = ${user.id} AND contract_status = 'none'`;
    return Response.json({ id: saved[0].id, content }, { status: 201 });
  } catch (error) {
    console.error("Agreement draft failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not create the agreement.", 500);
  }
}

/** PATCH /api/agreements { id, content } — save the founder's edits. */
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || !UUID.test(body.id)) return fail("Valid agreement id is required.", 400);
    if (typeof body.content !== "string" || !body.content.trim()) return fail("Agreement text can't be empty.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`UPDATE public.research_artifacts SET content = ${body.content.slice(0, 30000)}, status = 'reviewed', updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id} AND artifact_type = 'agreement' RETURNING id`;
    if (!rows.length) return fail("Agreement not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Agreement save failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not save the agreement.", 500);
  }
}
