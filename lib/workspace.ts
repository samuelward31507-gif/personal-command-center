// Workspace settings: who the business is, what it sells, and the goal. One row per owner.
// Pure: no I/O. Defaults are today's values, so an empty row behaves exactly like before.

export type TierSettings = { label: string; setupFee: number; monthlyFee: number; setupLink: string; monthlyLink: string };
export type WorkspaceSettings = {
  businessName: string;   // shown to clients: sidebar, signing, kickoff, reports, call opener
  shortName: string;      // what you say on the phone ("Samuel with CGC")
  ownerFirstName: string; // greetings, emails, call script
  ownerFullName: string;  // signs agreements
  legalName: string;      // provider line on agreements
  address: string;        // provider address on agreements
  contactEmail: string;   // provider email on agreements; where alerts go
  timezone: string;       // IANA zone for "today", crons, agreement dates
  niche: string;          // who you sell to, in plain words ("contractors and home-service companies")
  paymentLink: string;    // your own payment page (Stripe, Square, PayPal…); shown on invoices
  paymentInstructions: string; // other ways to pay (ACH details, Zelle…); shown on invoices
  bookingLink: string;    // where prospects book a call (Cal.com, Calendly…); used on prospect reports
  websiteUrl: string;     // your site; signs cold emails
  demoLink: string;       // a demo page or video; linked in follow-ups
  logoUrl: string;        // white-label: https image shown in place of the Cinder wordmark ("" = Cinder)
  accentColor: string;    // white-label: the one accent color, #rrggbb ("" = Cinder ember)
  tier1: TierSettings;
  tier2: TierSettings;
  goalAmount: number;
  goalBy: string;         // YYYY-MM-DD
  dailyCallTarget: number;
  taxSetAsidePct: number; // share of every payment to set aside for taxes, 0–60
};

export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  businessName: "Cinder Revenue Company",
  shortName: "Cinder",
  ownerFirstName: "Sam",
  ownerFullName: "Samuel Ward",
  legalName: "Samuel Ward, doing business as Cinder Revenue Company",
  address: "",
  contactEmail: "",
  timezone: "America/Denver",
  niche: "contractors and home-service companies",
  paymentLink: "",
  paymentInstructions: "",
  bookingLink: "https://cinderrevenue.com/book",
  websiteUrl: "https://cinderrevenue.com",
  demoLink: "https://cinderrevenue.com/demo",
  logoUrl: "",
  accentColor: "",
  tier1: { label: "Never Miss a Lead", setupFee: 1500, monthlyFee: 997, setupLink: "", monthlyLink: "" },
  tier2: { label: "Book & Close", setupFee: 2500, monthlyFee: 1997, setupLink: "", monthlyLink: "" },
  goalAmount: 50_000,
  goalBy: "2026-12-31",
  dailyCallTarget: 100,
  taxSetAsidePct: 28,
};

type Env = Record<string, string | undefined>;

/** Defaults, with the older environment settings filled in where they exist (so nothing set before is lost). */
export function envDefaults(env: Env): WorkspaceSettings {
  const pick = (k: string) => env[k]?.trim() || "";
  return {
    ...DEFAULT_WORKSPACE,
    legalName: pick("CINDER_PROVIDER_LEGAL_NAME") || DEFAULT_WORKSPACE.legalName,
    ownerFullName: pick("CINDER_SIGNER_NAME") || DEFAULT_WORKSPACE.ownerFullName,
    address: pick("CINDER_PROVIDER_ADDRESS"),
    contactEmail: pick("CINDER_ALERT_EMAIL"),
    timezone: isTimezone(pick("CINDER_TIMEZONE")) ? pick("CINDER_TIMEZONE") : DEFAULT_WORKSPACE.timezone,
  };
}

export function isPaymentLink(v: string): boolean {
  if (!v || v.length > 300) return false;
  try { const u = new URL(v); return u.protocol === "https:" && !!u.hostname.includes("."); } catch { return false; }
}

export const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
export function isLogoUrl(v: string): boolean {
  if (!v || v.length > 500) return false;
  try { const u = new URL(v); return u.protocol === "https:" && !!u.hostname.includes("."); } catch { return false; }
}
/** True when the workspace is branded as something other than Cinder (custom logo or a different business name). */
export function isWhiteLabel(w: Pick<WorkspaceSettings, "logoUrl" | "businessName">): boolean {
  return !!w.logoUrl || !/^cinder\b/i.test(w.businessName.trim());
}

export function isTimezone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

