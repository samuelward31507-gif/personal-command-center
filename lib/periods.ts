// Report periods: rolling (the last 30 or 90 days, 12 months) and calendar (this month, last month, this year, last
// year), each with the period it's compared against, in the business's own time zone. Pure.

export const PERIODS = [
  ["30", "30 days"], ["90", "90 days"], ["365", "12 months"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"], ["lastyear", "Last year"],
] as const;
export type PeriodKey = (typeof PERIODS)[number][0];
export const isPeriodKey = (v: unknown): v is PeriodKey => PERIODS.some(p => p[0] === v);
export type Range = { key: PeriodKey; from: Date; to: Date; prevFrom: Date; prevTo: Date; unit: "week" | "month"; phrase: string; vs: string; current: boolean };

const ymdIn = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
/** Midnight at the start of a local date, as an instant. */
export function startOf(ymd: string, tz: string): Date {
  const guess = new Date(ymd + "T00:00:00Z");
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess).map(x => [x.type, x.value]));
  return new Date(guess.getTime() - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess.getTime()));
}
const pad = (n: number) => String(n).padStart(2, "0");
const monthName = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

/** The range for a period, ending now (or at the end of a finished month or year), and the one before it. */
export function periodRange(key: PeriodKey, now: Date, tz: string): Range {
  const [y, m] = ymdIn(now, tz).split("-").map(Number);
  const end = new Date(now.getTime() + 60000);
  if (key === "30" || key === "90" || key === "365") {
    const days = Number(key), from = new Date(now.getTime() - days * 86400000);
    return { key, from, to: end, prevFrom: new Date(from.getTime() - days * 86400000), prevTo: from, unit: days > 120 ? "month" : "week",
      phrase: days === 365 ? "the last 12 months" : `the last ${days} days`, vs: "the period before", current: true };
  }
  if (key === "month") {
    const from = startOf(`${y}-${pad(m)}-01`, tz), py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1, prevFrom = startOf(`${py}-${pad(pm)}-01`, tz);
    return { key, from, to: end, prevFrom, prevTo: new Date(prevFrom.getTime() + (now.getTime() - from.getTime())), unit: "week", phrase: monthName(y, m) + " so far", vs: `the same days of ${monthName(py, pm)}`, current: true };
  }
  if (key === "lastmonth") {
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1, qy = pm === 1 ? py - 1 : py, qm = pm === 1 ? 12 : pm - 1;
    const from = startOf(`${py}-${pad(pm)}-01`, tz), to = startOf(`${y}-${pad(m)}-01`, tz);
    return { key, from, to, prevFrom: startOf(`${qy}-${pad(qm)}-01`, tz), prevTo: from, unit: "week", phrase: monthName(py, pm), vs: monthName(qy, qm), current: false };
  }
  if (key === "year") {
    const from = startOf(`${y}-01-01`, tz), prevFrom = startOf(`${y - 1}-01-01`, tz);
    return { key, from, to: end, prevFrom, prevTo: new Date(prevFrom.getTime() + (now.getTime() - from.getTime())), unit: "month", phrase: `${y} so far`, vs: `the same stretch of ${y - 1}`, current: true };
  }
  const from = startOf(`${y - 1}-01-01`, tz), to = startOf(`${y}-01-01`, tz);
  return { key, from, to, prevFrom: startOf(`${y - 2}-01-01`, tz), prevTo: from, unit: "month", phrase: String(y - 1), vs: String(y - 2), current: false };
}
