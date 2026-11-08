// The founding offer (Book & Close, half-price setup for the first 3 clients): settings, discovery fields, the guarantee
// calculator, the price script, client delivery tracking, Review Builder setup and the monthly report.
// Pure: no I/O. Safe to unit test.

// ---------- Offer settings (B1) ----------

export type OfferRates = { oldReply: number; oldBook: number; newReply: number; newBook: number };
export type OfferSettings = {
  offerName: string;
  setupFee: number;
  standardSetup: number;
  monthly: number;
  spotsTotal: number;
  /** Conversion rates behind the guarantee calculator. Update after client #1. */
  rates: OfferRates;
  /** Minimum old quotes/leads for the guarantee to apply. */
  minOldLeads: number;
};

export const DEFAULT_OFFER: OfferSettings = {
  offerName: "Book & Close (founding)",
  setupFee: 1250,
  standardSetup: 2500,
  monthly: 1997,
  spotsTotal: 3,
  rates: { oldReply: 0.10, oldBook: 0.25, newReply: 0.30, newBook: 0.30 },
  minOldLeads: 150,
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[$,%\s]/g, "")) : NaN);
const rate = (v: unknown) => { const n = num(v); return Number.isFinite(n) && n >= 0 && n <= 1 ? n : NaN; };

/** Saved offer settings merged over the defaults. Bad values fall back quietly. */
export function mergeOffer(saved: unknown): OfferSettings {
  const r = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const out: OfferSettings = { ...DEFAULT_OFFER, rates: { ...DEFAULT_OFFER.rates } };
  if (typeof r.offerName === "string" && r.offerName.trim()) out.offerName = r.offerName.trim().slice(0, 80);
  for (const k of ["setupFee", "standardSetup", "monthly"] as const) { const n = num(r[k]); if (Number.isFinite(n) && n >= 0 && n <= 1_000_000) out[k] = Math.round(n); }
  const spots = num(r.spotsTotal); if (Number.isFinite(spots) && spots >= 0 && spots <= 100) out.spotsTotal = Math.round(spots);
  const min = num(r.minOldLeads); if (Number.isFinite(min) && min >= 0 && min <= 100_000) out.minOldLeads = Math.round(min);
  const rr = (r.rates && typeof r.rates === "object" ? r.rates : {}) as Record<string, unknown>;
  for (const k of ["oldReply", "oldBook", "newReply", "newBook"] as const) { const n = rate(rr[k]); if (Number.isFinite(n)) out.rates[k] = n; }
  return out;
}

/** Strict check for a save from Settings. Rates are entered as percents (10 = 10%) or fractions (0.1). */
export function validateOffer(input: unknown): { error: string } | { ok: OfferSettings } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (typeof r.offerName !== "string" || !r.offerName.trim()) return { error: "Offer name can't be empty." };
  for (const [k, label] of [["setupFee", "Setup fee"], ["standardSetup", "Standard setup"], ["monthly", "Monthly fee"]] as const) {
    const n = num(r[k]); if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { error: `${label} must be a dollar amount.` };
  }
  const spots = num(r.spotsTotal); if (!Number.isFinite(spots) || spots < 0 || spots > 100 || !Number.isInteger(spots)) return { error: "Founding spots must be a whole number from 0 to 100." };
  const min = num(r.minOldLeads ?? DEFAULT_OFFER.minOldLeads); if (!Number.isFinite(min) || min < 0) return { error: "Minimum old leads must be a whole number." };
  const rr = (r.rates && typeof r.rates === "object" ? r.rates : {}) as Record<string, unknown>;
  const rates: Record<string, number> = {};
  for (const k of ["oldReply", "oldBook", "newReply", "newBook"]) {
    let n = num(rr[k]);
    if (Number.isFinite(n) && n > 1) n = n / 100; // typed as a percent
    if (!Number.isFinite(n) || n < 0 || n > 1) return { error: "Each rate must be a percent between 0 and 100." };
    rates[k] = Math.round(n * 10000) / 10000;
  }
  return { ok: mergeOffer({ ...r, rates, minOldLeads: min }) };
}

/** Spots used = founding clients that are signed and not cancelled or finished. */
export const FOUNDING_ACTIVE_STATUSES = ["planning", "onboarding", "in_progress", "blocked", "review"] as const;
export function spotsLeft(o: OfferSettings, used: number): number { return Math.max(0, o.spotsTotal - Math.max(0, Math.floor(used || 0))); }

// ---------- Discovery fields (B2) ----------

export const CRM_CHOICES = ["none", "Jobber", "Housecall Pro", "ServiceTitan", "other"] as const;
export type Discovery = {
  oldLeads?: number; newLeadsPerMonth?: number; avgJobValue?: number; closeRate?: number; // closeRate as a percent, 0–100
  usesCrm?: (typeof CRM_CHOICES)[number]; reviewLink?: string;
};

