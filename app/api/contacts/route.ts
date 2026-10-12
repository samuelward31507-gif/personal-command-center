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

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const sql = db();
    const rows = await sql`
      SELECT id, first_name, last_name, company, role, email, phone, status,
             source, notes, follow_up_at, created_at, updated_at
      FROM public.contacts
      WHERE owner_id = ${user.id}
      ORDER BY follow_up_at ASC NULLS LAST, updated_at DESC
    `;
    return Response.json({ contacts: rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      company: row.company,
      role: row.role,
      email: row.email,
      phone: row.phone,
      status: String(row.status).charAt(0).toUpperCase() + String(row.status).slice(1),
      source: row.source,
      nextFollowUp: row.follow_up_at ? String(row.follow_up_at).slice(0, 10) : "",
      lastContact: "",
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
    const status = allowedStatuses.has(body.status) ? String(body.status).toLowerCase() : "lead";
    const [firstName, ...lastParts] = name.split(/\s+/);
    const lastName = lastParts.join(" ");
    const sql = db();
    const rows = await sql`
      INSERT INTO public.contacts
        (owner_id, first_name, last_name, company, role, email, phone, status, source, notes, follow_up_at)
      VALUES
        (${user.id}, ${firstName}, ${lastName}, ${String(body.company ?? "").slice(0, 300)},
         ${String(body.role ?? "").slice(0, 200)}, ${String(body.email ?? "").slice(0, 320)},
         ${String(body.phone ?? "").slice(0, 100)}, ${status}, ${String(body.source ?? "").slice(0, 200)},
         ${String(body.notes ?? "").slice(0, 10000)}, ${body.nextFollowUp || null})
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
    if (typeof body.id !== "string" || !body.id) return jsonError("Contact id is required.", 400);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError("Contact name is required.", 400);
    const status = allowedStatuses.has(body.status) ? String(body.status).toLowerCase() : "lead";
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
        follow_up_at = ${body.nextFollowUp || null}, updated_at = now()
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
    if (!id) return jsonError("Contact id is required.", 400);
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
