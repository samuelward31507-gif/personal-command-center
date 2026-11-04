import { neon } from "@neondatabase/serverless";
import { blankIfPlaceholder } from "@/lib/contact-import";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactStatus = "Lead" | "Contact" | "Customer" | "Partner";
const allowedStatuses = new Set<ContactStatus>(["Lead", "Contact", "Customer", "Partner"]);

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

async function currentUser() {
  const result = await getAllowedSession();
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
             c.source, c.notes, c.follow_up_at, c.website, c.instagram, c.facebook, c.location, c.sms_consent, c.sms_consent_at, c.sms_consent_source, c.created_at, c.updated_at,
             (SELECT MAX(a.occurred_at) FROM public.contact_activities a
              WHERE a.owner_id = c.owner_id AND a.contact_id = c.id) AS last_contact_at,
             lt.occurred_at AS last_touch_at, lt.outcome AS last_touch_outcome, ln.notes AS last_note,
             (SELECT count(*) FROM public.contact_activities a
              WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.outcome IN ('no_answer','voicemail','gatekeeper')
                AND a.occurred_at > COALESCE((SELECT max(b.occurred_at) FROM public.contact_activities b
                  WHERE b.owner_id = c.owner_id AND b.contact_id = c.id AND b.action <> 'note'
                    AND b.outcome NOT IN ('initiated','no_answer','voicemail','gatekeeper','other')), 'epoch'::timestamptz)) AS attempts
      FROM public.contacts c
      LEFT JOIN LATERAL (
        SELECT a.notes FROM public.contact_activities a
        WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND coalesce(a.notes, '') <> ''
          AND a.notes NOT LIKE 'Call launched from%' AND a.notes NOT LIKE 'Outbound call launched%'
        ORDER BY a.occurred_at DESC LIMIT 1
      ) ln ON true
      LEFT JOIN LATERAL (
        SELECT a.occurred_at, a.outcome FROM public.contact_activities a
        WHERE a.owner_id = c.owner_id AND a.contact_id = c.id
          AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated'
        ORDER BY a.occurred_at DESC LIMIT 1
      ) lt ON true
      WHERE c.owner_id = ${user.id}
      ORDER BY c.follow_up_at ASC NULLS LAST, c.updated_at DESC
    `;
    return Response.json({ contacts: rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      company: row.company,
      role: row.role,
      email: blankIfPlaceholder(row.email),
      phone: blankIfPlaceholder(row.phone),
      website: blankIfPlaceholder(row.website),
      instagram: row.instagram,
      facebook: row.facebook,
      location: blankIfPlaceholder(row.location),
      smsConsent: row.sms_consent === true,
      smsConsentAt: row.sms_consent_at ?? null,
      smsConsentSource: row.sms_consent_source ?? "",
      status: String(row.status).charAt(0).toUpperCase() + String(row.status).slice(1),
      source: row.source,
      nextFollowUp: row.follow_up_at ? (row.follow_up_at instanceof Date ? row.follow_up_at.toISOString().slice(0, 10) : String(row.follow_up_at).slice(0, 10)) : "",
      lastContact: row.last_contact_at ? new Date(String(row.last_contact_at)).toISOString() : "",
      lastTouchAt: row.last_touch_at ? new Date(String(row.last_touch_at)).toISOString() : "",
      lastTouchOutcome: row.last_touch_outcome ? String(row.last_touch_outcome) : "",
      lastNote: row.last_note ? String(row.last_note).replace(/^Call launched from[^\n]*\n?/, "").slice(0, 400) : "",
      attempts: Number(row.attempts ?? 0),
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
    // Duplicate check: same email, or same phone number (last 10 digits). The client can confirm a separate record.
    if (body.allowDuplicate !== true) {
      const email = String(body.email ?? "").trim().toLowerCase();
      const digits = String(body.phone ?? "").replace(/\D/g, "").slice(-10);
      if (email || digits.length === 10) {
        const dup = await sql`SELECT id, trim(concat_ws(' ', first_name, last_name)) AS name,
            CASE WHEN ${email} <> '' AND lower(trim(email)) = ${email} THEN 'email' ELSE 'phone number' END AS matched
          FROM public.contacts WHERE owner_id = ${user.id} AND (
            (${email} <> '' AND lower(trim(email)) = ${email}) OR
            (${digits.length === 10} AND right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = ${digits}))
          ORDER BY updated_at DESC LIMIT 1`;
        if (dup.length) return Response.json({ error: `${dup[0].name || "This person"} is already in Cinder.`, duplicateId: dup[0].id, duplicateName: dup[0].name, matchedOn: dup[0].matched }, { status: 409 });
      }
    }
    const rows = await sql`
      INSERT INTO public.contacts
        (owner_id, first_name, last_name, company, role, email, phone, status, source, notes, follow_up_at, website, instagram, facebook, location, sms_consent, sms_consent_at, sms_consent_source)
      VALUES
        (${user.id}, ${firstName}, ${lastName}, ${String(body.company ?? "").slice(0, 300)},
         ${String(body.role ?? "").slice(0, 200)}, ${String(body.email ?? "").slice(0, 320)},
         ${String(body.phone ?? "").slice(0, 100)}, ${status}, ${String(body.source ?? "").slice(0, 200)},
         ${String(body.notes ?? "").slice(0, 10000)}, ${followUp},
         ${String(body.website ?? "").slice(0, 500)}, ${String(body.instagram ?? "").slice(0, 500)}, ${String(body.facebook ?? "").slice(0, 500)}, ${String(body.location ?? "").slice(0, 300)}, ${body.smsConsent === true}, ${body.smsConsent === true ? new Date().toISOString() : null}::timestamptz, ${body.smsConsent === true ? String(body.smsConsentSource ?? "user_confirmed").slice(0, 200) : ""})
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
        instagram = ${String(body.instagram ?? "").slice(0, 500)},
        facebook = ${String(body.facebook ?? "").slice(0, 500)},
        location = ${String(body.location ?? "").slice(0, 300)},
        sms_consent = CASE WHEN ${typeof body.smsConsent === "boolean"} THEN ${body.smsConsent === true} ELSE sms_consent END,
        sms_consent_at = CASE WHEN ${body.smsConsent === true} THEN now() WHEN ${body.smsConsent === false} THEN NULL ELSE sms_consent_at END,
        sms_consent_source = CASE WHEN ${body.smsConsent === true} THEN ${String(body.smsConsentSource ?? "user_confirmed").slice(0, 200)} WHEN ${body.smsConsent === false} THEN '' ELSE sms_consent_source END,
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
