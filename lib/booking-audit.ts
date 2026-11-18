// When a prospect books a meeting on Cal.com, run the in-depth business audit right away, so the meeting opens with
// research instead of guesses. Replaces the overnight audits of everyone on the call list (most went unread).
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { DEFAULT_AUDIT_MODEL, normalizeWebsite } from "@/lib/business-audit";
import { researchAndSave } from "@/lib/audit-engine";
import { isPlaceholder } from "@/lib/contact-import";
import { sendAlert } from "@/lib/notify";

type Sql = NeonQueryFunction<false, false>;

export async function auditOnBooking(sql: Sql, owner: string, contactId: string, dealId: string | null, when: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;
  // One audit per prospect a week is plenty: a reschedule or a second booking doesn't pay twice.
  const fresh = await sql`SELECT 1 FROM public.research_artifacts WHERE owner_id = ${owner} AND contact_id = ${contactId}::uuid
    AND artifact_type IN ('audit_prep', 'business_audit') AND status <> 'archived' AND created_at > now() - interval '7 days' LIMIT 1`;
  if (fresh.length) return;
  const [c] = await sql`SELECT company, first_name, last_name, website, location, notes FROM public.contacts WHERE owner_id = ${owner} AND id = ${contactId}::uuid`;
  if (!c) return;
  const company = String(c.company || [c.first_name, c.last_name].filter(Boolean).join(" ")).slice(0, 200);
  if (!company) return;
  const site = normalizeWebsite(String(c.website ?? "").slice(0, 2000));
  const r = await researchAndSave({
    sql, ownerId: owner, apiKey, model: process.env.CINDER_AUDIT_MODEL?.trim() || DEFAULT_AUDIT_MODEL, companyName: company,
    website: site && !("error" in site) ? site.url : null, location: isPlaceholder(c.location) ? "" : String(c.location ?? "").slice(0, 300),
    context: ["They just booked a 15-minute sales meeting with the founder. Go deep: how leads reach them, how fast they answer, reviews (especially complaints about slow replies or no callback), ads they run, and the one problem to show them in the demo.",
      c.notes ? `CRM notes from the cold call: ${String(c.notes).slice(0, 1500)}` : ""].filter(Boolean).join("\n"),
    contactId, dealId, deadline: Date.now() + 240_000,
  });
  if (r.ok) await sendAlert({ subject: `Audit ready: ${company}`, lines: [`Your meeting with ${company} (${when}) has its research ready.`], link: { label: "Open it", path: dealId ? `/crm/deals/${dealId}` : `/crm/call?contact=${contactId}` } });
}
