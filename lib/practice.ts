// Call practice: Claude plays a fence or pool owner on a cold call so the owner can rep openers and objections.
// Pure: prompts, validation and parsing only. No I/O, nothing is ever sent to a real person.

export const PERSONAS = {
  fence_busy: { label: "Busy fence owner", trade: "fence", brief: "Mike, owns a 6-person fence company. On a job site, distracted, short answers. Thinks he answers leads fast enough. Will hang up if you ramble." },
  pool_skeptic: { label: "Skeptical pool builder", trade: "pool", brief: "Dana, runs a pool construction company doing $60k+ builds. Polite but skeptical, asks how it works and what it costs, worried texts look cheap to wealthy buyers." },
  burned: { label: "Burned by agencies", trade: "fence", brief: "Rick, fence and deck contractor. Paid two marketing agencies that delivered nothing. Hostile at first, softens only if you're honest and specific." },
  friendly_stall: { label: "Friendly but stalling", trade: "pool", brief: "Jen, pool and patio builder. Friendly, likes the idea, but keeps saying 'send me info', 'call me after the season', 'need to talk to my husband'." },
} as const;
export type Persona = keyof typeof PERSONAS;

/** Real objections from the objection-handling sheet. The owner raises two or three of these, naturally. */
export const OBJECTIONS = [
  "That's too expensive.", "Can you do it cheaper?", "Let me think about it.", "Send me some info.", "Call me in a few months.",
  "I need to talk to my partner.", "I've been burned by marketing agencies.", "You're new, how do I know this works?",
  "We already answer fast.", "My office manager handles calls.", "We already have a CRM / Jobber.", "We get plenty of work from referrals.",
  "Customers don't like texts or bots.", "We're too small for this.",
];

export type Turn = { who: "you" | "owner"; text: string };
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

/** Cleans the request. Returns the first problem in plain words. */
export function validatePractice(body: unknown): { persona: Persona; turns: Turn[]; action: "reply" | "score" } | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const persona = (typeof b.persona === "string" && b.persona in PERSONAS ? b.persona : "fence_busy") as Persona;
  const action = b.action === "score" ? "score" : "reply";
  const raw = Array.isArray(b.turns) ? b.turns.slice(-40) : [];
  const turns: Turn[] = raw.map(t => {
    const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    return { who: o.who === "owner" ? "owner" : "you", text: clean(o.text, 800) } as Turn;
  }).filter(t => t.text);
  if (action === "score" && !turns.some(t => t.who === "you")) return { error: "Say something first, then end the call for a score." };
  return { persona, turns, action };
}

export function transcript(turns: Turn[]): string {
  return turns.map(t => `${t.who === "you" ? "REP" : "OWNER"}: ${t.text}`).join("\n");
}

export function ownerPrompt(persona: Persona, offer: { company: string; repName: string }): { system: string } {
  const p = PERSONAS[persona];
  return {
    system: `You are role-playing a real small-business owner receiving a cold call, so a salesperson can practice. Stay in character the whole time.

Character: ${p.brief}
The caller is ${offer.repName} from ${offer.company}, which sets up instant replies to new leads, missed-call text-back, booking and quote follow-up for ${p.trade === "pool" ? "pool builders" : "fence companies"}.

How to play it:
- Sound like a real person on the phone: 1 to 3 short sentences, casual, no lists, no stage directions.
- Raise two or three of these objections over the call, naturally and in your own words: ${OBJECTIONS.join(" | ")}
- Push back on vague claims. If the rep asks good questions about how you handle leads, answer honestly with plausible numbers.
- Reward good selling: if the rep is specific, honest and asks for a clear next step, soften and agree to a 20-minute call.
- Punish bad selling: if they ramble, sound scripted, overpromise or ignore what you said, get shorter and try to end the call.
- Never say you're an AI and never coach the rep. If the call is clearly over, end with a short goodbye.
- If the rep hasn't spoken yet, answer the phone the way this person would.`,
  };
}

export function scorePrompt(persona: Persona): { system: string } {
  return {
    system: `You are a blunt sales coach reviewing a practice cold call to a ${PERSONAS[persona].label.toLowerCase()}. The rep sells lead-response systems to contractors and is working on confidence on the phone.

Judge it against these principles: agree before answering an objection; ask a question before pitching; use the owner's own numbers; end every answer with a question that moves things forward; never invent results or clients; ask for a specific next step.

Reply with one JSON object only: start with { and end with }. No code fences, no prose. When you quote the rep, use single quotes, never double quotes inside a value.
{"score": <0-100>, "verdict": "<one blunt sentence>", "wins": ["<specific thing done well>", ...up to 3], "fixes": ["<specific thing to change, quoting their words>", ...up to 3], "betterLine": "<one line they should have said at the weakest moment>"}`,
  };
}

export type Scorecard = { score: number; verdict: string; wins: string[]; fixes: string[]; betterLine: string };

/** Strips stage directions like *sound of a truck* so the owner only "says" words. */
export function cleanOwnerLine(text: string): string {
  return text.replace(/^OWNER:\s*/i, "").replace(/\*[^*]{1,200}\*/g, "").replace(/\s{2,}/g, " ").replace(/^["\s]+|["\s]+$/g, "").trim() || "…";
}

/** Pulls the scorecard out of the model's reply. Returns null if it isn't usable. */
export function parseScore(text: string): Scorecard | null {
  const body = text.replace(/```(?:json)?/gi, "");
  const m = body.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    // Tolerate trailing commas, the most common way a model breaks JSON.
    const o = JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1")) as Record<string, unknown>;
    const score = Math.round(Number(o.score));
    if (!Number.isFinite(score)) return null;
    const list = (v: unknown) => (Array.isArray(v) ? v.map(x => clean(x, 300)).filter(Boolean).slice(0, 3) : []);
    return { score: Math.min(100, Math.max(0, score)), verdict: clean(o.verdict, 300), wins: list(o.wins), fixes: list(o.fixes), betterLine: clean(o.betterLine, 300) };
  } catch { return null; }
}
