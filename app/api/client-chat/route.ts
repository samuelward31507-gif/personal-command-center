import { neon } from "@neondatabase/serverless";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { cleanMessages } from "@/lib/client-ops";
import { clientInboundText, type Client } from "@/lib/client-runtime-run";
import { digits10 } from "@/lib/client-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint for the chat bubble on a client's website. Cross-origin by design; the key only names the client.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Cache-Control": "no-store" };
const reply = (b: unknown, status = 200) => Response.json(b, { status, headers: CORS });
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, max) : "");

async function byKey(key: string): Promise<Client | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key) || !process.env.DATABASE_URL) return null;
  const sql = neon(process.env.DATABASE_URL);
  const [r] = await sql`SELECT project_id, owner_id, setup, messages FROM public.client_ops WHERE chat_key = ${key} LIMIT 1` as Record<string, unknown>[];
  return r ? { projectId: String(r.project_id), owner: String(r.owner_id), setup: (r.setup ?? {}) as Record<string, string>, messages: cleanMessages(r.messages) } : null;
}

export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

/** GET ?key= → the label the bubble shows. */
export async function GET(req: Request) {
  const c = await byKey(new URL(req.url).searchParams.get("key") ?? "");
  if (!c) return reply({ error: "Unknown site." }, 404);
  return reply({ business: c.setup.display_name || "us", live: !!c.setup.texting_number });
}

/** POST {key, name, phone, message, website (honeypot)} → the reply engine answers by text to their phone. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return reply({ error: "Bad request." }, 400);
  if (str(b.website, 200)) return reply({ ok: true }); // honeypot: bots fill every field
  const c = await byKey(str(b.key, 64));
  if (!c) return reply({ error: "Unknown site." }, 404);
  if (!c.setup.texting_number) return reply({ error: "Texting isn't set up for this business yet. Please call instead." }, 503);
  const phone = digits10(str(b.phone, 30)), name = str(b.name, 60), message = str(b.message, 800);
  if (phone.length !== 10) return reply({ error: "Enter a 10-digit cell number so we can text you back." }, 400);
  if (!message) return reply({ error: "Tell us what you need." }, 400);
  if (!(await allowEvent("client-chat", clientIp(req), 8, 60))) return reply({ error: "Too many messages. Try again in a bit." }, 429);
  const sql = neon(process.env.DATABASE_URL!);
  const from = "+1" + phone;
  await sql`INSERT INTO public.client_threads (owner_id, project_id, customer_phone, customer_name, source)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${from}, ${name}, 'web chat')
    ON CONFLICT (project_id, customer_phone) DO UPDATE SET customer_name = CASE WHEN public.client_threads.customer_name = '' THEN EXCLUDED.customer_name ELSE public.client_threads.customer_name END, updated_at = now()`;
  await clientInboundText(sql, c, from, `[Website chat] ${message}`).catch(e => console.error("Client chat failed", e));
  return reply({ ok: true, to: `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` });
}
