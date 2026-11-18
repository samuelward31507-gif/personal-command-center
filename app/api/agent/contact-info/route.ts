import { parseContactInfo } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/agent/contact-info: fills a prospect's empty email, owner name and social pages. Never overwrites. */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseContactInfo(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const i = parsed.info;
  const [first, ...rest] = i.owner.split(/\s+/).filter(Boolean);
  try {
    const [before] = await g.sql`SELECT email, first_name, facebook, instagram FROM public.contacts WHERE owner_id = ${g.owner} AND id = ${i.contactId}::uuid` as Record<string, string | null>[];
    if (!before) return agentJson({ error: "No prospect with that contactId." }, 404);
    const empty = (v: string | null) => !v || !v.trim();
    const filled = [
      i.email && empty(before.email) ? "email" : "", first && empty(before.first_name) ? "owner" : "",
      i.facebook && empty(before.facebook) ? "facebook" : "", i.instagram && empty(before.instagram) ? "instagram" : "",
    ].filter(Boolean);
    if (!filled.length) return agentJson({ filled: [] });
    await g.sql`UPDATE public.contacts SET
        email = CASE WHEN coalesce(trim(email), '') = '' AND ${i.email} <> '' THEN ${i.email} ELSE email END,
        first_name = CASE WHEN coalesce(trim(first_name), '') = '' AND ${first ?? ""} <> '' THEN ${first ?? ""} ELSE first_name END,
        last_name = CASE WHEN coalesce(trim(first_name), '') = '' AND ${first ?? ""} <> '' THEN ${rest.join(" ")} ELSE last_name END,
        facebook = CASE WHEN coalesce(trim(facebook), '') = '' AND ${i.facebook} <> '' THEN ${i.facebook} ELSE facebook END,
        instagram = CASE WHEN coalesce(trim(instagram), '') = '' AND ${i.instagram} <> '' THEN ${i.instagram} ELSE instagram END,
        notes = trim(both from concat_ws(E'\n', notes, ${`Grok found ${filled.join(", ")}: ${i.source}`})),
        updated_at = now()
      WHERE owner_id = ${g.owner} AND id = ${i.contactId}::uuid`;
    return agentJson({ filled });
  } catch (e) {
    console.error("Agent contact info failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not save the details." }, 500);
  }
}
