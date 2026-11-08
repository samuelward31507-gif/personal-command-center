import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { groupSource } from "@/lib/group-posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const txt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
function db() { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); }

/** GET: your groups with posts, leads and meetings from each, plus every post (for script rotation). */
export async function GET() {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = db();
    const groups = await sql`SELECT g.id, g.name, g.url, g.rules, g.every_days,
        (SELECT max(p.posted_at) FROM public.group_posts p WHERE p.group_id = g.id) AS last_posted,
        (SELECT count(*)::int FROM public.group_posts p WHERE p.group_id = g.id AND p.posted_at > now() - interval '30 days') AS posts30,
        (SELECT count(*)::int FROM public.contacts c WHERE c.owner_id = g.owner_id AND c.source = 'Facebook group: ' || g.name) AS leads,
        (SELECT count(DISTINCT a.contact_id)::int FROM public.contact_activities a JOIN public.contacts c ON c.id = a.contact_id AND c.owner_id = a.owner_id
           WHERE a.owner_id = g.owner_id AND c.source = 'Facebook group: ' || g.name AND a.outcome = 'meeting_booked') AS meetings
      FROM public.outreach_groups g WHERE g.owner_id = ${o} AND NOT g.archived ORDER BY g.created_at`;
    const posts = await sql`SELECT group_id, script, posted_at FROM public.group_posts WHERE owner_id = ${o} AND posted_at > now() - interval '120 days' ORDER BY posted_at DESC LIMIT 2000`;
    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
    return Response.json({
      groups: groups.map(g => ({ id: String(g.id), name: String(g.name), url: String(g.url), rules: String(g.rules), everyDays: Number(g.every_days), lastPosted: iso(g.last_posted), posts30: Number(g.posts30), leads: Number(g.leads), meetings: Number(g.meetings) })),
      posts: posts.map(p => ({ groupId: String(p.group_id), script: String(p.script), at: iso(p.posted_at)! })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Groups GET failed", e); return Response.json({ error: "Couldn't load groups." }, { status: 500 }); }
}

/**
 * POST { action }:
 *  "add"    { name, url?, rules?, everyDays? }   add a group
 *  "edit"   { id, name?, url?, rules?, everyDays? }
 *  "remove" { id }                               archive (posts and leads are kept)
 *  "posted" { id, script }                       log a post
 *  "lead"   { id, name, company?, phone?, email?, note? }  add a contact from a post, tagged with the group
 */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    const sql = db();
    if (b.action === "add") {
      const name = txt(b.name, 120);
      if (!name) return Response.json({ error: "Group name is required." }, { status: 400 });
      const every = Math.min(60, Math.max(1, Number(b.everyDays) || 7));
      const [g] = await sql`INSERT INTO public.outreach_groups (owner_id, name, url, rules, every_days) VALUES (${o}, ${name}, ${txt(b.url, 500)}, ${txt(b.rules, 1000)}, ${every}) RETURNING id`;
      return Response.json({ id: String(g.id) }, { status: 201 });
    }
    if (!uuid(b.id)) return Response.json({ error: "Group id is required." }, { status: 400 });
    const [g] = await sql`SELECT id, name FROM public.outreach_groups WHERE id = ${b.id}::uuid AND owner_id = ${o}` as { id: string; name: string }[];
    if (!g) return Response.json({ error: "Group not found." }, { status: 404 });
    if (b.action === "edit") {
      const name = b.name === undefined ? g.name : txt(b.name, 120);
      if (!name) return Response.json({ error: "Group name is required." }, { status: 400 });
      await sql`UPDATE public.outreach_groups SET name = ${name},
          url = CASE WHEN ${b.url !== undefined} THEN ${txt(b.url, 500)} ELSE url END,
          rules = CASE WHEN ${b.rules !== undefined} THEN ${txt(b.rules, 1000)} ELSE rules END,
          every_days = CASE WHEN ${b.everyDays !== undefined} THEN ${Math.min(60, Math.max(1, Number(b.everyDays) || 7))} ELSE every_days END
        WHERE id = ${g.id}::uuid AND owner_id = ${o}`;
      // Keep leads attached when a group is renamed.
      if (name !== g.name) await sql`UPDATE public.contacts SET source = ${groupSource(name)} WHERE owner_id = ${o} AND source = ${groupSource(g.name)}`;
      return Response.json({ ok: true });
    }
    if (b.action === "remove") { await sql`UPDATE public.outreach_groups SET archived = true WHERE id = ${g.id}::uuid AND owner_id = ${o}`; return Response.json({ ok: true }); }
    if (b.action === "posted") {
      await sql`INSERT INTO public.group_posts (owner_id, group_id, script) VALUES (${o}, ${g.id}::uuid, ${txt(b.script, 60)})`;
      return Response.json({ ok: true }, { status: 201 });
    }
    if (b.action === "lead") {
      const name = txt(b.name, 120), company = txt(b.company, 160);
      if (!name && !company) return Response.json({ error: "A name or company is required." }, { status: 400 });
      const [first, ...rest] = (name || company).split(/\s+/);
      const note = txt(b.note, 1000);
      const [c] = await sql`INSERT INTO public.contacts (owner_id, first_name, last_name, company, phone, email, status, source, notes)
        VALUES (${o}, ${name ? first : company}, ${name ? rest.join(" ") : ""}, ${company}, ${txt(b.phone, 40)}, ${txt(b.email, 200).toLowerCase()}, 'lead', ${groupSource(g.name)},
          ${`Came from a post in ${g.name}.${note ? " " + note : ""}`}) RETURNING id`;
      return Response.json({ id: String(c.id) }, { status: 201 });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { console.error("Groups POST failed", e); return Response.json({ error: "Couldn't save that." }, { status: 500 }); }
}
