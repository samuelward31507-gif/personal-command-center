// Wakes a Grok Bot routine through its webhook when something happens in the command center (a meeting booked, a
// meeting ended). Off unless the URL and key are set. Never throws and never holds up the caller for long.
import { webhookTarget } from "@/lib/agent-api";

export type PingEvent = { event: "meeting_booked" | "meeting_rescheduled" | "meeting_ended"; calendarEventId: string | null; prospectId: string | null; business: string; startsAt: string | null };

export async function pingGrok(which: "prep" | "closer", body: PingEvent): Promise<void> {
  const t = which === "prep"
    ? webhookTarget(process.env.GROK_PREP_WEBHOOK_URL, process.env.GROK_PREP_WEBHOOK_KEY)
    : webhookTarget(process.env.GROK_CLOSER_WEBHOOK_URL, process.env.GROK_CLOSER_WEBHOOK_KEY);
  if (!t) return;
  try {
    await fetch(t.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` },
      body: JSON.stringify({ source: "cinder-command-center", ...body }), signal: AbortSignal.timeout(5000) });
  } catch (e) {
    console.error("Grok ping failed", which, e instanceof Error ? e.message.slice(0, 120) : e);
  }
}
