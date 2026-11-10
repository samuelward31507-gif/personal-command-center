import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { isTokenShape } from "@/lib/esign";
import { leakMath, readInputs, SPEEDS } from "@/lib/prospect-report";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** True when the person opening the link is signed in to Cinder (you previewing it), so it doesn't count as a view. */
async function isOwnerPreview() {
  try { const r = await getAllowedSession(); return !!r?.data?.session; } catch { return false; }
}

/** GET /api/report?token=… — public: one prospect report behind its private link. Counts the open. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This report link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "This report is unavailable right now." }, 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT owner_id, company, trade, inputs, findings, note, created_at FROM public.prospect_reports WHERE token = ${token} LIMIT 1` as Record<string, unknown>[];
    const r = rows[0];
    if (!r) return reply({ error: "This report is no longer available." }, 404);
    if (!(await isOwnerPreview())) {
      await sql`UPDATE public.prospect_reports SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, now()), last_viewed_at = now() WHERE token = ${token}`;
      // Their audit is open right now: put a call at the top of today's list (once a day per prospect).
      await sql`INSERT INTO public.tasks (owner_id, title, description, due_at, contact_id, priority)
        SELECT r.owner_id, 'Call now: opened their audit', ${"They opened the free audit for " + String(r.company) + ". Call while it's fresh."}, now(), r.contact_id, 'high'
        FROM public.prospect_reports r WHERE r.token = ${token} AND r.contact_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.owner_id = r.owner_id AND t.contact_id = r.contact_id AND t.title = 'Call now: opened their audit' AND t.created_at > now() - interval '20 hours')`.catch(() => {});
    }
    const ws = await loadWorkspace(String(r.owner_id));
    const trade = String(r.trade);
    const inputs = readInputs(r.inputs, trade);
    return reply({
      company: String(r.company), trade, inputs, speedLabel: SPEEDS[inputs.speed].label, result: leakMath(inputs),
      findings: Array.isArray(r.findings) ? r.findings.map(String) : [], note: String(r.note ?? ""),
      date: r.created_at instanceof Date ? r.created_at.toISOString().slice(0, 10) : String(r.created_at).slice(0, 10),
      from: { name: ws.businessName, owner: ws.ownerFirstName, email: ws.contactEmail, booking: ws.bookingLink },
    });
  } catch (error) {
    console.error("Report fetch failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "This report is unavailable right now." }, 500);
  }
}
