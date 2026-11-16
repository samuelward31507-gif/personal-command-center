import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { cleanMessages } from "@/lib/client-ops";
import { SOURCE_LABEL, flatten, leadFields, parseLead, sourceOf } from "@/lib/lead-sources";
import { webLead, type Client } from "@/lib/client-runtime-run";
import { leadFromMail, queueWithoutPhone } from "@/lib/client-lead-mail-run";

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
  // Google Ads lead forms carry the key typed into the form's webhook settings: it has to be this business's key.
  if (typeof body.google_key === "string" && body.google_key !== (url.searchParams.get("key") ?? "")) return Response.json({ error: "Wrong key." }, { status: 403, headers: CORS });
  const lead = parseLead(body, url.searchParams.get("source"));
  const back = url.searchParams.get("next");
  const done = (status: number, payload: Record<string, unknown>) =>
    back && /^https:\/\//.test(back) && !type.includes("json") ? Response.redirect(back, 303) : Response.json(payload, { status, headers: CORS });
  if (!lead) {
    // No phone, but an email: keep it for the owner (Inbox, "no phone") instead of losing it.
    const f = flatten(body), base = leadFields(f), source = sourceOf(url.searchParams.get("source") || f.source || f.leadsource || "");
    if (!base.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(base.email)) return done(400, { error: "A 10-digit phone number or an email is needed." });
    if (url.searchParams.get("test") === "1") return done(200, { ok: true, test: true, lead: { name: base.name, phone: "", email: base.email, source, message: base.message.slice(0, 200) } });
    if (!(await allowEvent("intake", clientIp(req), 20, 60))) return done(429, { error: "Too many submissions." });
    await queueWithoutPhone(neon(process.env.DATABASE_URL!), c, { ...base, email: base.email.toLowerCase(), source, via: SOURCE_LABEL[source] }).catch(e => console.error("Intake queue failed", e instanceof Error ? e.message : e));
    return done(200, { ok: true, texted: false });
  }
  // A dry run from the Connections screen: the lead is parsed and answered but nothing is saved and nobody is texted.
  if (url.searchParams.get("test") === "1") return done(200, { ok: true, test: true, lead: { name: lead.name, phone: lead.phone, source: lead.source || "web form", message: lead.message.slice(0, 200) } });
  if (!(await allowEvent("intake", clientIp(req), 20, 60))) return done(429, { error: "Too many submissions." });
  // Before the business number is live the lead is still saved and the owner alerted; nobody is texted.
  if (!c.setup.texting_number) {
    await leadFromMail(neon(process.env.DATABASE_URL!), c, { name: lead.name, phone: lead.phone, email: lead.email, message: lead.message, source: lead.source, via: lead.via, smsConsent: lead.smsConsent ?? null }, false, "New lead")
      .catch(e => console.error("Intake save failed", e instanceof Error ? e.message : e));
    return done(200, { ok: true, texted: false });
  }
  const r = await webLead(neon(process.env.DATABASE_URL!), c, lead, url.searchParams.get("source") ? "" : clientIp(req)).catch(e => { console.error("Intake failed", e); return { ok: false, threadId: "" }; });
  return done(200, { ok: true, texted: r.ok });
}
