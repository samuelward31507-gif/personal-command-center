// The app's Calendar tab, pure: which estimates need an outcome, the week merged with the owner's own calendar,
// the Google Calendar link, the "on my way" text and amounts typed on a phone.
export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; link: string };
export type Appt = { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string; event_id?: string; link?: string };
export type AgendaItem = { kind: "estimate"; at: string; appt: Appt } | { kind: "event"; at: string; event: CalEvent };

/** Estimates more than an hour past their start still marked booked need an outcome from the owner. */
export function splitAppointments(appts: Appt[], now = Date.now()): { due: Appt[]; upcoming: Appt[] } {
  const due: Appt[] = [], upcoming: Appt[] = [];
  for (const a of appts) (Date.parse(a.starts_at) < now - 3600_000 ? due : upcoming).push(a);
  due.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return { due, upcoming };
}

/** Upcoming estimates and the owner's own events, by day. A Cinder booking also sits on the calendar: show it once, as the estimate. */
export function agenda(upcoming: Appt[], events: CalEvent[], now = Date.now(), days = 7): { day: string; at: string; items: AgendaItem[] }[] {
  const mine = new Set(upcoming.map(a => a.event_id).filter(Boolean));
  const end = now + days * 86400_000;
  const items: AgendaItem[] = [
    ...upcoming.filter(a => Date.parse(a.starts_at) < end).map(a => ({ kind: "estimate" as const, at: a.starts_at, appt: a })),
    ...events.filter(e => !mine.has(e.id) && Date.parse(e.end) > now && Date.parse(e.start) < end).map(e => ({ kind: "event" as const, at: e.start, event: e })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.kind === "estimate" ? -1 : 1));
  const out: { day: string; at: string; items: AgendaItem[] }[] = [];
  for (const it of items) {
    const k = new Date(Math.max(Date.parse(it.at), now)).toDateString();
    const last = out.at(-1);
    if (last && last.day === k) last.items.push(it); else out.push({ day: k, at: new Date(Math.max(Date.parse(it.at), now)).toISOString(), items: [it] });
  }
  return out;
}

export const googleCalendarUrl = (email = "") => `https://calendar.google.com/calendar/r/week${email ? `?authuser=${encodeURIComponent(email)}` : ""}`;

export function onMyWayText(customer: string, owner: string, business: string, minutes = 15): string {
  const first = customer.trim().split(/\s+/)[0] || "";
  const who = owner.trim() ? `${owner.trim().split(/\s+/)[0]} with ${business || "us"}` : business || "us";
  return `Hi${first && !/^\(?\d/.test(first) ? " " + first : ""}, it's ${who}. On my way now, see you in about ${minutes} minutes.`;
}

/** "$9,400", "9.4k", "9400.50" → 9400 / 9400.5. Null when there's no usable number. */
export function parseAmount(v: string): number | null {
  const s = String(v).trim().toLowerCase().replace(/[$,\s]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(k)?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}
