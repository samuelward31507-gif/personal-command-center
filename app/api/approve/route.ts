import { neon } from "@neondatabase/serverless";
import { isTokenShape } from "@/lib/esign";
import { allApproved, applyApproval, cleanMessages } from "@/lib/client-ops";
import { sendAlert } from "@/lib/notify";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

async function find(token: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT o.project_id, o.owner_id, o.messages, o.setup, o.approved_at, p.name, p.client_name
    FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id AND p.owner_id = o.owner_id
    WHERE o.approval_token = ${token} LIMIT 1` as Record<string, unknown>[];
  return { sql, row: rows[0] ?? null };
}

/** GET /api/approve?token=… — public: the messages waiting for the client's approval. Nothing else. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  const { row } = await find(token);
  if (!row) return reply({ error: "This link is no longer active." }, 404);
  const ws = await loadWorkspace(String(row.owner_id));
  const setup = (row.setup && typeof row.setup === "object" ? row.setup : {}) as Record<string, string>;
  return reply({
    client: setup.display_name || String(row.client_name || row.name), from: { name: ws.businessName, owner: ws.ownerFirstName },
    messages: cleanMessages(row.messages), approvedAt: row.approved_at ? String(row.approved_at) : null,
  });
}

/** POST /api/approve — public: the client approves each message or asks for a change. Records it and tells the owner. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = body?.token;
  if (!isTokenShape(token)) return reply({ error: "This link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Unavailable right now." }, 503);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return reply({ error: "Add your name so we have a record of who approved." }, 400);
  const { sql, row } = await find(token);
  if (!row) return reply({ error: "This link is no longer active." }, 404);
  const next = applyApproval(cleanMessages(row.messages), body?.answers);
  if ("error" in next) return reply(next, 400);
  const done = allApproved(next);
  const stamped = next.map(m => ({ ...m }));
  await sql`UPDATE public.client_ops SET messages = ${JSON.stringify(stamped)}::jsonb, approved_at = CASE WHEN ${done} THEN now() ELSE NULL END,
    approved_by = ${name}, updated_at = now() WHERE approval_token = ${token}`;
  const changes = next.filter(m => m.status === "changes");
  const client = String(row.client_name || row.name);
  await sendAlert({
    subject: done ? `${client} approved every message` : `${client} asked for ${changes.length} change${changes.length === 1 ? "" : "s"}`,
    lines: done ? [`${name} approved all ${next.length} messages. You can launch once the test passes.`] : [`${name} reviewed the messages.`, ...changes.map(m => `${m.label}: ${m.clientNote}`)],
    link: { label: "Open the client", path: `/crm/client-success/${row.project_id}` },
  });
  return reply({ ok: true, allApproved: done, changes: changes.length });
}
