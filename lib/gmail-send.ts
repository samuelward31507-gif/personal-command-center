// Sending through the owner's connected Gmail. Shared by the Email page, the morning auto follow-ups and inbox replies.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { accessToken, buildRaw, classifyThread, complianceFooter, decryptToken, isEmail, DAILY_SEND_CAP, type ThreadMessage } from "@/lib/gmail";
import { recordVerdict } from "@/lib/gmail-sync";
import type { WorkspaceSettings } from "@/lib/workspace";

type Sql = NeonQueryFunction<false, false>;
export type SendResult = { ok: true; from: string } | { ok: false; error: string; status: number };
const fail = (error: string, status: number): SendResult => ({ ok: false, error, status });

async function tokenFor(sql: Sql, o: string): Promise<{ email: string; token: string } | SendResult> {
  const [acc] = await sql`SELECT email, refresh_token_enc FROM public.gmail_accounts WHERE owner_id = ${o}` as { email: string; refresh_token_enc: string }[];
  if (!acc) return fail("Connect Gmail first.", 400);
  try { return { email: acc.email, token: await accessToken(decryptToken(acc.refresh_token_enc)) }; }
  catch (e) {
    // Google expired or revoked access (every 7 days while the Google app is in Testing): forget the dead token
    // so the Email page shows Connect Gmail again instead of failing on every send.
    if (e instanceof Error && /revoked/.test(e.message)) {
      await sql`DELETE FROM public.gmail_accounts WHERE owner_id = ${o}`;
      return fail("Gmail disconnected (Google expires access every 7 days for now). Click Connect Gmail on the Email page, then send again.", 401);
    }
    return fail("Couldn't reach Gmail.", 502);
  }
}

/** One cold email (intro, follow-up or last try) to a contact, with every safety check, threaded and logged. */
export async function sendColdEmail(sql: Sql, o: string, ws: WorkspaceSettings, m: { contactId: string; step: "intro" | "follow_up" | "breakup"; subject: string; body: string }): Promise<SendResult> {
  if (!ws.address.trim()) return fail("Add your business mailing address in Settings first. Every cold email has to include it.", 400);
  const [c] = await sql`SELECT c.id, c.email,
      EXISTS (SELECT 1 FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id AND (s.contact_id = c.id OR (s.email_normalized <> '' AND s.email_normalized = lower(c.email)))) AS suppressed,
      (SELECT a.outcome FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id AND a.outcome IN ('do_not_contact','not_interested','wrong_contact') ORDER BY a.occurred_at DESC LIMIT 1) AS stop,
      -- Same rule as the Email page queue: a booked meeting, "not a fit" or a customer gets no more cold email (the morning job relies on this).
      (lower(coalesce(c.status, '')) = 'customer' OR (SELECT a.outcome FROM public.contact_activities a WHERE a.owner_id = c.owner_id AND a.contact_id = c.id
        AND a.action <> 'note' AND a.outcome IS DISTINCT FROM 'initiated' ORDER BY a.occurred_at DESC LIMIT 1) IN ('meeting_booked','not_a_fit')) AS engaged,
      -- They emailed in (any thread, any subject), so the "following up on my note" script would be wrong.
      EXISTS (SELECT 1 FROM public.gmail_inbox g WHERE g.owner_id = c.owner_id AND g.contact_id = c.id AND g.category <> 'out_of_office') AS wrote_in
    FROM public.contacts c WHERE c.id = ${m.contactId}::uuid AND c.owner_id = ${o} LIMIT 1` as { id: string; email: string; suppressed: boolean; stop: string | null; engaged: boolean; wrote_in: boolean }[];
  if (!c) return fail("Contact not found.", 404);
  if (!isEmail(c.email)) return fail("This contact has no valid email address.", 400);
  if (c.suppressed || c.stop) return fail("This contact asked not to be contacted. Nothing was sent.", 409);
  if (c.engaged) return fail("They booked a meeting, aren't a fit, or are a customer. Nothing was sent.", 409);
  if (c.wrote_in) return fail("They already emailed you. Answer them from the inbox instead.", 409);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM public.contact_activities WHERE owner_id = ${o} AND notes LIKE 'Email sent: %via Gmail%' AND occurred_at > now() - interval '24 hours'` as { n: number }[];
  if (n >= DAILY_SEND_CAP) return fail(`You've sent ${DAILY_SEND_CAP} in the last 24 hours. That's the cap to protect your inbox's reputation; the rest can go tomorrow.`, 429);
  const [dup] = await sql`SELECT 1 FROM public.contact_activities WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid AND notes LIKE ${`Email sent: ${m.step}%`} LIMIT 1`;
  if (dup) return fail("This email already went to them.", 409);
  const [heard] = await sql`SELECT notes FROM public.contact_activities WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid AND (notes LIKE 'Email reply:%' OR notes LIKE 'Email bounced:%') LIMIT 1` as { notes: string }[];
  if (heard) return fail(heard.notes.startsWith("Email bounced") ? "Their address bounced. Nothing was sent." : "They already replied. Answer them from Gmail instead.", 409);

  // Follow-ups reply in the same thread as the first email.
  const [prev] = await sql`SELECT notes FROM public.contact_activities WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid AND notes LIKE 'Email sent: %via Gmail%' ORDER BY occurred_at ASC LIMIT 1` as { notes: string }[];
  const threadId = prev?.notes.match(/Thread: (\S+)/)?.[1];
  const messageId = prev?.notes.match(/Message-ID: (\S+)/)?.[1];
  const t = await tokenFor(sql, o);
  if ("ok" in t) return t;
  // Last check right before a follow-up: did they answer since the last reply sync? Catches replies the batch sync hasn't reached.
  if (m.step !== "intro" && threadId) {
    try {
      const th = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From`, { headers: { Authorization: `Bearer ${t.token}` }, signal: AbortSignal.timeout(8000) });
      if (th.ok) {
        const j = await th.json().catch(() => ({})) as { messages?: { snippet?: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] };
        const msgs: ThreadMessage[] = (j.messages ?? []).map(x => ({ from: x.payload?.headers?.find(h => h.name.toLowerCase() === "from")?.value ?? "", snippet: x.snippet, internalDate: x.internalDate, labelIds: x.labelIds }));
        const v = classifyThread(msgs, t.email);
        if (v) {
          await recordVerdict(sql, o, c.id, v);
          return fail(v.kind === "bounce" ? "Their address bounced. Nothing was sent." : "They already replied. Answer them from Gmail instead.", 409);
        }
      }
    } catch { /* couldn't check; the reply sync already ran, so send */ }
  }
  try {
    const raw = buildRaw({ from: t.email, fromName: `${ws.ownerFirstName} at ${ws.businessName}`.trim(), to: c.email, subject: m.subject, body: `${m.body}\n\n${complianceFooter(ws.businessName, ws.address.trim())}`, inReplyTo: m.step !== "intro" ? messageId : undefined });
    const sent = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(m.step !== "intro" && threadId ? { raw, threadId } : { raw }) });
    const sj = await sent.json().catch(() => ({}));
    if (!sent.ok) return fail(sj?.error?.message ? `Gmail said: ${sj.error.message}` : "Gmail didn't accept the email.", 502);
    let mid = "";
    try {
      const meta = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${sj.id}?format=metadata&metadataHeaders=Message-ID`, { headers: { Authorization: `Bearer ${t.token}` } });
      const mj = await meta.json(); mid = (mj.payload?.headers ?? []).find((h: { name: string }) => /^message-id$/i.test(h.name))?.value ?? "";
    } catch { /* threading falls back to the Gmail thread id */ }
    // Gmail already sent it: never report a failure that invites a resend. Retry the log once if the DB blips.
    const note = `Email sent: ${m.step} via Gmail\nSubject: ${m.subject}\nThread: ${sj.threadId ?? ""}${mid ? `\nMessage-ID: ${mid}` : ""}`;
    const log = () => sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${o}, ${c.id}::uuid, 'note', 'note', 'other', ${note})`;
    try { await log(); } catch (e) {
      console.error("Gmail send log failed, retrying", e instanceof Error ? e.message : e);
      try { await log(); } catch { return fail("Sent from Gmail, but Cinder couldn't log it. Don't send it again; mark it Already sent.", 500); }
    }
    await sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${c.id}::uuid AND owner_id = ${o}`.catch(() => {});
    return { ok: true, from: t.email };
  } catch (e) {
    console.error("Gmail send failed", e instanceof Error ? e.message : e);
    return fail("Couldn't send through Gmail.", 502);
  }
}

