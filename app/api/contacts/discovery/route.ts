import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { cleanDiscovery, guaranteeCalc, readDiscovery } from "@/lib/founding-offer";
import { loadOffer } from "@/lib/offer-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/contacts/discovery?id=… — a contact's discovery answers, the guarantee calculator and the offer (spots, price script). */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return reply({ error: "Valid contact id is required." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT discovery FROM public.contacts WHERE id = ${id}::uuid AND owner_id = ${user.id}`;
  if (!rows.length) return reply({ error: "Contact not found." }, 404);
  const { offer, used, left } = await loadOffer(user.id);
  const discovery = readDiscovery(rows[0].discovery);
  return reply({ discovery, calc: guaranteeCalc(discovery, offer), offer, used, left });
}

/** PUT /api/contacts/discovery { id, discovery } — save the discovery answers (replaces the whole set). */
export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (!UUID.test(id)) return reply({ error: "Valid contact id is required." }, 400);
    const checked = cleanDiscovery(body?.discovery);
    if ("error" in checked) return reply({ error: checked.error }, 400);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`UPDATE public.contacts SET discovery = ${JSON.stringify(checked.ok)}::jsonb, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${user.id} RETURNING id`;
    if (!rows.length) return reply({ error: "Contact not found." }, 404);
    const { offer, used, left } = await loadOffer(user.id);
    return reply({ discovery: checked.ok, calc: guaranteeCalc(checked.ok, offer), offer, used, left });
  } catch (error) {
    console.error("Discovery save failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Could not save the discovery answers." }, 500);
  }
}
