import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types = new Set(["prospect_research", "call_brief", "audit_prep", "meeting_brief", "follow_up_draft"]);
const statuses = new Set(["draft", "reviewed", "archived"]);
const confidences = new Set(["low", "medium", "high"]);
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
const fail = (message: string, status: number) => Response.json({ error: message }, { status });
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function optionalUuid(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" && uuid.test(value) ? value : false;
}
function stringList(value: unknown, maxItems: number, maxLength: number): string[] | false {
  if (!Array.isArray(value) || value.length > maxItems || value.some(item => typeof item !== "string" || !item.trim() || item.trim().length > maxLength)) return false;
  return [...new Set(value.map(item => String(item).trim()))];
}
function urlList(value: unknown): string[] | false {
  const list = stringList(value, 30, 2000);
  if (list === false) return false;
  for (const item of list) {
    try {
      const url = new URL(item);
      if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    } catch { return false; }
  }
  return list;
}
async function validateLinks(sql: ReturnType<typeof db>, ownerId: string, contactId: string | null, dealId: string | null, eventId: string | null) {
  if (contactId) {
    const rows = await sql`SELECT id FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${ownerId} LIMIT 1`;
    if (!rows.length) return "Contact not found in your workspace.";
  }
  if (dealId) {
    const rows = await sql`SELECT id FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${ownerId} LIMIT 1`;
    if (!rows.length) return "Deal not found in your workspace.";
  }
  if (eventId) {
    const rows = await sql`SELECT id FROM public.calendar_events WHERE id = ${eventId}::uuid AND owner_id = ${ownerId} LIMIT 1`;
    if (!rows.length) return "Calendar event not found in your workspace.";
  }
  return null;
}
function mapRow(row: Record<string, unknown>) {
  const array = (value: unknown) => Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
  return {
    id: String(row.id), contactId: row.contact_id ? String(row.contact_id) : null,
    dealId: row.deal_id ? String(row.deal_id) : null, calendarEventId: row.calendar_event_id ? String(row.calendar_event_id) : null,
    type: String(row.artifact_type), title: String(row.title), sourceUrls: array(row.source_urls),
    verifiedFacts: array(row.verified_facts), hypotheses: array(row.hypotheses),
    confidence: String(row.confidence), content: String(row.content ?? ""), status: String(row.status),
    researchedAt: row.researched_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at,
    contactName: String(row.contact_name ?? ""), company: String(row.company ?? ""),
    dealTitle: String(row.deal_title ?? ""), eventTitle: String(row.event_title ?? ""),
    eventStartsAt: row.event_starts_at ?? null,
  };
}
const select = `
  SELECT r.id, r.contact_id, r.deal_id, r.calendar_event_id, r.artifact_type, r.title,
    r.source_urls, r.verified_facts, r.hypotheses, r.confidence, r.content, r.status,
    r.researched_at, r.created_at, r.updated_at,
    trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, c.company,
    d.title AS deal_title, e.title AS event_title, e.starts_at AS event_starts_at
  FROM public.research_artifacts r
  LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
  LEFT JOIN public.deals d ON d.id = r.deal_id AND d.owner_id = r.owner_id
  LEFT JOIN public.calendar_events e ON e.id = r.calendar_event_id AND e.owner_id = r.owner_id
`;
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    const status = params.get("status");
    if (type && !types.has(type)) return fail("Invalid artifact type.", 400);
    if (status && !statuses.has(status)) return fail("Invalid artifact status.", 400);
    const sql = db();
    const rows = await sql`
      SELECT r.id, r.contact_id, r.deal_id, r.calendar_event_id, r.artifact_type, r.title,
        r.source_urls, r.verified_facts, r.hypotheses, r.confidence, r.content, r.status,
        r.researched_at, r.created_at, r.updated_at,
        trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name, c.company,
        d.title AS deal_title, e.title AS event_title, e.starts_at AS event_starts_at
      FROM public.research_artifacts r
      LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
      LEFT JOIN public.deals d ON d.id = r.deal_id AND d.owner_id = r.owner_id
      LEFT JOIN public.calendar_events e ON e.id = r.calendar_event_id AND e.owner_id = r.owner_id
      WHERE r.owner_id = ${user.id}
        AND (${type ?? null}::text IS NULL OR r.artifact_type = ${type ?? null})
        AND (${status ?? null}::text IS NULL OR r.status = ${status ?? null})
      ORDER BY CASE WHEN r.status = 'draft' THEN 0 WHEN r.status = 'reviewed' THEN 1 ELSE 2 END,
        r.updated_at DESC
      LIMIT 500
    `;
    return Response.json({ artifacts: rows.map((row: Record<string, unknown>) => mapRow(row)) });
  } catch (error) {
    console.error("Research artifacts GET failed", error);
    return fail("Unable to load preparation records.", 500);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    const type = typeof body.type === "string" ? body.type : "prospect_research";
    const title = clean(body.title, 240);
    const content = clean(body.content, 20000);
    const contactId = optionalUuid(body.contactId);
    const dealId = optionalUuid(body.dealId);
    const eventId = optionalUuid(body.calendarEventId);
    const sources = urlList(body.sourceUrls ?? []);
    const facts = stringList(body.verifiedFacts ?? [], 50, 2000);
    const hypotheses = stringList(body.hypotheses ?? [], 50, 2000);
    const confidence = typeof body.confidence === "string" ? body.confidence : "medium";
    if (!types.has(type)) return fail("Invalid artifact type.", 400);
    if (!title) return fail("A title is required.", 400);
    if (typeof body.content !== "string" || body.content.length > 20000) return fail("Content must be 20,000 characters or fewer.", 400);
    if (contactId === false || dealId === false || eventId === false) return fail("A linked contact, deal, or calendar event id is invalid.", 400);
    if (sources === false) return fail("Sources must be valid HTTP(S) URLs (up to 30).", 400);
    if (facts === false || hypotheses === false) return fail("Facts and hypotheses must be non-empty text items (up to 50 each).", 400);
    if (!confidences.has(confidence)) return fail("Invalid confidence level.", 400);
    const sql = db();
    const linkError = await validateLinks(sql, user.id, contactId, dealId, eventId);
    if (linkError) return fail(linkError, 404);
    const rows = await sql`
      INSERT INTO public.research_artifacts
        (owner_id, contact_id, deal_id, calendar_event_id, artifact_type, title, source_urls,
         verified_facts, hypotheses, confidence, content, status, researched_at)
      VALUES (${user.id}, ${contactId}::uuid, ${dealId}::uuid, ${eventId}::uuid, ${type}, ${title},
        ${JSON.stringify(sources)}::jsonb, ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(hypotheses)}::jsonb,
        ${confidence}, ${content}, 'draft', CASE WHEN ${sources.length > 0} THEN now() ELSE NULL END)
      RETURNING id
    `;
    return Response.json({ id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("Research artifacts POST failed", error);
    return fail("Unable to save preparation record.", 500);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !uuid.test(body.id)) return fail("A valid artifact id is required.", 400);
    const type = typeof body.type === "string" ? body.type : "prospect_research";
    const title = clean(body.title, 240);
    const content = typeof body.content === "string" ? body.content : "";
    const contactId = optionalUuid(body.contactId);
    const dealId = optionalUuid(body.dealId);
    const eventId = optionalUuid(body.calendarEventId);
    const sources = urlList(body.sourceUrls ?? []);
    const facts = stringList(body.verifiedFacts ?? [], 50, 2000);
    const hypotheses = stringList(body.hypotheses ?? [], 50, 2000);
    const confidence = typeof body.confidence === "string" ? body.confidence : "medium";
    const status = typeof body.status === "string" ? body.status : "draft";
    if (!types.has(type) || !title) return fail("A valid artifact type and title are required.", 400);
    if (content.length > 20000) return fail("Content must be 20,000 characters or fewer.", 400);
    if (contactId === false || dealId === false || eventId === false) return fail("A linked contact, deal, or calendar event id is invalid.", 400);
    if (sources === false) return fail("Sources must be valid HTTP(S) URLs (up to 30).", 400);
    if (facts === false || hypotheses === false) return fail("Facts and hypotheses must be non-empty text items (up to 50 each).", 400);
    if (!confidences.has(confidence) || !statuses.has(status)) return fail("Invalid confidence or status.", 400);
    const sql = db();
    const linkError = await validateLinks(sql, user.id, contactId, dealId, eventId);
    if (linkError) return fail(linkError, 404);
    const rows = await sql`
      UPDATE public.research_artifacts SET
        contact_id = ${contactId}::uuid, deal_id = ${dealId}::uuid, calendar_event_id = ${eventId}::uuid,
        artifact_type = ${type}, title = ${title}, source_urls = ${JSON.stringify(sources)}::jsonb,
        verified_facts = ${JSON.stringify(facts)}::jsonb, hypotheses = ${JSON.stringify(hypotheses)}::jsonb,
        confidence = ${confidence}, content = ${content}, status = ${status},
        researched_at = CASE WHEN cardinality(${sources}::text[]) > 0 THEN COALESCE(researched_at, now()) ELSE researched_at END,
        updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id}
      RETURNING id
    `;
    if (!rows.length) return fail("Preparation record not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Research artifacts PATCH failed", error);
    return fail("Unable to update preparation record.", 500);
  }
}
