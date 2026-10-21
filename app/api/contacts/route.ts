import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactStatus = "Lead" | "Contact" | "Customer" | "Partner";
const allowedStatuses = new Set<ContactStatus>(["Lead", "Contact", "Customer", "Partner"]);

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

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validFollowUp(value: unknown): string | null | false {
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
      SELECT c.id, c.first_name, c.last_name, c.company, c.role, c.email, c.phone, c.status,
             c.source, c.notes, c.follow_up_at, c.website, c.location, c.sms_consent, c.sms_consent_at, c.sms_consent_source, c.created_at, c.updated_at,
             (SELECT MAX(a.occurred_at) FROM public.contact_activities a
              WHERE a.owner_id = c.owner_id AND a.contact_id = c.id) AS last_contact_at
      FROM public.contacts c
      WHERE c.owner_id = ${user.id}
      ORDER BY c.follow_up_at ASC NULLS LAST, c.updated_at DESC
    `;
    return Response.json({ contacts: rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      company: row.company,
      role: row.role,
      email: row.email,
      phone: row.phone,
      website: row.website,
      location: row.location,
      status: String(row.status).charAt(0).toUpperCase() + String(row.status).slice(1),
      source: row.source,
      nextFollowUp: row.follow_up_at ? (row.follow_up_at instanceof Date ? row.follow_up_at.toISOString().slice(0, 10) : String(row.follow_up_at).slice(0, 10)) : "",
      lastContact: row.last_contact_at ? new Date(String(row.last_contact_at)).toISOString() : "",
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) });
  } catch (error) {
    console.error("CRM contacts GET failed", error);
    return jsonError("Unable to load contacts.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError("Contact name is required.", 400);
    if (name.length > 200) return jsonError("Contact name is too long.", 400);
    const followUp = validFollowUp(body.nextFollowUp);
    if (followUp === false) return jsonError("Follow-up date must be a valid calendar date.", 400);
    if (body.status !== undefined && !allowedStatuses.has(body.status)) return jsonError("Invalid contact status.", 400);
    const status = body.status === undefined ? "lead" : String(body.status).toLowerCase();
    const [firstName, ...lastParts] = name.split(/\s+/);
    const lastName = lastParts.join(" ");
    const sql = db();
    const rows = await sql`
      INSERT INTO public.contacts
        (owner_id, first_name, last_name, company, role, email, phone, status, source, notes, follow_up_at, website, location, sms_consent, sms_consent_at, sms_consent_source)
      VALUES
        (${user.id}, ${firstName}, ${lastName}, ${String(body.company ?? "").slice(0, 300)},
         ${String(body.role ?? "").slice(0, 200)}, ${String(body.email ?? "").slice(0, 320)},
         ${String(body.phone ?? "").slice(0, 100)}, ${status}, ${String(body.source ?? "").slice(0, 200)},
         ${String(body.notes ?? "").slice(0, 10000)}, ${followUp},
         ${String(body.website ?? "").slice(0, 500)}, ${String(body.location ?? "").slice(0, 300)}, ${body.smsConsent === true}, ${body.smsConsent === true ? new Date().toISOString() : null}::timestamptz, ${body.smsConsent === true ? String(body.smsConsentSource ?? "user_confirmed").slice(0, 200) : ""})
      RETURNING id
    `;
    return Response.json({ id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("CRM contacts POST failed", error);
    return jsonError("Unable to save contact.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    if (!validUuid(body.id)) return jsonError("A valid contact id is required.", 400);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError("Contact name is required.", 400);
    if (name.length > 200) return jsonError("Contact name is too long.", 400);
    const followUp = validFollowUp(body.nextFollowUp);
    if (followUp === false) return jsonError("Follow-up date must be a valid calendar date.", 400);
    if (!allowedStatuses.has(body.status)) return jsonError("Invalid contact status.", 400);
    const status = String(body.status).toLowerCase();
    const [firstName, ...lastParts] = name.split(/\s+/);
    const sql = db();
    const rows = await sql`
      UPDATE public.contacts SET
        first_name = ${firstName}, last_name = ${lastParts.join(" ")},
        company = ${String(body.company ?? "").slice(0, 300)},
        role = ${String(body.role ?? "").slice(0, 200)},
        email = ${String(body.email ?? "").slice(0, 320)},
        phone = ${String(body.phone ?? "").slice(0, 100)},
        status = ${status}, source = ${String(body.source ?? "").slice(0, 200)},
        notes = ${String(body.notes ?? "").slice(0, 10000)},
        website = ${String(body.website ?? "").slice(0, 500)},
        location = ${String(body.location ?? "").slice(0, 300)},
        follow_up_at = ${followUp}, updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id}
      RETURNING id
    `;
    if (!rows.length) return jsonError("Contact not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("CRM contacts PATCH failed", error);
    return jsonError("Unable to update contact.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!validUuid(id)) return jsonError("A valid contact id is required.", 400);
    const sql = db();
    const rows = await sql`
      DELETE FROM public.contacts WHERE id = ${id}::uuid AND owner_id = ${user.id} RETURNING id
    `;
    if (!rows.length) return jsonError("Contact not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("CRM contacts DELETE failed", error);
    return jsonError("Unable to delete contact.", 500);
  }
}
