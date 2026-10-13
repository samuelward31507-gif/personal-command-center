import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const types = new Set(["meeting", "call", "focus", "personal", "deadline", "other"]);
const statuses = new Set(["scheduled", "completed", "cancelled"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validTimestamp(value: unknown): string | null | false {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return false;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? false : date.toISOString();
}
function validRange(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
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
const selectEvents = `
  SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.all_day, e.event_type, e.status,
    e.contact_id, e.deal_id, e.created_at, e.updated_at,
    trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, d.title AS deal_title
  FROM public.calendar_events e
  LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
  LEFT JOIN public.deals d ON d.id = e.deal_id AND d.owner_id = e.owner_id
`;
function mapEvent(r: Record<string, unknown>) {
  return { id:r.id, title:r.title, description:r.description, startsAt:r.starts_at, endsAt:r.ends_at, allDay:r.all_day,
    type:r.event_type, status:r.status, contactId:r.contact_id, dealId:r.deal_id,
    contactName:r.contact_name ?? "", dealTitle:r.deal_title ?? "", createdAt:r.created_at, updatedAt:r.updated_at };
}
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const params = new URL(request.url).searchParams;
    const from = validRange(params.get("from"));
    const to = validRange(params.get("to"));
    if (!from || !to || to <= from) return fail("A valid calendar date range is required.", 400);
    const sql = db();
    const rows = await sql`
      SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.all_day, e.event_type, e.status,
        e.contact_id, e.deal_id, e.created_at, e.updated_at,
        trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, d.title AS deal_title
      FROM public.calendar_events e
      LEFT JOIN public.contacts c ON c.id = e.contact_id AND c.owner_id = e.owner_id
      LEFT JOIN public.deals d ON d.id = e.deal_id AND d.owner_id = e.owner_id
      WHERE e.owner_id = ${user.id} AND e.starts_at < ${to}::date
        AND e.ends_at >= ${from}::date
      ORDER BY e.starts_at ASC LIMIT 1000
    `;
    return Response.json({ events: rows.map((r: Record<string, unknown>) => mapEvent(r)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Calendar GET failed", e);
    return fail("Unable to load calendar events.", 500);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    const title = clean(body.title, 240);
    if (!title) return fail("Event title is required (max 240 characters).", 400);
    const description = clean(body.description, 5000);
    const startsAt = validTimestamp(body.startsAt);
    const endsAt = validTimestamp(body.endsAt);
    if (!startsAt || !endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return fail("A valid start and end time are required.", 400);
    const type = body.type === undefined ? "meeting" : body.type;
    const status = body.status === undefined ? "scheduled" : body.status;
    if (typeof type !== "string" || !types.has(type)) return fail("Invalid event type.", 400);
    if (typeof status !== "string" || !statuses.has(status)) return fail("Invalid event status.", 400);
    if (body.allDay !== undefined && typeof body.allDay !== "boolean") return fail("Invalid all-day setting.", 400);
    const contactId = body.contactId == null || body.contactId === "" ? null : typeof body.contactId === "string" && uuid.test(body.contactId) ? body.contactId : false;
    const dealId = body.dealId == null || body.dealId === "" ? null : typeof body.dealId === "string" && uuid.test(body.dealId) ? body.dealId : false;
    if (contactId === false || dealId === false) return fail("Invalid linked record.", 400);
    const sql = db();
    const linkError = await validateLinks(sql, user.id, contactId, dealId);
    if (linkError) return fail(linkError, 404);
    const rows = await sql`
      INSERT INTO public.calendar_events (owner_id,title,description,starts_at,ends_at,all_day,event_type,status,contact_id,deal_id)
      VALUES (${user.id},${title},${description},${startsAt}::timestamptz,${endsAt}::timestamptz,${body.allDay === true},${type},${status},${contactId}::uuid,${dealId}::uuid)
      RETURNING id
    `;
    return Response.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    console.error("Calendar POST failed", e);
    return fail("Unable to create calendar event.", 500);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !uuid.test(body.id)) return fail("Valid event id is required.", 400);
    const sql = db();
    const existing = await sql`SELECT * FROM public.calendar_events WHERE id = ${body.id}::uuid AND owner_id = ${user.id} LIMIT 1`;
    if (!existing.length) return fail("Event not found.", 404);
    const old = existing[0] as Record<string, unknown>;
    const title = body.title === undefined ? String(old.title) : clean(body.title, 240);
    if (!title) return fail("Event title is required.", 400);
    const description = body.description === undefined ? String(old.description ?? "") : clean(body.description, 5000);
    const startsAt = body.startsAt === undefined ? new Date(String(old.starts_at)).toISOString() : validTimestamp(body.startsAt);
    const endsAt = body.endsAt === undefined ? new Date(String(old.ends_at)).toISOString() : validTimestamp(body.endsAt);
    if (!startsAt || !endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return fail("A valid start and end time are required.", 400);
    const type = body.type === undefined ? String(old.event_type) : body.type;
    const status = body.status === undefined ? String(old.status) : body.status;
    if (typeof type !== "string" || !types.has(type)) return fail("Invalid event type.", 400);
    if (typeof status !== "string" || !statuses.has(status)) return fail("Invalid event status.", 400);
    const allDay = body.allDay === undefined ? Boolean(old.all_day) : body.allDay;
    if (typeof allDay !== "boolean") return fail("Invalid all-day setting.", 400);
    const contactId = body.contactId === undefined ? (old.contact_id ? String(old.contact_id) : null) : body.contactId == null || body.contactId === "" ? null : typeof body.contactId === "string" && uuid.test(body.contactId) ? body.contactId : false;
    const dealId = body.dealId === undefined ? (old.deal_id ? String(old.deal_id) : null) : body.dealId == null || body.dealId === "" ? null : typeof body.dealId === "string" && uuid.test(body.dealId) ? body.dealId : false;
    if (contactId === false || dealId === false) return fail("Invalid linked record.", 400);
    const linkError = await validateLinks(sql, user.id, contactId, dealId);
    if (linkError) return fail(linkError, 404);
    await sql`UPDATE public.calendar_events SET title=${title},description=${description},starts_at=${startsAt}::timestamptz,
      ends_at=${endsAt}::timestamptz,all_day=${allDay},event_type=${type},status=${status},
      contact_id=${contactId}::uuid,deal_id=${dealId}::uuid,updated_at=now()
      WHERE id=${body.id}::uuid AND owner_id=${user.id}`;
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Calendar PATCH failed", e);
    return fail("Unable to update calendar event.", 500);
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !uuid.test(body.id)) return fail("Valid event id is required.", 400);
    const sql = db();
    const rows = await sql`DELETE FROM public.calendar_events WHERE id=${body.id}::uuid AND owner_id=${user.id} RETURNING id`;
    if (!rows.length) return fail("Event not found.", 404);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Calendar DELETE failed", e);
    return fail("Unable to delete calendar event.", 500);
  }
}
