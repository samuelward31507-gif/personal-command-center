import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { profileLink } from "@/lib/linkedin-outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEPS = new Set(["connect", "accepted", "message", "skipped"]);
const PREFIX = "LinkedIn: ";
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
function db() { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); }

/** GET: every LinkedIn step you've logged (request sent, accepted, message sent). Cinder never touches LinkedIn itself. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db()`SELECT contact_id, notes, occurred_at FROM public.contact_activities
      WHERE owner_id = ${o} AND channel = 'note' AND action = 'note' AND notes LIKE ${PREFIX + "%"} ORDER BY occurred_at DESC LIMIT 5000`;
    const log = rows.map(r => ({ contactId: String(r.contact_id), step: String(r.notes).slice(PREFIX.length).split(/\s|\n/)[0], at: new Date(r.occurred_at as string).toISOString() }));
    return Response.json({ log }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("LinkedIn outreach GET failed", e); return Response.json({ error: "Couldn't load LinkedIn history." }, { status: 500 }); }
}

/** POST { contactId, step }: log a LinkedIn step you did by hand. */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    if (!uuid(b.contactId) || !STEPS.has(b.step)) return Response.json({ error: "A contact and LinkedIn step are required." }, { status: 400 });
    const sql = db();
    const found = await sql`SELECT id FROM public.contacts WHERE id = ${b.contactId}::uuid AND owner_id = ${o} LIMIT 1`;
    if (!found.length) return Response.json({ error: "Contact not found." }, { status: 404 });
    const label: Record<string, string> = { connect: "connect request sent", accepted: "request accepted", message: "message sent", skipped: "no one to find on the job post" };
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${o}, ${b.contactId}::uuid, 'note', 'note', 'other', ${`${PREFIX}${b.step} (${label[b.step]})`})`;
    await sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${b.contactId}::uuid AND owner_id = ${o}`;
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { console.error("LinkedIn outreach POST failed", e); return Response.json({ error: "Couldn't log that." }, { status: 500 }); }
}

/** PUT { contactId, profile }: save the LinkedIn profile you found for a contact (only fills an empty one). */
export async function PUT(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    const link = profileLink(String(b.profile ?? ""));
    if (!uuid(b.contactId)) return Response.json({ error: "A contact is required." }, { status: 400 });
    if (!link) return Response.json({ error: "Paste a profile link that looks like linkedin.com/in/their-name." }, { status: 400 });
    const rows = await db()`UPDATE public.contacts SET linkedin_url = ${link}, updated_at = now()
      WHERE id = ${b.contactId}::uuid AND owner_id = ${o} AND coalesce(trim(linkedin_url), '') = '' RETURNING id`;
    if (!rows.length) return Response.json({ error: "That contact already has a LinkedIn profile, or wasn't found." }, { status: 409 });
    return Response.json({ ok: true, linkedin: link });
  } catch (e) { console.error("LinkedIn profile save failed", e); return Response.json({ error: "Couldn't save the profile." }, { status: 500 }); }
}
