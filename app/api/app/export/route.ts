import { appSession, clientFor, db } from "@/lib/client-app-run";
import { loadCustomers, loadInvoices, loadPayments } from "@/lib/client-billing-run";
import { loadBoard } from "@/lib/client-crm-run";
import { PAY_METHODS } from "@/lib/crm";

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
  const q = new URL(req.url).searchParams, what = ["invoices", "payments"].includes(q.get("what") ?? "") ? q.get("what")! : "customers";
  try {
    const sql = db();
    const c = await clientFor(sql, s, q.get("p"));
    if (!c) return Response.json({ error: "Sign in" }, { status: 401 });
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
