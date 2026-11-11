// Lead finder, I/O: Google Places (New) text search → scored leads → Contacts. Needs GOOGLE_PLACES_KEY
// (Places API (New) enabled on the same Google Cloud project as Gmail). Each page is one search call
// and returns up to 20 businesses.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { noteFor, pickLeads, type Lead, type Place } from "@/lib/lead-finder";

type Sql = NeonQueryFunction<false, false>;
const FIELDS = "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,nextPageToken";
export const placesConfigured = () => !!process.env.GOOGLE_PLACES_KEY?.trim();

export async function searchPlaces(query: string, pageToken = ""): Promise<{ places: Place[]; next: string }> {
  const key = process.env.GOOGLE_PLACES_KEY?.trim();
  if (!key) throw new Error("Add GOOGLE_PLACES_KEY in Vercel to search Google Maps.");
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({ textQuery: query, pageSize: 20, regionCode: "US", ...(pageToken ? { pageToken } : {}) }), signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(j?.error?.message ?? `Google returned ${r.status}`).slice(0, 200));
  return { places: (j.places ?? []) as Place[], next: String(j.nextPageToken ?? "") };
}

async function existingPhones(sql: Sql, o: string): Promise<Set<string>> {
  const rows = await sql`SELECT phone FROM public.contacts WHERE owner_id = ${o} AND coalesce(phone,'') <> ''` as { phone: string }[];
  return new Set(rows.map(r => r.phone.replace(/\D/g, "").slice(-10)));
}

export async function addLeads(sql: Sql, o: string, leads: Lead[], trade: string): Promise<number> {
  let added = 0;
  for (const l of leads) {
    try {
      await sql`INSERT INTO public.contacts (owner_id, first_name, last_name, company, email, phone, status, source, notes, website, location)
        VALUES (${o}, '', '', ${l.company}, '', ${l.phone}, 'lead', 'Google Maps', ${noteFor(l, trade)}, ${l.website}, ${l.location})`;
      added++;
    } catch (e) { console.error("Lead insert failed", e instanceof Error ? e.message : e); }
  }
  return added;
}

/** One saved search, a few pages further: finds, scores, dedupes and adds leads. */
export async function runSearch(sql: Sql, o: string, id: string, pages = 3): Promise<{ found: number; added: number; done: boolean }> {
  const [s] = await sql`SELECT trade, city, page_token, pages FROM public.lead_searches WHERE id = ${id}::uuid AND owner_id = ${o}` as { trade: string; city: string; page_token: string; pages: number }[];
  if (!s) throw new Error("Unknown search.");
  const have = await existingPhones(sql, o);
  let token = s.page_token, found = 0, added = 0, done = false;
  for (let i = 0; i < pages; i++) {
    if (s.pages > 0 && !token) { done = true; break; }
    const r = await searchPlaces(`${s.trade} in ${s.city}`, token);
    found += r.places.length;
    const leads = pickLeads(r.places, have);
    leads.forEach(l => have.add(l.phone.replace(/\D/g, "").slice(-10)));
    added += await addLeads(sql, o, leads, s.trade);
    token = r.next; s.pages++;
    if (!token) { done = true; break; }
  }
  await sql`UPDATE public.lead_searches SET page_token = ${token}, pages = ${s.pages}, found = found + ${found}, added = added + ${added},
    status = ${done ? "done" : "queued"}, last_run_at = now() WHERE id = ${id}::uuid`;
  return { found, added, done };
}

/** Never run out of people to call: when fewer than `floor` fresh leads are waiting, run queued searches until it's full. */
export async function refillLeads(sql: Sql, o: string, floor = Number(process.env.CINDER_LEAD_FLOOR) || 150): Promise<{ waiting: number; added: number; ran: number } | null> {
  if (!placesConfigured()) return null;
  const [w] = await sql`SELECT count(*)::int AS n FROM public.contacts c WHERE c.owner_id = ${o} AND lower(coalesce(c.status,'')) = 'lead'
    AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.contact_id = c.id AND a.channel = 'call')` as { n: number }[];
  let waiting = w?.n ?? 0, added = 0, ran = 0;
  const queue = await sql`SELECT id FROM public.lead_searches WHERE owner_id = ${o} AND status = 'queued' ORDER BY last_run_at NULLS FIRST, created_at LIMIT 8` as { id: string }[];
  for (const q of queue) {
    if (waiting >= floor) break;
    const r = await runSearch(sql, o, q.id, 3).catch(e => { console.error("Lead refill search failed", e instanceof Error ? e.message : e); return null; });
    if (!r) break;
    ran++; added += r.added; waiting += r.added;
  }
  return { waiting, added, ran };
}
