import { parseContactInfo } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/contact-info: fills a prospect's empty phone, website, email, owner name and social pages. Never
 * overwrites. A phone that already belongs to another contact merges this one into it: the other contact gets this
 * one's hiring note (so it turns grade A) and this one is marked a duplicate. A phone on the do-not-contact list is refused.
 */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseContactInfo(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const i = parsed.info;
  const [first, ...rest] = i.owner.split(/\s+/).filter(Boolean);
  try {
    const [before] = await g.sql`SELECT email, first_name, facebook, instagram, phone, website, coalesce(notes, '') AS notes FROM public.contacts WHERE owner_id = ${g.owner} AND id = ${i.contactId}::uuid` as Record<string, string | null>[];
    if (!before) return agentJson({ error: "No prospect with that contactId." }, 404);
    const empty = (v: string | null) => !v || !v.trim();
    if (i.phone && empty(before.phone)) {
      const ten = i.phone.replace(/\D/g, "");
      const [blocked] = await g.sql`SELECT 1 FROM public.contact_suppressions WHERE owner_id = ${g.owner} AND right(phone_normalized, 10) = ${ten} LIMIT 1` as unknown[];
      if (blocked) {
        await g.sql`UPDATE public.contacts SET status = 'duplicate', notes = concat_ws(E'\n', notes, 'Phone is on the do-not-contact list.'), updated_at = now() WHERE owner_id = ${g.owner} AND id = ${i.contactId}::uuid`;
        return agentJson({ filled: [], skipped: "That number is on Sam's do-not-contact list." });
      }
      const [other] = await g.sql`SELECT id, company FROM public.contacts WHERE owner_id = ${g.owner} AND id <> ${i.contactId}::uuid
        AND right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = ${ten} AND coalesce(status, '') <> 'duplicate' LIMIT 1` as { id: string; company: string }[];
      if (other) {
        const hire = String(before.notes ?? "").split("\n").filter(l => /^Lead grade: A · Hiring:|^Found by the hiring finder/.test(l)).join("\n");
        if (hire) await g.sql`UPDATE public.contacts SET notes = ${hire} || E'\n' || regexp_replace(coalesce(notes, ''), 'Lead grade: [ABC] · ?', ''), updated_at = now()
          WHERE owner_id = ${g.owner} AND id = ${other.id}::uuid AND coalesce(notes, '') NOT LIKE '%Hiring:%'`;
        await g.sql`UPDATE public.contacts SET status = 'duplicate', notes = concat_ws(E'\n', notes, ${`Same phone as ${other.company || "another contact"}; merged there.`}), updated_at = now() WHERE owner_id = ${g.owner} AND id = ${i.contactId}::uuid`;
        return agentJson({ filled: [], mergedInto: other.id });
      }
    }
    const filled = [
      i.phone && empty(before.phone) ? "phone" : "", i.website && empty(before.website) ? "website" : "",
      i.email && empty(before.email) ? "email" : "", first && empty(before.first_name) ? "owner" : "",
      i.facebook && empty(before.facebook) ? "facebook" : "", i.instagram && empty(before.instagram) ? "instagram" : "",
    ].filter(Boolean);
    if (!filled.length) return agentJson({ filled: [] });
    await g.sql`UPDATE public.contacts SET
        phone = CASE WHEN coalesce(trim(phone), '') = '' AND ${i.phone} <> '' THEN ${i.phone} ELSE phone END,
        website = CASE WHEN coalesce(trim(website), '') = '' AND ${i.website} <> '' THEN ${i.website} ELSE website END,
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
