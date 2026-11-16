import { appSession, clientFor, db } from "@/lib/client-app-run";
import { loadCustomers, loadInvoices, loadPayments } from "@/lib/client-billing-run";
import { loadBoard } from "@/lib/client-crm-run";
import { PAY_METHODS } from "@/lib/crm";
import { zip } from "@/lib/zip";
import type { Client } from "@/lib/client-runtime-run";

type Sql = ReturnType<typeof db>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s; };
const csv = (rows: unknown[][]) => "﻿" + rows.map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";

/**
 * GET /api/app/export?p=<project>&what=customers|invoices|payments — a CSV the owner (or the bookkeeper) opens in a
 * spreadsheet or QuickBooks. Customers by default. Owner only.
 */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return Response.json({ error: "Sign in" }, { status: 401 });
  if (s.role === "crew") return Response.json({ error: "Ask the owner for the export." }, { status: 403 });
  const q0 = new URL(req.url).searchParams;
  if (q0.get("what") === "all") {
    if (s.role !== "owner") return Response.json({ error: "Only the owner can export everything." }, { status: 403 });
    try { const sql = db(), c = await clientFor(sql, s, q0.get("p")); if (!c) return Response.json({ error: "Sign in" }, { status: 401 });
      if (s.role !== "owner") return Response.json({ error: "Only the owner can export everything." }, { status: 403 });
      const body = await everything(sql, c), slug = (c.setup.display_name || "business").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "business";
      return new Response(new Uint8Array(body), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slug}-everything-${new Date().toISOString().slice(0, 10)}.zip"`, "Cache-Control": "no-store" } });
    } catch (e) { console.error("Export all failed", e instanceof Error ? e.message : e); return Response.json({ error: "Couldn't export." }, { status: 500 }); }
  }
  const q = q0, what = ["invoices", "payments"].includes(q.get("what") ?? "") ? q.get("what")! : "customers";
  try {
    const sql = db();
    const c = await clientFor(sql, s, q.get("p"));
    if (!c) return Response.json({ error: "Sign in" }, { status: 401 });
    if ((s as { role?: string }).role === "crew") return Response.json({ error: "Ask the owner for the export." }, { status: 403 });
    let body: string;
    if (what === "invoices") {
      const list = await loadInvoices(sql, c);
      body = csv([["Invoice", "Customer", "Phone", "Status", "Issued", "Due", "Paid on", "Subtotal and tax", "Total", "Paid", "Balance", "Note"],
        ...list.map(i => [i.number, i.customer, i.phone, i.status === "sent" ? "Awaiting payment" : i.status[0].toUpperCase() + i.status.slice(1), i.sent_at?.slice(0, 10) ?? "", i.due_on ?? "", i.paid_at?.slice(0, 10) ?? "",
          i.items.map(x => `${x.name} ${x.qty}${x.unit ? " " + x.unit : ""} x ${x.price}`).join("; ") + (i.tax_rate ? `; tax ${i.tax_rate}%` : ""), i.total, i.paid_amount ?? 0, i.status === "void" ? 0 : Math.max(0, i.total - (i.paid_amount ?? 0)), i.note])]);
    } else if (what === "payments") {
      const list = await loadPayments(sql, c, 5000);
      body = csv([["Date", "Customer", "Invoice", "Method", "Amount", "Note"],
        ...list.map(p => [p.paid_on, p.customer, p.number ?? "", PAY_METHODS.find(m => m[0] === p.method)?.[1] ?? p.method, p.amount, p.note])]);
    } else {
      const [customers, board] = await Promise.all([loadCustomers(sql, c), loadBoard(sql, c).catch(() => [])]);
      const byId = new Map(board.map(b => [b.id, b]));
      body = csv([["Name", "Phone", "Email", "Address", "Source", "Stage", "Customer since", "Last contact", "Jobs", "Billed", "Owed", "Open quote", "Job", "Job value", "Next step", "Notes", "Crew notes"],
        ...customers.map(x => { const b = byId.get(x.id); return [x.name, x.phone, x.email, x.address, x.source, b?.stage ?? x.stage ?? "", x.since, x.last, x.jobs, x.spent, x.owed, x.open_quote ?? "", b?.line ?? x.line, b?.value ?? "", b?.next ?? "", b?.notes ?? "", b?.crew ?? ""]; })]);
    }
    const name = `${(c.setup.display_name || "cinder").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cinder"}-${what}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) { console.error("Export failed", e instanceof Error ? e.message : e); return Response.json({ error: "Couldn't export." }, { status: 500 }); }
}

/**
 * Export everything: one CSV per kind of record (customers, properties, quotes, invoices, payments, plans, visits, change
 * orders, hours, estimates, texts, the price list) and every job photo, in one zip. Nothing is locked in.
 */
async function everything(sql: Sql, c: Client): Promise<Uint8Array> {
  const p = c.projectId;
  const table = async (name: string, rows: Record<string, unknown>[]) => ({ name: name + ".csv", data: csv(rows.length ? [Object.keys(rows[0]), ...rows.map(r => Object.values(r).map(v => v instanceof Date ? v.toISOString() : v && typeof v === "object" ? JSON.stringify(v) : v))] : [["(none)"]]) });
  const q = (rows: Promise<unknown>) => rows.then(r => r as Record<string, unknown>[]).catch(() => [] as Record<string, unknown>[]);
  const files = await Promise.all([
    table("customers", await q(sql`SELECT id, customer_name AS name, customer_phone AS phone, customer_email AS email, details->>'address' AS address, source, stage, status, value, notes, crew_notes, created_at, updated_at, hidden_at, source_system, source_ref FROM public.client_threads WHERE project_id = ${p}::uuid ORDER BY created_at`)),
    table("properties", await q(sql`SELECT id, thread_id AS customer_id, address, gate_code, notes, created_at FROM public.client_properties WHERE project_id = ${p}::uuid ORDER BY created_at`)),
    table("expenses", await q(sql`SELECT e.id, e.spent_on, e.kind, e.vendor, e.category, e.amount, e.miles, e.note, e.thread_id AS customer_id, e.member, e.created_at FROM public.client_expenses e WHERE e.project_id = ${p}::uuid ORDER BY e.spent_on`)),
    table("quotes", await q(sql`SELECT id, customer_name, customer_phone, amount, status, sent_on, items, tax_rate, deposit, note, viewed_at, approved_at, declined_at, created_at FROM public.client_quotes WHERE project_id = ${p}::uuid ORDER BY created_at`)),
    table("invoices", await q(sql`SELECT id, thread_id AS customer_id, number, status, items, tax_rate, total, paid_amount, due_on, sent_at, paid_at, note, created_at FROM public.client_invoices WHERE project_id = ${p}::uuid ORDER BY number`)),
    table("payments", await q(sql`SELECT id, invoice_id, thread_id AS customer_id, amount, method, paid_on, note, created_at FROM public.client_payments WHERE project_id = ${p}::uuid ORDER BY paid_on`)),
    table("service-plans", await q(sql`SELECT id, thread_id AS customer_id, name, items, total, every_n, every_unit, next_on, ends_on, status, visits_done, created_at FROM public.client_plans WHERE project_id = ${p}::uuid ORDER BY created_at`)),
    table("visits", await q(sql`SELECT id, plan_id, thread_id AS customer_id, on_date, status, invoice_id FROM public.client_visits WHERE project_id = ${p}::uuid ORDER BY on_date`)),
    table("change-orders", await q(sql`SELECT id, thread_id AS customer_id, number, title, items, total, status, signed_by, decided_at, created_at FROM public.client_change_orders WHERE project_id = ${p}::uuid ORDER BY created_at`)),
    table("hours", await q(sql`SELECT id, thread_id AS customer_id, member, started_at, ended_at, note FROM public.client_time WHERE project_id = ${p}::uuid ORDER BY started_at`)),
    table("estimates", await q(sql`SELECT id, thread_id AS customer_id, starts_at, status, created_at FROM public.client_appointments WHERE project_id = ${p}::uuid ORDER BY starts_at`)),
    table("texts", await q(sql`SELECT x.id, x.thread_id AS customer_id, x.direction, x.author, x.body, x.at FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id WHERE t.project_id = ${p}::uuid ORDER BY x.at LIMIT 100000`)),
    table("price-list", (() => { try { return (JSON.parse(c.setup.catalog || "[]") as Record<string, unknown>[]); } catch { return []; } })()),
  ]);
  const photos = await q(sql`SELECT id, thread_id, kind, mime, bytes, created_at FROM public.client_photos WHERE project_id = ${p}::uuid ORDER BY created_at LIMIT 2000`);
  for (const ph of photos) files.push({ name: `photos/${ph.thread_id}/${ph.kind}-${ph.id}.${String(ph.mime).includes("png") ? "png" : "jpg"}`, data: new Uint8Array(ph.bytes as Buffer) as unknown as string });
  files.push({ name: "README.txt", data: `Everything from ${c.setup.display_name || "your business"}, exported ${new Date().toISOString().slice(0, 10)}.
One CSV per kind of record; customer_id links them. Photos are in photos/<customer_id>/.
` });
  return zip(files as { name: string; data: string | Uint8Array }[]);
}
