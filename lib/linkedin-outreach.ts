// LinkedIn scripts with fill-ins (same fill-ins as email). Pure: no I/O. You send these by hand on LinkedIn.

export type LinkedInStep = "connect" | "message";
/** Free LinkedIn accounts get only a few personalized connection notes a month, so the default is no note
    and the pitch goes in the first message after they accept. LinkedIn caps notes at 200 characters. */
export const CONNECT_NOTE_LIMIT = 200;
export const DEFAULT_LINKEDIN: Record<LinkedInStep, string> = {
  connect: `Hi {first_name}, I help service businesses book more jobs from the leads they already get. Would be good to connect.`,
  message: `Thanks for connecting, {first_name}.

Quick question: when you're out on a job and a homeowner calls, what happens to that call?

Most owners I talk to say voicemail, and most homeowners don't leave one. I set contractors up so every missed call and form gets a text back in about 10 seconds and the estimate books itself on your calendar. Every quote gets followed up until it's a yes or a no.

No contract, monthly doesn't start until the first appointment is booked, and 5 booked appointments in 30 days or your next month is free. Here's a 30-second look: {demo_link}

Worth 15 minutes? {booking_link}

{my_name}`,
};
/** Weekly connection requests. LinkedIn restricts accounts that send much more than ~100 a week. */
export const WEEKLY_CONNECT_CAP = 100;

/** Detailers: the repeat-customer pitch. Connection note is shared. */
export const DETAILING_LINKEDIN_MESSAGE = `Thanks for connecting, {first_name}.

Straight question: how many past customers does {company} have who haven't booked in the last 3 months?

Most detailers are sitting on a few hundred who'd book again if someone asked. I set up a system that texts them when they're due, texts back missed calls while you're mid-job, and asks happy customers for reviews.

We start with one campaign to your past customers. If it doesn't book at least 3 times what you pay for it, it's free. Here's how it works: {demo_link}

Worth 15 minutes? {booking_link}

{my_name}`;

/** Companies hiring for the phones (from the hiring finder). The role is filled in before the usual fill-ins. */
export const HIRING_LINKEDIN: Record<LinkedInStep, string> = {
  connect: `Hi {first_name}, saw {company} is hiring a {role}. I help contractors make sure every caller hears back in seconds. Would be good to connect.`,
  message: `Thanks for connecting, {first_name}.

Saw the {role} opening. Before you fill it: who answers when it's 6pm, a Saturday, or they're already on the other line?

I set contractors up with a front desk that never clocks out: every missed call and form gets a text back from your business in about 10 seconds, and the estimate books itself on your calendar. Here's 30 seconds of it: {demo_link}

Worth 15 minutes before you hire? {booking_link}

{my_name}`,
};
export const withRole = (template: string, role: string) => template.replaceAll("{role}", (role || "receptionist").toLowerCase());
/** A LinkedIn profile link (linkedin.com/in/...), cleaned, or "" if it isn't one. */
export function profileLink(v: string): string {
  const m = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{2,100})\/?(?:[?#].*)?$/i.exec((v || "").trim());
  return m ? `https://www.linkedin.com/in/${m[1]}` : "";
}
/** The job post link in a hiring lead's notes ("Hiring: Receptionist (posted ...) https://..."), or "". */
export const jobPostLink = (notes: string) => /Hiring:[^\n]*?(https?:\/\/\S+)/.exec(notes || "")?.[1] ?? "";
