// A client's QuickBooks Online: the owner connects once (OAuth 2: access tokens last an hour, refresh tokens rotate), then
// every invoice they send and every payment they record lands in their books, on the right customer. Never throws into
// the app: a QuickBooks hiccup is stored as last_error for the Settings screen and retried by "Sync now".
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { decryptToken, encryptToken } from "@/lib/gmail";
import { cleanItems } from "@/lib/billing";
import { QBO_TOKEN, customerBody, displayName, invoiceBody, paymentBody, qboApiBase, qboQuote, qboRedirect } from "@/lib/qbo-core";
export { qboAuthUrl, qboConfigured, qboRedirect, qboState, readQboState } from "@/lib/qbo-core";

type Sql = NeonQueryFunction<false, false>;
type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; x_refresh_token_expires_in?: number };

async function tokenCall(params: Record<string, string>): Promise<Tokens> {
  const basic = Buffer.from(`${process.env.QBO_CLIENT_ID!.trim()}:${process.env.QBO_CLIENT_SECRET!.trim()}`).toString("base64");
  const r = await fetch(QBO_TOKEN, { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({})) as Tokens & { error?: string };
  if (!r.ok || !j.access_token) throw new Error(`QuickBooks token request failed (${r.status}${j.error ? ": " + j.error : ""})`);
  return j;
}
export const exchangeQboCode = (code: string, origin: string) => tokenCall({ grant_type: "authorization_code", code, redirect_uri: qboRedirect(origin) });

type Conn = { token: string; realm: string; itemId: string; projectId: string };
async function api<T = Record<string, unknown>>(c: Pick<Conn, "token" | "realm">, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${qboApiBase()}/v3/company/${c.realm}/${path}${sep}minorversion=75`, { method, signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${c.token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({})) as T & { Fault?: { Error?: { Message?: string; Detail?: string; code?: string }[] } };
  if (r.status === 401) throw new Error("QuickBooks access was revoked. Reconnect QuickBooks in Settings.");
  if (!r.ok || j.Fault) { const e = j.Fault?.Error?.[0]; const err = new Error(`QuickBooks: ${e?.Detail || e?.Message || `error ${r.status}`}`.slice(0, 300)) as Error & { code?: string }; err.code = e?.code; throw err; }
  return j;
}
const query = async <T>(c: Conn, q: string) => (await api<{ QueryResponse?: Record<string, T[]> }>(c, "GET", `query?query=${encodeURIComponent(q)}`)).QueryResponse ?? {};

export async function qboCompanyName(token: string, realm: string): Promise<string> {
  const j = await api<{ CompanyInfo?: { CompanyName?: string } }>({ token, realm }, "GET", `companyinfo/${realm}`).catch(() => ({} as { CompanyInfo?: { CompanyName?: string } }));
  return j.CompanyInfo?.CompanyName ?? "";
}

/** A live connection for a business: a fresh access token (refreshing and storing a rotated refresh token) and the item lines book to. */
async function connection(sql: Sql, projectId: string): Promise<Conn | null> {
  const [row] = await sql`SELECT realm_id, refresh_token_enc, access_token_enc, access_expires_at, item_id FROM public.client_qbo WHERE project_id = ${projectId}::uuid` as { realm_id: string; refresh_token_enc: string; access_token_enc: string; access_expires_at: string | null; item_id: string }[];
  if (!row) return null;
  let token = "";
  if (row.access_token_enc && row.access_expires_at && Date.parse(row.access_expires_at) > Date.now() + 120000) token = decryptToken(row.access_token_enc);
  else {
    const t = await tokenCall({ grant_type: "refresh_token", refresh_token: decryptToken(row.refresh_token_enc) });
    await sql`UPDATE public.client_qbo SET access_token_enc = ${encryptToken(t.access_token)}, access_expires_at = ${new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString()}::timestamptz,
      refresh_token_enc = ${t.refresh_token ? encryptToken(t.refresh_token) : row.refresh_token_enc} WHERE project_id = ${projectId}::uuid`;
    token = t.access_token;
  }
  const c: Conn = { token, realm: row.realm_id, itemId: row.item_id, projectId };
  if (!c.itemId) {
    // The item every line books to: their "Services" item, or one made against their first income account.
    const found = (await query<{ Id: string }>(c, `select Id from Item where Name = 'Services' and Active = true`)).Item?.[0]?.Id;
    let id = found ?? "";
    if (!id) {
      const acct = (await query<{ Id: string }>(c, `select Id from Account where AccountType = 'Income' and Active = true maxresults 1`)).Account?.[0]?.Id;
      if (!acct) throw new Error("QuickBooks: no income account to book sales to.");
      id = (await api<{ Item: { Id: string } }>(c, "POST", "item", { Name: "Services", Type: "Service", IncomeAccountRef: { value: acct } })).Item.Id;
    }
    await sql`UPDATE public.client_qbo SET item_id = ${id} WHERE project_id = ${projectId}::uuid`;
    c.itemId = id;
  }
  return c;
}

/** The customer in QuickBooks: the one already linked, else found by display name, else made. */
async function customerId(sql: Sql, c: Conn, threadId: string): Promise<string> {
  const [t] = await sql`SELECT customer_name, customer_phone, customer_email, details, qbo_customer_id FROM public.client_threads WHERE id = ${threadId}::uuid` as { customer_name: string; customer_phone: string; customer_email: string | null; details: Record<string, unknown> | null; qbo_customer_id: string }[];
  if (!t) throw new Error("Customer not found.");
  if (t.qbo_customer_id) return t.qbo_customer_id;
  const dn = displayName(t.customer_name, t.customer_phone);
  let id = (await query<{ Id: string }>(c, `select Id from Customer where DisplayName = ${qboQuote(dn)}`)).Customer?.[0]?.Id ?? "";
  if (!id) id = (await api<{ Customer: { Id: string } }>(c, "POST", "customer", customerBody({ name: t.customer_name, phone: t.customer_phone, email: t.customer_email ?? "", address: String(t.details?.address ?? "") }))).Customer.Id;
  await sql`UPDATE public.client_threads SET qbo_customer_id = ${id} WHERE id = ${threadId}::uuid`;
  return id;
}

async function pushInvoice(sql: Sql, c: Conn, invoiceId: string): Promise<string> {
  const [i] = await sql`SELECT id, thread_id, number, items, tax_rate::float AS tax_rate, due_on::text AS due_on, note, status, qbo_id FROM public.client_invoices WHERE id = ${invoiceId}::uuid AND project_id = ${c.projectId}::uuid` as Record<string, unknown>[];
  if (!i) throw new Error("Invoice not found.");
  const cust = await customerId(sql, c, String(i.thread_id));
  const body = invoiceBody({ number: Number(i.number), items: cleanItems(i.items), tax_rate: Number(i.tax_rate), due_on: i.due_on ? String(i.due_on) : null, note: String(i.note ?? "") }, cust, c.itemId);
  if (i.qbo_id) {
    // Already there: replace its lines and dates (QuickBooks needs the current SyncToken).
    const cur = await api<{ Invoice: { SyncToken: string } }>(c, "GET", `invoice/${i.qbo_id}`);
    if (i.status === "void") { await api(c, "POST", "invoice?operation=void", { Id: i.qbo_id, SyncToken: cur.Invoice.SyncToken }); return String(i.qbo_id); }
    await api(c, "POST", "invoice", { ...body, Id: i.qbo_id, SyncToken: cur.Invoice.SyncToken });
    return String(i.qbo_id);
  }
  if (i.status === "void" || i.status === "draft") return "";
  const id = (await api<{ Invoice: { Id: string } }>(c, "POST", "invoice", body)).Invoice.Id;
  await sql`UPDATE public.client_invoices SET qbo_id = ${id} WHERE id = ${invoiceId}::uuid`;
  return id;
}
async function pushPayment(sql: Sql, c: Conn, paymentId: string): Promise<void> {
  const [p] = await sql`SELECT p.id, p.amount::float AS amount, p.paid_on::text AS paid_on, p.method, p.note, p.qbo_id, p.invoice_id, p.thread_id FROM public.client_payments p WHERE p.id = ${paymentId}::uuid AND p.project_id = ${c.projectId}::uuid` as Record<string, unknown>[];
  if (!p || p.qbo_id) return;
  const inv = await pushInvoice(sql, c, String(p.invoice_id));
  if (!inv) return;
  const cust = await customerId(sql, c, String(p.thread_id));
  const id = (await api<{ Payment: { Id: string } }>(c, "POST", "payment", paymentBody({ amount: Number(p.amount), paid_on: String(p.paid_on), method: String(p.method), note: String(p.note ?? "") }, cust, inv))).Payment.Id;
  await sql`UPDATE public.client_payments SET qbo_id = ${id} WHERE id = ${paymentId}::uuid`;
}

async function guarded(sql: Sql, projectId: string, run: (c: Conn) => Promise<unknown>): Promise<boolean> {
  try {
    const c = await connection(sql, projectId);
    if (!c) return false;
    await run(c);
    await sql`UPDATE public.client_qbo SET last_push_at = now(), last_error = '' WHERE project_id = ${projectId}::uuid`;
    return true;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("QuickBooks sync failed", msg);
    await sql`UPDATE public.client_qbo SET last_error = ${msg} WHERE project_id = ${projectId}::uuid`.catch(() => {});
    return false;
  }
}
/** After an invoice is sent, edited after sending, or voided. */
export const qboSyncInvoice = (sql: Sql, projectId: string, invoiceId: string) => guarded(sql, projectId, c => pushInvoice(sql, c, invoiceId));
/** After a payment is recorded. */
export const qboSyncPayment = (sql: Sql, projectId: string, paymentId: string) => guarded(sql, projectId, c => pushPayment(sql, c, paymentId));
/** A payment taken back off: deleted in QuickBooks too. */
export const qboDeletePayment = (sql: Sql, projectId: string, qboId: string) => !qboId ? Promise.resolve(false) : guarded(sql, projectId, async c => {
  const cur = await api<{ Payment: { SyncToken: string } }>(c, "GET", `payment/${qboId}`);
  await api(c, "POST", "payment?operation=delete", { Id: qboId, SyncToken: cur.Payment.SyncToken });
});
/** "Sync now": every sent or paid invoice and every payment from the last 120 days that isn't in QuickBooks yet. */
export async function qboSyncAll(sql: Sql, projectId: string): Promise<{ invoices: number; payments: number; error?: string }> {
  let invoices = 0, payments = 0, error = "";
  const ok = await guarded(sql, projectId, async c => {
    const inv = await sql`SELECT id FROM public.client_invoices WHERE project_id = ${projectId}::uuid AND status IN ('sent', 'paid') AND qbo_id = '' AND created_at > now() - interval '120 days' ORDER BY created_at LIMIT 60` as { id: string }[];
    for (const i of inv) { await pushInvoice(sql, c, i.id); invoices++; }
    const pay = await sql`SELECT id FROM public.client_payments WHERE project_id = ${projectId}::uuid AND qbo_id = '' AND created_at > now() - interval '120 days' ORDER BY created_at LIMIT 80` as { id: string }[];
    for (const p of pay) { await pushPayment(sql, c, p.id); payments++; }
  });
  if (!ok) { const [r] = await sql`SELECT last_error FROM public.client_qbo WHERE project_id = ${projectId}::uuid` as { last_error: string }[]; error = r?.last_error || "QuickBooks isn't connected."; }
  return { invoices, payments, ...(error ? { error } : {}) };
}
