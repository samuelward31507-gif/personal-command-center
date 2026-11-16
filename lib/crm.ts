// The client's CRM, kept simple: one card per customer, five stages, job details in the trade's own words,
// and a ballpark worked out from the owner's own prices (never invented by the AI).
// Pure functions only: the app, the server routes and the texting engine all share them.

export const TRADES = ["Fence", "Pool", "Contractor", "Auto detailing", "Carpet cleaning", "Exterior cleaning", "Other"] as const;

export type JobField = { key: string; label: string; kind: "number" | "text" | "choice"; unit?: string; options?: readonly string[]; ask: string };
const ADDRESS: JobField = { key: "address", label: "Address", kind: "text", ask: "the address or neighborhood" };

/** What a job looks like in each trade: the fields on the card and the questions the texts ask, one at a time. */
export function jobFields(trade?: string): JobField[] {
  const t = (trade || "").toLowerCase();
  if (t === "fence") return [
    { key: "length_ft", label: "Length", kind: "number", unit: "ft", ask: "about how many feet of fence" },
    { key: "material", label: "Material", kind: "text", ask: "the material (wood, vinyl, chain link, aluminum)" },
    { key: "height", label: "Height", kind: "choice", options: ["4 ft", "5 ft", "6 ft", "8 ft"], ask: "the height" },
    { key: "gates", label: "Gates", kind: "number", ask: "how many gates" },
    { key: "hoa", label: "HOA", kind: "choice", options: ["Yes", "No"], ask: "whether they're in an HOA" },
    ADDRESS,
  ];
  if (t === "auto detailing") return [
    { key: "vehicle", label: "Vehicle", kind: "text", ask: "the vehicle" },
    { key: "service", label: "Service", kind: "text", ask: "which service they want" },
    ADDRESS,
  ];
  if (t === "carpet cleaning") return [
    { key: "rooms", label: "Rooms", kind: "number", ask: "how many rooms" },
    { key: "service", label: "Service", kind: "text", ask: "what needs cleaning" },
    ADDRESS,
  ];
  return [
    { key: "job", label: "Job", kind: "text", ask: "what the job is" },
    { key: "size", label: "Size", kind: "text", ask: "roughly how big it is" },
    ADDRESS,
  ];
}

