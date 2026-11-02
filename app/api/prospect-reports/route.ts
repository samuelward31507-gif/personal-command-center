import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { newSigningToken } from "@/lib/esign";
import { readInputs, validateReport } from "@/lib/prospect-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const origin = (request: Request) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(request.url).origin;

function view(r: Record<string, unknown>, base: string) {
  const trade = String(r.trade);
  return {
    id: String(r.id), contactId: r.contact_id ? String(r.contact_id) : null, company: String(r.company), trade,
    inputs: readInputs(r.inputs, trade), findings: Array.isArray(r.findings) ? r.findings.map(String) : [], note: String(r.note ?? ""),
    viewCount: Number(r.view_count ?? 0), lastViewedAt: iso(r.last_viewed_at), createdAt: iso(r.created_at),
    link: `${base}/report/${r.token}`,
  };
}

/** GET /api/prospect-reports?contactId=… — this contact's reports, newest first, with how often each was opened. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const contactId = new URL(request.url).searchParams.get("contactId") ?? "";
  if (!UUID.test(contactId)) return reply({ reports: [] });
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM public.prospect_reports WHERE owner_id = ${user.id} AND contact_id = ${contactId}::uuid ORDER BY created_at DESC LIMIT 20` as Record<string, unknown>[];
  return reply({ reports: rows.map(r => view(r, origin(request))) });
}

/** POST /api/prospect-reports — create a report (or update one with `id`). Nothing is sent: you copy the link. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clean = validateReport(body);
  if ("error" in clean) return reply(clean, 400);
  const sql = neon(process.env.DATABASE_URL);
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  const contactId = typeof body?.contactId === "string" && UUID.test(body.contactId) ? body.contactId : null;
  try {
    if (contactId) {
      const own = await sql`SELECT 1 FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!own.length) return reply({ error: "Contact not found." }, 404);
    }
    const rows = id
      ? await sql`UPDATE public.prospect_reports SET company = ${clean.company}, trade = ${clean.trade}, inputs = ${JSON.stringify(clean.inputs)}::jsonb,
          findings = ${JSON.stringify(clean.findings)}::jsonb, note = ${clean.note}, updated_at = now()
          WHERE id = ${id}::uuid AND owner_id = ${user.id} RETURNING *`
      : await sql`INSERT INTO public.prospect_reports (owner_id, contact_id, token, company, trade, inputs, findings, note)
          VALUES (${user.id}, ${contactId}, ${newSigningToken()}, ${clean.company}, ${clean.trade}, ${JSON.stringify(clean.inputs)}::jsonb, ${JSON.stringify(clean.findings)}::jsonb, ${clean.note})
          RETURNING *`;
    if (!rows.length) return reply({ error: "Report not found." }, 404);
    if (!id && contactId) {
      await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
        VALUES (${user.id}, ${contactId}::uuid, 'note', 'note', 'other', ${"Made a prospect report for " + clean.company + "."})`;
    }
    return reply({ report: view(rows[0] as Record<string, unknown>, origin(request)) });
  } catch (error) {
    console.error("Prospect report save failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't save the report. Try again." }, 500);
  }
}
