// Loads and saves the founding offer settings (stored with the workspace settings) and counts founding spots used.
import { neon } from "@neondatabase/serverless";
import { mergeOffer, spotsLeft, FOUNDING_ACTIVE_STATUSES, type OfferSettings } from "@/lib/founding-offer";

export async function loadOffer(ownerId: string): Promise<{ offer: OfferSettings; used: number; left: number }> {
  const fallback = mergeOffer(null);
  if (!process.env.DATABASE_URL) return { offer: fallback, used: 0, left: spotsLeft(fallback, 0) };
  const sql = neon(process.env.DATABASE_URL);
  let offer = fallback, used = 0;
  try {
    const rows = await sql`SELECT settings->'offer' AS offer, settings->'tier2' AS tier2 FROM public.workspace_settings WHERE owner_id = ${ownerId}`;
    offer = mergeOffer(rows[0]?.offer);
    // Prices have one home: the Book & Close plan in Settings → Workspace. The call scripts always quote that.
    const t2 = rows[0]?.tier2 as { label?: string; setupFee?: number; monthlyFee?: number } | null;
    if (t2 && Number(t2.setupFee) > 0 && Number(t2.monthlyFee) > 0) {
      offer = { ...offer, offerName: t2.label || offer.offerName, setupFee: Number(t2.setupFee), standardSetup: Number(t2.setupFee), monthly: Number(t2.monthlyFee), spotsTotal: 0 };
    }
  } catch { /* keep defaults */ }
  try {
    const r = await sql`SELECT count(*)::int AS n FROM public.projects WHERE owner_id = ${ownerId} AND offer = 'founding' AND status = ANY(${[...FOUNDING_ACTIVE_STATUSES]})`;
    used = Number(r[0]?.n ?? 0);
  } catch { /* column not created yet */ }
  return { offer, used, left: spotsLeft(offer, used) };
}

export async function saveOffer(ownerId: string, offer: OfferSettings): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const sql = neon(process.env.DATABASE_URL);
  await sql`INSERT INTO public.workspace_settings (owner_id, settings) VALUES (${ownerId}, jsonb_build_object('offer', ${JSON.stringify(offer)}::jsonb))
    ON CONFLICT (owner_id) DO UPDATE SET settings = public.workspace_settings.settings || jsonb_build_object('offer', ${JSON.stringify(offer)}::jsonb), updated_at = now()`;
}