export type Details = Record<string, string | number>;
/** Keeps only the trade's own fields, trimmed; numbers stay numbers. Anything else is dropped. */
export function cleanDetails(trade: string | undefined, input: unknown): Details {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Details = {};
  for (const f of jobFields(trade)) {
    const v = r[f.key];
    if (v == null || v === "") continue;
    if (f.kind === "number") {
      const m = typeof v === "number" ? null : String(v).replace(/,/g, "").match(/^\s*(\d+(?:\.\d+)?)/); const n = typeof v === "number" ? v : m ? Number(m[1]) : NaN;
      if (Number.isFinite(n) && n > 0 && n < 100000) out[f.key] = Math.round(n * 10) / 10;
      continue;
    }
    const s = String(v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
    if (!s) continue;
    if (f.kind === "choice" && f.options) {
      const hit = f.options.find(o => o.toLowerCase() === s.toLowerCase() || o.toLowerCase().replace(/\s/g, "") === s.toLowerCase().replace(/\s/g, ""));
      if (hit) out[f.key] = hit; else if (f.key === "hoa") { if (/^(y|yes|yeah|yep|true)$/i.test(s)) out[f.key] = "Yes"; else if (/^(n|no|nope|false)$/i.test(s)) out[f.key] = "No"; }
      else if (/^\d+(\.\d)?\s*(ft|feet|')?$/i.test(s)) out[f.key] = `${parseFloat(s)} ft`;
      continue;
    }
    out[f.key] = s;
  }
  return out;
}

/** One line for a card, a text or an alert: "150 ft, 6 ft cedar, 2 gates, HOA". */
export function detailLine(trade: string | undefined, d: Details): string {
  if ((trade || "").toLowerCase() === "fence") {
    const parts: string[] = [];
    if (d.length_ft) parts.push(`${d.length_ft} ft`);
    const mat = [d.height, d.material].filter(Boolean).join(" ");
    if (mat) parts.push(String(mat));
    if (d.gates != null && d.gates !== "") parts.push(`${d.gates} ${Number(d.gates) === 1 ? "gate" : "gates"}`);
    if (d.hoa === "Yes") parts.push("HOA");
    return parts.join(", ");
  }
  return jobFields(trade).filter(f => f.key !== "address" && d[f.key] != null).map(f => f.unit ? `${d[f.key]} ${f.unit}` : String(d[f.key])).join(", ");
}

// ---------- The owner's prices ----------
export type Rate = { name: string; low: number; high: number };
export type PriceBook = { unit: "ft" | "job"; rates: Rate[]; gate?: [number, number] };
const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
export function parsePriceBook(raw: string | undefined): PriceBook | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    const unit = j.unit === "job" ? "job" : "ft";
    const rates: Rate[] = (Array.isArray(j.rates) ? j.rates : []).slice(0, 12).map((r: Record<string, unknown>) => ({ name: String(r.name ?? "").trim().slice(0, 60), low: num(r.low), high: num(r.high) }))
      .filter((r: Rate) => r.name && r.low > 0 && r.high >= r.low);
    const g = Array.isArray(j.gate) ? [num(j.gate[0]), num(j.gate[1])] : null;
    const gate = g && g[0] > 0 && g[1] >= g[0] ? [g[0], g[1]] as [number, number] : undefined;
    return rates.length ? { unit, rates, gate } : null;
  } catch { return null; }
}
export const serializePriceBook = (b: PriceBook) => JSON.stringify(b);

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !["fence", "privacy", "the"].includes(w));
/** The rate that fits what the customer asked for: shared words in the name, or the only rate there is. */
export function matchRate(book: PriceBook, material: string | undefined): Rate | null {
  if (book.rates.length === 1) return book.rates[0];
  if (!material) return null;
  const want = words(material);
  let best: Rate | null = null, score = 0;
  for (const r of book.rates) { const s = words(r.name).filter(w => want.some(x => x === w || x.startsWith(w) || w.startsWith(x))).length; if (s > score) { best = r; score = s; } }
  return best;
}
const round100 = (n: number) => Math.round(n / 100) * 100;
/**
 * A ballpark from the owner's own prices, or null when it can't be worked out honestly.
 * Fence: feet × the matching rate, plus gates. Per-job trades: the rate's own range.
 */
export function ballpark(book: PriceBook | null, d: Details): { low: number; high: number; basis: string } | null {
  if (!book) return null;
  if (book.unit === "job") { const r = matchRate(book, String(d.service ?? d.job ?? "")); return r ? { low: round100(r.low), high: round100(r.high), basis: r.name } : null; }
  const ft = Number(d.length_ft);
  if (!ft || ft < 8 || ft > 5000) return null;
  const r = matchRate(book, [d.height, d.material].filter(Boolean).join(" "));
  if (!r) return null;
  const gates = Number(d.gates) || 0;
  const gl = book.gate ? book.gate[0] * gates : 0, gh = book.gate ? book.gate[1] * gates : 0;
  return { low: round100(ft * r.low + gl), high: round100(ft * r.high + gh), basis: `${ft} ft of ${r.name}${gates ? ` and ${gates} ${gates === 1 ? "gate" : "gates"}` : ""}` };
}
export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const rangeText = (b: { low: number; high: number }) => `${money(b.low)}–${money(b.high)}`;

