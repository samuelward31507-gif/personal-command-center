import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { newSigningToken } from "@/lib/esign";
import { owedSummary, reminderEmail, retainerPlan, nextMove, type OwedEntry, type RetainerDeal } from "@/lib/invoice";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const origin = (request: Request) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(request.url).origin;

type Sql = ReturnType<typeof neon>;
async function openEntries(sql: Sql, owner: string): Promise<(OwedEntry & { token: string | null })[]> {
  const rows = await sql`
    SELECT r.id, r.title, r.amount, r.status, r.due_date, r.invoice_number, r.invoice_token, r.invoice_sent_at, r.reminded_at,
      COALESCE(NULLIF(c.company, ''), NULLIF(trim(concat_ws(' ', c.first_name, c.last_name)), ''), p.client_name, '') AS client,
      trim(concat_ws(' ', c.first_name, c.last_name)) AS person, COALESCE(c.email, '') AS email
    FROM public.revenue_entries r
    LEFT JOIN public.contacts c ON c.id = r.contact_id AND c.owner_id = r.owner_id
    LEFT JOIN public.projects p ON p.id = r.project_id AND p.owner_id = r.owner_id
    WHERE r.owner_id = ${owner} AND r.status IN ('expected', 'overdue')
    ORDER BY r.due_date NULLS LAST LIMIT 500` as Record<string, unknown>[];
  return rows.map(r => ({
    id: String(r.id), title: String(r.title), client: String(r.person || r.client || ""), email: String(r.email || ""), amount: Number(r.amount),
    status: String(r.status), dueDate: day(r.due_date), invoiceNumber: r.invoice_number == null ? null : Number(r.invoice_number),
    invoiceSentAt: iso(r.invoice_sent_at), remindedAt: iso(r.reminded_at), token: r.invoice_token ? String(r.invoice_token) : null,
  }));
}

/** GET /api/invoices — who owes you, grouped by urgency, plus how many retainers this month would bill. */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    if (!process.env.DATABASE_URL) return reply({ error: "DATABASE_URL is not configured." }, 503);
    const sql = neon(process.env.DATABASE_URL);
    const ws = await loadWorkspace(user.id);
    const today = todayIn(ws.timezone);
    const entries = await openEntries(sql, user.id);
    const summary = owedSummary(entries, today);
    const plan = retainerPlan(await activeDeals(sql, user.id), today.slice(0, 7), await existingKeys(sql, user.id, today.slice(0, 7)));
    const base = origin(request);
    return reply({
      today, ...summary,
      groups: summary.groups.map(g => ({ ...g, items: g.items.map(e => ({ ...e, token: undefined, url: (e as { token?: string | null }).token ? `${base}/invoice/${(e as { token?: string }).token}` : null, next: nextMove(e, today) })) })),
      retainersToBill: plan.create.length, paymentReady: !!(ws.paymentLink || ws.paymentInstructions),
    });
  } catch (error) {
    console.error("Invoices GET failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't load invoices." }, 500);
  }
}

async function activeDeals(sql: Sql, owner: string): Promise<RetainerDeal[]> {
  const rows = await sql`
    SELECT d.id, d.contact_id, d.monthly_fee, d.effective_at, d.ended_at, d.agreement_status, p.id AS project_id,
      COALESCE(NULLIF(c.company, ''), NULLIF(trim(concat_ws(' ', c.first_name, c.last_name)), ''), d.title) AS client
    FROM public.deals d
    LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    LEFT JOIN public.projects p ON p.deal_id = d.id AND p.owner_id = d.owner_id
    WHERE d.owner_id = ${owner} AND d.stage = 'won'` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), contactId: r.contact_id ? String(r.contact_id) : null, projectId: r.project_id ? String(r.project_id) : null,
    client: String(r.client), monthlyFee: Number(r.monthly_fee), effectiveAt: day(r.effective_at), endedAt: day(r.ended_at), agreementStatus: String(r.agreement_status) }));
}
async function existingKeys(sql: Sql, owner: string, month: string) {
  const rows = await sql`SELECT source_key FROM public.revenue_entries WHERE owner_id = ${owner} AND source_key LIKE ${"retainer:%:" + month}` as { source_key: string }[];
  return new Set(rows.map(r => r.source_key));
}

