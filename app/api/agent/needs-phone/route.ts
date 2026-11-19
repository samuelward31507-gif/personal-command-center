import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/needs-phone?limit=: hiring-finder leads missing a phone or an email (many hiring leads are landlines,
 * so the email is how they hear from Sam first), fence and generators first, phone-less first, oldest first. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 25));
  try {
    const rows = await g.sql`SELECT id, company, location, niche, website, notes, coalesce(trim(phone), '') = '' AS no_phone, coalesce(trim(email), '') = '' AS no_email FROM public.contacts
      WHERE owner_id = ${g.owner} AND (coalesce(trim(phone), '') = '' OR coalesce(trim(email), '') = '') AND coalesce(notes, '') LIKE '%Hiring:%' AND lower(coalesce(status, '')) = 'lead'
      ORDER BY (coalesce(trim(phone), '') = '') DESC, (coalesce(niche, '') <> '') DESC, created_at LIMIT ${limit}` as { id: string; company: string; location: string; niche: string; website: string; notes: string; no_phone: boolean; no_email: boolean }[];
    return agentJson({ leads: rows.map(r => {
      const m = /Hiring:\s*([^\n·]+?)(?:\s+\(posted ([0-9-]+)\))?(?:\s+(https?:\/\/\S+))?(?:\n|$)/.exec(r.notes ?? "");
      return { id: r.id, missing: [r.no_phone ? "phone" : "", r.no_email ? "email" : ""].filter(Boolean), company: r.company, city: r.location, niche: r.niche || "other", website: r.website || "", job: m?.[1]?.trim() ?? "", posted: m?.[2] ?? "", jobPost: m?.[3] ?? "" };
    }) });
  } catch (e) {
    console.error("Agent needs-phone failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not load the leads." }, 500);
  }
}