export function cleanDiscovery(input: unknown): { error: string } | { ok: Discovery } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Discovery = {};
  const whole = (k: keyof Discovery, label: string, max: number) => {
    const v = r[k]; if (v === undefined || v === null || v === "") return null;
    const n = num(v); if (!Number.isFinite(n) || n < 0 || n > max) return `${label} must be a number.`;
    (out as Record<string, number>)[k] = Math.round(n); return null;
  };
  for (const e of [whole("oldLeads", "Old quotes/leads", 1_000_000), whole("newLeadsPerMonth", "New leads per month", 100_000), whole("avgJobValue", "Average job value", 10_000_000)]) if (e) return { error: e };
  if (r.closeRate !== undefined && r.closeRate !== null && r.closeRate !== "") {
    let n = num(r.closeRate);
    if (Number.isFinite(n) && n > 0 && n <= 1 && String(r.closeRate).includes(".")) n = n * 100; // 0.3 → 30%
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Close rate must be a percent between 0 and 100." };
    out.closeRate = Math.round(n * 10) / 10;
  }
  if (typeof r.usesCrm === "string" && r.usesCrm) {
    if (!(CRM_CHOICES as readonly string[]).includes(r.usesCrm)) return { error: "Pick a CRM from the list." };
    out.usesCrm = r.usesCrm as Discovery["usesCrm"];
  }
  if (typeof r.reviewLink === "string" && r.reviewLink.trim()) {
    const v = r.reviewLink.trim();
    try { const u = new URL(v); if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(); } catch { return { error: "Google review link must be a full web address." }; }
    out.reviewLink = v.slice(0, 500);
  }
  return { ok: out };
}

/** Lenient read of a stored discovery object (never throws). */
export function readDiscovery(saved: unknown): Discovery {
  const c = cleanDiscovery(saved);
  return "ok" in c ? c.ok : {};
}

export const guaranteeEligible = (d: Discovery, o: OfferSettings = DEFAULT_OFFER) => (d.oldLeads ?? 0) >= o.minOldLeads;

// ---------- Guarantee calculator (B3) ----------

export type GuaranteeCalc = { expected: number; safe: number; eligible: boolean; offer: boolean; text: string; warning: string | null };

/**
 * expected = old × oldReply × oldBook + new × newReply × newBook; safe to guarantee = floor(expected × 0.5).
 * The 3-estimate guarantee is offered only when safe ≥ 3 and the company has enough old leads.
 */
export function guaranteeCalc(d: Discovery, o: OfferSettings = DEFAULT_OFFER): GuaranteeCalc {
  const r = o.rates;
  const raw = (d.oldLeads ?? 0) * r.oldReply * r.oldBook + (d.newLeadsPerMonth ?? 0) * r.newReply * r.newBook;
  const expected = Math.round((raw + 1e-9) * 10) / 10;
  const safe = Math.floor(raw * 0.5 + 1e-9);
  const eligible = guaranteeEligible(d, o);
  const offer = eligible && safe >= 3;
  return {
    expected, safe, eligible, offer,
    text: `Expected ~${expected} booked estimates in 30 days. Safe to guarantee: ${safe}.`,
    warning: offer ? null : "Don't offer the 3-estimate guarantee. Offer the plan without it, or a website first.",
  };
}

// ---------- Price script (B4) ----------

const usd = (n: number) => "$" + n.toLocaleString("en-US");
export function priceScript(o: OfferSettings = DEFAULT_OFFER): string {
  const setup = o.setupFee < o.standardSetup
    ? `It's normally ${usd(o.standardSetup)} to set up. For our first ${o.spotsTotal} clients it's ${usd(o.setupFee)}`
    : `It's ${usd(o.setupFee)} to set up`;
  return `${setup}, then ${usd(o.monthly)} a month, month to month, no contract, and the monthly starts after your first booked appointment. If you don't get at least 5 booked appointments in your first 30 days live, your next monthly payment is waived and we keep working.`;
}

// ---------- Delivery tracker (B5) ----------

export const DELIVERY_DATES = [
  { key: "signedDate", label: "Signed" },
  { key: "intakeCallDate", label: "Intake call" },
  { key: "a2pSubmittedDate", label: "Carrier (A2P) submitted" },
  { key: "a2pApprovedDate", label: "Carrier (A2P) approved" },
  { key: "goLiveDate", label: "Go-live" },
] as const;
export type DeliveryDateKey = (typeof DELIVERY_DATES)[number]["key"];

