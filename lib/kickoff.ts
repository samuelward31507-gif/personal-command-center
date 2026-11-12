// Client kickoff checklist (agreement Schedule B). Pure: safe to unit test.
// The client fills this in after signing; answers land on their project. Passwords are never collected.

export type KickoffTier = "tier1" | "tier2";
export type KickoffKind = "text" | "long" | "phone" | "url" | "choices" | "select" | "days" | "hours" | "file";
export type KickoffField = {
  key: string; label: string; help?: string; kind: KickoffKind; required?: boolean; tier2?: boolean;
  /** The step it's on; one screen per step. */
  group: string;
  options?: readonly string[];
  placeholder?: string;
  /** Only asked when another answer equals one of these values. */
  showIf?: { key: string; is: readonly string[] };
  /** Files: what the picker accepts. */
  accept?: string;
  /** A short note shown under a single-choice question when that option is picked. */
  notes?: Readonly<Record<string, string>>;
  /** Kept for older screens that check it. */
  long?: boolean;
};

export const EIN_HAVE = "Yes, I’ll upload it";
export const EIN_LATER = "I can’t find it right now";
export const EIN_NONE = "I’m a sole proprietor without an EIN";
export const FINANCING_YES = "Yes";
export const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/*";
export const LIST_ACCEPT = ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.heic,text/csv,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
export const FILE_KEYS = ["ein_letter", "quotes_file", "customers_file"] as const;

export const KICKOFF_FIELDS: readonly KickoffField[] = [
  // 1. Your business: what the phone carriers need to approve your texting number.
  { group: "Your business", key: "legal_name", kind: "text", label: "Legal business name", help: "Exactly as it appears on your IRS letter.", required: true },
  { group: "Your business", key: "ein_status", kind: "select", label: "Do you have your IRS EIN letter?", help: "The CP 575 (the letter the IRS sent when you got your EIN) or a 147C. Carriers use it to approve your texting number.", options: [EIN_HAVE, EIN_LATER, EIN_NONE], required: true,
    notes: { [EIN_LATER]: "No problem. You can ask the IRS for a copy (a 147C letter) at 800-829-4933, and we’ll collect it on your setup call.", [EIN_NONE]: "That works. Sole proprietors register a little differently, and we’ll walk you through it on your setup call." } },
  { group: "Your business", key: "ein_letter", kind: "file", label: "Upload your CP 575 or 147C letter", help: "A PDF, or a clear photo of the whole page.", accept: DOC_ACCEPT, required: true, showIf: { key: "ein_status", is: [EIN_HAVE] } },
  { group: "Your business", key: "business_address", kind: "text", label: "Business address", placeholder: "Street, city, state, zip", required: true },
  { group: "Your business", key: "website", kind: "url", label: "Website", placeholder: "yourfence.com", required: true },
  { group: "Your business", key: "business_phone", kind: "phone", label: "The number customers call", required: true },
  { group: "Your business", key: "owner_cell", kind: "phone", label: "Your cell", help: "Where you get lead alerts and can jump into any conversation.", required: true },
  // 2. Your leads.
  { group: "Your leads", key: "lead_sources", kind: "choices", label: "Where do your leads come from?", help: "Pick all that apply.", options: ["Phone calls", "Website form", "Facebook messages", "Facebook lead ads", "Google Business Profile", "Angi", "Thumbtack", "Yelp", "Referrals"], required: true },
  { group: "Your leads", key: "website_platform", kind: "select", label: "Who runs your website?", help: "So we know how to connect your form.", options: ["Wix", "Squarespace", "WordPress", "GoDaddy", "Someone built it for me", "Not sure", "No website"], required: true },
  // 3. Booking.
  { group: "Booking", key: "calendar", kind: "select", label: "Which calendar do you book estimates on?", options: ["Google Calendar", "Outlook", "Jobber", "Housecall Pro", "ServiceTitan", "Paper or my head"], required: true },
  { group: "Booking", key: "estimate_days", kind: "days", label: "Which days can estimates be booked?", options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], required: true },
  { group: "Booking", key: "estimate_hours", kind: "hours", label: "Between what times?", required: true },
  { group: "Booking", key: "estimate_length", kind: "select", label: "How long does an estimate take?", options: ["15 minutes", "30 minutes", "45 minutes", "1 hour", "90 minutes"], required: true },
  { group: "Booking", key: "service_area", kind: "long", label: "Where do you work?", placeholder: "e.g. Ocala and 30 miles around it, or a list of cities or zip codes", required: true },
  // 4. How we answer.
  { group: "How we answer", key: "questions", kind: "choices", label: "What should we ask every lead?", help: "Pick all that apply.", options: ["Address", "Footage or size", "Material", "Height", "Gates", "Remove the old fence", "Timeline", "Budget", "Photos", "HOA approval"], required: true },
  { group: "How we answer", key: "prices", kind: "long", label: "Your ballpark prices", help: "Ranges are fine. We only ever give a range, never a quote.", placeholder: "e.g. Wood privacy 6 ft: $30–40 a foot\nVinyl 6 ft: $40–50 a foot\nChain link: $18–25 a foot", required: true },
  { group: "How we answer", key: "min_job", kind: "text", label: "Smallest job you’ll take", placeholder: "e.g. $1,500, or 50 feet" },
  { group: "How we answer", key: "rules", kind: "long", label: "Jobs you don’t take", placeholder: "e.g. repairs under 20 ft, commercial, pool fencing" },
  // 5. Book & Close: quotes, customers, reviews.
  { group: "Quotes and reviews", key: "quotes_file", kind: "file", label: "Your open quotes from the last 6 months", help: "A spreadsheet or export is perfect: name, phone, job, amount, date. No list? Skip it and we’ll pull it with you on the kickoff call.", accept: LIST_ACCEPT, tier2: true },
  { group: "Quotes and reviews", key: "customers_file", kind: "file", label: "Past customer list", help: "Only people you’re allowed to text. Skip it if you don’t have one handy.", accept: LIST_ACCEPT, tier2: true },
  { group: "Quotes and reviews", key: "review_link", kind: "url", label: "Your Google review link", help: "On your Google Business Profile, tap “Ask for reviews” and copy the link.", tier2: true },
  { group: "Quotes and reviews", key: "financing", kind: "select", label: "Do you offer financing?", options: [FINANCING_YES, "No"], required: true, tier2: true },
  { group: "Quotes and reviews", key: "financing_details", kind: "text", label: "Who with, and what should we tell people?", placeholder: "e.g. Hearth, as low as $99 a month", showIf: { key: "financing", is: [FINANCING_YES] }, tier2: true },
  // Last: anything else.
  { group: "Anything else", key: "notes", kind: "long", label: "Anything else we should know?", placeholder: "Busy seasons, crew size, things customers always ask…" },
] as const;

export const fieldsFor = (tier: KickoffTier) => KICKOFF_FIELDS.filter(f => tier === "tier2" || !f.tier2);

const looksLikePassword = (s: string) => /\b(password|passcode|pwd|pw)\s*[:=]/i.test(s);

/** Is this field asked, given the other answers? */
export function isAsked(f: KickoffField, answers: Record<string, unknown>): boolean {
  return !f.showIf || f.showIf.is.includes(String(answers[f.showIf.key] ?? ""));
}

