import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { loadWorkspace } from "@/lib/workspace-data";
import { sendColdEmail } from "@/lib/gmail-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEPS = new Set(["intro", "follow_up", "breakup"]);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail = (error: string, status: number) => Response.json({ error }, { status });

/** POST { contactId, step, subject, body }: send one cold email from the owner's connected Gmail and log it. */
export async function POST(req: Request) {
  const r = await getAllowedSession();
  const o = r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null;
  if (!o) return fail("Unauthorized", 401);
  if (!process.env.DATABASE_URL) return fail("Database not configured.", 503);
  const b = await req.json().catch(() => ({}));
  const subject = typeof b.subject === "string" ? b.subject.trim().slice(0, 200) : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 10000) : "";
  if (!uuid(b.contactId) || !STEPS.has(b.step) || !subject || !body) return fail("Contact, step, subject and body are required.", 400);
  const res = await sendColdEmail(neon(process.env.DATABASE_URL), o, await loadWorkspace(o), { contactId: b.contactId, step: b.step, subject, body });
  return res.ok ? Response.json({ ok: true, from: res.from }) : fail(res.error, res.status);
}
