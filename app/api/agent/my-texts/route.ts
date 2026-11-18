import { agentGuard, agentJson } from "@/lib/agent-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/my-texts?limit=50: Sam's own recent texts to prospects, for his style profile. Text and date only. */
export async function GET(request: Request) {
  const g = await agentGuard(request);
  if (g instanceof Response) return g;
  const limit = Math.min(100, Math.max(5, Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "50", 10) || 50));
  try {
    const rows = await g.sql`SELECT notes, occurred_at FROM public.contact_activities
      WHERE owner_id = ${g.owner} AND action = 'outbound_text' AND coalesce(notes, '') <> ''
      ORDER BY occurred_at DESC LIMIT ${limit}` as { notes: string; occurred_at: string }[];
    return agentJson({ texts: rows.map(r => ({ text: String(r.notes).slice(0, 1000), at: new Date(String(r.occurred_at)).toISOString() })) });
  } catch (e) {
    console.error("Agent texts failed", e instanceof Error ? e.message.slice(0, 200) : e);
    return agentJson({ error: "Could not load texts." }, 500);
  }
}
