import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEPS = new Set(["intro", "follow_up", "breakup"]);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
function db() { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); }

/** GET: every cold email you've marked sent (contact, step, when). Cinder never sends email itself. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db()`SELECT contact_id, notes, occurred_at FROM public.contact_activities
      WHERE owner_id = ${o} AND channel = 'note' AND action = 'note' AND notes LIKE 'Email sent: %' ORDER BY occurred_at DESC LIMIT 5000`;
    const sent = rows.map(r => ({ contactId: String(r.contact_id), step: String(r.notes).slice("Email sent: ".length).split(/\s|\n/)[0], at: new Date(r.occurred_at as string).toISOString() }));
    return Response.json({ sent }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Email outreach GET failed", e); return Response.json({ error: "Couldn't load email history." }, { status: 500 }); }
}

/** POST { contactId, step, subject }: log that you sent this email from your own inbox. */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    if (!uuid(b.contactId) || !STEPS.has(b.step)) return Response.json({ error: "A contact and email step are required." }, { status: 400 });
    const sql = db();
    const found = await sql`SELECT id FROM public.contacts WHERE id = ${b.contactId}::uuid AND owner_id = ${o} LIMIT 1`;
    if (!found.length) return Response.json({ error: "Contact not found." }, { status: 404 });
    const subject = typeof b.subject === "string" ? b.subject.trim().slice(0, 200) : "";
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${o}, ${b.contactId}::uuid, 'note', 'note', 'other', ${`Email sent: ${b.step}${subject ? `\nSubject: ${subject}` : ""}`})`;
    await sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${b.contactId}::uuid AND owner_id = ${o}`;
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { console.error("Email outreach POST failed", e); return Response.json({ error: "Couldn't log that email." }, { status: 500 }); }
}
