import { neon } from "@neondatabase/serverless";
import { sendAlert } from "@/lib/notify";
import { hashToken, isTokenShape } from "@/lib/esign";
import { fieldsFor, validateKickoff, kickoffSummary, type KickoffTier } from "@/lib/kickoff";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

async function load(token: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT k.id, k.owner_id, k.deal_id, k.project_id, k.tier, k.status, k.submitted_at, c.company, c.id AS contact_id, d.title AS deal_title
    FROM public.kickoff_requests k
    JOIN public.deals d ON d.id = k.deal_id AND d.owner_id = k.owner_id
    LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    WHERE k.token_hash = ${hashToken(token)} LIMIT 1`;
  return { sql, row: rows[0] };
}

/** GET /api/kickoff?token=… — public: the checklist behind a kickoff link. Never returns earlier answers. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This kickoff link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "The checklist is unavailable right now." }, 503);
  try {
    const { row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This kickoff link is no longer active. Ask for a new one." }, 404);
    const tier = String(row.tier) as KickoffTier;
    return reply({
      status: row.status === "submitted" ? "submitted" : "open",
      client: String(row.company || String(row.deal_title).split(" — ")[0] || ""),
      tier, fields: fieldsFor(tier),
      submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : null,
    });
  } catch (error) {
    console.error("Kickoff GET failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't load the checklist. Try again." }, 500);
  }
}

/**
 * POST /api/kickoff { token, answers } — the client submits the checklist. Answers land on the project,
 * the kickoff steps are checked off, and the owner gets an email (without the EIN).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = body?.token;
  if (!isTokenShape(token)) return reply({ error: "This kickoff link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "The checklist is unavailable right now." }, 503);
  try {
    const { sql, row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This kickoff link is no longer active. Ask for a new one." }, 404);
    if (row.status === "submitted") return reply({ error: "This checklist was already sent. Thanks!" }, 409);
    const tier = String(row.tier) as KickoffTier;
    const v = validateKickoff(body?.answers, tier);
    if ("error" in v) return reply({ error: v.error }, 400);
    const owner = String(row.owner_id);
    const saved = await sql`UPDATE public.kickoff_requests SET answers = ${JSON.stringify(v.ok)}::jsonb, status = 'submitted', submitted_at = now(), updated_at = now()
      WHERE id = ${row.id}::uuid AND status = 'open' RETURNING id`;
    if (!saved.length) return reply({ error: "This checklist was already sent. Thanks!" }, 409);

    const company = String(row.company || String(row.deal_title).split(" — ")[0] || "the client");
    const summary = kickoffSummary(v.ok, tier);
    const project = row.project_id ? String(row.project_id) : (await sql`SELECT id FROM public.projects WHERE owner_id = ${owner} AND deal_id = ${row.deal_id}::uuid LIMIT 1`)[0]?.id;
    if (project) {
      await sql`UPDATE public.projects SET notes = left(trim(both from concat_ws(E'\n\n', NULLIF(notes, ''), ${"KICKOFF CHECKLIST (" + new Date().toISOString().slice(0, 10) + ")\n" + summary})), 20000), updated_at = now()
        WHERE id = ${String(project)}::uuid AND owner_id = ${owner}`;
      await sql`UPDATE public.project_milestones SET status = 'done', completed_at = COALESCE(completed_at, now()), updated_at = now()
        WHERE owner_id = ${owner} AND project_id = ${String(project)}::uuid AND status <> 'done'
          AND lower(title) IN ('send the kickoff checklist link', 'collect the kickoff checklist')`;
    }
    if (row.contact_id) {
      await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
        VALUES (${owner}, ${String(row.contact_id)}::uuid, 'note', 'note', 'other', 'Sent the kickoff checklist. The 21-business-day go-live clock starts now.')`;
    }
    await sendAlert({ subject: `Kickoff checklist in: ${company}`, lines: [
      `${company} sent their kickoff checklist. The 21-business-day go-live clock starts now.`,
      "Next: book the kickoff call and submit the SMS registration (the EIN is on the deal, not in this email).",
    ], link: { label: "Open the deal", path: `/crm/deals/${String(row.deal_id)}` } });
    return reply({ ok: true });
  } catch (error) {
    console.error("Kickoff POST failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return reply({ error: "Couldn't send the checklist. Try again." }, 500);
  }
}
