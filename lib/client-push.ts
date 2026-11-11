// Push a notification to every device the client's owner turned notifications on for. Never throws.
import { neon } from "@neondatabase/serverless";
import { sendPush, vapidKeys } from "@/lib/web-push";

export async function pushToProject(projectId: string, message: { title: string; body: string; url?: string; tag?: string }): Promise<number> {
  if (!process.env.DATABASE_URL || !vapidKeys()) return 0;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const subs = await sql`SELECT id, endpoint, p256dh, auth FROM public.app_push_subs WHERE project_id = ${projectId}::uuid LIMIT 10` as { id: string; endpoint: string; p256dh: string; auth: string }[];
    let sent = 0;
    for (const s of subs) {
      const r = await sendPush(s, message);
      if (r === "ok") sent++;
      if (r === "gone") await sql`DELETE FROM public.app_push_subs WHERE id = ${s.id}::uuid`; // the browser revoked it; it can't be used again
    }
    return sent;
  } catch (e) { console.error("Push to project failed", e instanceof Error ? e.message : e); return 0; }
}

/** Title and line for an owner alert ("Needs you: …" / "Booked: …"), from the same text the SMS alert uses. */
export function pushFromAlert(text: string): { title: string; body: string } {
  const t = text.replace(/^Cinder · /, "");
  const i = t.indexOf(": ");
  return i > 0 && i < 40 ? { title: t.slice(0, i), body: t.slice(i + 2).slice(0, 180) } : { title: "Cinder", body: t.slice(0, 180) };
}
