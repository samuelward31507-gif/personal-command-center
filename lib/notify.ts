// Founder alerts by email (Resend REST API, no SDK). Only ever emails the founder's own address —
// never a prospect or client. Best-effort: an alert failure never breaks the action that triggered it.

export type Alert = { subject: string; lines: string[]; link?: { label: string; path: string } };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain-text and HTML bodies for an alert. Pure, for tests. */
export function renderAlert(a: Alert, appUrl: string): { text: string; html: string } {
  const url = a.link ? appUrl.replace(/\/$/, "") + a.link.path : "";
  const text = [...a.lines, url ? `\n${a.link!.label}: ${url}` : ""].join("\n").trim();
  const html = `<div style="font:15px/1.6 -apple-system,Segoe UI,Inter,sans-serif;color:#111">${a.lines.map(l => `<p style="margin:0 0 8px">${esc(l)}</p>`).join("")}${url ? `<p style="margin:16px 0 0"><a href="${esc(url)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#111;color:#fff;text-decoration:none">${esc(a.link!.label)}</a></p>` : ""}<p style="margin:20px 0 0;color:#888;font-size:12px">Cinder alert</p></div>`;
  return { text, html };
}

export function alertsConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY?.trim() && process.env.CINDER_ALERT_EMAIL?.trim());
}

/** Send an alert to the founder. Returns false (and logs) instead of throwing. */
/** Why the last sendAlert failed (for run logs). */
export let lastAlertError = "";

export async function sendAlert(a: Alert): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CINDER_ALERT_EMAIL?.trim();
  if (!key || !to) { lastAlertError = "RESEND_API_KEY or CINDER_ALERT_EMAIL missing"; return false; }
  const appUrl = process.env.CINDER_APP_URL?.trim() || "https://personal-command-center-ten-ruby.vercel.app";
  const { text, html } = renderAlert(a, appUrl);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.CINDER_ALERT_FROM?.trim() || "Cinder <onboarding@resend.dev>", to: [to], subject: a.subject.slice(0, 150), text, html }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      lastAlertError = `Resend ${res.status}: ${detail}`;
      console.error("Alert email failed", { status: res.status, detail });
      return viaGmail(to, a.subject, text);
    }
    return true;
  } catch (e) {
    lastAlertError = `Resend request failed: ${e instanceof Error ? e.name : typeof e}`;
    console.error("Alert email failed", { name: e instanceof Error ? e.name : typeof e });
    return viaGmail(to, a.subject, text);
  }
}

/**
 * Backup route for founder alerts: when Resend refuses (unverified domain, outage), send it from Sam's own connected
 * Gmail to his alert address, so the morning brief and client alerts still arrive.
 */
async function viaGmail(to: string, subject: string, text: string): Promise<boolean> {
  const o = process.env.CINDER_OWNER_ID?.trim();
  if (!o || !process.env.DATABASE_URL) return false;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const { accessToken, buildRaw, decryptToken } = await import("@/lib/gmail");
    const sql = neon(process.env.DATABASE_URL);
    const [acc] = await sql`SELECT email, refresh_token_enc FROM public.gmail_accounts WHERE owner_id = ${o} ORDER BY is_main DESC, connected_at LIMIT 1` as { email: string; refresh_token_enc: string }[];
    if (!acc) return false;
    const token = await accessToken(decryptToken(acc.refresh_token_enc));
    const raw = buildRaw({ from: acc.email, fromName: "Cinder alerts", to, subject: `[Cinder] ${subject}`.slice(0, 150), body: text });
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }), signal: AbortSignal.timeout(6000) });
    if (r.ok) { lastAlertError = `${lastAlertError} (sent through Gmail instead)`; return true; }
    lastAlertError = `${lastAlertError}; Gmail backup ${r.status}`;
    return false;
  } catch (e) { lastAlertError = `${lastAlertError}; Gmail backup failed: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`; return false; }
}
