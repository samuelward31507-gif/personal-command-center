// Email to a business's customers, sent through Resend in the business's name. The From address is Cinder's own
// verified domain (CINDER_EMAIL_FROM, e.g. "quotes@cinderrevenue.com"); replies go to the owner when an email is on
// file. Until the domain is verified the sender is not configured and the app falls back to the owner's mail app.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const customerEmailReady = () => !!(process.env.RESEND_API_KEY?.trim() && process.env.CINDER_EMAIL_FROM?.trim());

/** One plain, phone-friendly email: the business name, a few lines, one button. Returns false with a reason on failure. */
export async function sendCustomerEmail(o: { to: string; business: string; replyTo?: string; subject: string; lines: string[]; button: { label: string; url: string }; foot?: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim(), fromAddr = process.env.CINDER_EMAIL_FROM?.trim();
  if (!key || !fromAddr) return { ok: false, error: "Email sending isn't switched on yet." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.to)) return { ok: false, error: "That email doesn't look right." };
  const name = (o.business || "Your contractor").replace(/["<>]/g, "").slice(0, 60);
  const text = [...o.lines, "", `${o.button.label}: ${o.button.url}`, "", o.foot ?? `Sent by ${name}`].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#121417">
<div style="max-width:480px;margin:0 auto;padding:28px 16px">
<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#121417;color:#fff;font-weight:600;text-align:center;line-height:28px">${esc(name.charAt(0))}</span><b style="font-size:15px">${esc(name)}</b></div>
<div style="background:#fff;border:1px solid rgba(18,20,23,.08);border-radius:14px;padding:22px">
${o.lines.map(l => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join("")}
<a href="${esc(o.button.url)}" style="display:block;margin-top:18px;text-align:center;background:#121417;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 18px;border-radius:10px">${esc(o.button.label)}</a>
</div>
<p style="text-align:center;color:#8a8f98;font-size:12px;margin-top:14px">${esc(o.foot ?? `Sent by ${name}`)}</p>
</div></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${name} <${fromAddr}>`, to: [o.to], subject: o.subject.slice(0, 150), text, html, ...(o.replyTo ? { reply_to: o.replyTo } : {}) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); console.error("Customer email failed", res.status, (j as { message?: string }).message); return { ok: false, error: "The email didn't send. Try again, or use your own mail app." }; }
    return { ok: true };
  } catch (e) { console.error("Customer email failed", e instanceof Error ? e.message : e); return { ok: false, error: "The email didn't send. Try again, or use your own mail app." }; }
}
