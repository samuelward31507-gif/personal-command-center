import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/needs-phone?limit=: hiring-finder leads with no phone yet, fence and generators first, oldest first. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 25));
  try {
    const rows = await g.sql`SELECT id, company, location, niche, website, notes FROM public.contacts
      WHERE owner_id = ${g.owner} AND coalesce(trim(phone), '') = '' AND coalesce(notes, '') LIKE '%Hiring:%' AND lower(coalesce(status, '')) = 'lead'
      ORDER BY (coalesce(niche, '') <> '') DESC, created_at LIMIT ${limit}` as { id: string; company: string; location: string; niche: string; website: string; notes: string }[];
    return agentJson({ leads: rows.map(r => {
      const m = /Hiring:\s*([^\n·]+?)(?:\s+\(posted ([0-9-]+)\))?(?:\s+(https?:\/\/\S+))?(?:\n|$)/.exec(r.notes ?? "");
      return { id: r.id, company: r.company, city: r.location, niche: r.niche || "other", website: r.website || "", job: m?.[1]?.trim() ?? "", posted: m?.[2] ?? "", jobPost: m?.[3] ?? "" };
    }) });
  } catch (e) {
    console.error("Agent needs-phone failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not load the leads." }, 500);
  }
}