/**
 * Validate the client's answers. Returns cleaned answers, or the first problem in plain words.
 * `files` names the file fields that already have an upload; a required file with none is an error.
 */
export function validateKickoff(input: unknown, tier: KickoffTier, files: readonly string[] = []): { error: string } | { ok: Record<string, string> } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of fieldsFor(tier)) {
    if (!isAsked(f, raw)) continue;
    if (f.kind === "file") {
      if (f.required && !files.includes(f.key)) return { error: `Upload "${f.label}".` };
      if (files.includes(f.key)) out[f.key] = "Uploaded";
      continue;
    }
    const long = f.kind === "long" || f.kind === "choices";
    let v = typeof raw[f.key] === "string" ? (raw[f.key] as string).replace(/\r/g, "").trim().slice(0, long ? 2000 : 300) : "";
    if (v && (f.kind === "select") && f.options && !f.options.includes(v)) v = "";
    if (f.required && !v) return { error: f.kind === "choices" || f.kind === "days" || f.kind === "select" ? `Pick an answer for "${f.label}".` : `Fill in "${f.label}".` };
    if (looksLikePassword(v)) return { error: `Please don't put passwords in "${f.label}". We'll send you access invites instead.` };
    if (v) out[f.key] = v;
  }
  return { ok: out };
}

/** Plain-text summary for the owner (project notes). The EIN is masked: it lives only in the stored answers. */
export function kickoffSummary(answers: Record<string, string>, tier: KickoffTier): string {
  const lines: string[] = [];
  let group = "";
  for (const f of fieldsFor(tier)) {
    const v = answers[f.key]; if (!v) continue;
    if (f.group !== group) { group = f.group; lines.push("", group.toUpperCase()); }
    lines.push(`${f.label}: ${f.key === "ein" ? maskEin(v) : v.replace(/\n+/g, " / ")}`);
  }
  return lines.join("\n").trim();
}

export function maskEin(v: string): string {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 4 ? `••-•••${digits.slice(-4)}` : v;
}
