import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { syncReplies } from "@/lib/gmail-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: check cold-email threads for replies and bounces (headers and Gmail's short preview only). */
export async function POST() {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const { status, ...res } = await syncReplies(neon(process.env.DATABASE_URL), o);
  return Response.json(res, { status: status ?? 200 });
}
