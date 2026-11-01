import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { KIND_LABEL, pickNew, touchState, type Touch } from "@/lib/prospect-queue";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString() : String(v));
const origin = (request: Request) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(request.url).origin;
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const KINDS = new Set(["dm_sent", "follow_up_sent", "replied", "not_interested"]);

async function build(owner: string, base: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const ws = await loadWorkspace(owner);
  const today = todayIn(ws.timezone);
  const [touches, candidates] = await Promise.all([
    sql`SELECT t.contact_id, t.kind, t.at, c.company, trim(concat_ws(' ', c.first_name, c.last_name)) AS person, c.instagram, c.facebook, c.website
      FROM public.prospect_touches t JOIN public.contacts c ON c.id = t.contact_id AND c.owner_id = t.owner_id WHERE t.owner_id = ${owner} ORDER BY t.at` as Promise<Record<string, unknown>[]>,
    sql`SELECT c.id, c.company, trim(concat_ws(' ', c.first_name, c.last_name)) AS person, c.instagram, c.facebook, c.website, c.follow_up_at, c.created_at,
        (SELECT r.token FROM public.prospect_reports r WHERE r.contact_id = c.id AND r.owner_id = c.owner_id ORDER BY r.created_at DESC LIMIT 1) AS report_token,
        (SELECT r.view_count FROM public.prospect_reports r WHERE r.contact_id = c.id AND r.owner_id = c.owner_id ORDER BY r.created_at DESC LIMIT 1) AS views,
        (SELECT a.notes FROM public.contact_activities a WHERE a.contact_id = c.id AND a.owner_id = c.owner_id AND a.notes LIKE 'Research (%' ORDER BY a.occurred_at DESC LIMIT 1) AS research
      FROM public.contacts c WHERE c.owner_id = ${owner} AND c.status IN ('contact','lead')
        AND NOT EXISTS (SELECT 1 FROM public.prospect_touches t WHERE t.contact_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.contact_id = c.id AND a.outcome IN ('do_not_contact','not_a_fit','wrong_contact'))
      ORDER BY c.created_at LIMIT 600` as Promise<Record<string, unknown>[]>,
  ]);
  const byContact = new Map<string, { info: Record<string, unknown>; touches: Touch[] }>();
  for (const t of touches) {
    const k = String(t.contact_id);
    if (!byContact.has(k)) byContact.set(k, { info: t, touches: [] });
    byContact.get(k)!.touches.push({ kind: String(t.kind) as Touch["kind"], at: iso(t.at) });
  }
  const followUps = [...byContact.entries()].map(([id, v]) => ({ id, ...touchState(v.touches, today), info: v.info }))
    .filter(x => x.state === "follow_up_due").map(x => ({ id: x.id, company: String(x.info.company || x.info.person), followUp: x.followUps + 1, instagram: String(x.info.instagram ?? ""), facebook: String(x.info.facebook ?? ""), website: String(x.info.website ?? "") }));
  const cand = candidates.map(c => ({ id: String(c.id), company: String(c.company || c.person || "Unnamed"), followUpAt: day(c.follow_up_at), hasReport: !!c.report_token,
    hasSocial: !!(String(c.instagram ?? "") || String(c.facebook ?? "")), niche: /fenc|pool|spa/i.test(String(c.company ?? "")), createdAt: iso(c.created_at) }));
  const picked = pickNew(cand, today);
  const info = new Map(candidates.map(c => [String(c.id), c]));
  const sentToday = touches.filter(t => String(t.kind) === "dm_sent" && day(t.at) === today).length;
  return {
    today, sentToday,
    newToday: picked.map(p => { const c = info.get(p.id)!; return { id: p.id, company: p.company, instagram: String(c.instagram ?? ""), facebook: String(c.facebook ?? ""), website: String(c.website ?? ""),
      report: c.report_token ? `${base}/report/${c.report_token}` : null, views: Number(c.views ?? 0), research: c.research ? String(c.research).replace(/^Research \([^)]*\):\s*/, "").slice(0, 280) : "" }; }),
    followUps,
    stats: { messaged: [...byContact.values()].length, replied: [...byContact.values()].filter(v => v.touches.some(t => t.kind === "replied")).length },
  };
}

/** GET /api/prospect-queue — today's prospects to message, follow-ups due, and reply stats. Nothing is sent. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  return reply(await build(user.id, origin(request)));
}

/** POST /api/prospect-queue — {contactId, kind, channel?} logs what you did. Updates the contact's follow-up date and activity. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const contactId = typeof b?.contactId === "string" && UUID.test(b.contactId) ? b.contactId : null;
  const kind = typeof b?.kind === "string" && KINDS.has(b.kind) ? (b.kind as Touch["kind"]) : null;
  if (!contactId || !kind) return reply({ error: "Contact and action are required." }, 400);
  const channel = b?.channel === "facebook" || b?.channel === "email" || b?.channel === "other" ? b.channel : "instagram";
  const sql = neon(process.env.DATABASE_URL);
  const owner = user.id;
  const own = await sql`SELECT 1 FROM public.contacts WHERE id = ${contactId}::uuid AND owner_id = ${owner}`;
  if (!own.length) return reply({ error: "Contact not found." }, 404);
  await sql`INSERT INTO public.prospect_touches (owner_id, contact_id, kind, channel) VALUES (${owner}, ${contactId}::uuid, ${kind}, ${channel})`;
  const all = (await sql`SELECT kind, at FROM public.prospect_touches WHERE owner_id = ${owner} AND contact_id = ${contactId}::uuid ORDER BY at`).map(t => ({ kind: String(t.kind) as Touch["kind"], at: iso(t.at) }));
  const ws = await loadWorkspace(owner);
  const s = touchState(all, todayIn(ws.timezone));
  await sql`UPDATE public.contacts SET follow_up_at = ${s.due}::date, updated_at = now() WHERE id = ${contactId}::uuid AND owner_id = ${owner}`;
  await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
    VALUES (${owner}, ${contactId}::uuid, 'note', 'note', ${kind === "replied" ? "reply_received" : kind === "not_interested" ? "not_a_fit" : "other"}, ${`${KIND_LABEL[kind]} on ${channel}.`})`;
  return reply(await build(owner, origin(request)));
}
