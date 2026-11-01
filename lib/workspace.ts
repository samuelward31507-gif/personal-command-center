// Workspace settings: who the business is, what it sells, and the goal. One row per owner.
// Pure: no I/O. Defaults are today's values, so an empty row behaves exactly like before.

export type TierSettings = { label: string; setupFee: number; monthlyFee: number };
export type WorkspaceSettings = {
  businessName: string;   // shown to clients: sidebar, signing, kickoff, reports, call opener
  shortName: string;      // what you say on the phone ("Samuel with CGC")
  ownerFirstName: string; // greetings, emails, call script
  ownerFullName: string;  // signs agreements
  legalName: string;      // provider line on agreements
  address: string;        // provider address on agreements
  contactEmail: string;   // provider email on agreements; where alerts go
  timezone: string;       // IANA zone for "today", crons, agreement dates
  niche: string;          // who you sell to, in plain words ("fence and pool companies")
  tier1: TierSettings;
  tier2: TierSettings;
  goalAmount: number;
  goalBy: string;         // YYYY-MM-DD
  dailyCallTarget: number;
};

export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  businessName: "Cinder Revenue Company",
  shortName: "Cinder Revenue Company",
  ownerFirstName: "Samuel",
  ownerFullName: "Samuel Ward",
  legalName: "Samuel Ward, doing business as Cinder Revenue Company",
  address: "",
  contactEmail: "",
  timezone: "America/Denver",
  niche: "fence and pool companies",
  tier1: { label: "Tier 1 · Speed to Lead", setupFee: 1500, monthlyFee: 997 },
  tier2: { label: "Tier 2 · Revenue System", setupFee: 3000, monthlyFee: 1500 },
  goalAmount: 50_000,
  goalBy: "2026-12-31",
  dailyCallTarget: 20,
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

export function isTimezone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

const TEXT_LIMITS: Record<string, number> = { businessName: 80, shortName: 60, ownerFirstName: 40, ownerFullName: 80, legalName: 160, address: 200, contactEmail: 160, niche: 120 };
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
  for (const t of ["tier1", "tier2"] as const) {
    const s = (r[t] && typeof r[t] === "object" ? r[t] : {}) as Record<string, unknown>;
    if (typeof s.label === "string" && s.label.trim()) out[t].label = s.label.trim().slice(0, 60);
    const setup = money(s.setupFee), monthly = money(s.monthlyFee);
    if (Number.isFinite(setup) && setup >= 0) out[t].setupFee = Math.round(setup);
    if (Number.isFinite(monthly) && monthly >= 0) out[t].monthlyFee = Math.round(monthly);
  }
  const goal = money(r.goalAmount);
  if (Number.isFinite(goal) && goal > 0) out.goalAmount = Math.round(goal);
  if (typeof r.goalBy === "string" && DATE.test(r.goalBy) && Number.isFinite(Date.parse(r.goalBy))) out.goalBy = r.goalBy;
  const calls = money(r.dailyCallTarget);
  if (Number.isFinite(calls) && calls >= 1 && calls <= 500) out.dailyCallTarget = Math.round(calls);
  return out;
}

/** Strict check for a save from the Settings page. Returns the first problem in plain words, or the cleaned settings. */
export function validateWorkspace(input: unknown): { error: string } | { ok: WorkspaceSettings } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const need: [keyof WorkspaceSettings, string][] = [["businessName", "Business name"], ["ownerFirstName", "Your first name"], ["ownerFullName", "Your full name"], ["legalName", "Legal name on agreements"]];
  for (const [k, label] of need) if (typeof r[k] !== "string" || !(r[k] as string).trim()) return { error: `${label} can't be empty.` };
  if (typeof r.contactEmail === "string" && r.contactEmail.trim() && !EMAIL.test(r.contactEmail.trim())) return { error: "That email address doesn't look right." };
  if (typeof r.timezone === "string" && r.timezone && !isTimezone(r.timezone)) return { error: "Pick a valid time zone." };
  for (const t of ["tier1", "tier2"] as const) {
    const s = (r[t] && typeof r[t] === "object" ? r[t] : {}) as Record<string, unknown>;
    const n = t === "tier1" ? "Tier 1" : "Tier 2";
    for (const [k, label] of [["setupFee", "setup fee"], ["monthlyFee", "monthly fee"]] as const) {
      const v = money(s[k]);
      if (!Number.isFinite(v) || v < 0 || v > 1_000_000) return { error: `${n} ${label} must be a dollar amount.` };
    }
  }
  const goal = money(r.goalAmount);
  if (!Number.isFinite(goal) || goal <= 0) return { error: "Revenue goal must be a dollar amount." };
  if (typeof r.goalBy !== "string" || !DATE.test(r.goalBy) || !Number.isFinite(Date.parse(r.goalBy))) return { error: "Goal date must be a real date." };
  const calls = money(r.dailyCallTarget);
  if (!Number.isFinite(calls) || calls < 1 || calls > 500) return { error: "Daily call target must be between 1 and 500." };
  return { ok: mergeWorkspace(r, { ...DEFAULT_WORKSPACE, address: "", contactEmail: "" }) };
}

/** The offer catalog, priced from settings. Service types never change: deals and agreements key off them. */
export function offersFrom(w: WorkspaceSettings) {
  return {
    tier1: { serviceType: "tier1_speed_to_lead", ...w.tier1 },
    tier2: { serviceType: "tier2_revenue_system", ...w.tier2 },
  };
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
