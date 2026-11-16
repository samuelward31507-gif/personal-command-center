import type { NeonQueryFunction } from "@neondatabase/serverless";
import { claudeText } from "@/lib/ai-text";
import { loadMyDay } from "@/lib/my-day-data";
import type { QueueItem } from "@/lib/my-day";

type Sql = NeonQueryFunction<false, false>;

/**
 * The overnight brief and the follow-up finder.
 *
 * Follow-up finder: people who went quiet after you showed interest (a text with no answer, a meeting with
 * nothing after it, a proposal sitting). Each gets a short text drafted in the owner's voice, waiting on Today.
 * Brief: three or four sentences on what matters today, and who to call first and why, written from facts
 * pulled here so every line can be traced. Nothing is ever sent from here.
 */

export const WARM_OUTCOMES = ["interested", "connected", "callback_requested", "send_info", "meeting_booked"];
export const DEAD_OUTCOMES = ["not_interested", "not_a_fit", "wrong_number", "do_not_contact"];

export type Candidate = { contactId: string; pattern: "no_reply" | "after_meeting" | "proposal_quiet"; company: string; firstName: string; days: number; context: string };
export type BriefCall = { contactId: string; reason: string };

const who = (company: string, first: string) => company || first || "this prospect";
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** People worth a follow-up text today. Warm only, never anyone who said no, never twice for the same reason. */
export async function findFollowUps(sql: Sql, owner: string): Promise<Candidate[]> {
  const noReply = await sql`
    WITH last AS (
      SELECT DISTINCT ON (contact_id) contact_id, action, occurred_at, notes FROM public.contact_activities
      WHERE owner_id = ${owner} AND channel IN ('text', 'call') AND outcome <> 'initiated'
      ORDER BY contact_id, occurred_at DESC)
    SELECT l.contact_id, l.occurred_at, l.notes, c.company, c.first_name FROM last l JOIN public.contacts c ON c.id = l.contact_id
    WHERE l.action = 'outbound_text' AND l.occurred_at < now() - interval '2 days' AND l.occurred_at > now() - interval '14 days'
      AND coalesce(c.phone, '') <> ''
      AND EXISTS (SELECT 1 FROM public.contact_activities w WHERE w.contact_id = l.contact_id AND w.outcome = ANY(${WARM_OUTCOMES}))
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities x WHERE x.contact_id = l.contact_id AND x.outcome = ANY(${DEAD_OUTCOMES}))
      AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.contact_id = l.contact_id AND d.stage IN ('won', 'lost'))
    ORDER BY l.occurred_at DESC LIMIT 12`;
  const afterMeeting = await sql`
    SELECT e.contact_id, e.ends_at, e.title, c.company, c.first_name FROM public.calendar_events e JOIN public.contacts c ON c.id = e.contact_id
    WHERE e.owner_id = ${owner} AND e.status <> 'cancelled' AND e.ends_at < now() - interval '2 days' AND e.ends_at > now() - interval '10 days'
      AND coalesce(c.phone, '') <> ''
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.contact_id = e.contact_id AND a.occurred_at > e.ends_at AND a.outcome <> 'initiated')
      AND NOT EXISTS (SELECT 1 FROM public.calendar_events f WHERE f.contact_id = e.contact_id AND f.starts_at > now() AND f.status <> 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.contact_id = e.contact_id AND d.stage IN ('won', 'lost'))
    ORDER BY e.ends_at DESC LIMIT 8`;
  const proposals = await sql`
    SELECT d.contact_id, d.proposal_sent_at, d.title, c.company, c.first_name FROM public.deals d JOIN public.contacts c ON c.id = d.contact_id
    WHERE d.owner_id = ${owner} AND d.proposal_sent_at < now() - interval '2 days' AND d.proposal_sent_at > now() - interval '21 days'
      AND d.proposal_decided_at IS NULL AND d.stage NOT IN ('won', 'lost') AND coalesce(c.phone, '') <> ''
      AND NOT EXISTS (SELECT 1 FROM public.contact_activities a WHERE a.contact_id = d.contact_id AND a.occurred_at > now() - interval '2 days' AND a.outcome <> 'initiated')
    ORDER BY d.proposal_sent_at DESC LIMIT 8`;

  const out = new Map<string, Candidate>();
  for (const r of proposals) out.set(String(r.contact_id), { contactId: String(r.contact_id), pattern: "proposal_quiet", company: String(r.company ?? ""), firstName: String(r.first_name ?? ""), days: daysAgo(String(r.proposal_sent_at)), context: `Proposal "${String(r.title ?? "").slice(0, 80)}" sent ${daysAgo(String(r.proposal_sent_at))} days ago, no decision yet.` });
  for (const r of afterMeeting) if (!out.has(String(r.contact_id))) out.set(String(r.contact_id), { contactId: String(r.contact_id), pattern: "after_meeting", company: String(r.company ?? ""), firstName: String(r.first_name ?? ""), days: daysAgo(String(r.ends_at)), context: `Had "${String(r.title ?? "a meeting").slice(0, 80)}" ${daysAgo(String(r.ends_at))} days ago; nothing logged since.` });
  for (const r of noReply) if (!out.has(String(r.contact_id))) out.set(String(r.contact_id), { contactId: String(r.contact_id), pattern: "no_reply", company: String(r.company ?? ""), firstName: String(r.first_name ?? ""), days: daysAgo(String(r.occurred_at)), context: `Last text ${daysAgo(String(r.occurred_at))} days ago got no reply: "${String(r.notes ?? "").slice(0, 280)}"` });
  return [...out.values()];
}

