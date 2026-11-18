// Hiring finder, pure: home-service companies with an open job for someone to answer their phones.
// A company hiring a receptionist gets more calls than it can answer and has budgeted a salary to fix it,
// which makes it the best prospect for a voice receptionist or speed to lead. Job data comes from Adzuna,
// a job-board aggregator; each employer is then matched to its Google Maps listing for a real phone number.

export type Job = {
  id?: string; title?: string; description?: string; created?: string; redirect_url?: string;
  company?: { display_name?: string }; location?: { display_name?: string; area?: string[] };
};
export type HiringLead = { jobId: string; company: string; role: string; location: string; url: string; posted: string; trade: string };

/** Searches the nightly run makes: a trade word plus the phone roles (Adzuna's what = all words, what_or = any). */
/** Sam's niches first; the other trades only fill in when the niches come up short (see findHiring). */
export const HIRING_NICHE_TRADES = ["fence", "generator", "generac"];
export const HIRING_OTHER_TRADES = ["hvac", "plumbing", "roofing", "electrical", "garage door"];
export const PHONE_ROLES = "receptionist dispatcher csr scheduler \"customer service\" \"call center\" \"front desk\" \"office assistant\"";

/** The job is mostly answering phones or booking work, not a field or sales role. */
const ROLE = /\b(receptionist|front desk|front office|csr|customer service|customer care|call (?:center|taker)|dispatch(?:er)?|scheduler|scheduling coordinator|office (?:assistant|administrator|coordinator|manager)|administrative assistant)\b/i;
const NOT_ROLE = /\b(technician|installer|tech\b|driver|sales (?:rep|representative|consultant)|estimator|manager of|director|engineer|apprentice|helper|laborer|plumber|electrician|roofer|welder|foreman)\b/i;
/** Recruiters, call centres and corporates post these jobs too; they aren't the buyer. */
const STAFFING = /\b(staffing|recruit\w*|talent|personnel|employment|workforce|robert half|aerotek|adecco|kelly services|randstad|manpower|express employment|spherion|volt|insight global|teksystems|appleone|labor ?ready|peopleready|careerbuilder|jobot|hire ?quest|ztek|call center|answering service|bpo|teleperformance|concentrix|alorica)\b/i;
const CORPORATE = /\b(home depot|lowe'?s|sears|servicemaster|service experts|one hour|aire serv|mr\.? rooter|roto-rooter|benjamin franklin|mister sparky|mr\.? electric|ars rescue|american residential|frontdoor|angi|homeadvisor|thumbtack|generac power|kohler|carrier|trane|lennox|leaffilter|1-800|amazon|walmart|hospital|clinic|dental|medical|health|law|bank|school|university|hotel|apartment|property management|insurance)\b/i;
const TRADE = /\b(fenc\w*|generat\w*|generac|standby power|hvac|heating|air condition\w*|cooling|plumb\w*|drain|sewer|roof\w*|electric\w*|garage door|home services?)\b/i;

/** Which of Sam's niches the employer is in ("" = another home-service trade). */
export const hiringNiche = (text: string) => /fenc/i.test(text) ? "fence" : /generat|generac|standby/i.test(text) ? "generators" : "other";

/** Keep a job only if it's a phone role at a home-service company itself, posted within maxDays. */
export function pickJob(j: Job, now = new Date(), maxDays = 30): HiringLead | null {
  const company = (j.company?.display_name ?? "").trim(), role = (j.title ?? "").trim();
  if (!company || !role || !j.redirect_url) return null;
  if (!ROLE.test(role) || NOT_ROLE.test(role)) return null;
  if (STAFFING.test(company) || CORPORATE.test(company)) return null;
  const text = `${company} ${role} ${j.description ?? ""}`;
  if (!TRADE.test(text)) return null;
  const created = j.created ? new Date(j.created) : null;
  if (created && !Number.isNaN(created.getTime()) && now.getTime() - created.getTime() > maxDays * 86_400_000) return null;
  return {
    jobId: String(j.id ?? j.redirect_url), company: company.slice(0, 120), role: role.slice(0, 80),
    location: (j.location?.display_name ?? "").slice(0, 120), url: j.redirect_url.slice(0, 300),
    posted: created && !Number.isNaN(created.getTime()) ? created.toISOString().slice(0, 10) : "",
    trade: hiringNiche(`${company} ${j.description ?? ""}`),
  };
}

/** One lead per employer (a company often posts the same job in several cities). */
export function pickJobs(jobs: Job[], now = new Date()): HiringLead[] {
  const seen = new Set<string>(), out: HiringLead[] = [];
  for (const j of jobs) {
    const l = pickJob(j, now);
    if (!l) continue;
    const k = companyKey(l.company);
    if (seen.has(k)) continue;
    seen.add(k); out.push(l);
  }
  return out;
}

/** "Ridge Fence Co., LLC" → "ridge fence": for matching a job's employer to a Google listing or a contact. */
export function companyKey(name: string): string {
  return name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(llc|inc|co|corp|corporation|company|ltd|the|of|and|services?|group)\b/g, " ").replace(/\s+/g, " ").trim();
}

/** Does this Google listing belong to that employer? Every meaningful word of the employer's name must appear. */
export function sameCompany(employer: string, listing: string): boolean {
  const a = companyKey(employer).split(" ").filter(w => w.length > 1), b = new Set(companyKey(listing).split(" "));
  return a.length > 0 && a.every(w => b.has(w));
}

export function hiringNote(l: HiringLead): string {
  return `Lead grade: A · Hiring: ${l.role}${l.posted ? ` (posted ${l.posted})` : ""} ${l.url}\nFound by the hiring finder: they're hiring someone to answer the phones.`;
}
