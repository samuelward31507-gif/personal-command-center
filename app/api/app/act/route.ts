import { appSession, bridgeCall, clientFor, db, json } from "@/lib/client-app-run";
import { sendToCustomer } from "@/lib/client-runtime-run";
import { digits10 } from "@/lib/client-runtime";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["auto", "paused", "booked", "closed"]);

/**
 * POST { p, action, ... } for the signed-in owner:
 *  reply { thread, body } — text the customer from the business number; Cinder steps back on that conversation.
 *  status { thread, status } — auto (Cinder handles it) | paused (you handle it) | booked | closed
 *  call { thread } — ring your cell, then connect the customer from the business number.
 *  message { body } — write to Sam.
 */
export async function POST(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const b = await req.json().catch(() => ({})) as { p?: string; action?: string; thread?: string; body?: string; status?: string };
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
    if (!b.thread || !/^[0-9a-f-]{36}$/i.test(b.thread)) return json({ error: "Which conversation?" }, 400);
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
