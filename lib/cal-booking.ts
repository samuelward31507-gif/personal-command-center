// Turning a Cal.com booking into CRM records. Pure: no I/O, safe to unit test.

export type BookingPerson = { email: string; name: string; phone: string; company: string; notes: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A Cal.com `responses` value is either a string or { value }. */
function responseValue(responses: unknown, ...keys: string[]): string {
  if (!responses || typeof responses !== "object") return "";
  const r = responses as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const inner = (v as Record<string, unknown>).value;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
      if (inner && typeof inner === "object" && typeof (inner as Record<string, unknown>).value === "string") return String((inner as Record<string, unknown>).value).trim();
    }
  }
  return "";
}

/**
 * The person who booked: the first attendee with a real email that isn't the organizer (you).
 * Name, phone, company and notes come from the attendee or the booking form's responses.
 */
export function bookingPerson(payload: { attendees?: unknown; organizer?: unknown; responses?: unknown; description?: unknown }): BookingPerson | null {
  const organizerEmail = payload.organizer && typeof payload.organizer === "object" ? str((payload.organizer as Record<string, unknown>).email, 320).toLowerCase() : "";
  const attendees = Array.isArray(payload.attendees) ? payload.attendees.filter(a => a && typeof a === "object") as Record<string, unknown>[] : [];
  const a = attendees.find(x => { const e = str(x.email, 320).toLowerCase(); return EMAIL.test(e) && e !== organizerEmail; });
  if (!a) return null;
  const phone = str(a.phoneNumber, 40) || responseValue(payload.responses, "attendeePhoneNumber", "phone", "phoneNumber", "location").replace(/[^+\d()\-\s.]/g, "").trim().slice(0, 40);
  return {
    email: str(a.email, 320).toLowerCase(),
    name: str(a.name, 200) || responseValue(payload.responses, "name").slice(0, 200),
    phone: /\d{7,}/.test(phone.replace(/\D/g, "")) ? phone : "",
    company: responseValue(payload.responses, "company", "business", "companyName", "Company").slice(0, 200),
    notes: (responseValue(payload.responses, "notes", "description", "message") || str(payload.description, 2000)).slice(0, 2000),
  };
}

export function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  return { first: parts[0].slice(0, 100), last: parts.slice(1).join(" ").slice(0, 100) };
}

/** Booking a call moves early deals to Meeting booked; later stages are left alone. */
export function stageAfterBooking(stage: string | null): string | null {
  if (!stage) return "meeting_booked";
  return ["new", "contacted", "nurture"].includes(stage) ? "meeting_booked" : null;
}

/** A finished meeting moves Meeting booked (or earlier) to Meeting held. */
export function stageAfterMeeting(stage: string | null): string | null {
  if (!stage) return null;
  return ["new", "contacted", "meeting_booked", "nurture"].includes(stage) ? "meeting_held" : null;
}

/** YYYY-MM-DD in the founder's timezone. */
export function localDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
