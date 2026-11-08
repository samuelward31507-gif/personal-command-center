// Cold email scripts with fill-ins. Pure: no I/O. Cinder never sends these; the founder sends each one from his own inbox.

export type EmailStep = "intro" | "follow_up" | "breakup";
export type EmailTemplate = { subject: string; body: string };
export type Merge = { first_name: string; company: string; city: string; my_name: string; business: string; booking_link: string };

/** Days to wait after the previous email before the next step comes due. */
export const STEP_GAP_DAYS: Record<"follow_up" | "breakup", number> = { follow_up: 3, breakup: 4 };

export const DEFAULT_TEMPLATES: Record<EmailStep, EmailTemplate> = {
  intro: {
    subject: "{company} calls after hours",
    body: `Hey {first_name},

Quick one. When someone calls {company} while your crew is out on a job or after hours, what happens to that call?

Most of those callers don't leave a voicemail. They call the next company on Google.

We set up a system that texts every missed caller back within seconds, answers their questions and books the estimate straight onto your calendar. You don't touch any tech.

We guarantee 5 booked appointments in your first 30 days, or your next month is free.

Worth a 15-minute look this week? {booking_link}

{my_name}
{business}`,
  },
  follow_up: {
    subject: "Re: {company} calls after hours",
    body: `Hey {first_name},

Bumping this up in case it got buried.

If I showed you how many estimates {company} could book from the calls you're already getting, would that be worth 15 minutes? {booking_link}

{my_name}`,
  },
  breakup: {
    subject: "Close the file on {company}?",
    body: `Hey {first_name},

Haven't heard back, so I'll assume missed calls aren't a problem for {company} right now and stop reaching out.

If that changes, just reply to this email and I'll send over a quick demo.

{my_name}`,
  },
};

const LEGAL = /\b(llc|inc|co|corp|company|ltd|fence|fencing|construction|services?)\b/i;

/** First name to greet with: the contact's first name when it's a person, "there" when the name is really the company. */
export function greetName(name: string, company: string): string {
  const n = (name || "").trim();
  if (!n || n.toLowerCase() === (company || "").trim().toLowerCase() || LEGAL.test(n) || /[@\d]/.test(n)) return "there";
  const first = n.split(/\s+/)[0].replace(/[^A-Za-z'-]/g, "");
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "there";
}

/** City from "City, ST" (or the whole thing when there's no comma). */
export const cityOf = (location = "") => location.split(",")[0].trim();

export function mergeFor(c: { name: string; company: string; location?: string }, ws: { ownerFirstName: string; businessName: string; bookingLink: string }): Merge {
  return {
    first_name: greetName(c.name, c.company),
    company: (c.company || c.name || "your company").trim(),
    city: cityOf(c.location) || "your area",
    my_name: ws.ownerFirstName || "Sam",
    business: ws.businessName,
    booking_link: ws.bookingLink,
  };
}

/** Replace {fill_ins}. Unknown ones are left as typed so a typo is visible in the preview, not silently dropped. */
export function fillTemplate(text: string, m: Merge): string {
  return text.replace(/\{(\w+)\}/g, (all, k: string) => (k in m ? String(m[k as keyof Merge]) : all)).replace(/\n{3,}/g, "\n\n").trim();
}
