// Lead finder, pure: turns Google Maps places into call-ready contacts and decides who's worth calling.
// Cinder sells to two niches: residential fence installers and standby generator dealers (ICP in the sales playbook).

export type Place = {
  id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  websiteUri?: string; rating?: number; userRatingCount?: number; businessStatus?: string; primaryTypeDisplayName?: { text?: string };
};
export type Lead = { placeId: string; company: string; phone: string; website: string; location: string; rating: number | null; reviews: number; score: number; why: string };

export const TRADES = ["standby generator dealer", "fence company", "fence contractor", "generac dealer", "standby generator installer", "pole barn builder", "deck builder", "concrete contractor", "roofing contractor", "landscaping company", "hvac company", "plumber", "garage door company", "painting contractor", "auto detailing", "mobile auto detailing", "ceramic coating", "pressure washing", "pool contractor", "tree service", "remodeling contractor", "gutter company"];

const digits10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);
/** City, state from a Google address ("123 Main St, Aurora, CO 80012, USA" → "Aurora, CO"). */
export function cityState(address: string): string {
  const parts = (address || "").split(",").map(s => s.trim()).filter(Boolean);
  const i = parts.findIndex(p => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p));
  return i > 0 ? `${parts[i - 1]}, ${parts[i].slice(0, 2)}` : parts.slice(-3, -1).join(", ");
}

const BIG = /\b(home depot|lowe'?s|ace hardware|sears|angi|homeadvisor|thumbtack|servicemaster|mr\.? rooter|roto-rooter|one hour|aire serv|benjamin franklin|leaf ?filter|1-800|tuff shed|superior fence (?:&|and) rail|top rail fence|mossy oak fence|fence ?masters|generator supercenter|mr\.? electric|mister sparky)\b/i;
/** Not installers: supply yards, rentals, wholesalers. */
const NOT_INSTALLER = /\b(supply|supplies|lumber|wholesale|rental|rentals|distribut\w*|outlet|depot)\b/i;
const SOCIAL = /facebook\.com|instagram\.com|yelp\.com|business\.site|sites\.google|linktr\.ee/i;

/** Which Cinder niche a search belongs to. */
export type Niche = "Fence" | "Standby generators" | "";
export function nicheOf(trade: string): Niche {
  if (/fenc/i.test(trade)) return "Fence";
  if (/generat|generac|kohler|standby/i.test(trade)) return "Standby generators";
  return "";
}

/**
 * The ICP filter (see the sales playbook): an established local installer, big enough to have steady jobs and pay for
 * leads, small enough that the owner still picks up. Google Maps can't see ads, so this only keeps the companies
 * worth checking; Lister upgrades the ones paying for leads to grade A.
 * Hard rules: real phone, open, not a franchise or supply yard, rating 4.0+, a real website (they market themselves),
 * enough reviews to be busy (fence 40+, generators 25+: dealers collect fewer reviews), and not a giant (600+).
 */
export function scorePlace(p: Place, trade = ""): { score: number; why: string } {
  const phone = digits10(p.nationalPhoneNumber || p.internationalPhoneNumber || "");
  if (phone.length !== 10) return { score: 0, why: "no phone" };
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return { score: 0, why: "not open" };
  const name = p.displayName?.text || "";
  if (BIG.test(name)) return { score: 0, why: "franchise or national chain" };
  if (NOT_INSTALLER.test(name)) return { score: 0, why: "supply yard or rental, not an installer" };
  const n = p.userRatingCount ?? 0, r = p.rating ?? 0;
  const min = nicheOf(trade) === "Standby generators" ? 25 : 40;
  if (n < min) return { score: 0, why: `only ${n} reviews, too small` };
  if (n > 600) return { score: 0, why: `${n} reviews, too big (front desk, sales team)` };
  if (r < 4.0) return { score: 0, why: `${r}★, under 4.0` };
  if (!p.websiteUri || SOCIAL.test(p.websiteUri)) return { score: 0, why: "no real website" };
  let s = 50; const why: string[] = [];
  if (n <= 300) { s += 30; why.push(`${n} reviews, busy owner-run size`); } else { s += 12; why.push(`${n} reviews, may have an office`); }
  if (r >= 4.6) { s += 15; why.push(`${r}★`); } else { s += 5; why.push(`${r}★`); }
  return { score: Math.min(100, s), why: why.join(", ") };
}

export function toLead(p: Place, trade = ""): Lead | null {
  const phone = digits10(p.nationalPhoneNumber || p.internationalPhoneNumber || "");
  const company = (p.displayName?.text || "").trim();
  if (phone.length !== 10 || !company) return null;
  const { score, why } = scorePlace(p, trade);
  return { placeId: p.id, company: company.slice(0, 120), phone: `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`, website: (p.websiteUri || "").slice(0, 300),
    location: cityState(p.formattedAddress || ""), rating: p.rating ?? null, reviews: p.userRatingCount ?? 0, score, why };
}

/** Leads worth calling, best first, minus anyone already in Contacts (by phone). */
export function pickLeads(places: Place[], existingPhones: Set<string>, trade = "", minScore = 50): Lead[] {
  const seen = new Set<string>(), out: Lead[] = [];
  for (const p of places) {
    const l = toLead(p, trade);
    if (!l || l.score < minScore) continue;
    const k = digits10(l.phone);
    if (existingPhones.has(k) || seen.has(k)) continue;
    seen.add(k); out.push(l);
  }
  return out.sort((a, b) => b.score - a.score);
}

export function noteFor(l: Lead, trade: string): string {
  // Grade B by default: passes the ICP filter, ads not checked yet. Lister upgrades it to A when they pay for leads.
  return [`Lead grade: B`, `Found on Google Maps (${trade})`, l.rating ? `${l.rating}★ from ${l.reviews} reviews` : "", l.why, "Ads: not checked"].filter(Boolean).join(" · ");
}
