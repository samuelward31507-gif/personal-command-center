import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { hashKey } from "@/lib/agent-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = { "Cache-Control": "no-store" };
async function owner() {
  const s = await getAllowedSession();
  return s?.data?.session && s?.data?.user?.id ? String(s.data.user.id) : null;
}

/** GET /api/agent-keys: the current Grok Bot key (last 4 characters and when it was last used), never the key itself. */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized." }, { status: 401, headers: no });
  if (!process.env.DATABASE_URL) return Response.json({ key: null }, { headers: no });
  const sql = neon(process.env.DATABASE_URL);
  const [k] = await sql`SELECT last4, created_at, last_used_at FROM public.agent_keys WHERE owner_id = ${o} AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  return Response.json({ key: k ? { last4: String(k.last4), createdAt: new Date(String(k.created_at)).toISOString(), lastUsedAt: k.last_used_at ? new Date(String(k.last_used_at)).toISOString() : null } : null }, { headers: no });
}

/** POST /api/agent-keys: a new key, shown once. Any older key stops working at the same moment. */
export async function POST() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized." }, { status: 401, headers: no });
  if (!process.env.DATABASE_URL) return Response.json({ error: "The database isn't configured." }, { status: 503, headers: no });
  const key = "cnd_" + randomBytes(24).toString("hex");
  const sql = neon(process.env.DATABASE_URL);
  await sql.transaction([
    sql`UPDATE public.agent_keys SET revoked_at = now() WHERE owner_id = ${o} AND revoked_at IS NULL`,
    sql`INSERT INTO public.agent_keys (owner_id, key_hash, last4) VALUES (${o}, ${hashKey(key)}, ${key.slice(-4)})`,
  ]);
  return Response.json({ key }, { status: 201, headers: no });
}
