import { appSession, clientFor, db, json } from "@/lib/client-app-run";
import { vapidKeys } from "@/lib/web-push";
import { pushToProject } from "@/lib/client-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the public key the browser subscribes with. */
export function GET() {
  const k = vapidKeys();
  return k ? json({ publicKey: k.publicKey }) : json({ error: "Notifications aren't switched on yet." }, 503);
}

/** POST { p, action: "subscribe", sub } | { action: "unsubscribe", endpoint } | { p, action: "test" } */
export async function POST(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const b = await req.json().catch(() => ({})) as { p?: string; action?: string; endpoint?: string; sub?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    const sql = db();
    if (b.action === "unsubscribe") {
      if (typeof b.endpoint === "string") await sql`DELETE FROM public.app_push_subs WHERE endpoint = ${b.endpoint} AND project_id = ANY(${s.projects}::uuid[])`;
      return json({ ok: true });
    }
    const c = await clientFor(sql, s, b.p);
    if (!c) return json({ error: "Sign in" }, 401);
    if (b.action === "subscribe") {
      const ep = String(b.sub?.endpoint ?? ""), p256dh = String(b.sub?.keys?.p256dh ?? ""), auth = String(b.sub?.keys?.auth ?? "");
      if (!/^https:\/\/[^\s]{10,800}$/.test(ep) || !/^[A-Za-z0-9_-]{60,120}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,40}$/.test(auth)) return json({ error: "That browser didn't give a usable subscription." }, 400);
      await sql`INSERT INTO public.app_push_subs (project_id, phone, endpoint, p256dh, auth) VALUES (${c.projectId}::uuid, ${s.phone}, ${ep}, ${p256dh}, ${auth})
        ON CONFLICT (endpoint) DO UPDATE SET project_id = EXCLUDED.project_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
      await pushToProject(c.projectId, { title: "Notifications are on", body: "You'll hear from Cinder the moment a lead needs you or an estimate gets booked.", url: "/app", tag: "welcome" });
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) { console.error("Push subscribe failed", e instanceof Error ? e.message : e); return json({ error: "Couldn't turn on notifications." }, 500); }
}