const TEXT_LIMITS: Record<string, number> = { businessName: 80, shortName: 60, ownerFirstName: 40, ownerFullName: 80, legalName: 160, address: 200, contactEmail: 160, niche: 120, paymentInstructions: 600 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const money = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[$,\s]/g, "")) : NaN);

/** Saved row merged over the defaults. Bad or missing values fall back quietly, so a broken row never breaks a page. */
export function mergeWorkspace(saved: unknown, base: WorkspaceSettings = DEFAULT_WORKSPACE): WorkspaceSettings {
  const r = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const out: WorkspaceSettings = { ...base, tier1: { ...base.tier1 }, tier2: { ...base.tier2 } };
  for (const k of Object.keys(TEXT_LIMITS) as (keyof WorkspaceSettings)[]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) (out[k] as string) = v.trim().slice(0, TEXT_LIMITS[k]);
  }
  if (typeof r.timezone === "string" && isTimezone(r.timezone)) out.timezone = r.timezone;
  if (typeof r.paymentLink === "string" && isPaymentLink(r.paymentLink.trim())) out.paymentLink = r.paymentLink.trim().slice(0, 300);
  if (typeof r.bookingLink === "string" && isPaymentLink(r.bookingLink.trim())) out.bookingLink = r.bookingLink.trim().slice(0, 300);
  if (typeof r.websiteUrl === "string" && isPaymentLink(r.websiteUrl.trim())) out.websiteUrl = r.websiteUrl.trim().slice(0, 300);
  if (typeof r.demoLink === "string" && isPaymentLink(r.demoLink.trim())) out.demoLink = r.demoLink.trim().slice(0, 300);
  if (typeof r.logoUrl === "string" && isLogoUrl(r.logoUrl.trim())) out.logoUrl = r.logoUrl.trim();
  if (typeof r.accentColor === "string" && isHexColor(r.accentColor.trim())) out.accentColor = r.accentColor.trim().toLowerCase();
  for (const t of ["tier1", "tier2"] as const) {
    const s = (r[t] && typeof r[t] === "object" ? r[t] : {}) as Record<string, unknown>;
    if (typeof s.label === "string" && s.label.trim()) out[t].label = s.label.trim().slice(0, 60);
    const setup = money(s.setupFee), monthly = money(s.monthlyFee);
    if (Number.isFinite(setup) && setup >= 0) out[t].setupFee = Math.round(setup);
    if (Number.isFinite(monthly) && monthly >= 0) out[t].monthlyFee = Math.round(monthly);
    for (const k of ["setupLink", "monthlyLink"] as const) if (typeof s[k] === "string" && isPaymentLink((s[k] as string).trim())) out[t][k] = (s[k] as string).trim();
  }
  const goal = money(r.goalAmount);
  if (Number.isFinite(goal) && goal > 0) out.goalAmount = Math.round(goal);
  if (typeof r.goalBy === "string" && DATE.test(r.goalBy) && Number.isFinite(Date.parse(r.goalBy))) out.goalBy = r.goalBy;
  const calls = money(r.dailyCallTarget);
  if (Number.isFinite(calls) && calls >= 1 && calls <= 500) out.dailyCallTarget = Math.round(calls);
  const tax = money(r.taxSetAsidePct);
  if (Number.isFinite(tax) && tax >= 0 && tax <= 60) out.taxSetAsidePct = Math.round(tax);
  return out;
}

