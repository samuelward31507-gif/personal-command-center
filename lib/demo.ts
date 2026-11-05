// Website demo: a visitor types a pretend quote request and sees the instant reply their customer would get.
// Pure: no I/O. Nothing is texted; nothing is saved except a hashed rate-limit record.

/** Business types the public demo knows how to qualify for. "Other" works for any service business. */
export const DEMO_TRADES = {
  Roofing: { thing: "roofing company", business: "Summit Roofing", questions: "the roof's age and size, any active leaks, insurance claim or not, and timeline" },
  HVAC: { thing: "heating and air company", business: "Peak Heating & Air", questions: "what the system is doing, its age, home size, and how soon they need it fixed" },
  Plumbing: { thing: "plumbing company", business: "Clearline Plumbing", questions: "what's happening, where in the home, whether it's urgent, and access" },
  Landscaping: { thing: "landscaping company", business: "Greenway Landscapes", questions: "yard size, the look they want, budget range, and timeline" },
  Fence: { thing: "fence company", business: "Summit Fence Co.", questions: "footage, material, gates, and timeline" },
  Pool: { thing: "pool builder", business: "Blue Ridge Pools", questions: "timeline, rough budget range, pool type, and whether the yard has access for equipment" },
  Remodeling: { thing: "remodeling company", business: "Oakline Remodeling", questions: "which room, the scope, budget range, and timeline" },
  Other: { thing: "local service business", business: "Your Business", questions: "what they need, where, budget range if relevant, and timeline" },
} as const;
export type DemoTrade = keyof typeof DEMO_TRADES;
export type DemoInput = { trade: DemoTrade; business: string; customer: string; request: string };
export const DEMO_LIMITS = { perIpPerDay: 8, perDay: 400 };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

export function validateDemo(body: unknown): DemoInput | "spam" | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (s(b.website, 100)) return "spam"; // honeypot
  const trade: DemoTrade = typeof b.trade === "string" && Object.prototype.hasOwnProperty.call(DEMO_TRADES, b.trade) ? b.trade as DemoTrade : "Other";
  const request = s(b.request, 400);
  if (request.length < 8) return { error: "Type a short quote request, like a homeowner would." };
  return { trade, business: s(b.business, 60) || DEMO_TRADES[trade].business, customer: s(b.customer, 30) || "there", request };
}

export function demoPrompt(i: DemoInput): { system: string; user: string } {
  const t = DEMO_TRADES[i.trade] ?? DEMO_TRADES.Other;
  const thing = t.thing;
  return {
    system: [
      `You write the instant text messages a ${thing} called "${i.business}" sends to a brand-new inquiry, seconds after it arrives.`,
      "Write like a friendly, competent person at a local service business: plain words, warm, short, no emojis, no exclamation overload.",
      "Rules: use the customer's first name if given; mention their actual project details; never quote prices or promise dates; never claim to be a human or deny being an assistant; no links except the literal text [booking link].",
      `For a ${thing}, good qualifying questions are about ${t.questions}.`,
      'Reply with JSON only: {"reply": first text under 280 characters that thanks them and asks ONE qualifying question, "followup": second text under 220 characters sent after they answer, offering to book a time with [booking link], "ownerAlert": one-line summary texted to the owner, under 160 characters}.',
    ].join("\n"),
    user: `Customer first name: ${i.customer}\nTheir message: ${i.request}`,
  };
}

/** Pulls the three messages out of the model's answer; tolerates code fences or stray text. */
export function parseDemo(text: string): { reply: string; followup: string; ownerAlert: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/https?:\/\/\S+/g, "[booking link]").trim().slice(0, max) : "");
    const out = { reply: clean(j.reply, 320), followup: clean(j.followup, 260), ownerAlert: clean(j.ownerAlert, 200) };
    return out.reply ? out : null;
  } catch { return null; }
}

export function rateDecision(ipToday: number, allToday: number): { ok: true } | { ok: false; error: string } {
  if (ipToday >= DEMO_LIMITS.perIpPerDay) return { ok: false, error: "You've tried the demo a few times today. Book a call and we'll show you it on your own business." };
  if (allToday >= DEMO_LIMITS.perDay) return { ok: false, error: "The demo is busy right now. Try again tomorrow, or book a call." };
  return { ok: true };
}
