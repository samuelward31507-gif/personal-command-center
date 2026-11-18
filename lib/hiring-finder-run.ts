// Hiring finder, I/O: Adzuna job search → phone-role jobs at home-service companies → matched to the company's
// Google Maps listing (for the phone number) → grade-A leads in Contacts. Needs ADZUNA_APP_ID + ADZUNA_APP_KEY
// (free at developer.adzuna.com). With GOOGLE_PLACES_KEY the phone comes from Google Maps; without it the lead is
// saved with no phone and Grok fills it in (get_needs_phone → save_contact_info). No AI calls here.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { HIRING_NICHE_TRADES, HIRING_OTHER_TRADES, PHONE_ROLES, companyKey, hiringNote, pickJobs, sameCompany, type HiringLead, type Job } from "@/lib/hiring-finder";
import { cityState } from "@/lib/lead-finder";
import { placesConfigured, searchPlaces } from "@/lib/lead-finder-run";

type Sql = NeonQueryFunction<false, false>;
export const hiringConfigured = () => !!(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim());
const NICHE: Record<string, string> = { fence: "Fence", generators: "Standby generators", other: "" };

async function adzuna(trade: string, page = 1): Promise<Job[]> {
  const q = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!.trim(), app_key: process.env.ADZUNA_APP_KEY!.trim(),
    what: trade, what_or: PHONE_ROLES.replace(/"/g, ""), max_days_old: "21", results_per_page: "50", sort_by: "date", "content-type": "application/json",
  });
  const r = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/${page}?${q}`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Adzuna returned ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return (j.results ?? []) as Job[];
}

/** The employer's Google listing: searched by name and city, accepted only if the names really match. */
async function findListing(l: HiringLead) {
  const { places } = await searchPlaces(`${l.company} ${l.location}`.trim());
  return places.find(p => sameCompany(l.company, p.displayName?.text ?? "") && (p.nationalPhoneNumber || p.internationalPhoneNumber)) ?? null;
}

/**
 * Nightly: search each trade for phone-role jobs posted in the last 3 weeks, add new employers as grade-A leads,
 * and upgrade employers already in Contacts (by phone) to grade A with the job attached. Skips the do-not-contact list.
 */
export async function findHiring(sql: Sql, owner: string, opts: { maxLookups?: number; budgetMs?: number; enough?: number } = {}): Promise<{ jobs: number; matched: number; added: number; upgraded: number; noListing: number; needsPhone: number; widened: boolean } | null> {
  if (!hiringConfigured()) return null;
  const until = Date.now() + (opts.budgetMs ?? 60_000), maxLookups = opts.maxLookups ?? 15, enough = opts.enough ?? 10;
  const have = await sql`SELECT id, company, right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) AS p, coalesce(notes, '') AS notes FROM public.contacts WHERE owner_id = ${owner}` as { id: string; company: string; p: string; notes: string }[];
  const blocked = new Set((await sql`SELECT right(phone_normalized, 10) AS p FROM public.contact_suppressions WHERE owner_id = ${owner} AND coalesce(phone_normalized, '') <> ''` as { p: string }[]).map(r => r.p));
  const byPhone = new Map(have.filter(h => h.p).map(h => [h.p, h]));
  const knownJobs = new Set(have.flatMap(h => [...h.notes.matchAll(/Hiring:[^\n]*?(https?:\/\/\S+)/g)].map(m => m[1])));
  const knownNames = new Set(have.filter(h => /Hiring:/.test(h.notes)).map(h => companyKey(h.company)));
  const t = { jobs: 0, matched: 0, added: 0, upgraded: 0, noListing: 0, needsPhone: 0, widened: false };
  const usePlaces = placesConfigured();
  let lookups = 0;

  async function pass(trades: string[], only?: (l: HiringLead) => boolean) {
    const jobs: Job[] = [];
    for (const trade of trades) {
      if (Date.now() > until) break;
      jobs.push(...await adzuna(trade).catch(e => { console.error("Adzuna search failed", trade, e instanceof Error ? e.message : e); return []; }));
    }
    t.jobs += jobs.length;
    for (const l of pickJobs(jobs).filter(l => !only || only(l))) {
      if (knownJobs.has(l.url) || knownNames.has(companyKey(l.company))) continue;
      if ((usePlaces && lookups >= maxLookups) || Date.now() > until || t.added >= 40) break;
      knownNames.add(companyKey(l.company));
      if (!usePlaces) {
        // No Google key: save it without a phone. It stays off the call list until Grok finds the number.
        try {
          await sql`INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, website, location, niche)
            VALUES (${owner}, '', '', ${l.company}, '', '', 'lead', 'Hiring finder', ${hiringNote(l) + "\nNeeds a phone number (Grok looks it up)."}, '', ${l.location}, ${NICHE[l.trade] ?? ""})`;
          t.added++; t.needsPhone++;
        } catch (e) { console.error("Hiring lead insert failed", e instanceof Error ? e.message : e); }
        continue;
      }
      lookups++;
      const place = await findListing(l).catch(() => null);
      if (!place) { t.noListing++; continue; }
      const digits = (place.nationalPhoneNumber || place.internationalPhoneNumber || "").replace(/\D/g, "").slice(-10);
      if (digits.length !== 10 || blocked.has(digits)) continue;
      t.matched++;
      const note = hiringNote(l), existing = byPhone.get(digits);
      if (existing) {
        if (/Hiring:/.test(existing.notes)) continue;
        await sql`UPDATE public.contacts SET notes = ${note} || E'\n' || regexp_replace(coalesce(notes, ''), 'Lead grade: [ABC] · ?', ''), updated_at = now() WHERE id = ${existing.id}`;
        t.upgraded++; continue;
      }
      const phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      const rating = place.rating ? `\n${place.rating}★ from ${place.userRatingCount ?? 0} reviews on Google` : "";
      try {
        await sql`INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, website, location, niche)
          VALUES (${owner}, '', '', ${(place.displayName?.text || l.company).slice(0, 120)}, '', ${phone}, 'lead', 'Hiring finder', ${note + rating},
            ${(place.websiteUri || "").slice(0, 300)}, ${cityState(place.formattedAddress || "") || l.location}, ${NICHE[l.trade] ?? ""})`;
        byPhone.set(digits, { id: "", company: l.company, p: digits, notes: note }); t.added++;
      } catch (e) { console.error("Hiring lead insert failed", e instanceof Error ? e.message : e); }
    }
  }

  // Fence and generator companies first. Only when they give fewer than `enough` new leads, widen to the other trades.
  await pass(HIRING_NICHE_TRADES, l => l.trade !== "other");
  if (t.added + t.upgraded < enough && Date.now() < until) { t.widened = true; await pass(HIRING_OTHER_TRADES); }
  return t;
}
