// Inbound lead intake from Cinder's public form. Pure: no I/O.
// Spam defenses: a hidden honeypot field and a minimum time-to-fill. No messages are ever sent.

export const INBOUND_TRADES = ["Fence", "Pool / spa", "Roofing", "HVAC", "Plumbing", "Landscaping", "Remodeling", "Other"] as const;
export const INBOUND_VOLUMES = ["Fewer than 10", "10–25", "25–50", "50–100", "100+"] as const;
export const MIN_FILL_MS = 2500;

export type InboundLead = {
  name: string; company: string; phone: string; email: string; website: string;
  trade: string; leadVolume: string; challenge: string; heardFrom: string;
};

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
export const phoneDigits = (p: string) => p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** Returns a clean lead, "spam" for bot submissions (accepted silently), or a user-facing error. */
export function validateInbound(body: unknown, now = Date.now()): InboundLead | "spam" | { error: string } {
  if (!body || typeof body !== "object") return { error: "Something went wrong. Please try again." };
  const b = body as Record<string, unknown>;
  if (s(b.fax, 200)) return "spam";
  const started = Number(b.startedAt);
  if (Number.isFinite(started) && started > 0 && now - started < MIN_FILL_MS) return "spam";
  const lead: InboundLead = {
    name: s(b.name, 120), company: s(b.company, 160), phone: s(b.phone, 40), email: s(b.email, 200).toLowerCase(),
    website: s(b.website, 300), trade: s(b.trade, 40), leadVolume: s(b.leadVolume, 40), challenge: s(b.challenge, 2000), heardFrom: s(b.heardFrom, 200),
  };
  if (!lead.name) return { error: "Please add your name." };
  if (!lead.company) return { error: "Please add your business name." };
  if (!lead.phone && !lead.email) return { error: "Add a phone number or email so we can reach you." };
  if (lead.phone && phoneDigits(lead.phone).length < 10) return { error: "That phone number looks too short." };
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return { error: "That email doesn't look right." };
  if (lead.trade && !(INBOUND_TRADES as readonly string[]).includes(lead.trade)) lead.trade = "Other";
  if (lead.leadVolume && !(INBOUND_VOLUMES as readonly string[]).includes(lead.leadVolume)) lead.leadVolume = "";
  return lead;
}

export function sourceFor(lead: InboundLead): string {
  return lead.heardFrom ? `Website form · ${lead.heardFrom}`.slice(0, 200) : "Website form";
}

export function notesFor(lead: InboundLead, receivedAt: Date): string {
  return [
    `Inbound lead from the Cinder form (${receivedAt.toISOString().slice(0, 16).replace("T", " ")} UTC).`,
    lead.trade && `Trade: ${lead.trade}`,
    lead.leadVolume && `Leads per month: ${lead.leadVolume}`,
    lead.heardFrom && `Heard about us: ${lead.heardFrom}`,
    lead.challenge && `Biggest challenge: ${lead.challenge}`,
  ].filter(Boolean).join("\n");
}
