// Cinder app, I/O: who's signed in, the client they're looking at, and the click-to-call bridge.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { cookieFrom, readSession, type AppSession } from "@/lib/client-app";
import { cleanMessages } from "@/lib/client-ops";
import type { Client } from "@/lib/client-runtime-run";

type Sql = NeonQueryFunction<false, false>;
export const db = (): Sql => { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); };
export const appSession = (req: Request): AppSession | null => readSession(cookieFrom(req.headers.get("cookie")));
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** The client for a project, only if this session may see it. */
export async function clientFor(sql: Sql, s: AppSession, projectId: string | null | undefined): Promise<Client | null> {
  const pid = projectId && s.projects.includes(projectId) ? projectId : s.projects[0];
  if (!pid) return null;
  const [r] = await sql`SELECT project_id, owner_id, setup, messages FROM public.client_ops WHERE project_id = ${pid}::uuid` as Record<string, unknown>[];
  return r ? { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup ?? {}) as Record<string, string>, messages: cleanMessages(r.messages) } : null;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/**
 * Call the customer back from the business number: Twilio rings the owner's cell first, then connects the customer,
 * who sees the business number. No app calling permissions, no personal number shown.
 */
export async function bridgeCall(ownerCell: string, businessNumber: string, customer: string, name: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim(), token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token || !ownerCell || !businessNumber || !customer) return false;
  const twiml = `<Response><Say voice="Polly.Joanna">Connecting you to ${xml(name || "your lead")}.</Say><Dial callerId="${xml(businessNumber)}" timeout="25"><Number>${xml(customer)}</Number></Dial></Response>`;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
    method: "POST", headers: { authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: ownerCell, From: businessNumber, Twiml: twiml }), signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) console.error("Bridge call failed", { status: r?.status });
  return !!r?.ok;
}