export const ONBOARDING_CHECKLIST = [
  { key: "call_forwarding", label: "Call forwarding connected" },
  { key: "forms", label: "Forms connected" },
  { key: "fb_leads", label: "FB leads connected" },
  { key: "old_leads", label: "Old-lead list received", count: true },
  { key: "consent", label: "Consent confirmed by client" },
  { key: "dnt_list", label: "Do-not-text list received" },
  { key: "calendar", label: "Calendar connected" },
  { key: "review_link", label: "Review link added" },
  { key: "crm", label: "CRM connection (if any)" },
  { key: "test_lead", label: "Test lead passed" },
] as const;

export type Delivery = Partial<Record<DeliveryDateKey, string>> & { checklist?: Record<string, boolean>; oldLeadsReceived?: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown): v is string => typeof v === "string" && DATE.test(v) && Number.isFinite(Date.parse(v + "T12:00:00Z")) && new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;

export function cleanDelivery(input: unknown): { error: string } | { ok: Delivery } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Delivery = {};
  for (const d of DELIVERY_DATES) {
    const v = r[d.key];
    if (v === undefined || v === null || v === "") continue;
    if (!isDate(v)) return { error: `${d.label} needs a real date.` };
    out[d.key] = v;
  }
  const cl = (r.checklist && typeof r.checklist === "object" ? r.checklist : {}) as Record<string, unknown>;
  out.checklist = {};
  for (const c of ONBOARDING_CHECKLIST) if (cl[c.key] === true) out.checklist[c.key] = true;
  if (r.oldLeadsReceived !== undefined && r.oldLeadsReceived !== null && r.oldLeadsReceived !== "") {
    const n = num(r.oldLeadsReceived); if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { error: "Old-lead count must be a whole number." };
    out.oldLeadsReceived = Math.round(n);
  }
  return { ok: out };
}
export function readDelivery(saved: unknown): Delivery { const c = cleanDelivery(saved); return "ok" in c ? c.ok : {}; }

export const BOOKING_SOURCES = ["revival", "callback", "other"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];
/** A booked estimate counts toward the guarantee only when our system contacted the lead. */
export const isCinderSource = (s: string) => s === "revival" || s === "callback";
export type Booking = { bookedOn: string; source: string };

const addDays = (ymd: string, n: number) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000);

export type GuaranteeStatus = "not live" | "on track" | "at risk" | "met" | "missed -> month 2 credit";
export type DeliveryState = {
  monthlyBillingStart: string | null; // = first booked estimate date
  firstBookedEstimateDate: string | null;
  guaranteeWindowEnd: string | null;  // = go-live + 30 days
  bookedInWindow: number;
  windowDay: number | null;           // go-live day is day 1
  status: GuaranteeStatus;
  atRisk: boolean;
};

/**
 * Guarantee state from the go-live date and the booked estimates.
 * At risk: day 15 or later of the 30-day window with fewer than 2 booked. Met: 3 or more in the window.
 * Missed: the window ended with fewer than 3 (month two becomes a service credit).
 */
export function deliveryState(d: Delivery, bookings: Booking[], today: string): DeliveryState {
  const cinder = bookings.filter(b => isDate(b.bookedOn) && isCinderSource(b.source)).map(b => b.bookedOn).sort();
  const first = cinder[0] ?? null;
  const goLive = d.goLiveDate ?? null;
  if (!goLive) return { monthlyBillingStart: first, firstBookedEstimateDate: first, guaranteeWindowEnd: null, bookedInWindow: 0, windowDay: null, status: "not live", atRisk: false };
  const end = addDays(goLive, 30);
  const inWindow = cinder.filter(x => x >= goLive && x <= end).length;
  const day = daysBetween(goLive, today) + 1;
  let status: GuaranteeStatus;
  if (inWindow >= 3) status = "met";
  else if (today > end) status = "missed -> month 2 credit";
  else if (day >= 15 && inWindow < 2) status = "at risk";
  else status = "on track";
  return { monthlyBillingStart: first, firstBookedEstimateDate: first, guaranteeWindowEnd: end, bookedInWindow: inWindow, windowDay: day < 1 ? null : day, status, atRisk: status === "at risk" };
}

export const atRiskTaskTitle = (client: string) => `Guarantee at risk: ${client}`.slice(0, 240);

// ---------- Review Builder setup (B6) ----------

export const REVIEW_TRIGGERS = ["CRM webhook", "owner texts \"done\"", "Friday check-in only"] as const;
export type ReviewSetup = { trigger?: (typeof REVIEW_TRIGGERS)[number]; reviewLink?: string; delayDays: number; reminderDays: number; requestsSent: number; reviewsReceived: number };
export const DEFAULT_REVIEWS: ReviewSetup = { delayDays: 3, reminderDays: 4, requestsSent: 0, reviewsReceived: 0 };