/**
 * POST /api/invoices
 *  { action: "invoice", id }   → give the entry an invoice number and private link; returns the link and an email draft.
 *  { action: "sent", id }      → you sent it (sets invoice_sent_at).
 *  { action: "reminded", id }  → you chased it (sets reminded_at).
 *  { action: "bill-month" }    → create this month's retainer invoices for active clients. Safe to run twice.
 * Nothing is emailed or charged by Cinder.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    if (!process.env.DATABASE_URL) return reply({ error: "DATABASE_URL is not configured." }, 503);
    const body = await request.json().catch(() => ({}));
    const sql = neon(process.env.DATABASE_URL);
    const ws = await loadWorkspace(user.id);
    const today = todayIn(ws.timezone);

    if (body.action === "bill-month") {
      const month = today.slice(0, 7);
      const plan = retainerPlan(await activeDeals(sql, user.id), month, await existingKeys(sql, user.id, month));
      let created = 0;
      for (const e of plan.create) {
        const rows = await sql`INSERT INTO public.revenue_entries (owner_id, contact_id, deal_id, project_id, title, revenue_type, amount, status, due_date, source_key, notes)
          VALUES (${user.id}, ${e.contactId}::uuid, ${e.dealId}::uuid, ${e.projectId}::uuid, ${e.title.slice(0, 240)}, 'monthly_retainer', ${e.amount}, 'expected', ${e.dueDate}::date, ${e.sourceKey}, 'Monthly retainer billed from Money.')
          ON CONFLICT (owner_id, source_key) WHERE source_key <> '' DO NOTHING RETURNING id`;
        created += rows.length;
      }
      return reply({ created, skipped: plan.skipped });
    }

    if (typeof body.id !== "string" || !UUID.test(body.id)) return reply({ error: "Valid invoice id is required." }, 400);

    if (body.action === "sent" || body.action === "reminded") {
      const rows = body.action === "sent"
        ? await sql`UPDATE public.revenue_entries SET invoice_sent_at = COALESCE(invoice_sent_at, now()), updated_at = now() WHERE id = ${body.id}::uuid AND owner_id = ${user.id} AND invoice_number IS NOT NULL RETURNING id`
        : await sql`UPDATE public.revenue_entries SET reminded_at = now(), invoice_sent_at = COALESCE(invoice_sent_at, now()), updated_at = now() WHERE id = ${body.id}::uuid AND owner_id = ${user.id} AND invoice_number IS NOT NULL RETURNING id`;
      return rows.length ? reply({ ok: true }) : reply({ error: "Create the invoice first." }, 400);
    }

    if (body.action === "invoice") {
      const found = await sql`SELECT id, invoice_number, invoice_token, status FROM public.revenue_entries WHERE id = ${body.id}::uuid AND owner_id = ${user.id}` as Record<string, unknown>[];
      if (!found.length) return reply({ error: "Invoice not found." }, 404);
      if (found[0].status === "cancelled") return reply({ error: "This entry is cancelled." }, 400);
      if (!found[0].invoice_number) {
        await sql`UPDATE public.revenue_entries SET
            invoice_number = (SELECT COALESCE(max(invoice_number), 1000) + 1 FROM public.revenue_entries WHERE owner_id = ${user.id}),
            invoice_token = COALESCE(invoice_token, ${newSigningToken()}), updated_at = now()
          WHERE id = ${body.id}::uuid AND owner_id = ${user.id} AND invoice_number IS NULL`;
      }
      const entry = (await openEntries(sql, user.id)).find(e => e.id === body.id);
      const row = entry ?? null;
      const token = row?.token ?? String((await sql`SELECT invoice_token FROM public.revenue_entries WHERE id = ${body.id}::uuid AND owner_id = ${user.id}`)[0]?.invoice_token ?? "");
      const url = `${origin(request)}/invoice/${token}`;
      const draft = row ? reminderEmail(row, today, ws, url) : null;
      return reply({ url, email: row?.email ?? "", draft, invoiceNumber: row?.invoiceNumber ?? null });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Invoices POST failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't update the invoice." }, 500);
  }
}
