// Expenses and mileage, the server side. Crew can log a receipt from the field; only the owner and the office see the
// list and the totals, and only they can delete one.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Client } from "@/lib/client-runtime-run";
import { cleanExpense, mileageRate, type Expense } from "@/lib/expenses";

type Sql = NeonQueryFunction<false, false>;
const todayIn = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });

export async function addExpense(sql: Sql, c: Client, member: string, input: unknown): Promise<{ ok: boolean; id?: string; error?: string }> {
  const e = cleanExpense(input, mileageRate(c.setup.mileage_rate), todayIn(c));
  if ("error" in e) return { ok: false, error: e.error };
  if (e.thread) { const [t] = await sql`SELECT id FROM public.client_threads WHERE id = ${e.thread}::uuid AND project_id = ${c.projectId}::uuid`; if (!t) return { ok: false, error: "That job isn't on your board." }; }
  // The receipt: a photo from the phone, already shrunk there; at most 900 KB.
  let bytes: Buffer | null = null, mime = "";
  const raw = (input as { receipt?: unknown } | null)?.receipt;
  if (typeof raw === "string" && raw) {
    const m = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return { ok: false, error: "That receipt photo didn't come through. Try again." };
    bytes = Buffer.from(m[2], "base64"); mime = m[1];
    if (bytes.length > 900_000) return { ok: false, error: "That receipt photo is too large." };
  }
  const [r] = await sql`INSERT INTO public.client_expenses (owner_id, project_id, thread_id, kind, vendor, category, amount, miles, spent_on, note, member, receipt, receipt_mime)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${e.thread}::uuid, ${e.kind}, ${e.vendor}, ${e.category}, ${e.amount}, ${e.miles}, ${e.spent_on}::date, ${e.note}, ${member}, ${bytes}, ${mime})
    RETURNING id` as { id: string }[];
  return { ok: true, id: r.id };
}

export async function deleteExpense(sql: Sql, c: Client, id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await sql`DELETE FROM public.client_expenses WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid RETURNING id`;
  return r.length ? { ok: true } : { ok: false, error: "Not found." };
}

/** The last 13 months, newest first, without the receipt bytes (those load one at a time). */
export async function loadExpenses(sql: Sql, c: Client): Promise<Expense[]> {
  const rows = await sql`SELECT e.id, e.kind, e.vendor, e.category, e.amount::float AS amount, e.miles::float AS miles, e.spent_on::text AS spent_on, e.note, e.member, e.thread_id,
      t.customer_name, (e.receipt IS NOT NULL) AS receipt
    FROM public.client_expenses e LEFT JOIN public.client_threads t ON t.id = e.thread_id
    WHERE e.project_id = ${c.projectId}::uuid AND e.spent_on > current_date - interval '13 months' ORDER BY e.spent_on DESC, e.created_at DESC LIMIT 1000` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), kind: r.kind === "mileage" ? "mileage" : "expense", vendor: String(r.vendor ?? ""), category: String(r.category ?? "other"), amount: Number(r.amount) || 0,
    miles: r.miles == null ? null : Number(r.miles), spent_on: String(r.spent_on), note: String(r.note ?? ""), member: String(r.member ?? ""), thread_id: r.thread_id ? String(r.thread_id) : null,
    customer: r.customer_name ? String(r.customer_name) : undefined, receipt: !!r.receipt }));
}