/** Strict check for a save from the Settings page. Returns the first problem in plain words, or the cleaned settings. */
export function validateWorkspace(input: unknown): { error: string } | { ok: WorkspaceSettings } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const need: [keyof WorkspaceSettings, string][] = [["businessName", "Business name"], ["ownerFirstName", "Your first name"], ["ownerFullName", "Your full name"], ["legalName", "Legal name on agreements"]];
  for (const [k, label] of need) if (typeof r[k] !== "string" || !(r[k] as string).trim()) return { error: `${label} can't be empty.` };
  if (typeof r.contactEmail === "string" && r.contactEmail.trim() && !EMAIL.test(r.contactEmail.trim())) return { error: "That email address doesn't look right." };
  if (typeof r.timezone === "string" && r.timezone && !isTimezone(r.timezone)) return { error: "Pick a valid time zone." };
  if (typeof r.paymentLink === "string" && r.paymentLink.trim() && !isPaymentLink(r.paymentLink.trim())) return { error: "Payment link must be a full https:// address." };
  if (typeof r.bookingLink === "string" && r.bookingLink.trim() && !isPaymentLink(r.bookingLink.trim())) return { error: "Booking link must be a full https:// address." };
  if (typeof r.websiteUrl === "string" && r.websiteUrl.trim() && !isPaymentLink(r.websiteUrl.trim())) return { error: "Website must be a full https:// address." };
  if (typeof r.demoLink === "string" && r.demoLink.trim() && !isPaymentLink(r.demoLink.trim())) return { error: "Demo link must be a full https:// address." };
  if (typeof r.logoUrl === "string" && r.logoUrl.trim() && !isLogoUrl(r.logoUrl.trim())) return { error: "Logo must be a full https:// image address." };
  if (typeof r.accentColor === "string" && r.accentColor.trim() && !isHexColor(r.accentColor.trim())) return { error: "Accent color must look like #ff6a1f." };
  for (const t of ["tier1", "tier2"] as const) {
    const s = (r[t] && typeof r[t] === "object" ? r[t] : {}) as Record<string, unknown>;
    const n = t === "tier1" ? "Tier 1" : "Tier 2";
    for (const [k, label] of [["setupFee", "setup fee"], ["monthlyFee", "monthly fee"]] as const) {
      const v = money(s[k]);
      if (!Number.isFinite(v) || v < 0 || v > 1_000_000) return { error: `${n} ${label} must be a dollar amount.` };
    }
    for (const [k, label] of [["setupLink", "setup payment link"], ["monthlyLink", "monthly payment link"]] as const) {
      if (typeof s[k] === "string" && s[k].trim() && !isPaymentLink(s[k].trim())) return { error: `${n} ${label} must be a full https:// address.` };
    }
  }
  const goal = money(r.goalAmount);
  if (!Number.isFinite(goal) || goal <= 0) return { error: "Revenue goal must be a dollar amount." };
  if (typeof r.goalBy !== "string" || !DATE.test(r.goalBy) || !Number.isFinite(Date.parse(r.goalBy))) return { error: "Goal date must be a real date." };
  const calls = money(r.dailyCallTarget);
  if (!Number.isFinite(calls) || calls < 1 || calls > 500) return { error: "Daily call target must be between 1 and 500." };
  if (r.taxSetAsidePct !== undefined) { const t = money(r.taxSetAsidePct); if (!Number.isFinite(t) || t < 0 || t > 60) return { error: "Tax set-aside must be between 0 and 60%." }; }
  return { ok: mergeWorkspace(r, { ...DEFAULT_WORKSPACE, address: "", contactEmail: "", paymentLink: "", paymentInstructions: "", bookingLink: "", websiteUrl: "", demoLink: "", logoUrl: "", accentColor: "" }) };
}

/** The offer catalog, priced from settings. Service types never change: deals and agreements key off them. */
export function offersFrom(w: WorkspaceSettings) {
  return {
    tier1: { serviceType: "tier1_speed_to_lead", label: w.tier1.label, setupFee: w.tier1.setupFee, monthlyFee: w.tier1.monthlyFee },
    tier2: { serviceType: "tier2_revenue_system", label: w.tier2.label, setupFee: w.tier2.setupFee, monthlyFee: w.tier2.monthlyFee },
  };
}

/**
 * Which payment link goes on an invoice. Tier links are fixed-price (a Stripe link charges its own amount),
 * so a tier link is used only when the invoice amount matches that tier's price. Otherwise: the general link, or none.
 */
export function paymentLinkFor(w: WorkspaceSettings, serviceType: string | null, revenueType: string, amount: number): { link: string; kind: "setup" | "monthly" | "general" | "none" } {
  const tier = serviceType === "tier1_speed_to_lead" ? w.tier1 : serviceType === "tier2_revenue_system" ? w.tier2 : null;
  if (tier && revenueType === "setup_fee" && tier.setupLink && Math.round(amount) === tier.setupFee) return { link: tier.setupLink, kind: "setup" };
  if (tier && revenueType === "monthly_retainer" && tier.monthlyLink && Math.round(amount) === tier.monthlyFee) return { link: tier.monthlyLink, kind: "monthly" };
  return w.paymentLink ? { link: w.paymentLink, kind: "general" } : { link: "", kind: "none" };
}

export function goalLabel(w: WorkspaceSettings): string {
  const amt = w.goalAmount >= 1000 && w.goalAmount % 1000 === 0 ? `$${w.goalAmount / 1000}k` : `$${w.goalAmount.toLocaleString("en-US")}`;
  const d = new Date(w.goalBy + "T12:00:00Z");
  const endOfYear = w.goalBy.endsWith("-12-31");
  return `${amt} by ${endOfYear ? "year-end" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
}

/** Today's date (YYYY-MM-DD) in the workspace time zone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: isTimezone(tz) ? tz : DEFAULT_WORKSPACE.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
