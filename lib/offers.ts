// The agency's offer catalog and pipeline stages, shared by the API and UI. No I/O.

export const DEAL_STAGES = ["new", "contacted", "meeting_booked", "meeting_held", "proposal", "won", "lost", "nurture"] as const;
export type DealStage = typeof DEAL_STAGES[number];
export const STAGE_LABELS: Record<DealStage, string> = {
  new: "New", contacted: "Contacted", meeting_booked: "Meeting booked", meeting_held: "Meeting held",
  proposal: "Proposal", won: "Won", lost: "Lost", nurture: "Nurture",
};
export const OPEN_STAGES: DealStage[] = ["new", "contacted", "meeting_booked", "meeting_held", "proposal", "nurture"];

/**
 * Default close probability by stage, used for the weighted pipeline. These are planning assumptions,
 * shown as "weighted by stage", never presented as a forecast of actual results.
 */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  new: 0.05, contacted: 0.1, meeting_booked: 0.25, meeting_held: 0.4, proposal: 0.6, won: 1, lost: 0, nurture: 0.05,
};

/** Weighted value of open deals: each deal's setup fee and monthly fee multiplied by its stage probability. */
export function weightedPipeline(deals: { stage: string; setupFee: number; monthlyFee: number }[]): { setup: number; monthly: number } {
  let setup = 0, monthly = 0;
  for (const d of deals) {
    const p = STAGE_PROBABILITY[d.stage as DealStage];
    if (p === undefined || d.stage === "won" || d.stage === "lost") continue;
    setup += (Number(d.setupFee) || 0) * p;
    monthly += (Number(d.monthlyFee) || 0) * p;
  }
  return { setup: Math.round(setup), monthly: Math.round(monthly) };
}

export type Offer = { serviceType: string; label: string; setupFee: number; monthlyFee: number };
export const OFFERS = {
  tier1: { serviceType: "tier1_speed_to_lead", label: "Tier 1 · Speed to Lead", setupFee: 1500, monthlyFee: 997 },
  tier2: { serviceType: "tier2_revenue_system", label: "Tier 2 · Revenue System", setupFee: 3000, monthlyFee: 1500 },
} satisfies Record<string, Offer>;

/**
 * Pick the starting offer for a new deal: the tier the audit recommended, else the
 * niche default (pool → Tier 2, fence → Tier 1), else Tier 1. Tier 3 is waitlist-only
 * and never suggested. Prices come from Workspace settings (passed in); the built-in list is the fallback.
 */
export type OfferCatalog = { tier1: Offer; tier2: Offer };

export function suggestOffer(company: string, auditVerdict: string | null, offers: OfferCatalog = OFFERS): Offer {
  const v = auditVerdict ?? "";
  if (/\btier\s*2\b/i.test(v)) return offers.tier2;
  if (/\btier\s*1\b/i.test(v)) return offers.tier1;
  if (/\b(pool|pools|spa|spas)\b/i.test(company)) return offers.tier2;
  return offers.tier1;
}

export function suggestDeal(contact: { name: string; company: string }, auditVerdict: string | null, outcome: "interested" | "meeting_booked", offers: OfferCatalog = OFFERS) {
  const offer = suggestOffer(contact.company, auditVerdict, offers);
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
