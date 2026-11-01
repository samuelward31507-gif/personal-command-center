import type { NeonQueryFunction } from "@neondatabase/serverless";
import { newSigningToken, hashToken } from "@/lib/esign";

export const publicOrigin = (requestUrl: string) => process.env.CINDER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || new URL(requestUrl).origin;

/**
 * New kickoff-checklist link for a won Tier 1 / Tier 2 deal. Voids older open links; stores only the token's hash.
 * Returns null when the deal isn't on a plan with a checklist.
 */
export async function createKickoffLink(sql: NeonQueryFunction<false, false>, ownerId: string, dealId: string, origin: string): Promise<string | null> {
  const rows = await sql`SELECT d.service_type, p.id AS project_id FROM public.deals d
    LEFT JOIN public.projects p ON p.deal_id = d.id AND p.owner_id = d.owner_id
    WHERE d.id = ${dealId}::uuid AND d.owner_id = ${ownerId} LIMIT 1`;
  if (!rows.length) return null;
  const st = String(rows[0].service_type ?? "");
  const tier = st === "tier1_speed_to_lead" ? "tier1" : st === "tier2_revenue_system" ? "tier2" : null;
  if (!tier) return null;
  const token = newSigningToken();
  await sql`UPDATE public.kickoff_requests SET status = 'void', updated_at = now() WHERE owner_id = ${ownerId} AND deal_id = ${dealId}::uuid AND status = 'open'`;
  await sql`INSERT INTO public.kickoff_requests (owner_id, deal_id, project_id, tier, token_hash)
    VALUES (${ownerId}, ${dealId}::uuid, ${rows[0].project_id ? String(rows[0].project_id) : null}::uuid, ${tier}, ${hashToken(token)})`;
  return `${origin}/kickoff/${token}`;
}
