import { neon } from "@neondatabase/serverless";
import { isTokenShape } from "@/lib/esign";
import { loadWorkspace } from "@/lib/workspace-data";
import { paymentLinkFor } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const TYPE_LABEL: Record<string, string> = { setup_fee: "Setup fee", monthly_retainer: "Monthly retainer", usage: "Usage", one_time: "One-time services" };
/** "Tier 1 · Speed to Lead — Monthly retainer (November 2026)"; falls back to the entry's own wording. */
function invoiceLine(title: string, type: string, plan: string): string {
  const period = title.match(/\(([A-Z][a-z]+ \d{4})\)\s*$/)?.[1];
  const own = title.split(" — ").slice(1).join(" — ").replace(/\s*\([A-Z][a-z]+ \d{4}\)\s*$/, "").trim();
  const what = TYPE_LABEL[type] ?? (own ? own.charAt(0).toUpperCase() + own.slice(1) : title);
  return [plan, what].filter(Boolean).join(" — ") + (period ? ` (${period})` : "");
}
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/** GET /api/invoice?token=… — public: one invoice behind its private link. No notes, no other records. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This invoice link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "This invoice is unavailable right now." }, 503);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT r.owner_id, r.title, r.amount, r.status, r.due_date, r.paid_at, r.invoice_number, r.created_at, r.revenue_type,
        COALESCE(NULLIF(c.company, ''), p.client_name, '') AS company, trim(concat_ws(' ', c.first_name, c.last_name)) AS person, COALESCE(c.email, '') AS email, d.service_type
      FROM public.revenue_entries r
      LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
      LEFT JOIN public.projects p ON p.id = r.project_id AND p.owner_id = r.owner_id
      LEFT JOIN public.deals d ON d.id = r.deal_id AND d.owner_id = r.owner_id
      WHERE r.invoice_token = ${token} AND r.invoice_number IS NOT NULL LIMIT 1` as Record<string, unknown>[];
    const r = rows[0];
    if (!r || r.status === "cancelled") return reply({ error: "This invoice is no longer active." }, 404);
    const ws = await loadWorkspace(String(r.owner_id));
    return reply({
      number: `INV-${r.invoice_number}`,
      issued: day(r.created_at), due: day(r.due_date),
      status: r.status === "paid" ? "paid" : "open", paidOn: day(r.paid_at),
      item: invoiceLine(String(r.title), String(r.revenue_type), r.service_type === "tier1_speed_to_lead" ? ws.tier1.label : r.service_type === "tier2_revenue_system" ? ws.tier2.label : ""), amount: Number(r.amount),
      to: { company: String(r.company || ""), person: String(r.person || ""), email: String(r.email || "") },
      from: { name: ws.businessName, legalName: ws.legalName, address: ws.address, email: ws.contactEmail },
      pay: { link: paymentLinkFor(ws, r.service_type ? String(r.service_type) : null, String(r.revenue_type), Number(r.amount)).link, instructions: ws.paymentInstructions },
    });
  } catch (error) {
    console.error("Invoice GET failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't load this invoice. Try again." }, 500);
  }
}
