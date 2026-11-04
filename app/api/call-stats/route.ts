import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { CONVERSATIONS } from "@/lib/call-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/call-stats?since=ISO — dials, conversations and meetings logged since the owner's local midnight. */
export async function GET(request: Request) {
  try {
    const session = await getAllowedSession();
    const owner = session?.data?.session && session?.data?.user?.id ? String(session.data.user.id) : null;
    if (!owner) return fail("Unauthorized", 401);
    const since = new URL(request.url).searchParams.get("since") ?? "";
    if (Number.isNaN(Date.parse(since))) return fail("since is required.", 400);
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT
        count(*) FILTER (WHERE outcome <> 'initiated') AS dials,
        count(*) FILTER (WHERE outcome = ANY(${CONVERSATIONS as string[]})) AS conversations,
        count(*) FILTER (WHERE outcome = 'meeting_booked') AS meetings
      FROM public.contact_activities
      WHERE owner_id = ${owner} AND action = 'outbound_call' AND occurred_at >= ${since}::timestamptz`;
    const r = rows[0] ?? {};
    return Response.json({ dials: Number(r.dials ?? 0), conversations: Number(r.conversations ?? 0), meetings: Number(r.meetings ?? 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Call stats failed", { message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return fail("Could not load today's numbers.", 500);
  }
}
