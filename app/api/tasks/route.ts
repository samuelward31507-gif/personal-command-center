import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses = new Set(["todo", "in_progress", "blocked", "done", "cancelled"]);
const priorities = new Set(["low", "medium", "high", "urgent"]);
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  const session = result?.data?.session;
  const user = result?.data?.user;
  return session && user?.id ? { id: String(user.id) } : null;
}
function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function nullableUuid(value: unknown): string | null | false {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : false;
}
function validDue(value: unknown): string | null | false {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return false;
  const zonedDateTime = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/;
  if (zonedDateTime.test(value)) {
    const day = value.slice(0, 10);
    const parsedDay = new Date(day + "T00:00:00.000Z");
    if (Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day) return false;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? false : new Date(timestamp).toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}(T(?:[01]\d|2[0-3]):[0-5]\d)?$/.test(value)) return false;
  const day = value.slice(0, 10);
  const parsedDay = new Date(day + "T00:00:00.000Z");
  if (Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day) return false;
  return value.length === 16 ? value + ":00" : value;
}
async function validateLinks(sql: ReturnType<typeof db>, ownerId: string, contactId: string | null, dealId: string | null) {
  if (contactId) {
    const rows = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${ownerId} LIMIT 1`;
    if (!rows.length) return "Contact not found in your workspace.";
  }
  if (dealId) {
    const rows = await sql`SELECT id FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${ownerId} LIMIT 1`;
    if (!rows.length) return "Deal not found in your workspace.";
  }
  return null;
}
function mapTask(r: Record<string, unknown>) {
  return {
    id: r.id, title: r.title, description: r.description, status: r.status, priority: r.priority,
    dueAt: r.due_at, contactId: r.contact_id, dealId: r.deal_id,
    contactName: r.contact_name ?? "", dealTitle: r.deal_title ?? "",
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const sql = db();
    const rows = await sql`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_at, t.contact_id, t.deal_id,
        t.created_at, t.updated_at,
        trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name,
        d.title AS deal_title
      FROM public.tasks t
      LEFT JOIN public.contacts c ON c.id = t.contact_id AND c.owner_id = t.owner_id
      LEFT JOIN public.deals d ON d.id = t.deal_id AND d.owner_id = t.owner_id
      WHERE t.owner_id = ${user.id}
      ORDER BY CASE WHEN t.status IN ('done','cancelled') THEN 1 ELSE 0 END,
        CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.due_at ASC NULLS LAST, t.updated_at DESC
      LIMIT 1000
    `;
    return Response.json({ tasks: rows.map((r: Record<string, unknown>) => mapTask(r)) });
  } catch (error) {
    console.error("Tasks GET failed", error);
    return jsonError("Unable to load tasks.", 500);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const title = cleanText(body.title, 240);
    if (!title) return jsonError("Task title is required (max 240 characters).", 400);
    const description = cleanText(body.description, 5000);
    if (body.status !== undefined && !statuses.has(body.status)) return jsonError("Invalid task status.", 400);
    if (body.priority !== undefined && !priorities.has(body.priority)) return jsonError("Invalid task priority.", 400);
    const status = body.status === undefined ? "todo" : body.status;
    const priority = body.priority === undefined ? "medium" : body.priority;
    const dueAt = validDue(body.dueAt);
    const contactId = nullableUuid(body.contactId);
    const dealId = nullableUuid(body.dealId);
    if (dueAt === false) return jsonError("Invalid due date.", 400);
    if (contactId === false || dealId === false) return jsonError("Invalid linked record.", 400);
    const sql = db();
    const linkError = await validateLinks(sql, user.id, contactId, dealId);
    if (linkError) return jsonError(linkError, 404);
    const rows = await sql`
      INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id, deal_id)
      VALUES (${user.id}, ${title}, ${description}, ${status}, ${priority}, ${dueAt}::timestamptz, ${contactId}::uuid, ${dealId}::uuid)
      RETURNING id
    `;
    return Response.json({ id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("Tasks POST failed", error);
    return jsonError("Unable to create task.", 500);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return jsonError("Valid task id is required.", 400);
    const sql = db();
    const existing = await sql`SELECT id, title, description, status, priority, due_at, contact_id, deal_id FROM public.tasks WHERE id = ${body.id}::uuid AND owner_id = ${user.id} LIMIT 1`;
    if (!existing.length) return jsonError("Task not found.", 404);
    const old = existing[0] as Record<string, unknown>;
    const title = body.title === undefined ? String(old.title) : cleanText(body.title, 240);
    if (!title) return jsonError("Task title is required (max 240 characters).", 400);
    const description = body.description === undefined ? String(old.description ?? "") : cleanText(body.description, 5000);
    const status = body.status === undefined ? String(old.status) : body.status;
    const priority = body.priority === undefined ? String(old.priority) : body.priority;
    if (!statuses.has(status)) return jsonError("Invalid task status.", 400);
    if (!priorities.has(priority)) return jsonError("Invalid task priority.", 400);
    const dueAt = body.dueAt === undefined ? (old.due_at ? new Date(String(old.due_at)).toISOString() : null) : validDue(body.dueAt);
    const contactId = body.contactId === undefined ? (old.contact_id ? String(old.contact_id) : null) : nullableUuid(body.contactId);
    const dealId = body.dealId === undefined ? (old.deal_id ? String(old.deal_id) : null) : nullableUuid(body.dealId);
    if (dueAt === false) return jsonError("Invalid due date.", 400);
    if (contactId === false || dealId === false) return jsonError("Invalid linked record.", 400);
    const linkError = await validateLinks(sql, user.id, contactId, dealId);
    if (linkError) return jsonError(linkError, 404);
    await sql`
      UPDATE public.tasks SET title = ${title}, description = ${description}, status = ${status},
        priority = ${priority}, due_at = ${dueAt}::timestamptz, contact_id = ${contactId}::uuid,
        deal_id = ${dealId}::uuid, updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id}
    `;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Tasks PATCH failed", error);
    return jsonError("Unable to update task.", 500);
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return jsonError("Valid task id is required.", 400);
    const sql = db();
    const rows = await sql`DELETE FROM public.tasks WHERE id = ${body.id}::uuid AND owner_id = ${user.id} RETURNING id`;
    if (!rows.length) return jsonError("Task not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Tasks DELETE failed", error);
    return jsonError("Unable to delete task.", 500);
  }
}
