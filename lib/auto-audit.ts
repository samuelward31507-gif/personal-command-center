// Free audit link: a private report page built from what a prospect's homepage shows, made once per contact.
// Used by the follow-up email so the second touch carries something useful, not just another ask.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { fetchPage } from "@/lib/website-text";
import { readSite, autoFindings } from "@/lib/site-check";
export { withAuditLine } from "@/lib/site-check";
import { TRADE_DEFAULTS } from "@/lib/prospect-report";
import { newSigningToken } from "@/lib/esign";

type Sql = NeonQueryFunction<false, false>;
const appUrl = () => process.env.CINDER_APP_URL?.trim() || "https://personal-command-center-ten-ruby.vercel.app";

export async function auditLinkFor(sql: Sql, o: string, c: { id: string; company: string; name?: string; website?: string | null; niche?: string | null }): Promise<string | null> {
  const [have] = await sql`SELECT token FROM public.prospect_reports WHERE owner_id = ${o} AND contact_id = ${c.id}::uuid ORDER BY created_at DESC LIMIT 1` as { token: string }[];
  if (have) return `${appUrl()}/report/${have.token}`;
  const site = (c.website ?? "").trim();
  if (!site) return null;
  const url = /^https?:\/\//i.test(site) ? site : "https://" + site;
  const t = Date.now();
  const html = await fetchPage(url, 8000);
  const findings = autoFindings(readSite(html, url, html ? Date.now() - t : null), new Date().getFullYear());
  if (!findings.length) return null;
  const trade = /fenc/i.test(c.niche ?? "") ? "fence" : /pool/i.test(c.niche ?? "") ? "pool" : "other";
  const inputs = { ...TRADE_DEFAULTS[trade], speed: "day", followsUp: false };
  const company = (c.company || c.name || "Your business").slice(0, 160);
  const [r] = await sql`INSERT INTO public.prospect_reports (owner_id, contact_id, token, company, trade, inputs, findings, note)
    VALUES (${o}, ${c.id}::uuid, ${newSigningToken()}, ${company}, ${trade}, ${JSON.stringify(inputs)}::jsonb, ${JSON.stringify(findings)}::jsonb, '')
    RETURNING token` as { token: string }[];
  await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
    VALUES (${o}, ${c.id}::uuid, 'note', 'note', 'other', ${`Made a free audit for ${company} (${findings.length} findings).`})`;
  return `${appUrl()}/report/${r.token}`;
}
