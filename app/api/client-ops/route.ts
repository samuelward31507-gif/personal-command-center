import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { newSigningToken } from "@/lib/esign";
import { GO_LIVE_STEP } from "@/lib/deal-handoff";
import { cleanLaunch, cleanMessages, cleanSetup, draftMessages, guaranteeClock, launchState, prefillSetup, setupGaps, allApproved } from "@/lib/client-ops";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sql = NeonQueryFunction<false, false>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const origin = (request: Request) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(request.url).origin;

async function load(sql: Sql, owner: string, projectId: string) {
  const pr = await sql`
    SELECT p.id, p.deal_id, p.service_type, p.client_name, c.company, c.website, c.first_name
    FROM public.projects p LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
    WHERE p.id = ${projectId}::uuid AND p.owner_id = ${owner}` as Record<string, unknown>[];
  if (!pr.length) return null;
  const p = pr[0];
  const dealId = p.deal_id ? String(p.deal_id) : null;
  const [ops, kick, golive] = await Promise.all([
    sql`SELECT * FROM public.client_ops WHERE project_id = ${projectId}::uuid AND owner_id = ${owner}` as Promise<Record<string, unknown>[]>,
    dealId ? sql`SELECT submitted_at, answers FROM public.kickoff_requests WHERE deal_id = ${dealId}::uuid AND owner_id = ${owner} AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 1` as Promise<Record<string, unknown>[]> : Promise.resolve([] as Record<string, unknown>[]),
    sql`SELECT completed_at FROM public.project_milestones WHERE project_id = ${projectId}::uuid AND owner_id = ${owner} AND title = ${GO_LIVE_STEP} AND status = 'done' LIMIT 1` as Promise<Record<string, unknown>[]>,
  ]);
  return { p, ops: ops[0] ?? null, kick: kick[0] ?? null, goLiveAt: iso(golive[0]?.completed_at) };
}

function view(d: NonNullable<Awaited<ReturnType<typeof load>>>, today: string, base: string) {
  const answers = (d.kick?.answers && typeof d.kick.answers === "object" ? d.kick.answers : {}) as Record<string, string>;
  const saved = (d.ops?.setup && typeof d.ops.setup === "object" ? d.ops.setup : {}) as Record<string, string>;
  const setup = prefillSetup(saved, answers, { company: String(d.p.company || d.p.client_name || ""), website: String(d.p.website ?? ""), ownerName: String(d.p.first_name ?? "") });
  const messages = cleanMessages(d.ops?.messages);
  const launch = cleanLaunch(d.ops?.launch);
  const tier2 = String(d.p.service_type) === "tier2_revenue_system";
  return {
    setup, gaps: setupGaps(setup), messages, launch, launchState: launchState(launch, tier2), tier2,
    clock: guaranteeClock(iso(d.kick?.submitted_at), d.goLiveAt, today),
    approval: { link: d.ops?.approval_token ? `${base}/approve/${d.ops.approval_token}` : null, sentAt: iso(d.ops?.approval_sent_at), approvedAt: iso(d.ops?.approved_at), approvedBy: String(d.ops?.approved_by ?? ""), allApproved: allApproved(messages) },
    portal: { link: d.ops?.portal_token ? `${base}/portal/${d.ops.portal_token}` : null },
  };
}

async function upsert(sql: Sql, owner: string, projectId: string) {
  await sql`INSERT INTO public.client_ops (project_id, owner_id) VALUES (${projectId}::uuid, ${owner}) ON CONFLICT (project_id) DO NOTHING`;
}

/** GET /api/client-ops?project=… — setup sheet (filled from kickoff), messages, launch test, guarantee clock, links. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const id = new URL(request.url).searchParams.get("project") ?? "";
  if (!UUID.test(id)) return reply({ error: "Valid project id is required." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const d = await load(sql, user.id, id);
  if (!d) return reply({ error: "Client not found." }, 404);
  const ws = await loadWorkspace(user.id);
  return reply(view(d, todayIn(ws.timezone), origin(request)));
}

/**
 * POST /api/client-ops — { project, action, ... }
 * actions: setup {setup} · draft-messages · messages {messages} · approval-link · launch {launch} · portal-link.
 * Nothing is sent to anyone: links are for you to share.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.project === "string" ? body.project : "";
  if (!UUID.test(id)) return reply({ error: "Valid project id is required." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const owner = user.id;
  const d0 = await load(sql, owner, id);
  if (!d0) return reply({ error: "Client not found." }, 404);
  await upsert(sql, owner, id);
  try {
    switch (body?.action) {
      case "setup": {
        const setup = cleanSetup(body.setup);
        await sql`UPDATE public.client_ops SET setup = ${JSON.stringify(setup)}::jsonb, updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${owner}`;
        break;
      }
      case "draft-messages": {
        const current = view(d0, "2000-01-01", "");
        const msgs = draftMessages(current.setup);
        await sql`UPDATE public.client_ops SET messages = ${JSON.stringify(msgs)}::jsonb, approved_at = NULL, updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${owner}`;
        break;
      }
      case "messages": {
        // Editing wording resets any message whose text changed back to draft.
        const prev = new Map(cleanMessages(d0.ops?.messages).map(m => [m.key, m]));
        const msgs = cleanMessages(body.messages).map(m => { const p = prev.get(m.key); return p && p.body === m.body ? { ...m, status: p.status, clientNote: p.clientNote } : { ...m, status: "draft" as const }; });
        await sql`UPDATE public.client_ops SET messages = ${JSON.stringify(msgs)}::jsonb, approved_at = CASE WHEN ${allApproved(msgs)} THEN approved_at ELSE NULL END, updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${owner}`;
        break;
      }
      case "approval-link": {
        if (!cleanMessages(d0.ops?.messages).length) return reply({ error: "Draft the messages first." }, 400);
        await sql`UPDATE public.client_ops SET approval_token = COALESCE(approval_token, ${newSigningToken()}), approval_sent_at = now(), updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${owner}`;
        break;
      }
      case "launch": {
        const launch = cleanLaunch(body.launch);
        await sql`UPDATE public.client_ops SET launch = ${JSON.stringify(launch)}::jsonb, updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${owner}`;
        break;
      }
      case "portal-link": {
        await sql`UPDATE public.client_ops SET portal_token = COALESCE(portal_token, ${newSigningToken()}), updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${owner}`;
        break;
      }
      default: return reply({ error: "Unknown action." }, 400);
    }
    const d = await load(sql, owner, id);
    const ws = await loadWorkspace(owner);
    return reply(view(d!, todayIn(ws.timezone), origin(request)));
  } catch (error) {
    console.error("Client ops save failed", { action: body?.action, name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't save that. Try again." }, 500);
  }
}