/** A reply in an existing inbox thread (answering someone who wrote in). No footer: it's a conversation, not outreach. */
export async function sendThreadReply(sql: Sql, o: string, ws: WorkspaceSettings, m: { gmailMessageId: string; threadId: string; to: string; subject: string; body: string; contactId?: string | null }): Promise<SendResult> {
  if (!isEmail(m.to)) return fail("No valid address to reply to.", 400);
  const t = await tokenFor(sql, o);
  if ("ok" in t) return t;
  try {
    let inReplyTo = "";
    try {
      const meta = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.gmailMessageId)}?format=metadata&metadataHeaders=Message-ID`, { headers: { Authorization: `Bearer ${t.token}` } });
      const mj = await meta.json(); inReplyTo = (mj.payload?.headers ?? []).find((h: { name: string }) => /^message-id$/i.test(h.name))?.value ?? "";
    } catch { /* Gmail still threads by thread id */ }
    const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
    const raw = buildRaw({ from: t.email, fromName: `${ws.ownerFirstName} at ${ws.businessName}`.trim(), to: m.to, subject, body: m.body, inReplyTo: inReplyTo || undefined });
    const sent = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw, threadId: m.threadId }) });
    const sj = await sent.json().catch(() => ({}));
    if (!sent.ok) return fail(sj?.error?.message ? `Gmail said: ${sj.error.message}` : "Gmail didn't accept the reply.", 502);
    if (m.contactId) await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
      VALUES (${o}, ${m.contactId}::uuid, 'note', 'note', 'other', ${`Email reply sent via Gmail\nSubject: ${subject}\n${m.body.slice(0, 1500)}`})`;
    return { ok: true, from: t.email };
  } catch (e) { console.error("Gmail reply failed", e instanceof Error ? e.message : e); return fail("Couldn't send the reply through Gmail.", 502); }
}
