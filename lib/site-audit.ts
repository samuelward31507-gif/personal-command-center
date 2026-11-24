// Public website audit ("where you're losing jobs"): validates what a stranger typed, and turns the homepage check
// into a plain pass/fail list. Only facts we saw on the page, plus math on their own numbers. Pure: safe to unit test.
import type { SiteCheck } from "./site-check";

export type AuditSpeed = "5min" | "hour" | "day" | "next";
export type AuditInput = { business: string; website: string; trade: "fence" | "generator" | "other"; leads: number; jobValue: number; closeRate: number; speed: AuditSpeed; followsUp: boolean };
export type AuditCheck = { key: string; label: string; ok: boolean; detail: string };

const SPEEDS: AuditSpeed[] = ["5min", "hour", "day", "next"];
const int = (v: unknown) => { const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : NaN; return Number.isFinite(n) ? Math.round(n) : NaN; };

/** "spam" for a filled honeypot. Errors are written for the person filling in the form. */
export function validateAudit(body: unknown): AuditInput | { error: string } | "spam" {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.fax === "string" && b.fax.trim()) return "spam";
  const business = typeof b.business === "string" ? b.business.replace(/[<>]/g, "").trim().slice(0, 60) : "";
  const website = typeof b.website === "string" ? b.website.trim().slice(0, 200) : "";
  if (!business) return { error: "Enter your business name." };
  if (!website) return { error: "Enter your website, like summitfence.com." };
  const leads = int(b.leads), jobValue = int(b.jobValue), closeRate = int(b.closeRate);
  if (!(leads >= 1 && leads <= 2000)) return { error: "Leads a month should be a number between 1 and 2,000." };
  if (!(jobValue >= 100 && jobValue <= 500000)) return { error: "Average job should be a dollar amount, like 6500." };
  if (!(closeRate >= 1 && closeRate <= 90)) return { error: "Close rate should be a percent between 1 and 90." };
  const speed = SPEEDS.includes(b.speed as AuditSpeed) ? (b.speed as AuditSpeed) : "hour";
  const trade = b.trade === "generator" ? "generator" : b.trade === "other" ? "other" : "fence";
  return { business, website, trade, leads, jobValue, closeRate, speed, followsUp: b.followsUp === true || b.followsUp === "yes" };
}

/** What a homeowner on their phone runs into, from the homepage we fetched. */
export function auditChecks(c: SiteCheck): AuditCheck[] {
  const secs = c.ms == null ? null : c.ms / 1000;
  return [
    { key: "book", label: "Book an estimate online", ok: !!c.booking, detail: c.booking ? `Booking through ${c.booking}.` : "No booking found. Every inquiry waits for a call back." },
    { key: "text", label: "Text or chat from the site", ok: !!(c.chat || c.textUs), detail: c.chat ? `${c.chat} on the page.` : c.textUs ? "A text-us link is on the page." : "No way to text. Someone looking at 9pm has to call or fill in a form and wait." },
    { key: "form", label: "Quote form", ok: c.form, detail: c.form ? "A form is on the homepage." : "No form on the homepage." },
    { key: "call", label: "Tap to call on a phone", ok: c.tapToCall, detail: c.tapToCall ? "The number is tappable." : "The number isn't tappable on a phone." },
    { key: "mobile", label: "Set up for phones", ok: c.mobile, detail: c.mobile ? "The page is set up for phones." : "The page isn't set up for phones." },
    { key: "speed", label: "Loads fast", ok: secs != null && secs <= 3, detail: secs == null ? "Load time unknown." : `The page answered in ${secs.toFixed(1)} seconds.` },
    { key: "reviews", label: "Reviews on the homepage", ok: c.reviewsShown, detail: c.reviewsShown ? "Reviews or testimonials are shown." : "No reviews shown to a first-time visitor." },
  ];
}
