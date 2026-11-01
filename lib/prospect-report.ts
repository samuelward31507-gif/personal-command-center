// Prospect report: a one-page, private link you send a prospect showing what slow follow-up likely costs them.
// Pure: no I/O. The math matches the website calculator so the two never disagree.

export const SPEEDS = {
  "5min": { label: "Within 5 minutes", loss: 0.02 },
  hour: { label: "Within the hour", loss: 0.10 },
  day: { label: "Same day", loss: 0.20 },
  next: { label: "Next day or later", loss: 0.30 },
} as const;
export type Speed = keyof typeof SPEEDS;
/** Share of quoted jobs consistent follow-up would add when quotes aren't always chased twice. */
export const FOLLOW_UP_LIFT = 0.10;

export type LeakInputs = { leads: number; jobValue: number; closeRate: number; speed: Speed; followsUp: boolean };
export type LeakResult = { lostLeads: number; lostJobs: number; followUpJobs: number; month: number; year: number; half: number };

/** Gaps you can see from outside a business. Pick the ones you actually observed. */
export const FINDING_CHOICES = [
  "Your website form doesn't send an instant reply, so a new inquiry hears nothing until someone checks.",
  "There's no way to book an estimate online. Every inquiry waits for a call back.",
  "Missed calls don't get a text back, so callers who reach voicemail usually try the next company.",
  "Facebook and Instagram messages aren't answered right away.",
  "There's no follow-up after a quote is sent, beyond the first email.",
  "Recent customers aren't being asked for reviews, so the review count lags the quality of the work.",
  "The contact page asks for a lot before someone can reach you, which loses people on their phones.",
] as const;

export const TRADE_DEFAULTS: Record<string, Pick<LeakInputs, "leads" | "jobValue" | "closeRate">> = {
  fence: { leads: 40, jobValue: 7000, closeRate: 30 },
  pool: { leads: 25, jobValue: 60000, closeRate: 15 },
  other: { leads: 40, jobValue: 12000, closeRate: 25 },
};

export function leakMath(i: LeakInputs): LeakResult {
  const loss = SPEEDS[i.speed]?.loss ?? SPEEDS.hour.loss;
  const close = i.closeRate / 100;
  const lostLeads = i.leads * loss;
  const lostJobs = lostLeads * close;
  const followUpJobs = i.followsUp ? 0 : i.leads * (1 - loss) * close * FOLLOW_UP_LIFT;
  const month = (lostJobs + followUpJobs) * i.jobValue;
  return { lostLeads, lostJobs, followUpJobs, month, year: month * 12, half: month * 6 };
}

export type ReportInput = { company: string; trade: "fence" | "pool" | "other"; inputs: LeakInputs; findings: string[]; note: string };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[$,\s%]/g, "")) : NaN);

/** Cleans a report from the CRM form. Returns the first problem in plain words. */
export function validateReport(body: unknown): ReportInput | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const i = (b.inputs && typeof b.inputs === "object" ? b.inputs : {}) as Record<string, unknown>;
  const company = s(b.company, 160);
  if (!company) return { error: "Add the company name." };
  const trade = b.trade === "fence" || b.trade === "pool" ? b.trade : "other";
  const leads = n(i.leads), jobValue = n(i.jobValue), closeRate = n(i.closeRate);
  if (!Number.isFinite(leads) || leads < 1 || leads > 5000) return { error: "Inquiries a month must be between 1 and 5,000." };
  if (!Number.isFinite(jobValue) || jobValue < 100 || jobValue > 5_000_000) return { error: "Average job size must be a dollar amount." };
  if (!Number.isFinite(closeRate) || closeRate < 1 || closeRate > 100) return { error: "Win rate must be between 1 and 100%." };
  const speed = (typeof i.speed === "string" && i.speed in SPEEDS ? i.speed : "hour") as Speed;
  const findings = Array.isArray(b.findings) ? b.findings.map(f => s(f, 300)).filter(Boolean).slice(0, 6) : [];
  return {
    company, trade, findings, note: s(b.note, 800),
    inputs: { leads: Math.round(leads), jobValue: Math.round(jobValue), closeRate: Math.round(closeRate), speed, followsUp: i.followsUp === true },
  };
}

/** Accepts a stored inputs object (jsonb) defensively; anything odd falls back to the trade's defaults. */
export function readInputs(raw: unknown, trade: string): LeakInputs {
  const d = TRADE_DEFAULTS[trade] ?? TRADE_DEFAULTS.other;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback);
  return {
    leads: num(r.leads, d.leads), jobValue: num(r.jobValue, d.jobValue), closeRate: Math.min(100, num(r.closeRate, d.closeRate)),
    speed: (typeof r.speed === "string" && r.speed in SPEEDS ? r.speed : "hour") as Speed, followsUp: r.followsUp === true,
  };
}

/** "Opened 3 times, last Nov 2" — for the CRM, so you know when to follow up. */
export function viewLabel(count: number, lastViewed: string | null): string {
  if (!count || !lastViewed) return "Not opened yet";
  const d = new Date(lastViewed).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return count === 1 ? `Opened once, ${d}` : `Opened ${count} times, last ${d}`;
}
