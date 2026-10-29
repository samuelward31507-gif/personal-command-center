// Discovery notes and proposal drafting for a deal. Pure: no I/O, safe to unit test.

export const DISCOVERY_FIELDS = [
  { key: "decisionMaker", label: "Decision maker", hint: "Who signs? Are they on the call?", kind: "text" },
  { key: "leadSources", label: "Where leads come from", hint: "Google, Angi, referrals, Facebook, yard signs…", kind: "text" },
  { key: "monthlyLeads", label: "New leads per month", hint: "Their estimate", kind: "text" },
  { key: "avgJobValue", label: "Average job value", hint: "What a typical job is worth", kind: "text" },
  { key: "closeRate", label: "Close rate on quotes", hint: "Out of 10 quotes, how many sign?", kind: "text" },
  { key: "responseTime", label: "How fast leads get a reply", hint: "Minutes, hours, next day?", kind: "text" },
  { key: "afterHours", label: "After-hours / missed calls", hint: "Voicemail? Nobody?", kind: "text" },
  { key: "currentTools", label: "Current tools", hint: "CRM, answering service, spreadsheets…", kind: "text" },
  { key: "pain", label: "Biggest pain, in their words", hint: "Quote them if you can", kind: "long" },
  { key: "goal", label: "What they want in 90 days", hint: "More booked jobs, less chasing, etc.", kind: "long" },
  { key: "timeline", label: "Timeline to decide", hint: "This week, this month, after busy season…", kind: "text" },
  { key: "budget", label: "Budget / price reaction", hint: "How they reacted to the range", kind: "text" },
  { key: "objections", label: "Concerns raised", hint: "What could stop this", kind: "long" },
] as const;
export type DiscoveryKey = typeof DISCOVERY_FIELDS[number]["key"];
export type Discovery = Partial<Record<DiscoveryKey, string>>;

export const PROPOSAL_STATUSES = ["none", "draft", "sent", "accepted", "declined"] as const;
export type ProposalStatus = typeof PROPOSAL_STATUSES[number];

/** Keep only known discovery keys, as trimmed strings with sane lengths. */
export function cleanDiscovery(input: unknown): Discovery {
  const out: Discovery = {};
  if (!input || typeof input !== "object") return out;
  for (const f of DISCOVERY_FIELDS) {
    const v = (input as Record<string, unknown>)[f.key];
    if (typeof v === "string" && v.trim()) out[f.key] = v.trim().slice(0, f.kind === "long" ? 2000 : 300);
  }
  return out;
}

export function discoveryCompleteness(d: Discovery): number {
  const core: DiscoveryKey[] = ["decisionMaker", "leadSources", "monthlyLeads", "avgJobValue", "responseTime", "pain", "timeline"];
  return Math.round((core.filter(k => d[k]).length / core.length) * 100);
}

/**
 * What happens to the deal when the proposal status changes. Forward-only for the pipeline:
 * sent → proposal stage (unless already won/lost); accepted → won (handoff runs, payment stays expected);
 * declined → lost with a reason. Never marks anything paid.
 */
export function stageForProposal(status: ProposalStatus, currentStage: string): string | null {
  if (currentStage === "won" || currentStage === "lost") return null;
  if (status === "sent") return ["new", "contacted", "meeting_booked", "meeting_held", "nurture"].includes(currentStage) ? "proposal" : null;
  if (status === "accepted") return "won";
  if (status === "declined") return "lost";
  return null;
}

export type ProposalInput = {
  company: string; contactName: string; location: string;
  offerLabel: string; setupFee: number; monthlyFee: number;
  discovery: Discovery; auditSummary: string; notes: string;
};

export function buildProposalPrompt(p: ProposalInput) {
  const facts = DISCOVERY_FIELDS.filter(f => p.discovery[f.key]).map(f => `- ${f.label}: ${p.discovery[f.key]}`).join("\n") || "- (no discovery notes yet)";
  const system = `You write short, plain-English proposals for Cinder Revenue Company, a one-founder agency that installs AI speed-to-lead and follow-up systems for contractors (fence companies, pool builders and similar).
Rules: Use only the facts given. Never invent statistics, results, case studies, testimonials or guarantees. If a number is unknown, don't make one up — describe it qualitatively or leave it for the call. Write to the owner directly ("you"). No hype words. Under 450 words. Markdown with these sections exactly:
## The situation — 2–4 sentences in their terms: how leads come in today and where they leak.
## What we'll set up — 3–5 bullets: instant reply to every new lead (form, call, message), follow-up until they book or say no, booking onto their calendar, owner alerts for hot leads, simple weekly report. Tie each to their situation.
## How it works week by week — onboarding and access, build, test with real leads, go live (live within 21 business days of signing), 7- and 30-day reviews.
## Investment — the setup fee and monthly fee exactly as given, what's included, month-to-month after launch unless the founder says otherwise.
## What we need from you — access and a 30-minute kickoff.
## Next step — one line: reply to approve, and we'll send the agreement and schedule kickoff.`;
  const user = `Prospect: ${p.company}${p.contactName ? ` (contact: ${p.contactName})` : ""}${p.location ? `, ${p.location}` : ""}
Offer: ${p.offerLabel} — $${p.setupFee.toLocaleString("en-US")} setup + $${p.monthlyFee.toLocaleString("en-US")}/month
Discovery notes:
${facts}
${p.auditSummary ? `Audit summary (public research, may be partly unverified):\n${p.auditSummary}\n` : ""}${p.notes ? `Founder notes: ${p.notes}\n` : ""}
Write the proposal.`;
  return { system, user };
}
