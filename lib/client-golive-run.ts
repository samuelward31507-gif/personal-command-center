// Going live after a move: the old app's quote and invoice links stop working when it's cancelled, so what's still open
// goes out again from here. Kept apart from the import so the import (and its tests) don't load the texting code.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Client } from "@/lib/client-runtime-run";
import { sendQuoteLink } from "@/lib/client-close-run";
import { sendInvoice } from "@/lib/client-billing-run";

type Sql = NeonQueryFunction<false, false>;
/** Moved-in quotes still open (follow-ups paused) and invoices still owed (reminders paused): what "send again" would send. */
export async function openToResend(sql: Sql, c: Client): Promise<{ quotes: number; invoices: number }> {
  const [r] = await sql`SELECT
      (SELECT count(*)::int FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND import_id IS NOT NULL AND kind = 'quote' AND status = 'open' AND chase_paused AND customer_phone NOT LIKE 'nophone:%') AS quotes,
      (SELECT count(*)::int FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id WHERE i.project_id = ${c.projectId}::uuid AND i.import_id IS NOT NULL AND i.status = 'sent' AND i.reminders_paused
        AND i.total - coalesce(i.paid_amount, 0) > 0.005 AND t.customer_phone NOT LIKE 'nophone:%' AND t.hidden_at IS NULL) AS invoices` as { quotes: number; invoices: number }[];
  return { quotes: r?.quotes ?? 0, invoices: r?.invoices ?? 0 };
}

/**
 * Send each moved-in open quote and unpaid invoice again, with a Cinder link. The owner pressed the button, so they go now,
 * in texting hours only; one that can't go yet stays paused and is counted as waiting. Sent ones get their follow-ups or
 * reminders back on, so pressing again never sends the same one twice. 25 of each per press.
 */
export async function resendOpen(sql: Sql, c: Client): Promise<{ ok: true; sent: number; waiting: number; failed: number; left: { quotes: number; invoices: number } }> {
  let sent = 0, waiting = 0, failed = 0;
  const quotes = await sql`SELECT q.id, t.id AS thread FROM public.client_quotes q JOIN public.client_threads t ON t.project_id = q.project_id AND t.customer_phone = q.customer_phone
    WHERE q.project_id = ${c.projectId}::uuid AND q.import_id IS NOT NULL AND q.kind = 'quote' AND q.status = 'open' AND q.chase_paused AND q.customer_phone NOT LIKE 'nophone:%' AND t.hidden_at IS NULL
    ORDER BY q.sent_on DESC LIMIT 25` as { id: string; thread: string }[];
  for (const q of quotes) {
    const r = await sendQuoteLink(sql, c, q.thread).catch(() => ({ ok: false, sent: false }));
    if (r.sent) { sent++; await sql`UPDATE public.client_quotes SET chase_paused = false, sent_on = current_date, steps_sent = 0 WHERE id = ${q.id}::uuid`; }
    else if (r.ok) waiting++; else failed++;
  }
  const invoices = await sql`SELECT i.id FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
    WHERE i.project_id = ${c.projectId}::uuid AND i.import_id IS NOT NULL AND i.status = 'sent' AND i.reminders_paused AND i.total - coalesce(i.paid_amount, 0) > 0.005
      AND t.customer_phone NOT LIKE 'nophone:%' AND t.hidden_at IS NULL ORDER BY i.due_on NULLS LAST LIMIT 25` as { id: string }[];
  for (const i of invoices) {
    const r = await sendInvoice(sql, c, i.id).catch(() => ({ ok: false, sent: false }));
    if (r.sent) { sent++; await sql`UPDATE public.client_invoices SET reminders_paused = false WHERE id = ${i.id}::uuid`; }
    else if (r.ok) waiting++; else failed++;
  }
  return { ok: true, sent, waiting, failed, left: await openToResend(sql, c) };
}
