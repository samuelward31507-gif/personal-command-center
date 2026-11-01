import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { addMonthsTo, cleanItem, COMMON_ITEMS, commonDue, dueState } from "@/lib/compliance";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

async function list(owner: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const ws = await loadWorkspace(owner);
  const today = todayIn(ws.timezone);
  const [items, texting] = await Promise.all([
    sql`SELECT id, title, kind, due_date, status, repeat_months, note, done_at FROM public.compliance_items WHERE owner_id = ${owner} ORDER BY status, due_date NULLS LAST, created_at LIMIT 300` as Promise<Record<string, unknown>[]>,
    sql`SELECT o.project_id, COALESCE(NULLIF(c.company,''), p.client_name, p.name) AS name, o.setup->>'a2p_status' AS a2p, o.setup->>'a2p_submitted' AS submitted
      FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id AND p.owner_id = o.owner_id LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
      WHERE o.owner_id = ${owner} AND p.status NOT IN ('completed','cancelled')` as Promise<Record<string, unknown>[]>,
  ]);
  const existing = new Set(items.map(i => String(i.title)));
  return {
    today,
    items: items.map(i => ({ id: String(i.id), title: String(i.title), kind: String(i.kind), dueDate: day(i.due_date), status: String(i.status), repeatMonths: i.repeat_months == null ? null : Number(i.repeat_months), note: String(i.note ?? ""), state: dueState(day(i.due_date), String(i.status), today) })),
    texting: texting.map(t => ({ projectId: String(t.project_id), name: String(t.name), status: String(t.a2p || "Not started"), submitted: t.submitted ? String(t.submitted) : null })),
    suggestions: COMMON_ITEMS.filter(c => !existing.has(c.title)).map(c => ({ title: c.title, kind: c.kind, repeatMonths: c.repeatMonths, note: c.note, dueDate: commonDue(c, today) })),
  };
}

/** GET /api/compliance — your deadlines, each client's texting registration, and common items not added yet. */
export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  return reply(await list(user.id));
}

/** POST /api/compliance — {action: add | update | done | remove}. Marking a repeating item done schedules the next one. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const sql = neon(process.env.DATABASE_URL);
  const owner = user.id;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof b?.id === "string" && UUID.test(b.id) ? b.id : null;
  try {
    if (b?.action === "add" || b?.action === "update") {
      const c = cleanItem(b);
      if ("error" in c) return reply(c, 400);
      const v = c.ok;
      if (b.action === "add") await sql`INSERT INTO public.compliance_items (owner_id, title, kind, due_date, repeat_months, note) VALUES (${owner}, ${v.title}, ${v.kind}, ${v.dueDate}::date, ${v.repeatMonths}, ${v.note})`;
      else if (id) await sql`UPDATE public.compliance_items SET title = ${v.title}, kind = ${v.kind}, due_date = ${v.dueDate}::date, repeat_months = ${v.repeatMonths}, note = ${v.note} WHERE id = ${id}::uuid AND owner_id = ${owner}`;
    } else if (b?.action === "done" && id) {
      const rows = await sql`UPDATE public.compliance_items SET status = 'done', done_at = now() WHERE id = ${id}::uuid AND owner_id = ${owner} AND status = 'open' RETURNING title, kind, due_date, repeat_months, note` as Record<string, unknown>[];
      const r = rows[0];
      if (r?.repeat_months && r.due_date) {
        await sql`INSERT INTO public.compliance_items (owner_id, title, kind, due_date, repeat_months, note) VALUES (${owner}, ${String(r.title)}, ${String(r.kind)}, ${addMonthsTo(day(r.due_date)!, Number(r.repeat_months))}::date, ${Number(r.repeat_months)}, ${String(r.note ?? "")})`;
      }
    } else if (b?.action === "remove" && id) {
      await sql`DELETE FROM public.compliance_items WHERE id = ${id}::uuid AND owner_id = ${owner}`;
    } else return reply({ error: "Unknown action." }, 400);
    return reply(await list(owner));
  } catch (error) {
    console.error("Compliance save failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't save that. Try again." }, 500);
  }
}