export function cleanReviews(input: unknown): { error: string } | { ok: ReviewSetup } {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: ReviewSetup = { ...DEFAULT_REVIEWS };
  if (typeof r.trigger === "string" && r.trigger) {
    if (!(REVIEW_TRIGGERS as readonly string[]).includes(r.trigger)) return { error: "Pick a job-complete trigger from the list." };
    out.trigger = r.trigger as ReviewSetup["trigger"];
  }
  if (typeof r.reviewLink === "string" && r.reviewLink.trim()) {
    try { const u = new URL(r.reviewLink.trim()); if (!/^https?:$/.test(u.protocol)) throw new Error(); } catch { return { error: "Review link must be a full web address." }; }
    out.reviewLink = r.reviewLink.trim().slice(0, 500);
  }
  for (const [k, label, max] of [["delayDays", "Delay", 60], ["reminderDays", "Reminder", 60], ["requestsSent", "Review requests sent", 1_000_000], ["reviewsReceived", "Reviews received", 1_000_000]] as const) {
    const v = r[k]; if (v === undefined || v === null || v === "") continue;
    const n = num(v); if (!Number.isFinite(n) || n < 0 || n > max || !Number.isInteger(n)) return { error: `${label} must be a whole number.` };
    out[k] = n;
  }
  return { ok: out };
}
export function readReviews(saved: unknown): ReviewSetup { const c = cleanReviews(saved); return "ok" in c ? c.ok : { ...DEFAULT_REVIEWS }; }

// ---------- Monthly report (B7) ----------

export type MonthlyInputs = {
  leadsIn?: number; under10Pct?: number;          // entered from the texting system until it reports on its own
  bookings: Booking[];                             // this month's booked estimates
  avgJobValue?: number; closeRatePct?: number;     // from the client's discovery fields
  reviewRequests?: number; newReviews?: number;
};
export type MonthlyFigures = {
  leadsIn: number | null; under10Pct: number | null; booked: number; fromRevival: number; fromCallback: number;
  estimatedValue: number | null; reviewRequests: number | null; newReviews: number | null;
};

export function monthlyFigures(i: MonthlyInputs): MonthlyFigures {
  const c = i.bookings.filter(b => isCinderSource(b.source));
  const booked = c.length;
  const value = i.avgJobValue && i.closeRatePct !== undefined ? Math.round(booked * i.avgJobValue * (i.closeRatePct / 100)) : null;
  return {
    leadsIn: i.leadsIn ?? null, under10Pct: i.under10Pct ?? null, booked,
    fromRevival: c.filter(b => b.source === "revival").length, fromCallback: c.filter(b => b.source === "callback").length,
    estimatedValue: value, reviewRequests: i.reviewRequests ?? null, newReviews: i.newReviews ?? null,
  };
}

const n0 = (n: number) => n.toLocaleString("en-US");
/** One-page report lines (for the page and the PDF) plus a short text Sam can send. Blank figures are left out. */
export function monthlyReport(client: string, periodLabel: string, f: MonthlyFigures): { rows: { label: string; value: string }[]; text: string } {
  const rows: { label: string; value: string }[] = [];
  if (f.leadsIn !== null) rows.push({ label: "Leads in", value: n0(f.leadsIn) });
  if (f.under10Pct !== null) rows.push({ label: "Texted in under 10 seconds", value: `${f.under10Pct}%` });
  rows.push({ label: "Booked estimates", value: `${n0(f.booked)}${f.booked ? ` (${f.fromRevival} from Dead Quote Revival, ${f.fromCallback} from 10-Second Callback)` : ""}` });
  if (f.estimatedValue !== null) rows.push({ label: "Estimated value", value: `$${n0(f.estimatedValue)}` });
  if (f.reviewRequests !== null) rows.push({ label: "Review requests sent", value: n0(f.reviewRequests) });
  if (f.newReviews !== null) rows.push({ label: "New reviews", value: n0(f.newReviews) });
  const bits = [
    f.leadsIn !== null ? `${n0(f.leadsIn)} leads came in${f.under10Pct !== null ? `, ${f.under10Pct}% texted back in under 10 seconds` : ""}` : "",
    `${n0(f.booked)} estimate${f.booked === 1 ? "" : "s"} booked${f.estimatedValue !== null ? ` (about $${n0(f.estimatedValue)} in expected jobs at your close rate)` : ""}`,
    f.newReviews !== null ? `${n0(f.newReviews)} new review${f.newReviews === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const text = `${client}, your ${periodLabel} report: ${bits.join(", ")}. Full one-page report attached.`;
  return { rows, text };
}

/** The one-job calculator on the website: booked estimates a month that cover the monthly fee. */
export function estimatesToPayFor(monthly: number, jobValue: number, closeRatePct: number): number | null {
  const c = closeRatePct / 100;
  if (!(jobValue > 0) || !(c > 0) || c > 1) return null;
  return Math.ceil(monthly / (jobValue * c));
}
