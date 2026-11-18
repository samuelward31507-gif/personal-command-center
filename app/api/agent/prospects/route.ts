import { parseProspects } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/prospects: businesses Grok found on public listings, added as leads the same way the Google Maps
 * lead finder adds them. Anyone already in the CRM (by the last 10 digits of their phone) or on the do-not-contact
 * list is skipped.
 */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseProspects(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  try {
    const have = await g.sql`SELECT right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) AS p FROM public.contacts WHERE owner_id = ${g.owner} AND coalesce(phone, '') <> ''
      UNION SELECT right(phone_normalized, 10) FROM public.contact_suppressions WHERE owner_id = ${g.owner} AND coalesce(phone_normalized, '') <> ''` as { p: string }[];
    const known = new Set(have.map(r => r.p));
    let added = 0, duplicates = 0;
    for (const p of parsed.prospects) {
      const ten = p.phone.replace(/\D/g, "");
      if (known.has(ten)) { duplicates++; continue; }
      const [first, ...rest] = p.owner.split(/\s+/);
      const notes = ["Found by Grok", p.notes, p.source ? `Listing: ${p.source}` : ""].filter(Boolean).join("\n");
      await g.sql`INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, website, location)
        VALUES (${g.owner}, ${first ?? ""}, ${rest.join(" ")}, ${p.business}, '', ${p.phone}, 'lead', 'Grok', ${notes}, ${p.website}, ${p.location})`;
      known.add(ten); added++;
    }
    return agentJson({ added, duplicates, rejected: parsed.rejected }, 201);
  } catch (e) {
    console.error("Agent prospects failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not add the prospects." }, 500);
  }
}
