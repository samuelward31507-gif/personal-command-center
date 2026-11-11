import { appSession, db } from "@/lib/client-app-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?id=<text id>&i=<n> — a photo a customer texted, fetched from Twilio (which requires our credentials) for the signed-in owner. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return new Response("Sign in", { status: 401 });
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "", i = Math.max(0, Math.min(9, Number(q.get("i")) || 0));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [r] = await db()`SELECT x.media FROM public.client_texts x JOIN public.client_threads t ON t.id = x.thread_id
    WHERE x.id = ${id}::uuid AND t.project_id = ANY(${s.projects}::uuid[])` as { media: { url: string; type: string }[] }[];
  const m = r?.media?.[i];
  if (!m || !/^https:\/\/api\.twilio\.com\//.test(m.url)) return new Response("Not found", { status: 404 });
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim(), token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const up = await fetch(m.url, { headers: sid && token ? { authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") } : {}, redirect: "follow", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!up?.ok || !up.body) return new Response("Not found", { status: 404 });
  return new Response(up.body, { headers: { "Content-Type": up.headers.get("content-type") || m.type || "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
