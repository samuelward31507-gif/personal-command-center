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
