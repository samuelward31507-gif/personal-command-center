// Lead finder, pure: turns Google Maps places into call-ready contacts and decides who's worth calling.
// Cinder sells to two niches: residential fence installers and standby generator dealers (ICP in the sales playbook).

export type Place = {
  id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  websiteUri?: string; rating?: number; userRatingCount?: number; businessStatus?: string; primaryTypeDisplayName?: { text?: string };
  regularOpeningHours?: { periods?: { open?: { day?: number; hour?: number }; close?: { day?: number; hour?: number } }[] };
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

/** Days of the week (0 = Sunday) the listing says they're open, or null when Google has no hours. */
export function openDays(p: Place): Set<number> | null {
  const periods = p.regularOpeningHours?.periods;
  if (!periods?.length) return null;
  if (periods.length === 1 && !periods[0].close) return new Set([0, 1, 2, 3, 4, 5, 6]); // open 24/7
  return new Set(periods.map(x => x.open?.day).filter((d): d is number => typeof d === "number"));
}

/** Fence demand dies December–February outside the Sunbelt (frozen ground, no leads). */
const COLD = new Set(["AK","CO","CT","DE","IA","ID","IL","IN","KS","MA","MD","ME","MI","MN","MO","MT","ND","NE","NH","NJ","NY","OH","OR","PA","RI","SD","UT","VT","WA","WI","WV","WY"]);
export const inWinterLull = (state: string, month: number) => COLD.has(state) && (month === 11 || month <= 1);

/**
 * The ICP (sales playbook, "Who we call"): companies that lose real money to slow replies. That takes four things at
 * once: enough leads (an established shop, not a 2-person crew), leads they compete for (homeowners get 3 quotes;
 * shared leads go to up to 5 pros), nobody free to answer fast (crews in the field, closed weekends), and a big
 * ticket. Google can't see lead volume or ads, so this keeps the companies worth checking and ranks them;
 * Lister marks the ones paying for leads as A, and the call itself confirms volume.
 * Signals that earned their place from Sam's own calls: closed a weekend day (41% interested vs 22%).
 * Hard rules: real phone, open, not a franchise or supply yard, 4.0+, 40–600 reviews (generators 25–600).
 */
export function scorePlace(p: Place, trade = "", now = new Date()): { score: number; why: string } {
  const phone = digits10(p.nationalPhoneNumber || p.internationalPhoneNumber || "");
  if (phone.length !== 10) return { score: 0, why: "no phone" };
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return { score: 0, why: "not open" };
  const name = p.displayName?.text || "";
  if (BIG.test(name)) return { score: 0, why: "franchise or national chain" };
  if (NOT_INSTALLER.test(name)) return { score: 0, why: "supply yard or rental, not an installer" };
  const n = p.userRatingCount ?? 0, r = p.rating ?? 0, niche = nicheOf(trade);
  const min = niche === "Standby generators" ? 25 : 40;
  if (n < min) return { score: 0, why: `only ${n} reviews, too small for steady leads` };
  if (n > 600) return { score: 0, why: `${n} reviews, too big (has a front desk)` };
  if (r < 4.0) return { score: 0, why: `${r}★, under 4.0` };
  let s = 45; const why: string[] = [];
  if (n <= 300) { s += 25; why.push(`${n} reviews, established but owner-run`); } else { s += 10; why.push(`${n} reviews, may have an office`); }
  if (r >= 4.6) s += 5;
  why.push(`${r}★`);
  const days = openDays(p);
  if (days && (!days.has(6) || !days.has(0))) { s += 15; why.push(!days.has(6) ? "closed Saturdays" : "closed Sundays"); }
  if (p.websiteUri && !SOCIAL.test(p.websiteUri)) s += 10; else why.push("no real website");
  const state = /,\s*([A-Z]{2})\s+\d{5}/.exec(p.formattedAddress || "")?.[1] ?? "";
  if (niche === "Fence" && inWinterLull(state, now.getMonth())) { s -= 20; why.push("winter lull in " + state); }
  return { score: Math.max(0, Math.min(100, s)), why: why.join(", ") };
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
