// Email finder run: checks contacts that have a website but no email, and saves the best address found.
// Shared by the Email page button, the overnight job and Autopilot.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { emailsIn, pickEmail, contactPages } from "@/lib/email-finder";
import { fetchPage as page } from "@/lib/website-text";

type Sql = NeonQueryFunction<false, false>;

export async function lookupEmail(website: string): Promise<string> {
  const base = /^https?:\/\//i.test(website) ? website : "https://" + website;
  const home = await page(base);
  if (!home) return "";
  let found = emailsIn(home), best = pickEmail(found, base);
  if (best) return best;
  for (const u of contactPages(home, base)) { found = [...found, ...emailsIn(await page(u))]; best = pickEmail(found, base); if (best) return best; }
  return "";
}

/** Checks up to `limit` sites, `batch` at a time, until the time budget runs out. */
export async function findEmails(sql: Sql, o: string, opts: { limit: number; batch?: number; budgetMs?: number }): Promise<{ checked: number; found: number; left: number }> {
  const started = Date.now(), batch = opts.batch ?? 10;
  const rows = await sql`SELECT c.id, c.website FROM public.contacts c WHERE c.owner_id = ${o} AND coalesce(c.email,'') = '' AND coalesce(c.website,'') <> '' AND c.email_lookup_at IS NULL
    ORDER BY c.created_at DESC LIMIT ${opts.limit}`;
  let checked = 0, found = 0;
  for (let i = 0; i < rows.length; i += batch) {
    if (opts.budgetMs && Date.now() - started > opts.budgetMs) break;
    const results = await Promise.all(rows.slice(i, i + batch).map(async row => ({ id: String(row.id), email: await lookupEmail(String(row.website)) })));
    for (const x of results) {
      checked++; if (x.email) found++;
      await sql`UPDATE public.contacts SET email = CASE WHEN coalesce(email,'') = '' AND ${x.email} <> '' THEN ${x.email} ELSE email END, email_lookup_at = now(), updated_at = now() WHERE id = ${x.id}::uuid AND owner_id = ${o}`;
    }
  }
  const [x] = await sql`SELECT count(*)::int AS left FROM public.contacts c WHERE c.owner_id = ${o} AND coalesce(c.email,'') = '' AND coalesce(c.website,'') <> '' AND c.email_lookup_at IS NULL`;
  return { checked, found, left: Number(x?.left ?? 0) };
}
