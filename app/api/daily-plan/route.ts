import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}
function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return error("Unauthorized", 401);
    const date = validDate(new URL(request.url).searchParams.get("date"));
    if (!date) return error("A valid plan date is required.", 400);
    const sql = db();
    const rows = await sql`SELECT plan_date, completed_blocks, notes, updated_at FROM public.daily_plans WHERE owner_id = ${user.id} AND plan_date = ${date}::date LIMIT 1`;
    const row = rows[0] as Record<string, unknown> | undefined;
    return Response.json({ plan: row ? { date: String(row.plan_date).slice(0, 10), completedBlocks: Array.isArray(row.completed_blocks) ? row.completed_blocks : [], notes: String(row.notes ?? ""), updatedAt: row.updated_at } : { date, completedBlocks: [], notes: "", updatedAt: null } });
  } catch (e) {
    console.error("Daily plan GET failed", e);
    return error("Unable to load your daily plan.", 500);
  }
}
export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return error("Unauthorized", 401);
    const body = await request.json();
    const date = validDate(typeof body.date === "string" ? body.date : null);
    if (!date) return error("A valid plan date is required.", 400);
    if (typeof body.notes !== "string" || body.notes.length > 10000) return error("Notes must be 10,000 characters or fewer.", 400);
    if (!Array.isArray(body.completedBlocks) || body.completedBlocks.length > 100 || body.completedBlocks.some((x: unknown) => typeof x !== "string" || !/^[a-zA-Z0-9:_-]{1,80}$/.test(x))) return error("Completed blocks are invalid.", 400);
    const completed = [...new Set(body.completedBlocks as string[])];
    const sql = db();
    const rows = await sql`
      INSERT INTO public.daily_plans (owner_id, plan_date, completed_blocks, notes)
      VALUES (${user.id}, ${date}::date, ${JSON.stringify(completed)}::jsonb, ${body.notes})
      ON CONFLICT (owner_id, plan_date) DO UPDATE SET completed_blocks = EXCLUDED.completed_blocks, notes = EXCLUDED.notes, updated_at = now()
      RETURNING plan_date, completed_blocks, notes, updated_at
    `;
    const row = rows[0] as Record<string, unknown>;
    return Response.json({ plan: { date: String(row.plan_date).slice(0, 10), completedBlocks: row.completed_blocks, notes: row.notes, updatedAt: row.updated_at } });
  } catch (e) {
    console.error("Daily plan PUT failed", e);
    return error("Unable to save your daily plan.", 500);
  }
}