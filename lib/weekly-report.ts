// Weekly client report: a short Monday check-in built from the last 7 days of the live system.
// A preview only: Sam copies it and sends it himself. Nothing here sends anything. Pure: safe to unit test.

/** replyText is replyLine() from lib/reply-times, worked out by the caller. */
export type WeeklyFigures = { estimates: number; jobsLogged: number; replyText: string };

/** The 7 days ending yesterday, as ISO bounds and a label like "Nov 16 to Nov 22". */
export function lastWeek(today: Date): { from: string; to: string; label: string } {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - 7 * 86400000);
  const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return { from: start.toISOString(), to: end.toISOString(), label: `${f(start)} to ${f(new Date(end.getTime() - 86400000))}` };
}

export function weeklyText(name: string, label: string, w: WeeklyFigures): string {
  const first = name.trim() || "there";
  return [
    `Hi ${first}, here's your week with Cinder (${label}).`,
    w.replyText,
    `Estimates booked on your calendar: ${w.estimates}.`,
    w.jobsLogged ? `Bookings logged: ${w.jobsLogged}.` : "",
    "Reply here if anything looks off. Sam",
  ].filter(Boolean).join("\n\n");
}
