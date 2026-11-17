import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { cleanSpeedTest } from "@/lib/speed-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/contacts/speed-test?id=… — the contact's speed test, or null. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return reply({ error: "Valid contact id is required." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT speed_test FROM public.contacts WHERE id = ${id}::uuid AND owner_id = ${user.id}`;
  if (!rows.length) return reply({ error: "Contact not found." }, 404);
  return reply({ test: cleanSpeedTest(rows[0].speed_test) });
}

/** PUT /api/contacts/speed-test { id, test } — start, finish or clear (test: null) the speed test. */
export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (!UUID.test(id)) return reply({ error: "Valid contact id is required." }, 400);
    const test = body?.test === null ? null : cleanSpeedTest(body?.test);
    if (body?.test !== null && !test) return reply({ error: "That speed test isn't valid. Check the time and how you asked." }, 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`UPDATE public.contacts SET speed_test = ${test ? JSON.stringify(test) : null}::jsonb, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${user.id} RETURNING id`;
    if (!rows.length) return reply({ error: "Contact not found." }, 404);
    return reply({ test });
  } catch (error) {
    console.error("Speed test save failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't save the speed test. Try again." }, 500);
  }
}