export const REASON: Record<Candidate["pattern"], (c: Candidate) => string> = {
  no_reply: c => `No reply in ${c.days} days`,
  after_meeting: c => `Quiet ${c.days} days after your meeting`,
  proposal_quiet: c => `Proposal sitting ${c.days} days`,
};

const DRAFT_SYSTEM = `You write short follow-up text messages for a founder who sells speed-to-lead and follow-up systems to contractors and home-service businesses. Each text: one or two sentences, under 240 characters, plain and human, no emojis, no links, no exclamation marks, no pressure, no made-up facts, never mention AI. Refer only to what the context says. End with an easy question. Sign off exactly as instructed.
Return only JSON: {"drafts":[{"contactId":"...","text":"..."}]}`;

/** One Claude call drafts every follow-up. Anything that comes back malformed is dropped, never guessed. */
export async function draftFollowUps(apiKey: string, cands: Candidate[], signOff: string): Promise<Map<string, string>> {
  if (!cands.length) return new Map();
  const user = `Sign off as: "${signOff}" (only on the first text to someone; these are follow-ups, so no sign-off is needed unless it reads naturally).\n\n` +
    cands.map(c => JSON.stringify({ contactId: c.contactId, firstName: c.firstName && c.firstName !== c.company ? c.firstName : "", company: c.company, situation: c.context })).join("\n");
  const raw = await claudeText({ apiKey, system: DRAFT_SYSTEM, user, label: "Follow-up drafts", maxTokens: 4000, timeoutMs: 90_000 });
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const map = new Map<string, string>();
  try {
    for (const d of (JSON.parse(json).drafts ?? []) as { contactId?: string; text?: string }[]) {
      if (d.contactId && typeof d.text === "string" && d.text.trim() && cands.some(c => c.contactId === d.contactId)) map.set(d.contactId, d.text.trim().slice(0, 480));
    }
  } catch { /* nothing usable */ }
  return map;
}

/** Facts for the brief, gathered once so the brief and its "based on" record match. */
export async function gatherFacts(sql: Sql, owner: string, tz: string) {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = fmt(new Date());
  const dayEnd = new Date(Date.now() + 86_400_000).toISOString();
  const windowEnd = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const [calls, meetings, proposals, stale, queue] = await Promise.all([
    sql`SELECT outcome, count(*)::int AS n FROM public.contact_activities WHERE owner_id = ${owner} AND action = 'outbound_call' AND outcome <> 'initiated' AND occurred_at > now() - interval '24 hours' GROUP BY outcome`,
    sql`SELECT e.title, e.starts_at, e.contact_id, c.company, c.first_name FROM public.calendar_events e LEFT JOIN public.contacts c ON c.id = e.contact_id
        WHERE e.owner_id = ${owner} AND e.status <> 'cancelled' AND e.starts_at > now() AND e.starts_at < now() + interval '30 hours' ORDER BY e.starts_at LIMIT 6`,
    sql`SELECT d.title, d.proposal_sent_at, d.contact_id, c.company FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id
        WHERE d.owner_id = ${owner} AND d.proposal_sent_at IS NOT NULL AND d.proposal_decided_at IS NULL AND d.stage NOT IN ('won', 'lost') ORDER BY d.proposal_sent_at LIMIT 6`,
    sql`SELECT d.title, d.stage, d.updated_at, d.contact_id, c.company FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id
        WHERE d.owner_id = ${owner} AND d.stage NOT IN ('won', 'lost', 'nurture') AND d.updated_at < now() - interval '10 days' ORDER BY d.updated_at LIMIT 5`,
    loadMyDay(sql, owner, today, dayEnd, windowEnd).then(r => r.items).catch((): QueueItem[] => []),
  ]);
  const name = (r: Record<string, unknown>) => String(r.company || r.first_name || r.title || "");
  return {
    today,
    callsLast24h: Object.fromEntries(calls.map(r => [String(r.outcome), Number(r.n)])),
    meetingsNext30h: meetings.map(r => ({ contactId: r.contact_id ? String(r.contact_id) : null, name: name(r), title: String(r.title ?? ""), startsAt: new Date(String(r.starts_at)).toISOString() })),
    openProposals: proposals.map(r => ({ contactId: r.contact_id ? String(r.contact_id) : null, name: name(r), daysSinceSent: daysAgo(String(r.proposal_sent_at)) })),
    staleDeals: stale.map(r => ({ contactId: r.contact_id ? String(r.contact_id) : null, name: name(r), stage: String(r.stage), daysQuiet: daysAgo(String(r.updated_at)) })),
    callQueue: queue.filter(i => i.callable && i.contact).slice(0, 10).map(i => ({ contactId: i.contact!.id, name: i.contact!.company || i.contact!.name, why: i.why, status: i.status })),
  };
}
export type BriefFacts = Awaited<ReturnType<typeof gatherFacts>>;

