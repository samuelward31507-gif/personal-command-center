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
export async function sendAlert(a: Alert): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CINDER_ALERT_EMAIL?.trim();
  if (!key || !to) return false;
  const appUrl = process.env.CINDER_APP_URL?.trim() || "https://personal-command-center-ten-ruby.vercel.app";
  const { text, html } = renderAlert(a, appUrl);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.CINDER_ALERT_FROM?.trim() || "Cinder <onboarding@resend.dev>", to: [to], subject: a.subject.slice(0, 150), text, html }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("Alert email failed", { status: res.status });
    return res.ok;
  } catch (e) {
    console.error("Alert email failed", { name: e instanceof Error ? e.name : typeof e });
    return false;
  }
}
