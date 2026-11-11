// The client's own Google Calendar: connect (the owner opens a link we send), read busy times, write the booking.
// Uses the same Google OAuth app as Gmail and the same redirect URI, so nothing new is set up in Google Cloud.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { accessToken, decryptToken, redirectUri } from "@/lib/gmail";
import type { Busy } from "@/lib/client-booking";

type Sql = NeonQueryFunction<false, false>;
export const CAL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

const sign = (s: string) => createHmac("sha256", process.env.CINDER_TOKEN_KEY?.trim() || "").update(s).digest("base64url").slice(0, 32);
/** State for the calendar flow: "cal.<project>.<expires>.<sig>", good for 7 days so the owner can open it later. */
export function calState(projectId: string, now = Date.now()): string {
  const body = `cal.${projectId}.${Math.floor(now / 1000) + 7 * 86400}`;
  return `${body}.${sign(body)}`;
}
export function readCalState(state: string, now = Date.now()): string | null {
  const m = state.match(/^(cal\.([0-9a-f-]{36})\.(\d+))\.([A-Za-z0-9_-]+)$/i);
  if (!m || +m[3] * 1000 < now) return null;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[4]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[2] : null;
}
export function calAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!.trim(), redirect_uri: redirectUri(origin), response_type: "code",
    scope: CAL_SCOPES.join(" "), access_type: "offline", prompt: "select_account consent", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export type ClientCal = { calendarId: string; token: string; slotMin: number; email: string };
export async function clientCalendar(sql: Sql, projectId: string): Promise<ClientCal | null> {
  const [r] = await sql`SELECT refresh_token_enc, calendar_id, slot_min, google_email FROM public.client_calendars WHERE project_id = ${projectId}::uuid` as { refresh_token_enc: string; calendar_id: string; slot_min: number; google_email: string }[];
  if (!r) return null;
  try { return { calendarId: r.calendar_id, slotMin: r.slot_min, email: r.google_email, token: await accessToken(decryptToken(r.refresh_token_enc)) }; }
  catch (e) { console.error("Client calendar token failed", e instanceof Error ? e.message : e); return null; }
}

export async function busyTimes(cal: ClientCal, from: Date, to: Date): Promise<Busy[]> {
  const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", { method: "POST", headers: { Authorization: `Bearer ${cal.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: cal.calendarId }] }), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Couldn't read the calendar.");
  return (j.calendars?.[cal.calendarId]?.busy ?? []) as Busy[];
}

export async function createEvent(cal: ClientCal, e: { start: string; end: string; title: string; details: string; tz: string }): Promise<string> {
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendarId)}/events`, { method: "POST",
    headers: { Authorization: `Bearer ${cal.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: e.title, description: e.details, start: { dateTime: e.start, timeZone: e.tz }, end: { dateTime: e.end, timeZone: e.tz },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] } }), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Couldn't add the estimate to the calendar.");
  return String(j.id ?? "");
}

export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; link: string };
/** The owner's own events (their jobs, personal blocks) between two times, so the app can show the real week. */
export async function listEvents(cal: ClientCal, from: Date, to: Date): Promise<CalEvent[]> {
  const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "120",
    fields: "items(id,summary,start,end,htmlLink,status,transparency)" });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendarId)}/events?${q}`, { headers: { Authorization: `Bearer ${cal.token}` }, signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Couldn't read the calendar.");
  type G = { id?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string; status?: string; transparency?: string };
  return ((j.items ?? []) as G[]).filter(e => e.status !== "cancelled" && e.start).map(e => ({
    id: String(e.id ?? ""), title: String(e.summary ?? "Busy").slice(0, 120), allDay: !e.start?.dateTime,
    start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`, end: e.end?.dateTime ?? `${e.end?.date ?? e.start?.date}T00:00:00`, link: String(e.htmlLink ?? ""),
  }));
}
