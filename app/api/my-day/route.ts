import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { GROUP_LABELS } from "@/lib/my-day";
import { loadMyDay } from "@/lib/my-day-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
/**
 * GET /api/my-day?today=YYYY-MM-DD&dayEnd=ISO&windowEnd=ISO
 * today/dayEnd come from the browser so "today" means the owner's local day.
 */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const params = new URL(request.url).searchParams;
    const today = params.get("today") ?? "";
    const dayEnd = params.get("dayEnd") ?? "";
    const windowEnd = params.get("windowEnd") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(dayEnd)) || Number.isNaN(Date.parse(windowEnd))) {
      return fail("today, dayEnd and windowEnd are required.", 400);
    }
    const { items, now } = await loadMyDay(db(), user.id, today, dayEnd, windowEnd);
    return Response.json({ items, groups: GROUP_LABELS, generatedAt: now }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("My Day queue failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return fail("Could not build today's queue.", 500);
  }
}
