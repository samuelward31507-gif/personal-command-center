import { appSession, bridgeCall, clientFor, db, json } from "@/lib/client-app-run";
import { markNoShow, sendReviewRequest, sendToCustomer } from "@/lib/client-runtime-run";
import { parseAmount } from "@/lib/client-schedule";
import { digits10 } from "@/lib/client-runtime";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["auto", "paused", "booked", "closed"]);
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * POST { p, action, ... } for the signed-in owner:
 *  reply { thread, body } — text the customer from the business number; Cinder steps back on that conversation.
 *  status { thread, status } — auto (Cinder handles it) | paused (you handle it) | booked | closed
 *  call { thread } — ring your cell, then connect the customer from the business number.
 *  message { body } — write to Sam.
 *  outcome { appt, result, amount?, review? } — how an estimate went: quoted (Cinder follows up on the quote), won (counts the job,
 *    optionally asks for a Google review), no_show (texts them to rebook).
 *  quote { quote, status, amount? } — a quote Cinder is chasing was won or lost.
 */
export async function POST(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const b = await req.json().catch(() => ({})) as { p?: string; action?: string; thread?: string; body?: string; status?: string; appt?: string; result?: string; amount?: string; review?: boolean; quote?: string };
  try {
    const sql = db();
    const c = await clientFor(sql, s, b.p);
    if (!c) return json({ error: "Sign in" }, 401);
    if (b.action === "message") {
      const body = String(b.body ?? "").trim().slice(0, 4000);
      if (!body) return json({ error: "Write a message first." }, 400);
      await sql`INSERT INTO public.client_messages (owner_id, project_id, author, body) VALUES (${c.owner}, ${c.projectId}::uuid, 'client', ${body})`;
      await sendAlert({ subject: `Message from ${c.setup.display_name || "a client"}`, lines: [`${c.setup.display_name || "A client"} wrote from the Cinder app:`, body.slice(0, 1200)], link: { label: "Reply in the CRM", path: `/crm/client-success/${c.projectId}` } }).catch(() => false);
      return json({ ok: true });
    }
    if (b.action === "outcome") {
      if (!b.appt || !UUID.test(b.appt)) return json({ error: "Which estimate?" }, 400);
      if (b.result === "no_show") { const r = await markNoShow(sql, c, b.appt); return r.ok ? json({ ok: true }) : json({ error: r.error }, 409); }
      if (b.result !== "quoted" && b.result !== "won") return json({ error: "Pick how it went." }, 400);
      const amount = b.amount ? parseAmount(b.amount) : null;
      if (b.amount && amount == null) return json({ error: "Type the amount as a number, like 9400." }, 400);
      const [a] = await sql`UPDATE public.client_appointments a SET status = 'done' FROM public.client_threads t
        WHERE a.id = ${b.appt}::uuid AND a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND t.id = a.thread_id
        RETURNING t.id AS thread_id, t.customer_phone, t.customer_name` as { thread_id: string; customer_phone: string; customer_name: string }[];
      if (!a) return json({ error: "That estimate was already updated." }, 409);
      const phone10 = digits10(a.customer_phone);
      const [open] = await sql`SELECT id FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open','replied')
        AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${phone10} ORDER BY created_at DESC LIMIT 1` as { id: string }[];
      const today = new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });
      if (b.result === "quoted") {
        if (open) await sql`UPDATE public.client_quotes SET amount = coalesce(${amount}, amount), sent_on = ${today}::date, status = 'open', steps_sent = 0 WHERE id = ${open.id}::uuid`;
        else await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on) VALUES (${c.owner}, ${c.projectId}::uuid, ${a.customer_phone}, ${a.customer_name}, ${amount}, ${today}::date)`;
        await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${a.thread_id}::uuid, 'out', 'system', ${`Quote sent${amount ? `: $${amount.toLocaleString("en-US")}` : ""}. Cinder follows up until they answer.`})`;
        return json({ ok: true });
      }
      if (open) await sql`UPDATE public.client_quotes SET status = 'won', amount = coalesce(${amount}, amount), last_step_at = now() WHERE id = ${open.id}::uuid`;
      else await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on, status, last_step_at) VALUES (${c.owner}, ${c.projectId}::uuid, ${a.customer_phone}, ${a.customer_name}, ${amount}, ${today}::date, 'won', now())`;
      await sql`UPDATE public.client_threads SET status = 'closed', updated_at = now() WHERE id = ${a.thread_id}::uuid AND status <> 'opted_out'`;
      await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${a.thread_id}::uuid, 'out', 'system', ${`Job won${amount ? `: $${amount.toLocaleString("en-US")}` : ""}`})`;
      let review = "";
      if (b.review) { const r = await sendReviewRequest(sql, c, a.customer_phone, a.customer_name); review = r.ok ? "sent" : r.error?.includes("already") ? "already" : "no_link"; }
      return json({ ok: true, review });
    }
    if (b.action === "review") {
      // The job is finished: now is the right moment to ask for a Google review.
      if (!b.quote || !UUID.test(b.quote)) return json({ error: "Which job?" }, 400);
      const [q] = await sql`SELECT customer_phone, customer_name FROM public.client_quotes WHERE id = ${b.quote}::uuid AND project_id = ${c.projectId}::uuid AND status = 'won'` as { customer_phone: string; customer_name: string }[];
      if (!q) return json({ error: "That job isn't marked won." }, 404);
      const r = await sendReviewRequest(sql, c, q.customer_phone, q.customer_name);
      return r.ok ? json({ ok: true }) : json({ error: r.error?.includes("already") ? "They already got a review request." : r.error || "The text didn't send." }, 409);
    }
    if (b.action === "quote") {
      if (!b.quote || !UUID.test(b.quote) || (b.status !== "won" && b.status !== "lost")) return json({ error: "Which quote?" }, 400);
      const amount = b.amount ? parseAmount(b.amount) : null;
      const r = await sql`UPDATE public.client_quotes SET status = ${b.status}, amount = coalesce(${amount}, amount), last_step_at = CASE WHEN ${b.status} = 'won' THEN now() ELSE last_step_at END
        WHERE id = ${b.quote}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('open','replied') RETURNING id`;
      return r.length ? json({ ok: true }) : json({ error: "That quote was already updated." }, 409);
    }
    if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which conversation?" }, 400);
    const [t] = await sql`SELECT id, customer_phone, customer_name, status FROM public.client_threads WHERE id = ${b.thread}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; customer_phone: string; customer_name: string; status: string }[];
    if (!t) return json({ error: "Not found" }, 404);
    if (b.action === "reply") {
      const body = String(b.body ?? "").trim().slice(0, 1200);
      if (!body) return json({ error: "Write a text first." }, 400);
      if (t.status === "opted_out") return json({ error: "This customer opted out of texts." }, 409);
      if (!c.setup.texting_number) return json({ error: "Your texting number isn't set up yet." }, 409);
      const ok = await sendToCustomer(sql, c, t.id, t.customer_phone, body, "owner");
      if (t.status !== "booked") await sql`UPDATE public.client_threads SET status = 'paused', updated_at = now() WHERE id = ${t.id}::uuid`;
      return ok ? json({ ok: true }) : json({ error: "The text didn't send. Try again." }, 502);
    }
    if (b.action === "status") {
      if (!STATUSES.has(String(b.status))) return json({ error: "Unknown status." }, 400);
      if (t.status === "opted_out") return json({ error: "This customer opted out of texts." }, 409);
      await sql`UPDATE public.client_threads SET status = ${String(b.status)}, updated_at = now() WHERE id = ${t.id}::uuid`;
      return json({ ok: true });
    }
    if (b.action === "call") {
      const cell = digits10(c.setup.owner_cell || ""), from = digits10(c.setup.texting_number || ""), to = digits10(t.customer_phone);
      if (cell.length !== 10 || from.length !== 10) return json({ error: "Calling needs your cell and texting number in setup." }, 409);
      const ok = await bridgeCall("+1" + cell, "+1" + from, "+1" + to, t.customer_name);
      if (ok) await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'out', 'system', 'You called them back')`;
      return ok ? json({ ok: true }) : json({ error: "Couldn't start the call. Try again." }, 502);
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) { console.error("App action failed", e instanceof Error ? e.message : e); return json({ error: "Something went wrong." }, 500); }
}
