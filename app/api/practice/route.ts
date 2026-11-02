import { getAllowedSession } from "@/lib/auth/server";
import { aiAllowed, AI_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { claudeText, AiTextError } from "@/lib/ai-text";
import { loadWorkspace } from "@/lib/workspace-data";
import { validatePractice, ownerPrompt, scorePrompt, transcript, parseScore } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** POST /api/practice — role-play reply from a practice "owner", or a scorecard for the finished call. Nothing leaves Cinder. */
export async function POST(request: Request) {
  const session = await getAllowedSession();
  const user = session?.data?.user?.id ? { id: String(session.data.user.id) } : null;
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return reply({ error: "AI isn't configured." }, 503);
  const input = validatePractice(await request.json().catch(() => null));
  if ("error" in input) return reply(input, 400);
  if (!(await aiAllowed(user.id))) return reply({ error: AI_LIMIT_MESSAGE }, 429);
  try {
    const ws = await loadWorkspace(user.id);
    if (input.action === "score") {
      const text = await claudeText({ apiKey: key, system: scorePrompt(input.persona).system, user: transcript(input.turns), maxTokens: 700, timeoutMs: 40_000, label: "Practice score" });
      const card = parseScore(text);
      return card ? reply({ score: card }) : reply({ error: "The coach's notes came back garbled. Try again." }, 502);
    }
    const sys = ownerPrompt(input.persona, { company: ws.businessName, repName: ws.ownerFirstName }).system;
    const user_ = input.turns.length ? `${transcript(input.turns)}\n\nReply as the OWNER, in character, to the rep's last line.` : "The phone rings. Answer it as the OWNER.";
    const text = await claudeText({ apiKey: key, system: sys, user: user_, maxTokens: 200, timeoutMs: 25_000, label: "Practice reply", model: process.env.CINDER_DEMO_MODEL?.trim() || "claude-haiku-5-5" });
    return reply({ owner: text.replace(/^OWNER:\s*/i, "").replace(/^"|"$/g, "").trim() });
  } catch (e) {
    const err = e instanceof AiTextError ? e : null;
    return reply({ error: err?.message || "Practice is unavailable right now." }, err?.status || 500);
  }
}
