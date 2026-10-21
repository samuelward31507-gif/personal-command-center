import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stages = new Set(["new", "qualified", "discovery", "proposal", "negotiation", "won", "lost"]);
const services = new Set(["ai_voice_agent", "speed_to_lead", "lead_follow_up", "appointment_booking", "workflow_automation", "custom_ai_implementation"]);
const agreementStatuses = new Set(["pending", "active", "paused", "ended"]);
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  const session = result?.data?.session;
  const user = result?.data?.user;
  if (!session || !user?.id) return null;
  return { id: String(user.id) };
}
function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
function amount(value: unknown) {
  if (value !== undefined && value !== null && typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 && n <= 9999999999.99 ? n : null;
}
function validDate(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : false;
}
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const sql = db();
    const rows = await sql`
      SELECT d.id, d.contact_id, d.title, d.service_type, d.stage, d.setup_fee,
        d.monthly_fee, d.expected_close_date, d.source, d.notes, d.lost_reason, d.agreement_status, d.signed_at, d.effective_at, d.ended_at, d.conversion_completed_at,
        d.created_at, d.updated_at, trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, c.company
      FROM public.deals d
      LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.owner_id = ${user.id}
      ORDER BY CASE WHEN d.stage IN ('won','lost') THEN 1 ELSE 0 END,
        d.expected_close_date ASC NULLS LAST, d.updated_at DESC
      LIMIT 1000
    `;
    return Response.json({ deals: rows.map((r: Record<string, unknown>) => ({
      id: r.id, contactId: r.contact_id, title: r.title, serviceType: r.service_type,
      stage: r.stage, setupFee: Number(r.setup_fee), monthlyFee: Number(r.monthly_fee),
      expectedCloseDate: r.expected_close_date ? (r.expected_close_date instanceof Date ? r.expected_close_date.toISOString().slice(0, 10) : String(r.expected_close_date).slice(0, 10)) : "",
      source: r.source, notes: r.notes, lostReason: r.lost_reason, agreementStatus: r.agreement_status, signedAt: r.signed_at, effectiveAt: r.effective_at, endedAt: r.ended_at, convertedAt: r.conversion_completed_at,
      contactName: String(r.contact_name ?? ""),
      company: r.company, createdAt: r.created_at, updatedAt: r.updated_at,
    })) });
  } catch (error) {
    console.error("CRM deals GET failed", error);
    return jsonError("Unable to load sales pipeline.", 500);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 240) return jsonError("Deal title is required (max 240 characters).", 400);
    const setupFee = amount(body.setupFee);
    const monthlyFee = amount(body.monthlyFee);
    if (setupFee === null || monthlyFee === null) return jsonError("Fees must be non-negative numbers.", 400);
    if (body.stage !== undefined && !stages.has(body.stage)) return jsonError("Invalid deal stage.", 400);
    if (body.serviceType !== undefined && !services.has(body.serviceType)) return jsonError("Invalid service type.", 400);
    const stage = body.stage === undefined ? "new" : body.stage;
    const serviceType = body.serviceType === undefined ? "custom_ai_implementation" : body.serviceType;
    const contactId = typeof body.contactId === "string" && body.contactId ? body.contactId : null;
    if (contactId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contactId)) return jsonError("Invalid contact id.", 400);
    const sql = db();
    if (contactId) {
      const owned = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!owned.length) return jsonError("Contact not found.", 404);
    }
    const closeDate = validDate(body.expectedCloseDate);
    if (closeDate === false) return jsonError("Expected close date must use a valid YYYY-MM-DD date.", 400);
    const rows = await sql`
      INSERT INTO public.deals (owner_id, contact_id, title, service_type, stage, setup_fee, monthly_fee, expected_close_date, source, notes, lost_reason, agreement_status, signed_at, effective_at)
      VALUES (${user.id}, ${contactId}::uuid, ${title}, ${serviceType}, ${stage}, ${setupFee}, ${monthlyFee}, ${closeDate}::date,
        ${String(body.source ?? "").slice(0, 200)}, ${String(body.notes ?? "").slice(0, 10000)}, ${String(body.lostReason ?? "").slice(0, 1000)},
        ${stage === "won" ? "active" : "pending"}, ${stage === "won" ? new Date().toISOString() : null}::timestamptz, ${stage === "won" ? new Date().toISOString().slice(0, 10) : null}::date)
      RETURNING id
    `;
    return Response.json({ id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("CRM deals POST failed", error);
    return jsonError("Unable to create deal.", 500);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return jsonError("Valid deal id is required.", 400);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 240) return jsonError("Deal title is required (max 240 characters).", 400);
    const setupFee = amount(body.setupFee);
    const monthlyFee = amount(body.monthlyFee);
    if (setupFee === null || monthlyFee === null) return jsonError("Fees must be non-negative numbers.", 400);
    if (!stages.has(body.stage)) return jsonError("Invalid deal stage.", 400);
    if (!services.has(body.serviceType)) return jsonError("Invalid service type.", 400);
    const contactId = typeof body.contactId === "string" && body.contactId ? body.contactId : null;
    if (contactId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contactId)) return jsonError("Invalid contact id.", 400);
    const sql = db();
    if (contactId) {
      const owned = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${user.id} LIMIT 1`;
      if (!owned.length) return jsonError("Contact not found.", 404);
    }
    const closeDate = validDate(body.expectedCloseDate);
    if (closeDate === false) return jsonError("Expected close date must be a valid YYYY-MM-DD date.", 400);
    if (body.agreementStatus !== undefined && !agreementStatuses.has(body.agreementStatus)) return jsonError("Invalid agreement status.", 400);
    const endedAt = validDate(body.endedAt);
    if (endedAt === false) return jsonError("Agreement end date must use a valid YYYY-MM-DD date.", 400);
    const rows = await sql`
      UPDATE public.deals SET contact_id = ${contactId}::uuid, title = ${title},
        service_type = ${body.serviceType}, stage = ${body.stage}, setup_fee = ${setupFee},
        monthly_fee = ${monthlyFee}, expected_close_date = ${closeDate}::date,
        source = ${String(body.source ?? "").slice(0, 200)}, notes = ${String(body.notes ?? "").slice(0, 10000)},
        lost_reason = ${String(body.lostReason ?? "").slice(0, 1000)},
        agreement_status = CASE
          WHEN ${body.agreementStatus ?? null}::text IS NOT NULL THEN ${body.agreementStatus ?? null}
          WHEN ${body.stage} = 'won' AND stage <> 'won' THEN 'active'
          ELSE agreement_status END,
        signed_at = CASE WHEN ${body.stage} = 'won' THEN COALESCE(signed_at, now()) ELSE signed_at END,
        effective_at = CASE WHEN ${body.stage} = 'won' THEN COALESCE(effective_at, CURRENT_DATE) ELSE effective_at END,
        ended_at = CASE WHEN ${body.agreementStatus ?? null} = 'ended' THEN COALESCE(${endedAt}::date, CURRENT_DATE)
          WHEN ${body.agreementStatus ?? null} = 'active' THEN NULL ELSE ended_at END,
        updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id} RETURNING id
    `;
    if (!rows.length) return jsonError("Deal not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("CRM deals PATCH failed", error);
    return jsonError("Unable to update deal.", 500);
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return jsonError("Valid deal id is required.", 400);
    const sql = db();
    const rows = await sql`DELETE FROM public.deals WHERE id = ${body.id}::uuid AND owner_id = ${user.id} RETURNING id`;
    if (!rows.length) return jsonError("Deal not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("CRM deals DELETE failed", error);
    return jsonError("Unable to delete deal.", 500);
  }
}
