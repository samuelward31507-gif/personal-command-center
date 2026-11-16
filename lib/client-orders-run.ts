// Material orders, the server side: owner and office only. Received orders become a materials expense on the job
// (once), and moving one back off received takes that expense away again.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Client } from "@/lib/client-runtime-run";
import { cleanOrder, isOrderStatus, orderTotal, type Order, type OrderLine, type OrderStatus } from "@/lib/orders";

type Sql = NeonQueryFunction<false, false>;
const today = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });

export async function saveOrder(sql: Sql, c: Client, threadId: string, id: string | null, input: unknown, by: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const [t] = await sql`SELECT id FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string }[];
  if (!t) return { ok: false, error: "That job isn't on your board." };
  const o = cleanOrder(input);
  if ("error" in o) return { ok: false, error: o.error };
  if (id) {
    const r = await sql`UPDATE public.client_orders SET supplier = ${o.supplier}, supplier_email = ${o.supplier_email}, items = ${JSON.stringify(o.items)}::jsonb, needed_on = ${o.needed_on}::date, note = ${o.note}
      WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND status <> 'received' RETURNING id`;
    return r.length ? { ok: true, id } : { ok: false, error: "A received order can't be changed. Move it back to ordered first." };
  }
  const [r] = await sql`INSERT INTO public.client_orders (owner_id, project_id, thread_id, supplier, supplier_email, items, needed_on, note, created_by)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, ${o.supplier}, ${o.supplier_email}, ${JSON.stringify(o.items)}::jsonb, ${o.needed_on}::date, ${o.note}, ${by}) RETURNING id` as { id: string }[];
  return { ok: true, id: r.id };
}

/** Draft, ordered, received, canceled. Received adds the materials expense on the job; leaving received removes it. */
export async function setOrderStatus(sql: Sql, c: Client, id: string, status: unknown, by: string): Promise<{ ok: boolean; error?: string }> {
  if (!isOrderStatus(status)) return { ok: false, error: "Pick a status." };
  const [o] = await sql`SELECT id, thread_id, supplier, items, status, expense_id FROM public.client_orders WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; thread_id: string; supplier: string; items: OrderLine[]; status: OrderStatus; expense_id: string | null }[];
  if (!o) return { ok: false, error: "That order isn't here." };
  if (o.status === status) return { ok: true };
  if (o.status === "received" && o.expense_id) await sql`DELETE FROM public.client_expenses WHERE id = ${o.expense_id}::uuid AND project_id = ${c.projectId}::uuid`;
  let expense: string | null = null;
  if (status === "received") {
    const total = orderTotal(Array.isArray(o.items) ? o.items : []);
    if (total > 0) {
      const [e] = await sql`INSERT INTO public.client_expenses (owner_id, project_id, thread_id, kind, vendor, category, amount, spent_on, note, member)
        VALUES (${c.owner}, ${c.projectId}::uuid, ${o.thread_id}::uuid, 'expense', ${o.supplier.slice(0, 80)}, 'materials', ${total}, ${today(c)}::date, 'Material order received', ${by}) RETURNING id` as { id: string }[];
      expense = e.id;
    }
  }
  await sql`UPDATE public.client_orders SET status = ${status}, expense_id = ${expense}::uuid,
      ordered_at = CASE WHEN ${status} IN ('ordered', 'received') THEN coalesce(ordered_at, now()) WHEN ${status} = 'draft' THEN NULL ELSE ordered_at END,
      received_at = CASE WHEN ${status} = 'received' THEN now() ELSE NULL END
    WHERE id = ${id}::uuid`;
  return { ok: true };
}

/** Deleted outright; a received one takes its expense with it. */
export async function deleteOrder(sql: Sql, c: Client, id: string): Promise<{ ok: boolean; error?: string }> {
  const [o] = await sql`DELETE FROM public.client_orders WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid RETURNING expense_id` as { expense_id: string | null }[];
  if (!o) return { ok: false, error: "That order was already deleted." };
  if (o.expense_id) await sql`DELETE FROM public.client_expenses WHERE id = ${o.expense_id}::uuid AND project_id = ${c.projectId}::uuid`;
  return { ok: true };
}

export async function loadOrders(sql: Sql, c: Client): Promise<Order[]> {
  const rows = await sql`SELECT o.id, o.thread_id, o.supplier, o.supplier_email, o.items, o.status, o.needed_on::text AS needed_on, o.note, o.ordered_at, o.received_at, o.created_at, t.customer_name
    FROM public.client_orders o JOIN public.client_threads t ON t.id = o.thread_id
    WHERE o.project_id = ${c.projectId}::uuid AND (o.status IN ('draft', 'ordered') OR o.created_at > now() - interval '13 months') ORDER BY o.created_at DESC LIMIT 500` as Record<string, unknown>[];
  const iso = (v: unknown) => v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  return rows.map(r => ({ id: String(r.id), thread_id: String(r.thread_id), supplier: String(r.supplier ?? ""), supplier_email: String(r.supplier_email ?? ""),
    items: Array.isArray(r.items) ? r.items as OrderLine[] : [], status: (isOrderStatus(r.status) ? r.status : "draft") as OrderStatus, needed_on: r.needed_on ? String(r.needed_on) : null,
    note: String(r.note ?? ""), ordered_at: iso(r.ordered_at), received_at: iso(r.received_at), created_at: iso(r.created_at) ?? "", customer: r.customer_name ? String(r.customer_name) : undefined }));
}
