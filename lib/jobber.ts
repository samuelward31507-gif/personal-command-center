// A client's Jobber: the owner connects once (OAuth), then every estimate Cinder books shows up in Jobber
// as a request on that customer's client record, so nobody copies bookings over by hand.
// Jobber: OAuth 2 (access tokens last 60 minutes, refresh tokens may rotate), GraphQL at /api/graphql.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { decryptToken, encryptToken } from "@/lib/gmail";
import { JOBBER_API, JOBBER_VERSION, clientInput, jobberRedirect, requestTitle } from "@/lib/jobber-core";
export { jobberAuthUrl, jobberConfigured, jobberRedirect, jobberState, readJobberState } from "@/lib/jobber-core";

type Sql = NeonQueryFunction<false, false>;

type Tokens = { access_token: string; refresh_token?: string; expires_in?: number };
async function tokenCall(params: Record<string, string>): Promise<Tokens> {
  const r = await fetch(`${JOBBER_API}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.JOBBER_CLIENT_ID!.trim(), client_secret: process.env.JOBBER_CLIENT_SECRET!.trim(), ...params }),
    signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({})) as Tokens & { error?: string };
  if (!r.ok || !j.access_token) throw new Error(`Jobber token request failed (${r.status}${j.error ? ": " + j.error : ""})`);
  return j;
}
export const exchangeJobberCode = (code: string, origin: string) => tokenCall({ grant_type: "authorization_code", code, redirect_uri: jobberRedirect(origin) });

export async function gql<T = Record<string, unknown>>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<{ data?: T; errors?: { message: string }[] }> {
  const r = await fetch(`${JOBBER_API}/graphql`, { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, "X-JOBBER-GRAPHQL-VERSION": JOBBER_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }) });
  const j = await r.json().catch(() => ({})) as { data?: T; errors?: { message: string }[] };
  if (r.status === 401) throw new Error("Jobber access was revoked. Send the owner a new connect link.");
  if (!r.ok && !j.errors) throw new Error(`Jobber API error (${r.status})`);
  return j;
}

/** The account name, used to confirm a fresh connection worked. */
export async function jobberAccountName(token: string): Promise<string> {
  const r = await gql<{ account: { name: string } }>(token, "query { account { name } }");
  return r.data?.account?.name ?? "";
}

/** A live access token for a client's Jobber, refreshing (and storing a rotated refresh token) when needed. Null when not connected. */
export async function jobberToken(sql: Sql, projectId: string): Promise<string | null> {
  const [row] = await sql`SELECT refresh_token_enc, access_token_enc, access_expires_at FROM public.client_jobber WHERE project_id = ${projectId}::uuid` as { refresh_token_enc: string; access_token_enc: string; access_expires_at: string | null }[];
  if (!row) return null;
  if (row.access_token_enc && row.access_expires_at && Date.parse(row.access_expires_at) > Date.now() + 120000) return decryptToken(row.access_token_enc);
  const t = await tokenCall({ grant_type: "refresh_token", refresh_token: decryptToken(row.refresh_token_enc) });
  const expires = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await sql`UPDATE public.client_jobber SET access_token_enc = ${encryptToken(t.access_token)}, access_expires_at = ${expires}::timestamptz,
    refresh_token_enc = ${t.refresh_token ? encryptToken(t.refresh_token) : row.refresh_token_enc} WHERE project_id = ${projectId}::uuid`;
  return t.access_token;
}

const CLIENT_SEARCH = `query($q: String!) { clients(searchTerm: $q, first: 1) { nodes { id } } }`;
const CLIENT_CREATE = `mutation($input: ClientCreateInput!) { clientCreate(input: $input) { client { id } userErrors { message path } } }`;
const REQUEST_CREATE = `mutation($input: RequestCreateInput!) { requestCreate(input: $input) { request { id } userErrors { message path } } }`;

type Errs = { message: string }[] | undefined;
const errText = (e: Errs, u?: { message: string }[]) => [...(e ?? []), ...(u ?? [])].map(x => x.message).join("; ");

/** Finds the customer by phone or creates them, then adds a request for the booked estimate. Returns the request id. */
export async function pushBooking(token: string, b: { name: string; phone: string; start: string; end: string; tz: string; summary: string }): Promise<string> {
  let clientId = "";
  try {
    const s = await gql<{ clients: { nodes: { id: string }[] } }>(token, CLIENT_SEARCH, { q: b.phone.replace(/\D/g, "").slice(-10) });
    clientId = s.data?.clients?.nodes?.[0]?.id ?? "";
  } catch { /* search is a nicety: create instead */ }
  if (!clientId) {
    const c = await gql<{ clientCreate: { client: { id: string } | null; userErrors: { message: string }[] } }>(token, CLIENT_CREATE, { input: clientInput(b.name, b.phone) });
    clientId = c.data?.clientCreate?.client?.id ?? "";
    if (!clientId) throw new Error("Jobber didn't create the client: " + (errText(c.errors, c.data?.clientCreate?.userErrors) || "no id returned"));
  }
  const title = requestTitle(b.start, b.tz, b.summary);
  // First try with the assessment time on the request; if this account's schema refuses that shape, fall back to title only.
  const rich = { clientId, title, assessment: { startAt: b.start, endAt: b.end, instructions: b.summary.slice(0, 2000) } };
  let r = await gql<{ requestCreate: { request: { id: string } | null; userErrors: { message: string }[] } }>(token, REQUEST_CREATE, { input: rich });
  if (!r.data?.requestCreate?.request?.id) r = await gql(token, REQUEST_CREATE, { input: { clientId, title } });
  const id = r.data?.requestCreate?.request?.id ?? "";
  if (!id) throw new Error("Jobber didn't create the request: " + (errText(r.errors, r.data?.requestCreate?.userErrors) || "no id returned"));
  return id;
}

/** Called after a booking lands on the calendar. Never throws: a Jobber hiccup must not undo a booking. */
export async function syncBookingToJobber(sql: Sql, projectId: string, appointmentId: string, b: { name: string; phone: string; start: string; end: string; tz: string; summary: string }): Promise<boolean> {
  try {
    const token = await jobberToken(sql, projectId);
    if (!token) return false;
    const id = await pushBooking(token, b);
    await sql`UPDATE public.client_appointments SET jobber_request_id = ${id} WHERE id = ${appointmentId}::uuid`;
    await sql`UPDATE public.client_jobber SET last_push_at = now(), last_error = '' WHERE project_id = ${projectId}::uuid`;
    return true;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("Jobber sync failed", msg);
    await sql`UPDATE public.client_jobber SET last_error = ${msg} WHERE project_id = ${projectId}::uuid`.catch(() => {});
    return false;
  }
}
