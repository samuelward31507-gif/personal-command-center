// The owner's own follow-ups, the server side: saving the rules, and the pass that sends what's due. Every send goes
// through sendToCustomer (the business's number, the opt-out line, the do-not-text list, logged on the conversation),
// only inside texting hours, never to an opted-out customer, and each rule reaches each customer once.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { mergeRules, readRules, type Rule } from "@/lib/automations";
import { fill, inTextingHours } from "@/lib/client-runtime";
import { clientById, sendToCustomer, type Client } from "@/lib/client-runtime-run";

type Sql = NeonQueryFunction<false, false>;

export async function saveRules(sql: Sql, c: Client, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const rules = mergeRules(input, readRules(c.setup.automations), new Date().toISOString(), () => randomBytes(5).toString("hex"));
  if ("error" in rules) return { ok: false, error: rules.error };
  await sql`UPDATE public.client_ops SET setup = setup || ${JSON.stringify({ automations: JSON.stringify(rules) })}::jsonb, updated_at = now() WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
  return { ok: true };
}

/** Customers a rule is due for now: hit the trigger after the rule's start, waited long enough, not sent before. */
async function dueFor(sql: Sql, c: Client, r: Rule): Promise<{ id: string; customer_phone: string; customer_name: string }[]> {
  if (r.trigger === "paid") return await sql`SELECT DISTINCT ON (t.id) t.id, t.customer_phone, t.customer_name FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
    WHERE i.project_id = ${c.projectId}::uuid AND i.status = 'paid' AND i.paid_at >= ${r.since}::timestamptz AND i.paid_at <= now() - make_interval(days => ${r.days})
      AND t.status <> 'opted_out' AND NOT EXISTS (SELECT 1 FROM public.client_auto_sends s WHERE s.project_id = t.project_id AND s.rule_id = ${r.id} AND s.thread_id = t.id)
    ORDER BY t.id LIMIT 20` as { id: string; customer_phone: string; customer_name: string }[];
  return await sql`SELECT t.id, t.customer_phone, t.customer_name FROM public.client_threads t
    WHERE t.project_id = ${c.projectId}::uuid AND t.stage = ${r.trigger} AND t.stage_at IS NOT NULL AND t.stage_at >= ${r.since}::timestamptz AND t.stage_at <= now() - make_interval(days => ${r.days})
      AND t.status <> 'opted_out' AND NOT EXISTS (SELECT 1 FROM public.client_auto_sends s WHERE s.project_id = t.project_id AND s.rule_id = ${r.id} AND s.thread_id = t.id)
    ORDER BY t.stage_at LIMIT 20` as { id: string; customer_phone: string; customer_name: string }[];
}

/** The pass the scheduler runs a few times a day. */
export async function runAutomations(sql: Sql, limit = 120): Promise<{ sent: number; failed: number }> {
  const ops = await sql`SELECT owner_id, project_id FROM public.client_ops WHERE coalesce(setup->>'automations', '') NOT IN ('', '[]') LIMIT 500` as { owner_id: string; project_id: string }[];
  let sent = 0, failed = 0;
  for (const o of ops) {
    if (sent + failed >= limit) break;
    const c = await clientById(sql, o.owner_id, o.project_id).catch(() => null);
    if (!c || !c.setup.texting_number || c.setup.agent_paused === "yes") continue;
    if (!inTextingHours(c.setup.timezone || "America/Denver")) continue;
    const vars = { business: c.setup.display_name || "", owner: (c.setup.owner_name || "").split(" ")[0], review_link: c.setup.review_link || "" };
    for (const r of readRules(c.setup.automations).filter(x => x.on)) {
      for (const t of await dueFor(sql, c, r)) {
        if (sent + failed >= limit) break;
        // Claim it first, so two passes at once can't both send.
        const [claim] = await sql`INSERT INTO public.client_auto_sends (project_id, rule_id, thread_id) VALUES (${c.projectId}::uuid, ${r.id}, ${t.id}::uuid) ON CONFLICT DO NOTHING RETURNING rule_id`;
        if (!claim) continue;
        const ok = await sendToCustomer(sql, c, t.id, t.customer_phone, fill(r.message, { ...vars, first: (t.customer_name || "").split(" ")[0] }), "template").catch(() => false);
        await sql`UPDATE public.client_auto_sends SET ok = ${ok} WHERE project_id = ${c.projectId}::uuid AND rule_id = ${r.id} AND thread_id = ${t.id}::uuid`;
        if (ok) sent++; else failed++;
      }
    }
  }
  return { sent, failed };
}
