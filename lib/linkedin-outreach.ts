// LinkedIn scripts with fill-ins (same fill-ins as email). Pure: no I/O. You send these by hand on LinkedIn.

export type LinkedInStep = "connect" | "message";
/** Free LinkedIn accounts get only a few personalized connection notes a month, so the default is no note
    and the pitch goes in the first message after they accept. LinkedIn caps notes at 200 characters. */
export const CONNECT_NOTE_LIMIT = 200;
export const DEFAULT_LINKEDIN: Record<LinkedInStep, string> = {
  connect: `Hi {first_name}, I work with contractors on getting more booked jobs from the calls they already get. Would be good to connect.`,
  message: `Thanks for connecting, {first_name}.

Straight question: when someone calls {company} after hours or on a weekend and nobody picks up, what happens to that job?

I set up a system that texts those callers back in seconds and books the estimate on your calendar. If it doesn't book you 5 estimates in the first 30 days, your next month is free.

Worth a quick look? {booking_link}

{my_name}`,
};
/** Weekly connection requests. LinkedIn restricts accounts that send much more than ~100 a week. */
export const WEEKLY_CONNECT_CAP = 100;
