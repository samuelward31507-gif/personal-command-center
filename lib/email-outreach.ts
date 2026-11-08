// Cold email scripts with fill-ins. Pure: no I/O. Sent from the founder's own inbox.

export type EmailStep = "intro" | "follow_up" | "breakup";
export type EmailTemplate = { subject: string; body: string };
export type Merge = { first_name: string; company: string; city: string; my_name: string; business: string; booking_link: string };

/** Days to wait after the previous email before the next step comes due. */
export const STEP_GAP_DAYS: Record<"follow_up" | "breakup", number> = { follow_up: 3, breakup: 4 };

/* Written to get a reply, not a click: short, plain text, one question at the end.
   The first email has no link on purpose. Links in a first cold email from a new inbox hurt delivery,
   and a one-word reply ("sure") is easier to get than a booking. The link comes in the follow-up. */
export const DEFAULT_TEMPLATES: Record<EmailStep, EmailTemplate> = {
  intro: {
    subject: "missed calls at {company}",
    body: `Hi {first_name},

When someone calls {company} and nobody picks up (you're on a job, it's after 5, it's Saturday), most of them don't leave a voicemail. They call the next company on Google.

I set up a system that texts every missed caller back within seconds, gets the job details and books the estimate on your calendar. Nothing new for you to learn.

If it doesn't book you at least 5 estimates in the first 30 days, your next month is free.

Open to seeing how it would work for {company}?

{my_name}
{business}`,
  },
  follow_up: {
    subject: "Re: missed calls at {company}",
    body: `Hi {first_name},

Following up on my note below. Do you know roughly how many calls {company} misses in a busy week?

Most owners don't, because those callers never leave a voicemail. That's the work I'd be winning back for you.

Worth 15 minutes to see it? {booking_link}

{my_name}`,
  },
  breakup: {
    subject: "Re: missed calls at {company}",
    body: `Hi {first_name},

I haven't heard back, so I'll take it this isn't a priority for {company} right now and stop emailing.

If missed calls ever turn into a headache, reply "calls" and I'll send over how it works.

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
