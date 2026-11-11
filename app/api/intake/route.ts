import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { cleanMessages } from "@/lib/client-ops";
import { parseLead } from "@/lib/lead-sources";
import { webLead, type Client } from "@/lib/client-runtime-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lead intake for a client: point any web form, landing page or form tool's webhook at
// https://<crm>/api/intake?key=<the client's website key>. JSON or a normal form post both work.
// Paid lead sites add &source=angi | thumbtack | facebook (directly, or through Zapier / Make), and their
// payloads are read as-is: nested fields, Facebook's field_data, Angi's phonePrimary/taskName, Thumbtack's customer/request.
// The lead gets a text from the client's number right away ("Got your request on Angi…"); replies go to the reply engine.
// Every lead is written to the consent log with what they submitted, the source and the IP.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Cache-Control": "no-store" };
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

async function byKey(key: string): Promise<Client | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key) || !process.env.DATABASE_URL) return null;
  const [r] = await neon(process.env.DATABASE_URL)`SELECT project_id, owner_id, setup, messages FROM public.client_ops WHERE chat_key = ${key} LIMIT 1` as Record<string, unknown>[];
  return r ? { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup ?? {}) as Record<string, string>, messages: cleanMessages(r.messages) } : null;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const c = await byKey(url.searchParams.get("key") ?? "");
  if (!c) return Response.json({ error: "Unknown key." }, { status: 404, headers: CORS });
  const type = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  if (type.includes("json")) body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  else { const f = await req.formData().catch(() => null); if (f) for (const [k, v] of f.entries()) if (typeof v === "string") body[k] = v; }
  if (typeof body.website === "string" && body.website) return Response.json({ ok: true }, { headers: CORS }); // honeypot
  const lead = parseLead(body, url.searchParams.get("source"));
  const back = url.searchParams.get("next");
  const done = (status: number, payload: Record<string, unknown>) =>
    back && /^https:\/\//.test(back) && !type.includes("json") ? Response.redirect(back, 303) : Response.json(payload, { status, headers: CORS });
  if (!lead) return done(400, { error: "A 10-digit phone number is needed." });
  if (!(await allowEvent("intake", clientIp(req), 20, 60))) return done(429, { error: "Too many submissions." });
  if (!c.setup.texting_number) return done(202, { ok: true, texted: false });
  const r = await webLead(neon(process.env.DATABASE_URL!), c, lead, url.searchParams.get("source") ? "" : clientIp(req)).catch(e => { console.error("Intake failed", e); return { ok: false, threadId: "" }; });
  return done(200, { ok: true, texted: r.ok });
}
