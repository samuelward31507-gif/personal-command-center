import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { loadWorkspace } from "@/lib/workspace-data";
import { accessToken, buildRaw, complianceFooter, decryptToken, isEmail, DAILY_SEND_CAP } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEPS = new Set(["intro", "follow_up", "breakup"]);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail = (error: string, status: number) => Response.json({ error }, { status });

/** POST { contactId, step, subject, body }: send one cold email from the owner's connected Gmail and log it. */
export async function POST(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return fail("Unauthorized", 401);
  if (!process.env.DATABASE_URL) return fail("Database not configured.", 503);
  const b = await req.json().catch(() => ({}));
  const subject = typeof b.subject === "string" ? b.subject.trim().slice(0, 200) : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 10000) : "";
  if (!uuid(b.contactId) || !STEPS.has(b.step) || !subject || !body) return fail("Contact, step, subject and body are required.", 400);

  const sql = neon(process.env.DATABASE_URL);
  const ws = await loadWorkspace(o);
  if (!ws.address.trim()) return fail("Add your business mailing address in Settings first. Every cold email has to include it.", 400);

  const [acc] = await sql`SELECT email, refresh_token_enc FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string; refresh_token_enc: string }[];
  if (!acc) return fail("Connect Gmail first.", 400);

  const [c] = await sql`SELECT c.id, c.email, lower(c.email) AS norm,
      EXISTS (SELECT 1 FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id AND (s.contact_id = c.id OR (s.email_normalized <> '' AND s.email_normalized = lower(c.email)))) AS suppressed,
      (SELECT a.outcome FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.outcome IN ('do_not_contact','not_interested','wrong_contact') ORDER BY a.occurred_at DESC LIMIT 1) AS stop
    FROM public.contacts c WHERE c.id = ${b.contactId}::uuid AND c.owner_id = ${o} LIMIT 1` as { id: string; email: string; suppressed: boolean; stop: string | null }[];
  if (!c) return fail("Contact not found.", 404);
  if (!isEmail(c.email)) return fail("This contact has no valid email address.", 400);
  if (c.suppressed || c.stop) return fail("This contact asked not to be contacted. Nothing was sent.", 409);

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM public.contact_activities WHERE owner_id = ${o} AND notes LIKE 'Email sent: %via Gmail%' AND occurred_at > now() - interval '24 hours'` as { n: number }[];
  if (n >= DAILY_SEND_CAP) return fail(`You've sent ${DAILY_SEND_CAP} in the last 24 hours. That's the cap to protect your inbox's reputation; the rest can go tomorrow.`, 429);
  const [dup] = await sql`SELECT 1 FROM public.contact_activities WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid AND notes LIKE ${`Email sent: ${b.step}%`} LIMIT 1`;
  if (dup) return fail("This email already went to them.", 409);
  const [heard] = await sql`SELECT notes FROM public.contact_activities WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid AND (notes LIKE 'Email reply:%' OR notes LIKE 'Email bounced:%') LIMIT 1` as { notes: string }[];
  if (heard) return fail(heard.notes.startsWith("Email bounced") ? "Their address bounced. Nothing was sent." : "They already replied. Answer them from Gmail instead.", 409);

  // Follow-ups reply in the same thread as the first email.
  const [prev] = await sql`SELECT notes FROM public.contact_activities WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid AND notes LIKE 'Email sent: %via Gmail%' ORDER BY occurred_at ASC LIMIT 1` as { notes: string }[];
  const threadId = prev?.notes.match(/Thread: (\S+)/)?.[1];
  const messageId = prev?.notes.match(/Message-ID: (\S+)/)?.[1];

  try {
    const token = await accessToken(decryptToken(acc.refresh_token_enc));
    const raw = buildRaw({ from: acc.email, fromName: `${ws.ownerFirstName} at ${ws.businessName}`.trim(), to: c.email, subject, body: `${body}\n\n${complianceFooter(ws.businessName, ws.address.trim())}`, inReplyTo: b.step !== "intro" ? messageId : undefined });
    const sent = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(b.step !== "intro" && threadId ? { raw, threadId } : { raw }) });
    const sj = await sent.json().catch(() => ({}));
    if (!sent.ok) return fail(sj?.error?.message ? `Gmail said: ${sj.error.message}` : "Gmail didn't accept the email.", 502);
    let mid = "";
    try {
      const meta = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${sj.id}?format=metadata&metadataHeaders=Message-ID`, { headers: { Authorization: `Bearer ${token}` } });
      const mj = await meta.json(); mid = (mj.payload?.headers ?? []).find((h: { name: string }) => /^message-id$/i.test(h.name))?.value ?? "";
    } catch { /* threading falls back to the Gmail thread id */ }
    await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${o}, ${c.id}::uuid, 'note', 'note', 'other', ${`Email sent: ${b.step} via Gmail\nSubject: ${subject}\nThread: ${sj.threadId ?? ""}${mid ? `\nMessage-ID: ${mid}` : ""}`})`;
    await sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${c.id}::uuid AND owner_id = ${o}`;
    return Response.json({ ok: true, from: acc.email });
  } catch (e) {
    console.error("Gmail send failed", e instanceof Error ? e.message : e);
    // Google expired or revoked access (every 7 days while the Google app is in Testing). Forget the dead
    // token so the Email page shows Connect Gmail again instead of failing on every send.
    if (e instanceof Error && /revoked/.test(e.message)) {
      await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`;
      return fail("Gmail disconnected (Google expires access every 7 days for now). Click Connect Gmail on the Email page, then send again.", 401);
    }
    return fail(e instanceof Error && /revoked|reach Gmail/.test(e.message) ? e.message : "Couldn't send through Gmail.", 502);
  }
}
