import { neon } from "@neondatabase/serverless";
import { verifySvix } from "@/lib/lead-mail";
import { fetchReceived, takeMail, takeReply } from "@/lib/client-lead-mail-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lead-mail: Resend's email.received webhook for <website key>@CINDER_INBOUND_DOMAIN.
 * Signed with RESEND_WEBHOOK_SECRET (Svix headers). The webhook carries only the email's ID, so the email itself is read
 * from Resend's Receiving API. Answers 200 once the email is read (even "not a lead") so Resend doesn't retry it; a failure to
 * read the email answers 502 so it does.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifySvix(process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "", req.headers.get("svix-id") ?? "", req.headers.get("svix-timestamp") ?? "", req.headers.get("svix-signature") ?? "", raw);
  if (!ok) return Response.json({ error: "Bad signature." }, { status: 401 });
  const ev = (() => { try { return JSON.parse(raw) as { type?: string; data?: { email_id?: string; id?: string } }; } catch { return null; } })();
  if (!ev || ev.type !== "email.received") return Response.json({ ok: true, skipped: true });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Not configured." }, { status: 503 });
  const id = String(ev.data?.email_id ?? ev.data?.id ?? "");
  let mail;
  try { mail = await fetchReceived(id); } catch (e) { console.error("Lead email read failed", e instanceof Error ? e.message : e); return Response.json({ error: "Couldn't read the email." }, { status: 502 }); }
  if (!mail) return Response.json({ ok: true, skipped: true });
  const sql = neon(process.env.DATABASE_URL);
  // A customer answering one of the business's emails: onto their record. Anything else is a lead email.
  const reply = await takeReply(sql, mail).catch(e => { console.error("Email reply failed", e instanceof Error ? e.message : e); return { status: "failed" as const }; });
  if (reply) return Response.json({ ok: true, status: reply.status });
  const r = await takeMail(sql, mail);
  // A failure after the email is read stays on its row (the owner can add it by hand), so a retry would only be a duplicate.
  return Response.json({ ok: true, status: r.status });
}
