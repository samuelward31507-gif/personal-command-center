// Website demo: a visitor types a pretend quote request and sees the instant reply their customer would get.
// Pure: no I/O. Nothing is texted; nothing is saved except a hashed rate-limit record.

export const DEMO_TRADES = ["Fence", "Pool"] as const;
export type DemoInput = { trade: "Fence" | "Pool"; business: string; customer: string; request: string };
export const DEMO_LIMITS = { perIpPerDay: 8, perDay: 400 };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

export function validateDemo(body: unknown): DemoInput | "spam" | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (s(b.website, 100)) return "spam"; // honeypot
  const trade = b.trade === "Pool" ? "Pool" : "Fence";
  const request = s(b.request, 400);
  if (request.length < 8) return { error: "Type a short quote request, like a homeowner would." };
  return { trade, business: s(b.business, 60) || (trade === "Pool" ? "Blue Ridge Pools" : "Summit Fence Co."), customer: s(b.customer, 30) || "there", request };
}

export function demoPrompt(i: DemoInput): { system: string; user: string } {
  const thing = i.trade === "Pool" ? "pool builder" : "fence company";
  return {
    system: [
      `You write the instant text messages a ${thing} called "${i.business}" sends to a brand-new inquiry, seconds after it arrives.`,
      "Write like a friendly, competent person at a local trades business: plain words, warm, short, no emojis, no exclamation overload.",
      "Rules: use the customer's first name if given; mention their actual project details; never quote prices or promise dates; never claim to be a human or deny being an assistant; no links except the literal text [booking link].",
      `For a ${thing}, good qualifying questions are about ${i.trade === "Pool" ? "timeline, rough budget range, pool type, and whether the yard has access for equipment" : "footage, material, gates, and timeline"}.`,
      'Reply with JSON only: {"reply": first text under 280 characters that thanks them and asks ONE qualifying question, "followup": second text under 220 characters sent after they answer, offering to book a free estimate with [booking link], "ownerAlert": one-line summary texted to the owner, under 160 characters}.',
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