const BRIEF_SYSTEM = `You are the chief of staff for a solo founder who cold-calls contractors to sell speed-to-lead and follow-up systems. Write his morning brief from the JSON facts only. Never invent people, numbers or events.
Rules: 3 or 4 short sentences, plain and direct, no greeting, no exclamation marks, no emojis, no hype. Lead with the single most important thing today. When you name a person or company that has a contactId, write it as [[contactId|Name]]. Mention follow-up drafts waiting if draftsWaiting > 0. If there is nothing notable, say so in one sentence and point him at the first call.
Then pick who to call first: at most 8 people from callQueue, meetings or proposals, best first, each with a reason under 70 characters grounded in the facts.
Return only JSON: {"brief":"...","calls":[{"contactId":"...","reason":"..."}]}`;

export async function writeBrief(apiKey: string, facts: BriefFacts & { draftsWaiting: number }, firstName: string): Promise<{ brief: string; calls: BriefCall[] }> {
  const raw = await claudeText({ apiKey, system: BRIEF_SYSTEM, user: `Founder's first name: ${firstName}\n\n${JSON.stringify(facts)}`, label: "Daily brief", maxTokens: 4000, timeoutMs: 90_000 });
  const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { brief?: string; calls?: BriefCall[] };
  const known = new Set<string>([...facts.callQueue.map(c => c.contactId), ...facts.meetingsNext30h.map(m => m.contactId), ...facts.openProposals.map(p => p.contactId), ...facts.staleDeals.map(s => s.contactId)].filter(Boolean) as string[]);
  // People the model names must exist in the facts; anyone else is shown as plain text.
  const brief = String(parsed.brief ?? "").replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (m, id: string, n: string) => (known.has(id) ? m : n)).slice(0, 900);
  const calls = (Array.isArray(parsed.calls) ? parsed.calls : []).filter(c => c && known.has(String(c.contactId))).slice(0, 8).map(c => ({ contactId: String(c.contactId), reason: String(c.reason ?? "").slice(0, 90) }));
  return { brief, calls };
}

/** The whole overnight job: find and draft follow-ups, then write and save the brief. */
export async function runBrief(opts: { sql: Sql; owner: string; apiKey: string; tz: string; firstName: string; signOff: string }) {
  const { sql, owner, apiKey, tz } = opts;
  await sql`UPDATE public.follow_up_drafts SET status = 'expired' WHERE owner_id = ${owner} AND status = 'ready' AND created_at < now() - interval '5 days'`;
  const cands = await findFollowUps(sql, owner);
  const open = await sql`SELECT contact_id FROM public.follow_up_drafts WHERE owner_id = ${owner} AND (status = 'ready' OR (status = 'skipped' AND snooze_until > now()) OR (status = 'sent' AND acted_at > now() - interval '3 days'))`;
  const skip = new Set(open.map(r => String(r.contact_id)));
  const fresh = cands.filter(c => !skip.has(c.contactId));
  let drafted = 0;
  if (fresh.length) {
    const bodies = await draftFollowUps(apiKey, fresh, opts.signOff).catch(e => { console.error("Follow-up drafting failed", e instanceof Error ? e.message : e); return new Map<string, string>(); });
    for (const c of fresh) {
      const body = bodies.get(c.contactId);
      if (!body) continue;
      await sql`INSERT INTO public.follow_up_drafts (owner_id, contact_id, pattern, reason, body) VALUES (${owner}, ${c.contactId}::uuid, ${c.pattern}, ${REASON[c.pattern](c)}, ${body}) ON CONFLICT DO NOTHING`;
      drafted++;
    }
  }
  const waiting = await sql`SELECT count(*)::int AS n FROM public.follow_up_drafts WHERE owner_id = ${owner} AND status = 'ready'`;
  const facts = await gatherFacts(sql, owner, tz);
  const { brief, calls } = await writeBrief(apiKey, { ...facts, draftsWaiting: Number(waiting[0]?.n ?? 0) }, opts.firstName);
  await sql`INSERT INTO public.daily_briefs (owner_id, day, brief, calls, facts, generated_at) VALUES (${owner}, ${facts.today}::date, ${brief}, ${JSON.stringify(calls)}::jsonb, ${JSON.stringify(facts)}::jsonb, now())
    ON CONFLICT (owner_id, day) DO UPDATE SET brief = EXCLUDED.brief, calls = EXCLUDED.calls, facts = EXCLUDED.facts, generated_at = now()`;
  return { day: facts.today, candidates: cands.length, drafted, waiting: Number(waiting[0]?.n ?? 0), briefChars: brief.length, calls: calls.length };
}
