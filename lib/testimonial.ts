// Testimonials: a client leaves a quote on a private link, and says whether it may be published. Pure: no I/O.

export type TestimonialInput = { quote: string; result: string; name: string; role: string; company: string; permission: boolean };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

export function validateTestimonial(body: unknown): TestimonialInput | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const quote = s(b.quote, 1200);
  if (quote.length < 15) return { error: "Write a sentence or two about what changed." };
  const name = s(b.name, 80);
  if (!name) return { error: "Add your name." };
  return { quote, result: s(b.result, 300), name, role: s(b.role, 80), company: s(b.company, 120), permission: b.permission === true };
}

/** How the quote reads on a website or slide: only when they gave permission. */
export function publishable(t: { status: string; permission: boolean; quote: string; name: string; role: string; company: string }): string | null {
  if (t.status !== "submitted" || !t.permission) return null;
  const who = [t.name, [t.role, t.company].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  return `“${t.quote}” — ${who}`;
}
