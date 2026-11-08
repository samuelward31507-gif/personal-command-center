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

/** Detailers get a different pitch: their money is repeat customers, not missed quotes. */
export const DETAILING_TEMPLATES: Record<EmailStep, EmailTemplate> = {
  intro: {
    subject: "repeat customers for {company}",
    body: `Hi {first_name},

Quick question: how many past customers does {company} have who haven't booked in the last 3 months?

For most detailers it's a few hundred. They liked the work and they'd book again. Nobody asked them to.

I set up a system that texts your past customers when they're due for their next detail, texts back anyone who calls while you're mid-job, and asks every happy customer for a Google review. Nothing new for you to learn.

If it doesn't put 5 booked appointments on your calendar in the first 30 days, your next month is free.

Worth a look?

{my_name}
{business}
{website}`,
  },
  follow_up: {
    subject: "Re: repeat customers for {company}",
    body: `Hi {first_name},

Following up on my note below. If {company} had 5 more booked details next month from customers you've already served, could you fit them in?

Here's a quick demo of how it works: {demo_link}

If the answer is yes, I'll show you how it would work for you in 15 minutes: {booking_link}

{my_name}`,
  },
  breakup: {
    subject: "Re: repeat customers for {company}",
    body: `Hi {first_name},

I'll stop here so I'm not cluttering your inbox.

If you ever want to fill slow weeks from your own customer list, the demo is here: {demo_link}

Or reply "book" and I'll walk you through it.

{my_name}`,
  },
};

/** Which script a contact gets: detailers get the repeat-customer pitch, everyone else the contractor one. */
export type Track = "trades" | "detailing";
export const trackOf = (niche?: string): Track => (/detail/i.test(niche || "") ? "detailing" : "trades");
export const TEMPLATE_SETS: Record<Track, Record<EmailStep, EmailTemplate>> = { trades: DEFAULT_TEMPLATES, detailing: DETAILING_TEMPLATES };
export const TRACK_LABEL: Record<Track, string> = { trades: "Contractors", detailing: "Detailers" };

/** Sent right after a no-answer or voicemail in Call mode. It counts as the first email, so the
    normal follow-up and last try come after it in the same thread (the subject matches theirs). */
export const AFTER_CALL_TEMPLATES: Record<Track, EmailTemplate> = {
  trades: {
    subject: "more work for {company}",
    body: `Hi {first_name},

Just tried calling {company}. Sorry I missed you.

Short version: could you handle more work right now? I set up a system that texts back every missed call in seconds and books them, follows up on open quotes, and brings past customers back for their next job.

If it doesn't put 5 booked appointments on your calendar in the first 30 days, your next month is free.

Worth a quick call this week? Just reply with a good time.

{my_name}
{business}
{website}`,
  },
  detailing: {
    subject: "repeat customers for {company}",
    body: `Hi {first_name},

Just tried calling {company}. Probably caught you mid-detail.

Short version: how many past customers haven't rebooked in the last 3 months? I set up a system that texts them when they're due and books them back in, texts back anyone who calls while you're working, and asks happy customers for reviews.

If it doesn't put 5 booked appointments on your calendar in the first 30 days, your next month is free.

Worth a quick call this week? Just reply with a good time.

{my_name}
{business}
{website}`,
  },
};

/** How many follow-ups and last tries are due, from the send log alone (replies and bounces excluded). Pure. */
export function dueFollowUps(sent: { contactId: string; step: string; at: string }[], heard: { contactId: string }[], now = Date.now()): { follow_up: number; breakup: number } {
  const done = new Set(heard.map(h => h.contactId));
  const by = new Map<string, Record<string, number>>();
  for (const s of sent) { const m = by.get(s.contactId) ?? {}; m[s.step] = Math.max(m[s.step] ?? 0, Date.parse(s.at)); by.set(s.contactId, m); }
  let follow_up = 0, breakup = 0;
  const days = (t: number) => (now - t) / 86400000;
  for (const [id, m] of by) {
    if (done.has(id)) continue;
    if (m.intro && !m.follow_up && !m.breakup && days(m.intro) >= STEP_GAP_DAYS.follow_up) follow_up++;
    else if (m.follow_up && !m.breakup && days(m.follow_up) >= STEP_GAP_DAYS.breakup) breakup++;
  }
  return { follow_up, breakup };
}

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
