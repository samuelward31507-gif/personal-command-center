import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendDirectEmail } from "@/lib/gmail-send";
import { noShowEmail, noShowText, whenPhrase, tomorrowAt, OUTCOMES, type MeetingOutcome } from "@/lib/meeting-outcome";
import { BOOKING_LINK, smsHref } from "@/lib/sms-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TZ = "America/Denver";

/**
 * POST { id, outcome }: record how a meeting went.
 * no_show: emails them a reschedule link (if Gmail and an email exist), adds a callback task for tomorrow 10am,
 * and returns a reschedule text to send from your phone. showed: logs it and adds "send next step" for today.
 */
export async function POST(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database not configured." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const outcome = String(b.outcome ?? "") as MeetingOutcome;
  if (typeof b.id !== "string" || !OUTCOMES.includes(outcome)) return Response.json({ error: "Meeting and outcome are required." }, { status: 400 });
  const sql = neon(process.env.DATABASE_URL);
  const [e] = await sql`UPDATE public.calendar_events SET outcome = ${outcome}, outcome_at = now(), updated_at = now(),
      status = CASE WHEN ${outcome} = 'cancelled' THEN 'cancelled' ELSE status END
    WHERE id = ${b.id}::uuid AND owner_id = ${o}
    RETURNING id, title, starts_at, contact_id` as { id: string; title: string; starts_at: string; contact_id: string | null }[];
  if (!e) return Response.json({ error: "Meeting not found." }, { status: 404 });
  const [c] = e.contact_id ? await sql`SELECT id, first_name, last_name, company, email, phone FROM public.contacts WHERE id = ${e.contact_id}::uuid AND owner_id = ${o}` as { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null }[] : [];
  const label = { showed: "showed", no_show: "no-show", rescheduled: "rescheduled", cancelled: "cancelled" }[outcome];
  if (c) await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes) VALUES (${o}, ${c.id}::uuid, 'note', 'note', 'other', ${`Meeting outcome: ${label} (${e.title})`})`;

  const out: { ok: true; emailed?: string; emailError?: string; text?: { href: string; body: string }; task?: string } = { ok: true };
  if (outcome === "no_show") {
    const ws = await loadWorkspace(o);
    const first = (c?.first_name ?? "").trim();
    const when = whenPhrase(e.starts_at, new Date(), TZ);
    const link = ws.bookingLink || BOOKING_LINK;
    const me = ws.ownerFirstName || "Sam";
    if (c?.email) {
      const m = noShowEmail({ firstName: first, company: c.company ?? "", me, bookingLink: link, when });
      const s = await sendDirectEmail(sql, o, ws, { to: c.email, subject: m.subject, body: m.body, contactId: c.id, kind: "no-show reschedule" });
      if (s.ok) out.emailed = c.email; else out.emailError = s.error;
    }
    if (c?.phone) { const body = noShowText({ firstName: first, me, bookingLink: link, when }); out.text = { href: smsHref(c.phone, body), body }; }
    const due = tomorrowAt(10, TZ);
    const title = `Call back ${c?.company || c?.first_name || e.title} (missed meeting)`;
    await sql`INSERT INTO public.tasks (owner_id, title, status, due_at, contact_id) VALUES (${o}, ${title}, 'todo', ${due.toISOString()}::timestamptz, ${c?.id ?? null})`.catch(err => console.error("No-show task failed", err));
    out.task = title;
  }
  if (outcome === "showed") {
    const title = `Send next step to ${c?.company || c?.first_name || e.title}`;
    await sql`INSERT INTO public.tasks (owner_id, title, status, due_at, contact_id) VALUES (${o}, ${title}, 'todo', now(), ${c?.id ?? null})`.catch(err => console.error("Showed task failed", err));
    out.task = title;
  }
  return Response.json(out);
}
