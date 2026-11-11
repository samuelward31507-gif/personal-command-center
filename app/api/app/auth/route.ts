import { CODE_MINUTES, CODE_TRIES, clearCookie, hashCode, makeSession, newCode, phone10, sessionCookie } from "@/lib/client-app";
import { db, json } from "@/lib/client-app-run";
import { allowEvent, clientIp } from "@/lib/rate-limit";
import { sendSms } from "@/lib/twilio";
import { isTokenShape } from "@/lib/esign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every business whose owner cell is this number. */
async function businessesFor(phone: string) {
  return await db()`SELECT project_id, setup->>'texting_number' AS from_number FROM public.client_ops
    WHERE right(regexp_replace(coalesce(setup->>'owner_cell',''), '[^0-9]', '', 'g'), 10) = ${phone}` as { project_id: string; from_number: string | null }[];
}

/**
 * POST { action: "send", phone } — text a 6-digit code to the owner's cell (always answers the same, so it doesn't reveal who's a client).
 * POST { action: "verify", phone, code } — sign in for 90 days.
 * POST { action: "link", token } — sign in from the portal link they already have.
 * POST { action: "logout" }
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { action?: string; phone?: string; code?: string; token?: string };
  const secure = new URL(req.url).protocol === "https:";
  if (!process.env.CINDER_TOKEN_KEY?.trim()) return json({ error: "Sign-in isn't switched on yet." }, 503);
  try {
    if (b.action === "logout") return json({ ok: true }, 200, { "Set-Cookie": clearCookie });
    if (b.action === "link") {
      if (!isTokenShape(b.token ?? null)) return json({ error: "That link isn't valid." }, 404);
      const [r] = await db()`SELECT project_id, setup->>'owner_cell' AS cell FROM public.client_ops WHERE portal_token = ${b.token} LIMIT 1` as { project_id: string; cell: string | null }[];
      if (!r) return json({ error: "That link isn't active." }, 404);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(makeSession([r.project_id], phone10(r.cell ?? "")), secure) });
    }
    const phone = phone10(b.phone ?? "");
    if (phone.length !== 10) return json({ error: "Enter the 10-digit cell number you gave us." }, 400);
    if (b.action === "send") {
      if (!(await allowEvent("app-code-ip", clientIp(req), 10, 60)) || !(await allowEvent("app-code-phone", phone, 5, 60))) return json({ error: "Too many codes. Try again in an hour." }, 429);
      const biz = await businessesFor(phone);
      const from = biz.find(x => x.from_number)?.from_number || process.env.CINDER_TEXT_FROM?.trim() || "";
      if (biz.length && from) {
        const code = newCode();
        await db()`INSERT INTO public.app_codes (phone, code_hash, expires_at) VALUES (${phone}, ${hashCode(phone, code)}, now() + make_interval(mins => ${CODE_MINUTES}))`;
        await sendSms("+1" + phone, from, `${code} is your Cinder sign-in code. It expires in ${CODE_MINUTES} minutes. Don't share it.`);
      }
      return json({ ok: true, sent: true });
    }
    if (b.action === "verify") {
      const code = String(b.code ?? "").replace(/\D/g, "");
      if (code.length !== 6) return json({ error: "Enter the 6-digit code." }, 400);
      const sql = db();
      const [c] = await sql`SELECT id, code_hash, attempts FROM public.app_codes WHERE phone = ${phone} AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1` as { id: string; code_hash: string; attempts: number }[];
      if (!c || c.attempts >= CODE_TRIES) return json({ error: "That code expired. Send a new one." }, 400);
      if (c.code_hash !== hashCode(phone, code)) {
        await sql`UPDATE public.app_codes SET attempts = attempts + 1 WHERE id = ${c.id}::uuid`;
        return json({ error: "That code isn't right." }, 400);
      }
      await sql`UPDATE public.app_codes SET used_at = now() WHERE id = ${c.id}::uuid`;
      const biz = await businessesFor(phone);
      if (!biz.length) return json({ error: "No business is set up with that number." }, 404);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(makeSession(biz.map(x => x.project_id), phone), secure) });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) { console.error("App auth failed", e instanceof Error ? e.message : e); return json({ error: "Something went wrong. Try again." }, 500); }
}
