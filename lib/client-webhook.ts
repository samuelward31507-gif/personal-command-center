// Events out to the client's other systems: Cinder posts each one to the webhook URL in the setup sheet
// (usually an n8n workflow that writes to Jobber, HubSpot, a spreadsheet, any CRM). Never blocks or breaks the caller.
import { createHmac } from "node:crypto";

export type CrmEvent = "lead.new" | "lead.updated" | "estimate.booked" | "quote.sent" | "job.won" | "job.lost" | "stage.changed";

/** Only public https URLs: nothing on the local network, no credentials in the URL. */
export function safeHookUrl(raw: string | undefined): string | null {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(\d+\.){3}\d+$/.test(h) || h.includes(":")) return null;
    return u.toString();
  } catch { return null; }
}

export function signBody(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/** Post one event. Resolves true when the receiver answered 2xx; never throws. */
export async function emitEvent(setup: Record<string, string>, projectId: string, event: CrmEvent, data: Record<string, unknown>): Promise<boolean> {
  const url = safeHookUrl(setup.webhook_url);
  if (!url) return false;
  const body = JSON.stringify({ event, business: setup.display_name || "", project: projectId, at: new Date().toISOString(), data });
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "Cinder-Webhooks/1", "X-Cinder-Event": event };
  const secret = process.env.CINDER_WEBHOOK_SECRET?.trim();
  if (secret) headers["X-Cinder-Signature"] = signBody(body, secret);
  try {
    const r = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(4000), redirect: "error" });
    return r.ok;
  } catch { return false; }
}
