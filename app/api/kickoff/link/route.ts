import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { createKickoffLink, publicOrigin } from "@/lib/kickoff-link";
import { fieldsFor, maskEin, type KickoffTier } from "@/lib/kickoff";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/kickoff/link?dealId= — the latest kickoff request and the client's answers (EIN masked unless ?reveal=ein). */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const url = new URL(request.url); const dealId = url.searchParams.get("dealId") ?? "";
    if (!UUID.test(dealId)) return fail("Valid deal id is required.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT id, tier, status, answers, created_at, submitted_at FROM public.kickoff_requests
      WHERE owner_id = ${user.id} AND deal_id = ${dealId}::uuid AND status <> 'void' ORDER BY created_at DESC LIMIT 1`;
    const r = rows[0];
    if (!r) return Response.json({ request: null }, { headers: { "Cache-Control": "no-store" } });
    const tier = String(r.tier) as KickoffTier;
    const answers = (r.answers ?? {}) as Record<string, string>;
    // ?file=<field>: download what the client uploaded (EIN letter, quote or customer list).
    const want = url.searchParams.get("file");
    if (want) {
      const f = await sql`SELECT filename, mime, data FROM public.kickoff_files WHERE kickoff_id = ${String(r.id)}::uuid AND owner_id = ${user.id} AND field = ${want}
        ORDER BY created_at DESC LIMIT 1`;
      if (!f.length) return fail("No file uploaded for that item.", 404);
      const raw = f[0].data as unknown;
      const bytes = typeof raw === "string" ? Buffer.from(raw.replace(/^\\x/, ""), "hex") : Buffer.from(raw as Uint8Array);
      const name = String(f[0].filename).replace(/["\r\n]/g, "");
      return new Response(bytes, { headers: { "Content-Type": String(f[0].mime), "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const files = await sql`SELECT DISTINCT ON (field) field, filename, size FROM public.kickoff_files WHERE kickoff_id = ${String(r.id)}::uuid AND owner_id = ${user.id}
      ORDER BY field, created_at DESC`;
    const reveal = url.searchParams.get("reveal") === "ein";
    const items = fieldsFor(tier).filter(f => answers[f.key] && f.kind !== "file").map(f => ({ label: f.label, value: f.key === "ein" && !reveal ? maskEin(answers[f.key]) : answers[f.key] }));
    const labelOf = (k: string) => fieldsFor(tier).find(f => f.key === k)?.label ?? k;
    return Response.json({ request: { tier, status: r.status, files: files.map(f => ({ field: String(f.field), label: labelOf(String(f.field)), name: String(f.filename), size: Number(f.size) })), createdAt: new Date(String(r.created_at)).toISOString(), submittedAt: r.submitted_at ? new Date(String(r.submitted_at)).toISOString() : null, items } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Kickoff link GET failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not load the kickoff checklist.", 500);
  }
}

/** POST /api/kickoff/link { dealId } — a fresh kickoff link (older open links stop working). */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.dealId !== "string" || !UUID.test(body.dealId)) return fail("Valid deal id is required.", 400);
    const sql = neon(process.env.DATABASE_URL);
    const won = await sql`SELECT stage FROM public.deals WHERE id = ${body.dealId}::uuid AND owner_id = ${user.id}`;
    if (!won.length) return fail("Deal not found.", 404);
    if (won[0].stage !== "won") return fail("The kickoff checklist is for signed clients. Get the agreement signed first.", 400);
    const url = await createKickoffLink(sql, user.id, body.dealId, publicOrigin(request.url));
    if (!url) return fail("The kickoff checklist covers Tier 1 and Tier 2 deals. Set the deal's service first.", 400);
    return Response.json({ url }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Kickoff link POST failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not create the kickoff link.", 500);
  }
}
