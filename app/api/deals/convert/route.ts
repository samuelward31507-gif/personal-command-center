import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  try {
    const result = await auth.getSession();
    const session = result?.data?.session;
    const user = result?.data?.user;
    if (!session || !user?.id) return fail("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.dealId !== "string" || !uuid.test(body.dealId)) return fail("A valid deal id is required.", 400);
    const ownerId = String(user.id);
    const sql = neon(process.env.DATABASE_URL || "");
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 500);

    const deals = await sql`
      SELECT d.id, d.contact_id, d.title, d.service_type, d.stage, d.setup_fee,
        d.monthly_fee, d.agreement_status, d.signed_at, d.effective_at,
        trim(concat_ws(' ', c.first_name, c.last_name)) AS contact_name,
        c.company
      FROM public.deals d
      LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.id = ${body.dealId}::uuid AND d.owner_id = ${ownerId}
      LIMIT 1
    `;
    const deal = deals[0];
    if (!deal) return fail("Deal not found.", 404);
    if (deal.stage !== "won" || deal.agreement_status !== "active" || !deal.signed_at) {
      return fail("Mark the deal won only after the agreement is signed, then retry this handoff.", 409);
    }

    const clientName = String(deal.company || deal.contact_name || deal.title).slice(0, 240);
    const projects = await sql`
      INSERT INTO public.projects
        (owner_id, contact_id, deal_id, name, client_name, service_type, status,
         start_date, target_date, monthly_value, setup_value, notes)
      VALUES
        (${ownerId}, ${deal.contact_id}::uuid, ${deal.id}::uuid,
         ${String(deal.title).slice(0, 240)}, ${clientName}, ${deal.service_type},
         'onboarding', COALESCE(${deal.effective_at}::date, CURRENT_DATE), NULL,
         ${Number(deal.monthly_fee)}, ${Number(deal.setup_fee)},
         'Created from signed deal handoff. Confirm scope, access, milestones, and launch criteria.')
      ON CONFLICT (owner_id, deal_id) WHERE deal_id IS NOT NULL
      DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    const projectId = String(projects[0].id);

    if (deal.contact_id) {
      await sql`UPDATE public.contacts SET status = 'customer', updated_at = now()
        WHERE id = ${deal.contact_id}::uuid AND owner_id = ${ownerId}`;
    }
    if (Number(deal.setup_fee) > 0) {
      await sql`INSERT INTO public.revenue_entries
        (owner_id, contact_id, deal_id, project_id, title, revenue_type, amount, status, due_date, source_key, notes)
        VALUES (${ownerId}, ${deal.contact_id}::uuid, ${deal.id}::uuid, ${projectId}::uuid,
          ${clientName + " — setup fee"}, 'setup_fee', ${Number(deal.setup_fee)}, 'expected',
          COALESCE(${deal.effective_at}::date, CURRENT_DATE), ${"deal:" + deal.id + ":setup"},
          'Expected receivable created by signed-deal handoff; not cash collected.')
        ON CONFLICT (owner_id, source_key) WHERE source_key <> '' DO NOTHING`;
    }
    if (Number(deal.monthly_fee) > 0) {
      await sql`INSERT INTO public.revenue_entries
        (owner_id, contact_id, deal_id, project_id, title, revenue_type, amount, status, due_date, source_key, notes)
        VALUES (${ownerId}, ${deal.contact_id}::uuid, ${deal.id}::uuid, ${projectId}::uuid,
          ${clientName + " — first monthly retainer"}, 'monthly_retainer', ${Number(deal.monthly_fee)}, 'expected',
          COALESCE(${deal.effective_at}::date, CURRENT_DATE), ${"deal:" + deal.id + ":first_month"},
          'First-period expected receivable created by signed-deal handoff; future billing periods are not auto-generated.')
        ON CONFLICT (owner_id, source_key) WHERE source_key <> '' DO NOTHING`;
    }
    await sql`UPDATE public.deals SET conversion_completed_at = COALESCE(conversion_completed_at, now()), updated_at = now()
      WHERE id = ${deal.id}::uuid AND owner_id = ${ownerId}`;
    return Response.json({ ok: true, projectId, message: "Signed deal connected to client delivery and expected receivables. No payment was recorded." });
  } catch (error) {
    console.error("Signed deal handoff failed", error);
    return fail("Unable to convert signed deal. Retry safely after checking the project and finance records.", 500);
  }
}
