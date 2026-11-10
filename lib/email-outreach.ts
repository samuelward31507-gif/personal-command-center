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
    subject: "missed calls at {company}",
    body: `Hi {first_name},

When you're out on a job and a homeowner calls, what happens to that call?

Most owners I talk to say voicemail, and most homeowners don't leave one. They call the next company on the list.

I set contractors up so every missed call and web form gets a text back in about 10 seconds, the homeowner's questions get answered, and the estimate books itself on your calendar. Every quote gets followed up until it's a yes or a no.

No contract, and you don't pay monthly until the first appointment is booked. If it doesn't book 5 appointments in your first 30 days, your next month is free.

Open to a quick look? Just reply "yes" and I'll send a couple of times.

{my_name}
{business}
{website}`,
  },
  follow_up: {
    subject: "Re: missed calls at {company}",
    body: `Hi {first_name},

Following up on my note below. Here's a 30-second look at what your customer gets when you can't pick up: {demo_link}

Worth 15 minutes to see it set up for {company}? Grab a time here: {booking_link}, or just reply with a morning or afternoon that works.

{my_name}`,
  },
  breakup: {
    subject: "Re: missed calls at {company}",
    body: `Hi {first_name},

I'll leave it here so I'm not cluttering your inbox.

If missed calls or quotes that go quiet ever start costing {company} jobs, reply "show me" and I'll walk you through it in 15 minutes.

{my_name}`,
  },
};

/** Detailers get a different pitch: their money is repeat customers, not missed quotes. */
export const DETAILING_TEMPLATES: Record<EmailStep, EmailTemplate> = {
  intro: {
    subject: "past customers at {company}",
    body: `Hi {first_name},

How many customers has {company} detailed who haven't been back in 3 months or more?

For most shops it's a few hundred. They liked the work. Nobody reminded them.

I set detailers up so past customers get a text when they're due and book themselves back in, anyone who calls while you're mid-detail gets a text back in seconds, and every happy customer gets asked for a Google review.

We start with one campaign to your past customers. If it doesn't book at least 3 times what you pay for it, it's free.

Open to a quick look? Just reply "yes" and I'll send a couple of times.

{my_name}
{business}
{website}`,
  },
  follow_up: {
    subject: "Re: past customers at {company}",
    body: `Hi {first_name},

Following up on my note below. Here's a quick look at how past customers get booked back in: {demo_link}

Worth 15 minutes to see it for {company}? Grab a time here: {booking_link}, or just reply with a morning or afternoon that works.

{my_name}`,
  },
  breakup: {
    subject: "Re: past customers at {company}",
    body: `Hi {first_name},

I'll leave it here so I'm not cluttering your inbox.

If you ever want to fill slow weeks from your own customer list, reply "show me" and I'll walk you through it in 15 minutes.

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
    subject: "missed calls at {company}",
    body: `Hi {first_name},

Just tried calling {company}. Probably caught you on a job, which is exactly why I was calling.

When a homeowner calls and you can't pick up, most don't leave a voicemail. They call the next company. I set contractors up so every missed call gets a text back in about 10 seconds and the estimate books itself on your calendar.

No contract, monthly doesn't start until the first appointment is booked, and if it doesn't book 5 in your first 30 days, your next month is free.

Worth a quick call? Just reply with a morning or afternoon that works.

{my_name}
{business}
{website}`,
  },
  detailing: {
    subject: "past customers at {company}",
    body: `Hi {first_name},

Just tried calling {company}. Probably caught you mid-detail.

Short version: how many past customers haven't rebooked in the last 3 months? I set detailers up so those customers get a text when they're due and book themselves back in, and anyone who calls while you're working gets a text back in seconds.

We start with one campaign to your past customers. If it doesn't book at least 3 times what you pay for it, it's free.

Worth a quick call? Just reply with a morning or afternoon that works.

{my_name}
{business}
{website}`,
  },
};

/** Who is due a follow-up or last try right now, from the send log alone (replies and bounces excluded). Pure. */
export function dueContacts(sent: { contactId: string; step: string; at: string }[], heard: { contactId: string }[], now = Date.now()): { contactId: string; step: "follow_up" | "breakup"; lastAt: number }[] {
  const done = new Set(heard.map(h => h.contactId));
  const by = new Map<string, Record<string, number>>();
  for (const s of sent) { const m = by.get(s.contactId) ?? {}; m[s.step] = Math.max(m[s.step] ?? 0, Date.parse(s.at)); by.set(s.contactId, m); }
  const days = (t: number) => (now - t) / 86400000;
  const out: { contactId: string; step: "follow_up" | "breakup"; lastAt: number }[] = [];
  for (const [id, m] of by) {
    if (done.has(id)) continue;
    if (m.intro && !m.follow_up && !m.breakup && days(m.intro) >= STEP_GAP_DAYS.follow_up) out.push({ contactId: id, step: "follow_up", lastAt: m.intro });
    else if (m.follow_up && !m.breakup && days(m.follow_up) >= STEP_GAP_DAYS.breakup) out.push({ contactId: id, step: "breakup", lastAt: m.follow_up });
  }
  return out.sort((x, y) => x.lastAt - y.lastAt);
}

/** How many follow-ups and last tries are due (for the Today count). */
export function dueFollowUps(sent: { contactId: string; step: string; at: string }[], heard: { contactId: string }[], now = Date.now()): { follow_up: number; breakup: number } {
  const d = dueContacts(sent, heard, now);
  return { follow_up: d.filter(x => x.step === "follow_up").length, breakup: d.filter(x => x.step === "breakup").length };
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
    demo_link: personalLink(ws.demoLink || ws.websiteUrl || "", greetName(c.name, c.company) === "there" ? "" : greetName(c.name, c.company), (c.company || "").trim()),
  };
}

/** Replace {fill_ins}. Unknown ones are left as typed so a typo is visible in the preview, not silently dropped. */
export function fillTemplate(text: string, m: Merge): string {
  return text.replace(/\{(\w+)\}/g, (all, k: string) => (k in m ? String(m[k as keyof Merge]) : all)).replace(/\n{3,}/g, "\n\n").trim();
}

// Personal links: a cinderrevenue.com link carries ?n=&b= so Cinder alerts you when they open it (same as lib/sms-templates).
export function personalLink(link: string, firstName?: string, company?: string): string {
  if (!/^https:\/\/(www\.)?cinderrevenue\.com(\/|$|\?)/i.test(link || "")) return link;
  try {
    const u = new URL(link);
    if (firstName?.trim()) u.searchParams.set("n", firstName.trim());
    if (company?.trim()) u.searchParams.set("b", company.trim());
    return u.toString();
  } catch { return link; }
}
