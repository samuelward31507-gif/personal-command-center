import { sendSms } from "@/lib/twilio";
import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { pushToProject } from "@/lib/client-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const db = () => { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); };
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** GET ?project= : the messages with that client (marks theirs read). GET without project: unread count per client. */
export async function GET(req: Request) {
  const o = await owner(); if (!o) return bad("Unauthorized", 401);
  const project = new URL(req.url).searchParams.get("project");
  try {
    const sql = db();
    if (!isId(project)) {
      const rows = await sql`SELECT project_id, count(*)::int AS unread FROM public.client_messages WHERE owner_id = ${o} AND author = 'client' AND read_at IS NULL GROUP BY project_id`;
      return Response.json({ unread: rows }, { headers: { "Cache-Control": "no-store" } });
    }
    const msgs = await sql`SELECT id, author, body, created_at, read_at FROM public.client_messages WHERE owner_id = ${o} AND project_id = ${project}::uuid ORDER BY created_at LIMIT 300`;
    await sql`UPDATE public.client_messages SET read_at = now() WHERE owner_id = ${o} AND project_id = ${project}::uuid AND author = 'client' AND read_at IS NULL`;
    const [p] = await sql`SELECT portal_token FROM public.client_ops WHERE project_id = ${project}::uuid AND owner_id = ${o}` as { portal_token: string | null }[];
    return Response.json({ messages: msgs, portal: p?.portal_token ? `/portal/${p.portal_token}` : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Client messages GET failed", e); return bad("Couldn't load messages.", 500); }
}

/** POST { project, body } : reply to the client; it shows in their portal. */
export async function POST(req: Request) {
  const o = await owner(); if (!o) return bad("Unauthorized", 401);
  const b = await req.json().catch(() => ({})) as { project?: string; body?: string };
  const body = String(b.body ?? "").trim().slice(0, 4000);
  if (!isId(b.project)) return bad("Which client?");
  if (!body) return bad("Write a reply first.");
  try {
    const sql = db();
    const [p] = await sql`SELECT 1 FROM public.projects WHERE id = ${b.project}::uuid AND owner_id = ${o}`;
    if (!p) return bad("Unknown client.", 404);
    await sql`INSERT INTO public.client_messages (owner_id, project_id, author, body) VALUES (${o}, ${b.project}::uuid, 'owner', ${body})`;
    await pushToProject(b.project, { title: "Sam replied", body: body.slice(0, 180), url: "/app?tab=sam", tag: "sam" });
    // And a text to the owner's cell from their own Cinder number, in the daytime, so a reply never sits unseen.
    const [ops] = await sql`SELECT setup FROM public.client_ops WHERE project_id = ${b.project}::uuid` as { setup: Record<string, string> | null }[];
    const st = ops?.setup ?? {};
    const hour = Number(new Date().toLocaleString("en-US", { timeZone: st.timezone || "America/Denver", hour: "numeric", hourCycle: "h23" }));
    const cell = (st.owner_cell || "").replace(/\D/g, "").slice(-10);
    if (cell.length === 10 && st.texting_number && hour >= 8 && hour < 21) {
      const origin = process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
      await sendSms("+1" + cell, st.texting_number, `Sam from Cinder replied: "${body.slice(0, 140)}${body.length > 140 ? "…" : ""}" Read and reply: ${origin}/app?tab=sam`).catch(() => false);
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { console.error("Client messages POST failed", e); return bad("Couldn't send that.", 500); }
}
