// The agency's offer catalog and pipeline stages, shared by the API and UI. No I/O.

export const DEAL_STAGES = ["new", "contacted", "meeting_booked", "meeting_held", "proposal", "won", "lost", "nurture"] as const;
export type DealStage = typeof DEAL_STAGES[number];
export const STAGE_LABELS: Record<DealStage, string> = {
  new: "New", contacted: "Contacted", meeting_booked: "Meeting booked", meeting_held: "Meeting held",
  proposal: "Proposal", won: "Won", lost: "Lost", nurture: "Nurture",
};
export const OPEN_STAGES: DealStage[] = ["new", "contacted", "meeting_booked", "meeting_held", "proposal", "nurture"];

export type Offer = { serviceType: string; label: string; setupFee: number; monthlyFee: number };
export const OFFERS = {
  tier1: { serviceType: "tier1_speed_to_lead", label: "Tier 1 · Speed to Lead", setupFee: 1500, monthlyFee: 997 },
  tier2: { serviceType: "tier2_revenue_system", label: "Tier 2 · Revenue System", setupFee: 3000, monthlyFee: 1500 },
} satisfies Record<string, Offer>;

/**
 * Pick the starting offer for a new deal: the tier the audit recommended, else the
 * niche default (pool → Tier 2, fence → Tier 1), else Tier 1. Tier 3 is waitlist-only
 * and never suggested. Prices are the catalog list prices; the founder can edit them.
 */
export function suggestOffer(company: string, auditVerdict: string | null): Offer {
  const v = auditVerdict ?? "";
  if (/\btier\s*2\b/i.test(v)) return OFFERS.tier2;
  if (/\btier\s*1\b/i.test(v)) return OFFERS.tier1;
  if (/\b(pool|pools|spa|spas)\b/i.test(company)) return OFFERS.tier2;
  return OFFERS.tier1;
}

export function suggestDeal(contact: { name: string; company: string }, auditVerdict: string | null, outcome: "interested" | "meeting_booked") {
  const offer = suggestOffer(contact.company, auditVerdict);
  const who = contact.company || contact.name || "New deal";
  return {
    title: `${who} — ${offer.label}`.slice(0, 240),
    serviceType: offer.serviceType,
    setupFee: offer.setupFee,
    monthlyFee: offer.monthlyFee,
    stage: (outcome === "meeting_booked" ? "meeting_booked" : "contacted") as DealStage,
    offerLabel: offer.label,
  };
}
