// Cold email scripts with fill-ins. Pure: no I/O. Sent from the founder's own inbox.

export type EmailStep = "intro" | "follow_up" | "breakup";
export type EmailTemplate = { subject: string; body: string };
export type Merge = { first_name: string; company: string; city: string; my_name: string; business: string; booking_link: string; website: string; demo_link: string };

/** Days to wait after the previous email before the next step comes due. */
export const STEP_GAP_DAYS: Record<"follow_up" | "breakup", number> = { follow_up: 3, breakup: 4 };

/* Written to get a reply, not a click: short, plain text, one question at the end.
   The first email has no link on purpose. Links in a first cold email from a new inbox hurt delivery,
   and a one-word reply ("sure") is easier to get than a booking. The link comes in the follow-up. */
export const DEFAULT_TEMPLATES: Record<EmailStep, EmailTemplate> = {
  intro: {
    subject: "more work for {company}",
    body: `Hi {first_name},

Quick question: could {company} handle more work right now?

Most owners I talk to aren't short on leads. They lose them. A call comes in after hours or on a Saturday and nobody picks up. A quote goes out and nobody follows up. A happy customer from last year never hears from you again.

I set up a system that fixes all three. It texts every missed caller back in seconds and books them, follows up on open quotes until they answer, and brings past customers back for their next job. Nothing new for you to learn and nobody to hire.

If it doesn't put 5 booked appointments on your calendar in the first 30 days, your next month is free.

Worth a look?

{my_name}
{business}
{website}`,
  },
  follow_up: {
    subject: "Re: more work for {company}",
    body: `Hi {first_name},

Following up on my note below. If {company} had 5 more booked jobs next month, could your crew take them?

Here's a quick demo of how it works: {demo_link}

If the answer is yes, I'll show you exactly where they'd come from in 15 minutes: {booking_link}

{my_name}`,
  },
  breakup: {
    subject: "Re: more work for {company}",
    body: `Hi {first_name},

I'll stop here so I'm not cluttering your inbox.

If {company} ever wants more jobs on the calendar without adding office staff, the demo is here: {demo_link}

Or reply "jobs" and I'll walk you through it.

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

export function mergeFor(c: { name: string; company: string; location?: string }, ws: { ownerFirstName: string; businessName: string; bookingLink: string; websiteUrl?: string; demoLink?: string }): Merge {
  return {
    first_name: greetName(c.name, c.company),
    company: (c.company || c.name || "your company").trim(),
    city: cityOf(c.location) || "your area",
    my_name: ws.ownerFirstName || "Sam",
    business: ws.businessName,
    booking_link: ws.bookingLink,
    website: (ws.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    demo_link: ws.demoLink || ws.websiteUrl || "",
  };
}

/** Replace {fill_ins}. Unknown ones are left as typed so a typo is visible in the preview, not silently dropped. */
export function fillTemplate(text: string, m: Merge): string {
  return text.replace(/\{(\w+)\}/g, (all, k: string) => (k in m ? String(m[k as keyof Merge]) : all)).replace(/\n{3,}/g, "\n\n").trim();
}