// ---------- Stages ----------
export const STAGES = ["new", "booked", "quoted", "won", "lost"] as const;
export type Stage = typeof STAGES[number];
export const STAGE_LABEL: Record<Stage, string> = { new: "New", booked: "Estimate booked", quoted: "Quoted", won: "Won", lost: "Lost" };
/** Why a job was lost, for the owner to pick when he moves it. */
export const LOST_REASONS = ["Price", "Went with someone else", "Timing", "Not a fit", "Never answered", "Other"] as const;
export const cleanLostReason = (v: unknown): string => { const s = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) : ""; return s; };
/** Where a customer stands. The owner's own move wins; otherwise it follows what happened (quote, booking, close). */
export function stageFor(r: { stage?: string | null; status: string; quote_status?: string | null; next_appt?: string | null }): Stage {
  if (r.stage && (STAGES as readonly string[]).includes(r.stage)) return r.stage as Stage;
  if (r.quote_status === "won") return "won";
  if (r.quote_status === "lost") return "lost";
  if (r.quote_status === "open" || r.quote_status === "replied") return "quoted";
  if (r.status === "booked" || r.next_appt) return "booked";
  if (r.status === "closed" || r.status === "opted_out") return "lost";
  return "new";
}

// ---------- Setup the owner fills in themselves ----------
export const TEAM_SIZES = ["Just me", "2-5 people", "6-10 people", "11+ people"] as const;
export const YEARS = ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "10+ years"] as const;
export const LEADS_MONTH = ["Under 10", "10-30", "30-60", "60+"] as const;
export const LEAD_SOURCES = ["Phone calls", "Website form", "Google", "Facebook", "Angi", "Thumbtack", "Yelp", "Referrals", "Nextdoor"] as const;
export const SOFTWARE = ["None, just my phone", "Jobber", "Housecall Pro", "ServiceTitan", "Spreadsheet or paper", "Something else"] as const;
export const PRIORITIES = [
  { key: "speed", label: "Answer every lead before my competitors do" },
  { key: "quotes", label: "Win more of the quotes I send" },
  { key: "organized", label: "Keep every customer and job in one place" },
  { key: "calendar", label: "Fill my calendar with estimates" },
] as const;

