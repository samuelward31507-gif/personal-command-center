import { appSession, clientFor, db } from "@/lib/client-app-run";
import { loadCustomers } from "@/lib/client-billing-run";
import { loadBoard } from "@/lib/client-crm-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s; };

/** GET /api/app/export?p=<project> — every customer and job as a CSV the owner can open in a spreadsheet. Owner only. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return Response.json({ error: "Sign in" }, { status: 401 });
  if (s.role === "crew") return Response.json({ error: "Ask the owner for the export." }, { status: 403 });
  try {
    const sql = db();
    const c = await clientFor(sql, s, new URL(req.url).searchParams.get("p"));
    if (!c) return Response.json({ error: "Sign in" }, { status: 401 });
    const [customers, board] = await Promise.all([loadCustomers(sql, c), loadBoard(sql, c).catch(() => [])]);
    const byId = new Map(board.map(b => [b.id, b]));
    const head = ["Name", "Phone", "Address", "Source", "Stage", "Customer since", "Last contact", "Jobs", "Billed", "Owed", "Open quote", "Job", "Job value", "Next step", "Notes", "Crew notes"];
    const rows = customers.map(x => { const b = byId.get(x.id); return [x.name, x.phone, x.address, x.source, b?.stage ?? x.stage ?? "", x.since, x.last, x.jobs, x.spent, x.owed, x.open_quote ?? "", b?.line ?? x.line, b?.value ?? "", b?.next ?? "", b?.notes ?? "", b?.crew ?? ""]; });
    const csv = "﻿" + [head, ...rows].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
    const name = `${(c.setup.display_name || "cinder").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cinder"}-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) { console.error("Export failed", e instanceof Error ? e.message : e); return Response.json({ error: "Couldn't export." }, { status: 500 }); }
}
