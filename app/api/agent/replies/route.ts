import { parseReply } from "@/lib/agent-api";
import { agentGuard, agentJson } from "@/lib/agent-route";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", facebook_group: "a Facebook group", linkedin: "LinkedIn", email: "email", tiktok: "TikTok", other: "somewhere else" };

/** POST /api/agent/replies: a prospect replied where the command center can't see. Logged on their record, and Sam gets an email. */
export async function POST(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const parsed = parseReply(await request.json().catch(() => null));
  if ("error" in parsed) return agentJson({ error: parsed.error }, 400);
  const r = parsed.reply;
  try {
    let who = r.from;
    let logged = false;
    if (r.contactId) {
      const [c] = await g.sql`SELECT id, company, first_name FROM public.contacts WHERE owner_id = ${g.owner} AND id = ${r.contactId}::uuid` as { id: string; company: string; first_name: string }[];
      if (!c) return agentJson({ error: "No prospect with that contactId." }, 404);
      who = c.company || c.first_name || r.from;
      const note = `${LABEL[r.channel]} reply${r.from ? ` from ${r.from}` : ""} (found by Grok): ${r.text}${r.url ? `\n${r.url}` : ""}`;
      await g.sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes) VALUES (${g.owner}, ${r.contactId}::uuid, 'note', 'note', 'reply_received', ${note})`;
      await g.sql`UPDATE public.contacts SET updated_at = now() WHERE id = ${r.contactId}::uuid AND owner_id = ${g.owner}`;
      logged = true;
    }
    const alerted = await sendAlert({
      subject: `${who || "Someone"} replied on ${LABEL[r.channel]}`,
      lines: [`"${r.text.slice(0, 400)}"`, r.url ? `Conversation: ${r.url}` : "", logged ? "" : "They're not in the CRM yet. Add them if they're a real lead."].filter(Boolean),
      link: { label: logged ? "Open them" : "Open contacts", path: logged ? `/crm?contact=${r.contactId}` : "/crm" },
    });
    return agentJson({ logged, alerted }, 201);
  } catch (e) {
    console.error("Agent reply failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not log the reply." }, 500);
  }
}
