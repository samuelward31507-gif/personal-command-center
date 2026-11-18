import { AGENT_AUTHOR, briefMarkdown, parseBrief } from "@/lib/agent-api";
import { agentGuard, agentJson, dayRange, todayIn } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/brief: a research brief on a prospect or a meeting. Saved as a draft (unreviewed), marked as
 * written by the agent, with verified facts kept apart from guesses. One per prospect, type and meeting per day:
 * a second brief the same day replaces the first instead of piling up.
 */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const today = todayIn();
  const parsed = parseBrief(await request.json().catch(() => null), today);
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const b = parsed.brief;
  try {
    const [c] = await g.sql`SELECT id FROM public.contacts WHERE owner_id = ${g.owner} AND id = ${b.contactId}::uuid` as unknown[];
    if (!c) return agentJson({ error: "No prospect with that contactId." }, 404);
    if (b.calendarEventId) {
      const [e] = await g.sql`SELECT id FROM public.calendar_events WHERE owner_id = ${g.owner} AND id = ${b.calendarEventId}::uuid` as unknown[];
      if (!e) return agentJson({ error: "No meeting with that calendarEventId." }, 404);
    }
    const content = briefMarkdown(b);
    const sources = JSON.stringify([...new Set(b.facts.map(f => f.source))]);
    const facts = JSON.stringify(b.facts);
    const guesses = JSON.stringify(b.guesses);
    const { start } = dayRange(today);
    const [existing] = await g.sql`SELECT id FROM public.research_artifacts
      WHERE owner_id = ${g.owner} AND contact_id = ${b.contactId}::uuid AND artifact_type = ${b.type} AND author = ${AGENT_AUTHOR}
        AND calendar_event_id IS NOT DISTINCT FROM ${b.calendarEventId}::uuid AND status = 'draft' AND created_at >= ${start}::timestamptz
      ORDER BY created_at DESC LIMIT 1` as { id: string }[];
    if (existing) {
      await g.sql`UPDATE public.research_artifacts SET title = ${b.title}, content = ${content}, source_urls = ${sources}::jsonb, verified_facts = ${facts}::jsonb,
        hypotheses = ${guesses}::jsonb, confidence = ${b.confidence}, researched_at = now(), updated_at = now() WHERE id = ${existing.id}::uuid AND owner_id = ${g.owner}`;
      return agentJson({ id: String(existing.id), replaced: true, movedToGuesses: parsed.moved });
    }
    const [row] = await g.sql`INSERT INTO public.research_artifacts
        (owner_id, contact_id, calendar_event_id, artifact_type, title, source_urls, verified_facts, hypotheses, confidence, content, status, researched_at, author)
      VALUES (${g.owner}, ${b.contactId}::uuid, ${b.calendarEventId}::uuid, ${b.type}, ${b.title}, ${sources}::jsonb, ${facts}::jsonb, ${guesses}::jsonb,
        ${b.confidence}, ${content}, 'draft', now(), ${AGENT_AUTHOR})
      RETURNING id` as { id: string }[];
    return agentJson({ id: String(row.id), replaced: false, movedToGuesses: parsed.moved }, 201);
  } catch (e) {
    console.error("Agent brief failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not save the brief." }, 500);
  }
}
