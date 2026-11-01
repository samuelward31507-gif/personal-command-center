// Inbound lead intake from Cinder's public form. Pure: no I/O.
// Spam defenses: a hidden honeypot field and a minimum time-to-fill. No messages are ever sent.

export const INBOUND_TRADES = ["Fence", "Pool / spa", "Roofing", "HVAC", "Plumbing", "Landscaping", "Remodeling", "Other"] as const;
export const INBOUND_VOLUMES = ["Fewer than 10", "10–25", "25–50", "50–100", "100+"] as const;
export const MIN_FILL_MS = 2500;

export type InboundLead = {
  name: string; company: string; phone: string; email: string; website: string;
  trade: string; leadVolume: string; challenge: string; heardFrom: string;
  /** "speed-test" when they asked for the no-call speed test, else "". */
  offer: "" | "speed-test";
  /** They ticked the box agreeing to text messages. Never pre-ticked. */
  smsConsent: boolean;
  /** For the speed test: they allowed one test inquiry through their website. */
  testOk: boolean;
};

/** The exact consent wording shown next to the box, stored with the lead as a record of what they agreed to. */
export const SMS_CONSENT_TEXT = "I agree to receive text messages from Cinder Revenue Company about my inquiry and its services. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";
export const TEST_OK_TEXT = "OK to send one test inquiry through my website so you can time the reply.";
const yes = (v: unknown) => v === true || v === "on" || v === "true" || v === "1";

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
    offer: b.offer === "speed-test" ? "speed-test" : "", smsConsent: yes(b.smsConsent), testOk: yes(b.testOk),
  };
  if (!lead.name) return { error: "Please add your name." };
  if (!lead.company) return { error: "Please add your business name." };
  if (!lead.phone && !lead.email) return { error: "Add a phone number or email so we can reach you." };
  if (lead.phone && phoneDigits(lead.phone).length < 10) return { error: "That phone number looks too short." };
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return { error: "That email doesn't look right." };
  if (lead.offer === "speed-test") {
    if (!lead.website) return { error: "Add your website so we know where to send the test inquiry." };
    if (!lead.testOk) return { error: "Tick the box so we have your OK to send the test inquiry." };
  }
  if (lead.trade && !(INBOUND_TRADES as readonly string[]).includes(lead.trade)) lead.trade = "Other";
  if (lead.leadVolume && !(INBOUND_VOLUMES as readonly string[]).includes(lead.leadVolume)) lead.leadVolume = "";
  return lead;
}

export function sourceFor(lead: InboundLead): string {
  const base = lead.offer === "speed-test" ? "Website speed test" : "Website form";
  return lead.heardFrom ? `${base} · ${lead.heardFrom}`.slice(0, 200) : base;
}

export function notesFor(lead: InboundLead, receivedAt: Date): string {
  return [
    `Inbound lead from the Cinder form (${receivedAt.toISOString().slice(0, 16).replace("T", " ")} UTC).`,
    lead.offer === "speed-test" && `Asked for the free speed test. ${lead.testOk ? "Gave permission to send one test inquiry through their website." : ""}`.trim(),
    lead.phone && (lead.smsConsent ? `Text consent: yes, given on the form at ${receivedAt.toISOString()} with the wording "${SMS_CONSENT_TEXT}"` : "Text consent: not given. Call or email only."),
    lead.trade && `Trade: ${lead.trade}`,
    lead.leadVolume && `Leads per month: ${lead.leadVolume}`,
    lead.heardFrom && `Heard about us: ${lead.heardFrom}`,
    lead.challenge && `Biggest challenge: ${lead.challenge}`,
  ].filter(Boolean).join("\n");
}

/** The urgent task Cinder creates for a new form lead. Speed tests get the test steps, everyone else a call. */
export function inboundTask(lead: InboundLead): { title: string; description: string } {
  const reach = lead.phone ? "Phone: " + lead.phone : "Email: " + lead.email;
  if (lead.offer === "speed-test") return {
    title: ("Run speed test: " + lead.company).slice(0, 240),
    description: `They asked for the free speed test and gave permission.\n1. Submit one inquiry on ${lead.website}, clearly marked as Cinder's speed test.\n2. Note the time, then time the first reply (text, call or email).\n3. Send them the result within 48 hours, with what it likely costs them.\n${reach}`,
  };
  return { title: ("Call new inbound lead: " + lead.company).slice(0, 240), description: "They filled out your form. Speed wins: call within 5 minutes if you can.\n" + reach };
}

/** One line for the owner's alert saying whether they may text this lead. */
export function consentLine(lead: InboundLead): string {
  if (!lead.phone) return "";
  return lead.smsConsent ? "They agreed to texts." : "No text consent: call or email only.";
}
