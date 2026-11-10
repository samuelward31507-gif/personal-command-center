// What happens after a meeting: the owner taps Showed / No-show / Rescheduled and Cinder does the rest. Pure text here.

export type MeetingOutcome = "showed" | "no_show" | "rescheduled" | "cancelled";
export const OUTCOMES: MeetingOutcome[] = ["showed", "no_show", "rescheduled", "cancelled"];

export function noShowEmail(i: { firstName: string; company: string; me: string; bookingLink: string; when: string }): { subject: string; body: string } {
  const hi = i.firstName ? `Hi ${i.firstName},` : "Hi there,";
  return {
    subject: `Missed you ${i.when}`,
    body: `${hi}\n\nLooks like we missed each other ${i.when}. No problem, I know you're busy on jobs.\n\nHere's my calendar to grab a new time that works better: ${i.bookingLink}\n\nOr just reply with a morning or afternoon and I'll send an invite.\n\n${i.me}\nCinder Revenue Company\ncinderrevenue.com`,
  };
}

export function noShowText(i: { firstName: string; me: string; bookingLink: string; when: string }): string {
  return `Hey${i.firstName ? " " + i.firstName : ""}, ${i.me} with Cinder. Missed you ${i.when}, no worries. Want to grab a new time? ${i.bookingLink} or just text me morning or afternoon.`;
}

/** "this morning" / "this afternoon" / "on Tuesday" relative to now, in the owner's time zone. */
export function whenPhrase(startsAt: string, now = new Date(), timeZone?: string): string {
  const s = new Date(startsAt);
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const hour = Number(s.toLocaleString("en-US", { timeZone, hour: "numeric", hour12: false }));
  if (day(s) === day(now)) return hour < 12 ? "this morning" : hour < 17 ? "this afternoon" : "this evening";
  return "on " + s.toLocaleDateString("en-US", { timeZone, weekday: "long" });
}

/** Tomorrow at a local hour in a time zone, as a UTC Date (works on a UTC server). */
export function tomorrowAt(hour: number, timeZone: string, now = new Date()): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now).map(p => [p.type, p.value]));
  const offsetMin = (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute) - Math.floor(now.getTime() / 60000) * 60000) / 60000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1, hour, 0) - offsetMin * 60000);
}
