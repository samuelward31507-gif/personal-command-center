import { AGENT_AUTHOR, parseDraft } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/drafts: a text or email for Sam to review and send himself. It waits with the follow-up drafts
 * on Today, marked as written by the agent. Nothing is sent from here. One open agent draft per prospect; a new one
 * replaces it. Refused for anyone on the do-not-contact list.
 */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseDraft(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const d = parsed.draft;
  try {
    const [c] = await g.sql`SELECT c.id,
        EXISTS (SELECT 1 FROM public.contact_suppressions s WHERE s.owner_id = c.owner_id AND (s.contact_id = c.id
          OR (s.phone_normalized <> '' AND s.phone_normalized = regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'))
          OR (s.email_normalized <> '' AND s.email_normalized = lower(trim(coalesce(c.email, '')))))) AS suppressed
      FROM public.contacts c WHERE c.owner_id = ${g.owner} AND c.id = ${d.contactId}::uuid` as { id: string; suppressed: boolean }[];
    if (!c) return agentJson({ error: "No prospect with that contactId." }, 404);
    if (c.suppressed) return agentJson({ error: "This prospect asked not to be contacted. No draft saved." }, 409);
    const [row] = await g.sql`INSERT INTO public.follow_up_drafts (owner_id, contact_id, pattern, reason, body, channel, subject, author)
      VALUES (${g.owner}, ${d.contactId}::uuid, 'agent', ${d.reason}, ${d.body}, ${d.channel}, ${d.subject}, ${AGENT_AUTHOR})
      ON CONFLICT (owner_id, contact_id, pattern) WHERE status = 'ready'
      DO UPDATE SET reason = EXCLUDED.reason, body = EXCLUDED.body, channel = EXCLUDED.channel, subject = EXCLUDED.subject, created_at = now()
      RETURNING id` as { id: string }[];
    return agentJson({ id: String(row.id) }, 201);
  } catch (e) {
    console.error("Agent draft failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not save the draft." }, 500);
  }
}