/** The setup keys an owner may change from the app. Everything else (texting number, alerts, links) stays Sam's. */
export const OWNER_KEYS = ["display_name", "owner_name", "website", "trade", "service_area", "team_size", "years", "leads_month", "lead_sources", "software", "price_book", "share_ballpark", "priority", "onboarded_at", "pay_link", "tax_rate", "invoice_days"] as const;
/** The agent's own settings, in plain words, that the owner may change from the app. Each one changes what the texts say or do. */
export const AGENT_KEYS = ["hours", "service_area", "rules", "questions", "prices", "tone", "avoid", "financing", "handoff", "lang", "book_lead_hours", "book_per_day", "book_buffer_min", "quote_days", "nudge_hours", "dnt"] as const;
/** "2, 5, 10, 21" to [2, 5, 10, 21]: whole numbers, ascending, at most `max` of them, each at most `top`. */
export function parseDayList(v: unknown, max: number, top: number): number[] {
  const out: number[] = [];
  for (const p of String(v ?? "").split(/[,\s]+/)) { const n = Number(p); if (!Number.isInteger(n) || n < 0 || n > top) continue; if (out.length && n <= out[out.length - 1]) continue; out.push(n); if (out.length >= max) break; }
  return out;
}
/** A do-not-text list: one phone per line or comma, kept as +1 numbers. */
export function parseDnt(v: unknown): string[] {
  const seen = new Set<string>();
  for (const p of String(v ?? "").split(/[,\n;]+/)) { const d = p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""); if (d.length === 10) seen.add("+1" + d); if (seen.size >= 500) break; }
  return [...seen];
}
export const TEAM_MAX = 10;
export type TeamMember = { name: string; cell: string; role: "crew" | "office" | "owner"; /** What an hour of their time costs, for job labor from clocked hours. */ rate?: number };
/** The owner's team from setup.team: up to ten people, each a name, a +1 cell, a role (owner, office, crew) and an hourly rate. */
export function parseTeam(v: unknown): TeamMember[] {
  let arr: unknown = v;
  if (typeof v === "string") { try { arr = JSON.parse(v); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  const out: TeamMember[] = [], seen = new Set<string>();
  for (const m of arr) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const d = String(r.cell ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (d.length !== 10 || seen.has(d)) continue;
    seen.add(d);
    const rate = Number(String(r.rate ?? "").replace(/[$,\s]/g, ""));
    out.push({ name: String(r.name ?? "").trim().slice(0, 40), cell: "+1" + d, role: r.role === "owner" ? "owner" : r.role === "office" ? "office" : "crew", ...(Number.isFinite(rate) && rate > 0 && rate <= 500 ? { rate: Math.round(rate * 100) / 100 } : {}) });
    if (out.length >= TEAM_MAX) break;
  }
  return out;
}
export function cleanOwnerSetup(input: unknown): Record<string, string> {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  const pick = (k: string, allowed?: readonly string[], max = 120) => {
    const v = r[k]; if (typeof v !== "string") return;
    const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
    if (allowed && s && !allowed.includes(s)) return;
    out[k] = s;
  };
  pick("display_name", undefined, 80); pick("owner_name", undefined, 40); pick("website", undefined, 200); pick("service_area", undefined, 300);
  pick("trade", TRADES); pick("team_size", TEAM_SIZES); pick("years", YEARS); pick("leads_month", LEADS_MONTH); pick("software", SOFTWARE);
  pick("priority", PRIORITIES.map(p => p.key)); pick("share_ballpark", ["yes", "no"]);
  if (typeof r.lead_sources === "string") out.lead_sources = r.lead_sources.split(",").map(s => s.trim()).filter(s => (LEAD_SOURCES as readonly string[]).includes(s)).join(", ");
  if (typeof r.price_book === "string") { const b = parsePriceBook(r.price_book); out.price_book = b ? serializePriceBook(b) : ""; }
  if (typeof r.onboarded_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(r.onboarded_at)) out.onboarded_at = r.onboarded_at.slice(0, 30);
  if (out.website && !/^https?:\/\//i.test(out.website)) out.website = "https://" + out.website.replace(/^\/+/, "");
  // Billing: the owner's own pay link (https only), sales tax as a percent, and how many days an invoice gives.
  if (typeof r.pay_link === "string") { const v = r.pay_link.trim(); let ok = ""; try { const u = new URL(/^https?:\/\//i.test(v) ? v : "https://" + v); ok = v && u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? u.toString().slice(0, 400) : ""; } catch { ok = ""; } out.pay_link = ok; }
  if (r.tax_rate !== undefined) { const n = Number(String(r.tax_rate).replace(/[%\s]/g, "")); out.tax_rate = n >= 0 && n <= 20 ? String(Math.round(n * 100) / 100) : "0"; }
  if (r.invoice_days !== undefined) out.invoice_days = ["0", "7", "14", "30"].includes(String(r.invoice_days)) ? String(r.invoice_days) : "7";
  // The agent's settings. Free text stays short; numbers stay in the ranges the engine can honour.
  pick("hours", undefined, 120); pick("rules", undefined, 400); pick("questions", undefined, 400); pick("prices", undefined, 400); pick("tone", undefined, 300); pick("avoid", undefined, 300); pick("financing", undefined, 200); pick("handoff", undefined, 300);
  pick("lang", ["", "en", "es", "both"]);
  const int = (k: string, lo: number, hi: number) => { if (r[k] === undefined) return; const n = Math.round(Number(String(r[k]).replace(/[^\d.]/g, ""))); out[k] = Number.isFinite(n) && n >= lo && n <= hi ? String(n) : ""; };
  int("book_lead_hours", 1, 72); int("book_per_day", 1, 8); int("book_buffer_min", 0, 120);
  if (r.quote_days !== undefined) out.quote_days = parseDayList(r.quote_days, 6, 60).join(",");
  if (r.nudge_hours !== undefined) out.nudge_hours = parseDayList(r.nudge_hours, 3, 168).join(",");
  if (r.dnt !== undefined) out.dnt = parseDnt(r.dnt).join(",");
  if (r.team !== undefined) out.team = JSON.stringify(parseTeam(r.team));
  pick("monthly_report", ["", "yes", "no"]); pick("booking_page", ["", "yes", "no"]); pick("review_on_paid", ["", "yes", "no"]); pick("evening_text", ["", "yes", "no"]); pick("crew_prices", ["", "yes", "no"]);
  if (r.checklists !== undefined) { let arr: unknown = r.checklists; if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = []; } }
    out.checklists = JSON.stringify((Array.isArray(arr) ? arr : []).slice(0, 20).map(x => { const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return { name: String(o.name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60), items: (Array.isArray(o.items) ? o.items : []).map(i => String(i ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 100)).filter(Boolean).slice(0, 30) }; }).filter(x => x.name && x.items.length)); }
  if (r.labor_rate !== undefined) { const n = Number(String(r.labor_rate ?? "").replace(/[$,\s]/g, "")); out.labor_rate = Number.isFinite(n) && n > 0 && n <= 500 ? String(Math.round(n * 100) / 100) : ""; }
  pick("quote_terms", undefined, 1200); pick("warranty", undefined, 300); pick("financing_note", undefined, 160);
  if (r.financing_link !== undefined) { const u = String(r.financing_link ?? "").trim().slice(0, 300); out.financing_link = /^https:\/\/[^\s]+$/.test(u) ? u : ""; }
  return out;
}

/** The first text a new lead gets, for the preview while the owner sets up. Mirrors the missed-call text. */
export function previewFirstText(name: string, trade: string): string {
  const biz = name.trim().replace(/\.+$/, "") || "your business";
  const ask = (trade || "").toLowerCase() === "fence" ? "What kind of fence are you thinking about?" : "What can we help you with?";
  return `Hi! This is ${biz}. Sorry we missed your call, we're out on a job. ${ask} Reply STOP to opt out.`;
}

/**
 * What the reply engine needs to gather an estimate-ready job: what it knows, what's still worth asking (one at a time),
 * and the ballpark it may share, worked out from the owner's prices, never by the AI.
 */
export function intakeRules(trade: string | undefined, d: Details, bp: { low: number; high: number; basis: string } | null): string {
  const fields = jobFields(trade);
  const known = fields.filter(f => d[f.key] != null).map(f => `${f.label}: ${d[f.key]}${f.unit ? " " + f.unit : ""}`);
  const missing = fields.filter(f => d[f.key] == null).map(f => f.ask);
  const keys = fields.map(f => f.key).join(", ");
  return `

Job details (so the owner gets an estimate-ready lead):
- Known so far: ${known.length ? known.join("; ") : "nothing yet"}.
- Still worth learning, one question per text, only while it fits naturally: ${missing.length ? missing.join("; ") : "nothing, you have it all"}. If they haven't sent a photo, you may ask once for a photo of the area.
- Never hold up a booking for these: if they want to book, book.
- Add "job" to your JSON with anything the customer told you, using these keys: ${keys}. Numbers as numbers (feet, gates). Only what they said; never guess.
${bp ? `- Ballpark from the owner's own prices for ${bp.basis}: ${rangeText(bp)}. You may share this once, as a range, and say the final price comes after measuring. Never give any other number.` : "- No ballpark yet: don't give a price number unless the pricing guidance gives one."}`;
}

// ---------- The board's card (shared by the server, the app and the example business) ----------
export type Card = { id: string; name: string; phone: string; source: string; status: string; stage: Stage; details: Details; line: string; value: number | null;
  ballpark: { low: number; high: number } | null; notes: string; next: string | null; at: string;
  quote: { id: string; amount: number | null; status: string; steps: number; linked: boolean; url: string | null; viewed: string | null; note: string;
    items: { name: string; qty: number; unit: string; price: number; tier?: string; opt?: boolean }[]; tax: number; deposit?: number | null;
    /** How many times they opened it, the last time, whether follow-ups are paused (imported quotes start paused), and when the next one goes. */
    views?: number; lastViewed?: string | null; chasePaused?: boolean; nextChase?: string | null } | null;
  install: string | null; installTime: string | null; installDays: number; onCalendar: boolean; reviewAuto: boolean; reviewSent: string | null; pastCustomer: boolean;
  invoice: CardInvoice | null; job: Record<string, string>; costs: Costs;
  /** When the job entered its current stage, and the owner's reason when it was lost. */
  stageAt?: string | null; lostReason?: string;
  /** What the crew needs on site: gate code, the dog, where to park. */
  crew?: string;
  email?: string;
  /** "Remind me": when, and what about. Cleared once it's sent or the owner clears it. */
  remind?: { at: string; note: string; sent: boolean } | null;
  photos?: Photo[];
  /** The team member on this job (their +1 cell), or "" when it's the owner's. */
  crewMember?: string;
  /** Extra work agreed mid-job, each one approved by the customer (or in person). */
  changeOrders?: import("@/lib/service").ChangeOrder[];
  /** When the Google review ask goes out after the invoice was paid in full, if it's queued. */
  reviewAfter?: string | null;
  /** The customer's sign-off at the end of the job, the latest one. */
  signoff?: import("@/lib/service").Signoff | null;
  /** Every property this customer has (address, gate code, notes), when there's more than the main address. */
  properties?: { id: string; address: string; gate_code: string; notes: string }[];
  /** The job's checklist, filled in on the crew's phone. */
  checklist?: { name: string; items: { label: string; done: boolean; at?: string; by?: string }[] } | null };
export const cleanEmail = (v: unknown) => { const s = String(v ?? "").trim().toLowerCase().slice(0, 120); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ""; };
export type CardInvoice = { id: string; number: number; status: string; items: { name: string; qty: number; unit: string; price: number }[]; tax_rate: number; total: number; note: string;
  due_on: string | null; sent_at: string | null; viewed_at: string | null; paid_at: string | null; paid_claimed_at: string | null; reminders: number; reminders_paused: boolean; url: string | null;
  /** What has come in so far, from recorded payments. Balance is total minus this. */
  paid_amount?: number };
export type Payment = { id: string; invoice_id: string; thread_id: string; amount: number; method: PayMethod; paid_on: string; note: string; number?: number; customer?: string };
export const PAY_METHODS = [["card", "Card, through your pay link"], ["cash", "Cash"], ["check", "Check"], ["bank", "Bank transfer, Zelle or Venmo"], ["other", "Other"]] as const;
export type PayMethod = (typeof PAY_METHODS)[number][0];
export const cleanPayMethod = (v: unknown): PayMethod => (PAY_METHODS.some(m => m[0] === v) ? v as PayMethod : "other");
export type Photo = { id: string; kind: "before" | "during" | "after" | "other"; caption: string; at: string; shared: boolean };
// ---------- Where the jobs come from ----------
export const SOURCE_LABEL: Record<string, string> = { "booking page": "Booking page", missed_call: "Missed calls", text: "Texts", "web form": "Website form", "web chat": "Website chat", angi: "Angi", thumbtack: "Thumbtack",
  facebook: "Facebook", google: "Google", yelp: "Yelp", nextdoor: "Nextdoor", owner: "Added by you", import: "Imported", rehash: "Old leads", zapier: "Forms", referral: "Referrals" };
export type SourceRow = { source: string; label: string; leads: number; booked: number; won: number; wonValue: number };
/** Leads, estimates and won jobs per lead source, from the board itself: no setup, nothing to tag. Best earner first. */
export function sourceReport(cards: Pick<Card, "source" | "stage" | "value" | "quote">[]): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  for (const c of cards) {
    const key = SOURCE_LABEL[c.source] ? c.source : "other";
    const r = rows.get(key) ?? { source: key, label: SOURCE_LABEL[key] ?? "Other", leads: 0, booked: 0, won: 0, wonValue: 0 };
    r.leads++;
    if (c.stage === "booked" || c.stage === "quoted" || c.stage === "won") r.booked++;
    if (c.stage === "won") { r.won++; r.wonValue += c.value ?? c.quote?.amount ?? 0; }
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.wonValue - a.wonValue || b.won - a.won || b.leads - a.leads);
}

// ---------- Quotes the customer approves with one tap ----------
export const QUOTE_TOKEN = /^[A-Za-z0-9_-]{24}$/;
/** The text that carries the quote link. Short enough for one or two SMS segments. */
export function quoteText(v: { first: string; business: string; amount: number | null; line: string; url: string }): string {
  const biz = v.business.trim().replace(/\.+$/, "") || "us";
  const what = [v.amount ? money(v.amount) : "", v.line ? `for ${v.line}` : ""].filter(Boolean).join(" ");
  return `Hi${v.first ? " " + v.first : ""}, here's your quote from ${biz}${what ? `: ${what}` : ""}. You can look it over and approve it here: ${v.url}`;
}

// ---------- After the job: the review ask ----------
/** The review goes out the day after the install, not the day of: the crew's gone and the yard's cleaned up. */
export function reviewDue(install: string | null, today: string): boolean {
  return !!install && /^\d{4}-\d{2}-\d{2}$/.test(install) && install < today;
}
export const cleanDate = (v: unknown): string | null => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T12:00:00Z")) ? v : null;

// ---------- Win back past customers ----------
/** A ready-to-send check-in for past customers, by trade and season. The owner can rewrite it before it goes. */
export function winbackDraft(trade: string | undefined, owner: string, business: string, month = new Date().getMonth()): string {
  const first = owner.trim().split(" ")[0], biz = business.trim().replace(/\.+$/, "") || "us";
  const intro = first ? `it's ${first} with ${biz}` : `it's ${biz}`;
  const spring = month >= 1 && month <= 5;
  const t = (trade || "").toLowerCase();
  const ask = t === "fence" ? (spring ? "Spring's a good time to stain, seal or fix any boards that moved over the winter." : "Before winter is a good time to fix loose boards and leaning posts.")
    : t === "pool" ? (spring ? "Opening season is coming up." : "Closing season is coming up.")
    : t.includes("clean") || t === "auto detailing" ? "It's been a while since your last visit."
    : "Checking in on the work we did for you.";
  return `Hi {first}, ${intro}. ${ask} Want us to come take a look? Just reply YES.`;
}
/** Owner-edited win-back wording: plain text, the business named, a real ask, one message long. */
export function cleanWinback(body: unknown, business: string): { ok: true; text: string } | { ok: false; error: string } {
  const s = String(body ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim();
  if (s.length < 20) return { ok: false, error: "Write a little more so they know what you're offering." };
  if (s.length > 320) return { ok: false, error: "Keep it under 320 characters so it arrives as one text." };
  if (/https?:\/\/|www\./i.test(s)) return { ok: false, error: "Leave links out. Carriers often block texts like this with links." };
  const biz = business.trim().replace(/\.+$/, "");
  if (biz && !s.toLowerCase().includes(biz.toLowerCase().split(" ")[0])) return { ok: false, error: `Say it's from ${biz} so they know who's texting.` };
  return { ok: true, text: s };
}

// ---------- A first draft of a quote ----------
const mid = (a: number, b: number) => Math.round((a + b) / 2);
/**
 * A first draft of the quote from what Cinder learned and the owner's own prices. Never sent as is: the owner
 * checks every line and taps Send. Fence: the run of fence by the foot, each gate. Per-job trades: the matching service.
 */
export function draftItems(trade: string | undefined, d: Details, priceBook: string | undefined): { name: string; qty: number; unit: string; price: number }[] {
  const book = parsePriceBook(priceBook);
  const out: { name: string; qty: number; unit: string; price: number }[] = [];
  if (book?.unit === "ft") {
    const ft = Number(d.length_ft) || 0;
    const r = matchRate(book, [d.height, d.material].filter(Boolean).join(" ")) ?? (d.material ? null : book.rates[0]);
    if (r) out.push({ name: `${[d.height, r.name].filter(Boolean).join(" ")} fence, installed`, qty: ft || 1, unit: ft ? "ft" : "", price: mid(r.low, r.high) });
    const gates = Number(d.gates) || 0;
    if (gates && book.gate) out.push({ name: "Walk gate", qty: gates, unit: "", price: mid(book.gate[0], book.gate[1]) });
  } else if (book?.unit === "job") {
    const r = matchRate(book, String(d.service ?? d.job ?? "")) ?? book.rates[0];
    if (r) out.push({ name: r.name, qty: 1, unit: "", price: mid(r.low, r.high) });
  }
  if (!out.length) out.push({ name: (trade || "").toLowerCase() === "fence" ? "Fence, installed" : "Job", qty: 1, unit: "", price: 0 });
  return out;
}


// ---------- After the yes: the job, step by step ----------
export type JobStep = { key: string; label: string; hint: string };
export type Costs = { materials: number; labor: number; other: number };
const FENCE_STEPS: JobStep[] = [
  { key: "deposit", label: "Deposit in", hint: "Most fence jobs take a third up front." },
  { key: "hoa", label: "HOA approved", hint: "Send the HOA the plan and the material before ordering." },
  { key: "permit", label: "Permit sorted", hint: "Pulled, or checked that this job doesn't need one." },
  { key: "locate", label: "811 locate called", hint: "Call 811 at least 3 business days before digging." },
  { key: "materials", label: "Materials ordered", hint: "" },
  { key: "installed", label: "Installed", hint: "" },
  { key: "walk", label: "Walk-through with the customer", hint: "Walk the line together before you invoice." },
];
const BASIC_STEPS: JobStep[] = [
  { key: "deposit", label: "Deposit in", hint: "" },
  { key: "materials", label: "Materials ordered", hint: "" },
  { key: "installed", label: "Job done", hint: "" },
  { key: "walk", label: "Walk-through with the customer", hint: "" },
];
/** The steps between "won" and "paid" for this trade and this job. HOA only shows when the customer is in one. */
export function jobSteps(trade: string | undefined, d: Details): JobStep[] {
  if (!/fenc/i.test(trade ?? "")) return BASIC_STEPS;
  return FENCE_STEPS.filter(s => s.key !== "hoa" || d.hoa === "Yes");
}
/** Saved steps: known keys only, each with the day it was done. */
export function cleanJob(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  const keys = new Set([...FENCE_STEPS, ...BASIC_STEPS].map(s => s.key));
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) if (keys.has(k) && typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) out[k] = raw;
  return out;
}
/** Where the job stands, counting the invoice: the last two steps are always "Invoice sent" and "Paid". */
export function jobProgress(trade: string | undefined, c: Pick<Card, "details" | "job" | "invoice">): { done: number; total: number; next: string | null } {
  const steps = jobSteps(trade, c.details);
  const marks = [...steps.map(s => !!c.job[s.key]), !!c.invoice && c.invoice.status !== "draft" && c.invoice.status !== "void", c.invoice?.status === "paid"];
  const labels = [...steps.map(s => s.label), "Invoice sent", "Paid"];
  const i = marks.indexOf(false);
  return { done: marks.filter(Boolean).length, total: marks.length, next: i < 0 ? null : labels[i] };
}
/** What the job cost, from what the owner typed: whole dollars, nothing negative. */
export function cleanCosts(v: unknown): Costs {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown) => { const m = Number(String(x ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(m) && m > 0 ? Math.min(Math.round(m), 10_000_000) : 0; };
  return { materials: n(o.materials), labor: n(o.labor), other: n(o.other) };
}
/** Profit on a job: the price minus what it cost. Null until there is a price and at least one cost. */
export function jobProfit(price: number | null, costs: Costs): { cost: number; profit: number; margin: number } | null {
  const cost = costs.materials + costs.labor + costs.other;
  if (!price || !cost) return null;
  return { cost, profit: price - cost, margin: Math.round(((price - cost) / price) * 100) };
}
