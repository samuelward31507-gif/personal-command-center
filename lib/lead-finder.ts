// Lead finder, pure: turns Google Maps places into call-ready contacts and decides who's worth calling.
// The best Cinder prospects are busy local trade businesses: real reviews, a phone, open, not a franchise giant.

export type Place = {
  id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  websiteUri?: string; rating?: number; userRatingCount?: number; businessStatus?: string; primaryTypeDisplayName?: { text?: string };
};
export type Lead = { placeId: string; company: string; phone: string; website: string; location: string; rating: number | null; reviews: number; score: number; why: string };

export const TRADES = ["fence company", "fence contractor", "deck builder", "concrete contractor", "roofing contractor", "landscaping company", "hvac company", "plumber", "garage door company", "painting contractor", "auto detailing", "mobile auto detailing", "ceramic coating", "pressure washing", "pool contractor", "tree service", "remodeling contractor", "gutter company"];

const digits10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);
/** City, state from a Google address ("123 Main St, Aurora, CO 80012, USA" → "Aurora, CO"). */
export function cityState(address: string): string {
  const parts = (address || "").split(",").map(s => s.trim()).filter(Boolean);
  const i = parts.findIndex(p => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p));
  return i > 0 ? `${parts[i - 1]}, ${parts[i].slice(0, 2)}` : parts.slice(-3, -1).join(", ");
}

const BIG = /\b(home depot|lowe'?s|ace hardware|sears|angi|homeadvisor|thumbtack|servicemaster|mr\.? rooter|roto-rooter|one hour|aire serv|benjamin franklin|leaf ?filter|1-800|tuff shed)\b/i;
/**
 * How good a cold-call target this is, 0–100. Rewards: a phone, 10–400 reviews (busy enough to miss calls, small enough
 * that the owner answers), a decent rating. A missing website is good news too: it's an easy audit finding.
 */
export function scorePlace(p: Place): { score: number; why: string } {
  const phone = digits10(p.nationalPhoneNumber || p.internationalPhoneNumber || "");
  if (phone.length !== 10) return { score: 0, why: "no phone" };
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return { score: 0, why: "not open" };
  const name = p.displayName?.text || "";
  if (BIG.test(name)) return { score: 0, why: "national chain" };
  const n = p.userRatingCount ?? 0, r = p.rating ?? 0;
  let s = 40, why: string[] = [];
  if (n >= 10 && n <= 400) { s += 30; why.push(`${n} reviews`); } else if (n > 400) { s += 5; why.push("very large"); } else if (n > 0) { s += 12; why.push(`${n} reviews`); } else why.push("no reviews yet");
  if (r >= 4.3) s += 12; else if (r >= 3.8) s += 6; else if (r > 0) s -= 5;
  if (!p.websiteUri) { s += 10; why.push("no website"); }
  else if (/facebook\.com|instagram\.com|yelp\.com|business\.site|sites\.google/i.test(p.websiteUri)) { s += 8; why.push("no real website"); }
  return { score: Math.max(0, Math.min(100, s)), why: why.join(", ") };
}

export function toLead(p: Place): Lead | null {
  const phone = digits10(p.nationalPhoneNumber || p.internationalPhoneNumber || "");
  const company = (p.displayName?.text || "").trim();
  if (phone.length !== 10 || !company) return null;
  const { score, why } = scorePlace(p);
  return { placeId: p.id, company: company.slice(0, 120), phone: `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`, website: (p.websiteUri || "").slice(0, 300),
    location: cityState(p.formattedAddress || ""), rating: p.rating ?? null, reviews: p.userRatingCount ?? 0, score, why };
}

/** Leads worth calling, best first, minus anyone already in Contacts (by phone). */
export function pickLeads(places: Place[], existingPhones: Set<string>, minScore = 50): Lead[] {
  const seen = new Set<string>(), out: Lead[] = [];
  for (const p of places) {
    const l = toLead(p);
    if (!l || l.score < minScore) continue;
    const k = digits10(l.phone);
    if (existingPhones.has(k) || seen.has(k)) continue;
    seen.add(k); out.push(l);
  }
  return out.sort((a, b) => b.score - a.score);
}

export function noteFor(l: Lead, trade: string): string {
  return [`Found on Google Maps (${trade})`, l.rating ? `${l.rating}★ from ${l.reviews} reviews` : "", l.why].filter(Boolean).join(" · ");
}
