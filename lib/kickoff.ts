// Client kickoff checklist (agreement Schedule B). Pure: safe to unit test.
// The client fills this in after signing; answers land on their project. Passwords are never collected.

export type KickoffTier = "tier1" | "tier2";
export type KickoffField = { key: string; label: string; help?: string; long?: boolean; required?: boolean; tier2?: boolean; group: string };

export const KICKOFF_FIELDS: readonly KickoffField[] = [
  { group: "Your business", key: "legal_name", label: "Legal business name", help: "Exactly as registered. Needed for text-message registration.", required: true },
  { group: "Your business", key: "ein", label: "EIN (federal tax ID)", help: "Carriers require it to register your texting number. Sole proprietors without one: write \"none\".", required: true },
  { group: "Your business", key: "business_address", label: "Business address", required: true },
  { group: "Your business", key: "website", label: "Website", required: true },
  { group: "Your business", key: "business_phone", label: "Business phone number customers call", required: true },
  { group: "Your business", key: "owner_cell", label: "Your cell for alerts and handoffs", help: "Where you get the lead summary and can take over any conversation.", required: true },
  { group: "Where leads come from", key: "lead_sources", label: "Where do your leads come in?", help: "Website form, Facebook page, Facebook lead ads, Google, phone, other. We'll send access invites, so don't paste passwords here.", long: true, required: true },
  { group: "Booking", key: "calendar", label: "Which calendar do you use?", help: "Google, Outlook, Jobber, Housecall Pro, paper…", required: true },
  { group: "Booking", key: "availability", label: "When can estimates be booked?", help: "Days, hours, and how long an estimate takes.", long: true, required: true },
  { group: "Booking", key: "service_area", label: "Service area", help: "Cities, zip codes or a radius.", long: true, required: true },
  { group: "How leads are handled", key: "questions", label: "Questions to ask every lead", help: "e.g. footage, material, timeline, budget, photos.", long: true, required: true },
  { group: "How leads are handled", key: "prices", label: "Ballpark price ranges and minimum job size", long: true, required: true },
  { group: "How leads are handled", key: "rules", label: "Jobs you don't take, small jobs and repairs", long: true, required: true },
  { group: "Revenue System", key: "quotes", label: "Open quotes from the last 6 months", help: "How you'll get us the list (name, phone, job, amount, date). A spreadsheet is perfect.", long: true, tier2: true },
  { group: "Revenue System", key: "past_customers", label: "Past customer list", help: "For seasonal check-ins and reviews. Only people you're allowed to contact.", long: true, tier2: true },
  { group: "Revenue System", key: "review_link", label: "Google review link", tier2: true },
  { group: "Revenue System", key: "financing", label: "Financing options and budget ranges to share", long: true, tier2: true },
  { group: "Revenue System", key: "estimators", label: "Estimators, zones and schedules", long: true, tier2: true },
  { group: "Revenue System", key: "crm", label: "CRM you use (if any)", tier2: true },
  { group: "Anything else", key: "notes", label: "Anything else we should know?", long: true },
] as const;

export const fieldsFor = (tier: KickoffTier) => KICKOFF_FIELDS.filter(f => tier === "tier2" || !f.tier2);

const looksLikePassword = (s: string) => /\b(password|passcode|pwd|pw)\s*[:=]/i.test(s);

/** Validate the client's answers. Returns cleaned answers, or the first problem in plain words. */
export function validateKickoff(input: unknown, tier: KickoffTier): { error: string } | { ok: Record<string, string> } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of fieldsFor(tier)) {
    const v = typeof raw[f.key] === "string" ? (raw[f.key] as string).replace(/\r/g, "").trim().slice(0, f.long ? 2000 : 300) : "";
    if (f.required && !v) return { error: `Fill in "${f.label}".` };
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
