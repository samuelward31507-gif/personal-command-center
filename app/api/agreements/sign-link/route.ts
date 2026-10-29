import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { countBlanks } from "@/lib/deal-workspace";
import { newSigningToken, hashToken, contentHash } from "@/lib/esign";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
function twoBusinessDays(tz: string) {
  const d = new Date(); let added = 0;
  while (added < 2) { d.setDate(d.getDate() + 1); const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d); if (wd !== "Sat" && wd !== "Sun") added++; }
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** GET /api/agreements/sign-link?dealId=… — the latest signing request for a deal (never the token). */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const dealId = new URL(request.url).searchParams.get("dealId") ?? "";
  if (!UUID.test(dealId)) return fail("Valid deal id is required.", 400);
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT status, created_at, expires_at, signed_at, signer_name, signer_title, signer_email FROM public.signing_requests
      WHERE owner_id = ${user.id} AND deal_id = ${dealId}::uuid ORDER BY created_at DESC LIMIT 1`;
    const r = rows[0];
    return Response.json({ request: r ? { status: r.status, createdAt: new Date(String(r.created_at)).toISOString(), expiresAt: new Date(String(r.expires_at)).toISOString(),
      signedAt: r.signed_at ? new Date(String(r.signed_at)).toISOString() : null, signerName: r.signer_name, signerTitle: r.signer_title, signerEmail: r.signer_email } : null },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Sign-link GET failed", { name: error instanceof Error ? error.name : typeof error });
    return fail("Could not load the signing status.", 500);
  }
}

/**
 * POST /api/agreements/sign-link { dealId } — create a signing link for the latest agreement draft.
 * Refused while [bracketed] blanks remain. Voids any earlier open link. The link is returned once.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.dealId !== "string" || !UUID.test(body.dealId)) return fail("Valid deal id is required.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const deal = await sql`SELECT id, stage, contract_status FROM public.deals WHERE id = ${body.dealId}::uuid AND owner_id = ${user.id}`;
    if (!deal.length) return fail("Deal not found.", 404);
    if (deal[0].contract_status === "signed" || deal[0].stage === "won" || deal[0].stage === "lost") return fail("This deal is already closed.", 409);
    const ag = await sql`SELECT id, content FROM public.research_artifacts WHERE owner_id = ${user.id} AND deal_id = ${body.dealId}::uuid AND artifact_type = 'agreement' AND status <> 'archived' ORDER BY created_at DESC LIMIT 1`;
    if (!ag.length) return fail("Draft the agreement first.", 400);
    const content = String(ag[0].content);
    const blanks = countBlanks(content);
    if (blanks) return fail(`Fill in the ${blanks} [bracketed] blank${blanks === 1 ? "" : "s"} first. A client should never sign a draft with gaps.`, 400);

    const token = newSigningToken();
    await sql`UPDATE public.signing_requests SET status = 'void' WHERE owner_id = ${user.id} AND deal_id = ${body.dealId}::uuid AND status = 'open'`;
    await sql`INSERT INTO public.signing_requests (owner_id, deal_id, artifact_id, token_hash, content_hash, provider_name, provider_signer)
      VALUES (${user.id}, ${body.dealId}::uuid, ${ag[0].id}::uuid, ${hashToken(token)}, ${contentHash(content)},
        ${process.env.CINDER_LEGAL_NAME?.trim() || ""}, ${process.env.CINDER_SIGNER_NAME?.trim() || "Samuel Ward"})`;
    const tz = process.env.CINDER_TIMEZONE?.trim() || "America/Denver";
    await sql`UPDATE public.deals SET contract_status = 'sent', contract_sent_at = COALESCE(contract_sent_at, now()),
      next_step = 'Follow up on the agreement', next_step_at = ${twoBusinessDays(tz)}::date, updated_at = now()
      WHERE id = ${body.dealId}::uuid AND owner_id = ${user.id}`;
    const origin = new URL(request.url).origin;
    return Response.json({ url: `${origin}/sign/${token}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Sign-link create failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not create the signing link.", 500);
  }
}
