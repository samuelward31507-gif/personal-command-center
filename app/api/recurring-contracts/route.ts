import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const statuses = new Set(["active", "paused", "cancelled"]);
function db() { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); }
async function currentUser() {
  const result = await auth.getSession();
  const session = result?.data?.session;
  const user = result?.data?.user;
  return session && user?.id ? { id: String(user.id) } : null;
}
const fail = (message: string, status: number) => Response.json({ error: message }, { status });
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function amount(value: unknown) {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999999999.99 ? parsed : null;
}
function validDate(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : false;
}
function mapped(row: Record<string, unknown>) {
  return { id: String(row.id), clientName: String(row.client_name), contractName: String(row.contract_name),
    monthlyAmount: Number(row.monthly_amount), status: String(row.status),
    startDate: String(row.start_date).slice(0, 10), endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
    notes: String(row.notes ?? "") };
}
export async function GET() {
  try {
    const user = await currentUser(); if (!user) return fail("Unauthorized", 401);
    const sql = db();
    const rows = await sql`SELECT id,client_name,contract_name,monthly_amount,status,start_date,end_date,notes
      FROM public.recurring_revenue_contracts WHERE owner_id=${user.id}
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, client_name, contract_name LIMIT 1000`;
    return Response.json({ contracts: rows.map((row: Record<string, unknown>) => mapped(row)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Recurring contracts GET failed", e); return fail("Unable to load recurring contracts. Apply the financial truth-source migration first.", 500); }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser(); if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    const clientName = cleanText(body.clientName, 240), contractName = cleanText(body.contractName, 240);
    const monthlyAmount = amount(body.monthlyAmount), startDate = validDate(body.startDate), endDate = validDate(body.endDate);
    if (!clientName || !contractName) return fail("Client and contract names are required.", 400);
    if (monthlyAmount === null) return fail("Monthly amount must be a non-negative number.", 400);
    if (startDate === null || startDate === false || endDate === false) return fail("Provide a valid start date and optional end date.", 400);
    if (endDate && endDate < startDate) return fail("End date cannot be before start date.", 400);
    if (body.status !== undefined && !statuses.has(body.status)) return fail("Invalid contract status.", 400);
    const status = body.status === undefined ? "active" : body.status, sql = db();
    const rows = await sql`INSERT INTO public.recurring_revenue_contracts
      (owner_id,client_name,contract_name,monthly_amount,status,start_date,end_date,notes)
      VALUES (${user.id},${clientName},${contractName},${monthlyAmount},${status},${startDate}::date,${endDate}::date,${cleanText(body.notes,5000)})
      RETURNING id,client_name,contract_name,monthly_amount,status,start_date,end_date,notes`;
    return Response.json({ contract: mapped(rows[0] as Record<string, unknown>) }, { status: 201 });
  } catch (e) { console.error("Recurring contracts POST failed", e); return fail("Unable to save recurring contract.", 500); }
}
export async function PATCH(request: Request) {
  try {
    const user = await currentUser(); if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return fail("Valid contract id is required.", 400);
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasTerms = ["clientName", "contractName", "monthlyAmount", "startDate", "endDate", "notes"].some(key => Object.prototype.hasOwnProperty.call(body, key));
    if (!hasStatus && !hasTerms) return fail("Provide contract terms or a status to update.", 400);
    if (hasStatus && !statuses.has(body.status)) return fail("Invalid contract status.", 400);
    const sql = db();
    if (!hasTerms) {
      const rows = await sql`UPDATE public.recurring_revenue_contracts SET status=${body.status},updated_at=now()
        WHERE id=${body.id}::uuid AND owner_id=${user.id}
        RETURNING id,client_name,contract_name,monthly_amount,status,start_date,end_date,notes`;
      if (!rows.length) return fail("Contract not found.", 404);
      return Response.json({ contract: mapped(rows[0] as Record<string, unknown>) });
    }
    const current = await sql`SELECT id,client_name,contract_name,monthly_amount,status,start_date,end_date,notes
      FROM public.recurring_revenue_contracts WHERE id=${body.id}::uuid AND owner_id=${user.id} LIMIT 1`;
    if (!current.length) return fail("Contract not found.", 404);
    const row = current[0] as Record<string, unknown>;
    const clientName = Object.prototype.hasOwnProperty.call(body, "clientName") ? cleanText(body.clientName, 240) : String(row.client_name);
    const contractName = Object.prototype.hasOwnProperty.call(body, "contractName") ? cleanText(body.contractName, 240) : String(row.contract_name);
    const monthlyAmount = Object.prototype.hasOwnProperty.call(body, "monthlyAmount") ? amount(body.monthlyAmount) : Number(row.monthly_amount);
    const startDate = Object.prototype.hasOwnProperty.call(body, "startDate") ? validDate(body.startDate) : String(row.start_date).slice(0, 10);
    const endDate = Object.prototype.hasOwnProperty.call(body, "endDate") ? validDate(body.endDate) : (row.end_date ? String(row.end_date).slice(0, 10) : null);
    const notes = Object.prototype.hasOwnProperty.call(body, "notes") ? cleanText(body.notes, 5000) : String(row.notes ?? "");
    if (!clientName || !contractName) return fail("Client and contract names are required.", 400);
    if (monthlyAmount === null || monthlyAmount === false) return fail("Monthly amount must be a non-negative number.", 400);
    if (startDate === null || startDate === false || endDate === false) return fail("Provide a valid start date and optional end date.", 400);
    if (endDate && typeof startDate === "string" && endDate < startDate) return fail("End date cannot be before start date.", 400);
    const nextStatus = hasStatus ? body.status : String(row.status);
    const rows = await sql`UPDATE public.recurring_revenue_contracts SET
      client_name=${clientName},contract_name=${contractName},monthly_amount=${monthlyAmount},
      status=${nextStatus},start_date=${startDate}::date,end_date=${endDate}::date,notes=${notes},updated_at=now()
      WHERE id=${body.id}::uuid AND owner_id=${user.id}
      RETURNING id,client_name,contract_name,monthly_amount,status,start_date,end_date,notes`;
    if (!rows.length) return fail("Contract not found.", 404);
    return Response.json({ contract: mapped(rows[0] as Record<string, unknown>) });
  } catch (e) { console.error("Recurring contracts PATCH failed", e); return fail("Unable to update recurring contract.", 500); }
}
export async function DELETE(request: Request) {
  try {
    const user = await currentUser(); if (!user) return fail("Unauthorized", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return fail("Valid contract id is required.", 400);
    const sql = db();
    const rows = await sql`DELETE FROM public.recurring_revenue_contracts WHERE id=${id}::uuid AND owner_id=${user.id} RETURNING id`;
    if (!rows.length) return fail("Contract not found.", 404);
    return Response.json({ ok: true });
  } catch (e) { console.error("Recurring contracts DELETE failed", e); return fail("Unable to delete recurring contract.", 500); }
}
