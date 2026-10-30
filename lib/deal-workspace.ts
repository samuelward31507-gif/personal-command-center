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
 * sent/accepted → proposal stage (unless already won/lost). Accepted is not Won: the deal is Won when the
 * agreement is signed (see stageForContract);
 * declined → lost with a reason. Never marks anything paid.
 */
export function stageForProposal(status: ProposalStatus, currentStage: string): string | null {
  if (currentStage === "won" || currentStage === "lost") return null;
  if (status === "sent") return ["new", "contacted", "meeting_booked", "meeting_held", "nurture"].includes(currentStage) ? "proposal" : null;
  if (status === "accepted") return ["new", "contacted", "meeting_booked", "meeting_held", "nurture"].includes(currentStage) ? "proposal" : null;
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

// ---------- Service agreement ----------

export const CONTRACT_STATUSES = ["none", "draft", "sent", "signed"] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

/** Signed agreement → Won (handoff runs; payments stay expected). Closed deals never move. */
export function stageForContract(status: ContractStatus, currentStage: string): string | null {
  if (currentStage === "won" || currentStage === "lost") return null;
  return status === "signed" ? "won" : null;
}

export type AgreementInput = {
  providerName: string; company: string; contactName: string; location: string;
  offerLabel: string; setupFee: number; monthlyFee: number; proposal: string; today: string;
};

/** Prompt for a plain-English service agreement drafted from the accepted proposal. Unknown facts stay as [bracketed] blanks. */
export function buildAgreementPrompt(p: AgreementInput) {
  const provider = p.providerName.trim() || "[Your legal business name]";
  const system = `You draft complete, plain-English service agreements for a one-founder agency that installs and runs AI speed-to-lead and follow-up systems for contractors.
Rules: Base the scope only on the accepted proposal and the fees given. Never invent facts. Anything not given (legal names, addresses, state, notice periods, caps, response times) stays as a [bracketed blank] the founder fills in. No guarantees of results. Plain English a contractor can read, short numbered clauses, no legalese filler. Aim for 1,800–2,500 words. Markdown, with these sections exactly, in this order:
# Service Agreement
A line naming the parties: ${provider} ("Provider") and the client ("Client"), the Client's address [Client address], and the effective date.
## 1. Services — bullets of exactly what's in scope, from the proposal. Out of scope: anything not listed, including ad spend, website rebuilds and lead generation. Changes or additions are quoted in writing before any work starts.
## 2. Setup and go-live — the system goes live within 21 business days after the Client signs, pays the setup fee and provides the access and information in section 6. Delays in access or approvals move the date day for day. Client approves all message wording before launch. Provider tests every path before go-live.
## 3. Go-live guarantee — if the system isn't live within 21 business days after everything in section 6 is received, and the delay is Provider's, Provider refunds the setup fee on request. This is the only refund of the setup fee; otherwise it's non-refundable once work begins.
## 4. Fees and payment — setup fee due at signing; monthly fee starts on the go-live date and is billed monthly in advance; payment method [card / ACH] on file. If a payment is more than [X] days late, Provider may pause the services (including messaging) until paid. Fees exclude taxes. Use the exact amounts given.
## 5. Usage and third-party costs — the Client pays all usage and third-party costs. These are NOT included in the monthly fee. Name them: text and picture messages, phone numbers, call minutes, AI and voice usage, email sending, carrier registration and compliance fees (for example A2P 10DLC brand and campaign fees), and any software subscriptions the system needs. They're paid either directly on the Client's own accounts or billed back to the Client at cost each month with the invoice, as [direct / billed at cost]. Provider gives an estimate of monthly usage at kickoff and tells the Client if usage is running well above it. Provider may pause sending if usage costs go unpaid.
## 6. Client responsibilities — access (phone, website forms, calendar, CRM and ad-platform logins as relevant), the business details needed for carrier registration, a 30-minute kickoff, approvals and answers within [X] business days, and accurate information about its services and pricing.
## 7. Messaging compliance — the Client is responsible for having permission to text and call the people it contacts, for the content it approves, and for following texting and calling laws (such as the TCPA) and carrier rules. The system honors opt-outs (STOP) automatically and the Client won't override them. Provider won't send messages to purchased lists or contacts without permission. The Client covers Provider for claims that come from the Client's contact lists, consent or approved content.
## 8. Monitoring and support — Provider monitors the system, fixes problems within [X business hours] of finding them, and sends a monthly report. Support is by [email / text] on business days. Provider isn't responsible for outages of third-party services (phone carriers, calendar, AI or software providers) but will work around them where it can.
## 9. Term and cancellation — an initial term of 3 months from the go-live date, then month to month. After the initial term, either side can cancel with [notice period] written notice. Either side can end the agreement right away if the other seriously breaks it and doesn't fix it within 10 days of written notice. Fees already paid aren't refunded except under section 3.
## 10. What happens at the end — Provider stops the services, gives the Client an export of its data and leads within [X] days on request, and helps move or release phone numbers and accounts that belong to the Client. Usage incurred up to the end date is still owed.
## 11. Ownership and data — Client owns its data, leads, conversations, phone numbers and accounts. Provider keeps its templates, workflows, know-how and tools, and gives the Client a license to use them while the agreement is active. Provider uses Client data only to deliver the services.
## 12. Confidentiality — each side keeps the other's non-public information confidential and uses it only for this agreement, during the term and for 2 years after.
## 13. No guarantee of results — Provider doesn't guarantee a number of leads, bookings, sales or revenue. The only guarantee is the go-live guarantee in section 3.
## 14. Liability — neither side is liable for indirect or lost-profit damages. Each side's total liability is capped at [amount, e.g. fees paid in the prior 3 months], except for unpaid fees and the Client's obligations in section 7.
## 15. General — independent contractor relationship; governing law [State]; neither side assigns this agreement without consent; delays from events outside either side's control are excused; if one clause is invalid the rest stands; this is the whole agreement and changes must be in writing; electronic signatures count as originals; notices go to the emails in the signature blocks.
## Signatures — two blocks (Provider / Client) with Name, Title, Email, Signature, Date lines.`;
  const user = `Provider: ${provider}
Client: ${p.company}${p.contactName ? ` (signer: ${p.contactName})` : ""}${p.location ? `, ${p.location}` : ""}
Effective date: ${p.today}
Offer: ${p.offerLabel} — $${p.setupFee.toLocaleString("en-US")} setup + $${p.monthlyFee.toLocaleString("en-US")}/month
Accepted proposal:
${p.proposal.slice(0, 6000)}

Draft the agreement.`;
  return { system, user };
}

// ---------- Follow-up emails (drafts only — Cinder never sends) ----------

export const EMAIL_PURPOSES = {
  meeting_recap: { label: "Recap after the call", brief: "Thank them for the call, recap what you heard in 2–3 short bullets (their words where possible), and confirm the next step." },
  proposal_follow_up: { label: "Proposal follow-up", brief: "A short, friendly nudge on the proposal you sent. Offer to answer questions or hop on a 10-minute call. One clear ask." },
  agreement_follow_up: { label: "Agreement nudge", brief: "They accepted the proposal; the agreement is waiting for a signature. Make signing easy and say what happens right after (kickoff)." },
  no_show: { label: "Missed meeting", brief: "They missed the scheduled call. No guilt. Offer two specific times to reschedule." },
  check_in: { label: "Check-in (nurture)", brief: "They said not now. A light check-in that gives them something useful in one line and asks if timing has changed." },
  referral_ask: { label: "Referral ask", brief: "They're a happy client. Ask if they know one other contractor who's losing leads to slow replies. Easy to say no." },
} as const;
export type EmailPurpose = keyof typeof EMAIL_PURPOSES;
export const isEmailPurpose = (v: unknown): v is EmailPurpose => typeof v === "string" && Object.prototype.hasOwnProperty.call(EMAIL_PURPOSES, v);

export type EmailInput = {
  purpose: EmailPurpose; company: string; firstName: string; senderName: string;
  stage: string; discovery: Discovery; nextStep: string; proposalSentAt: string | null; notes: string;
};

/** First name to greet by — skipped when it's really the start of the company name (bad list data like "Dive" for "Dive Deep Pools"). */
export function greetingName(firstName: string, company: string): string {
  const f = firstName.trim();
  if (!f || f.length < 2) return "";
  if (company.trim().toLowerCase().startsWith(f.toLowerCase())) return "";
  return f;
}

export function buildEmailPrompt(p: EmailInput) {
  const first = greetingName(p.firstName, p.company);
  const facts = DISCOVERY_FIELDS.filter(f => p.discovery[f.key]).slice(0, 8).map(f => `- ${f.label}: ${p.discovery[f.key]}`).join("\n") || "- (none)";
  const system = `You write short follow-up emails that ${p.senderName} sends himself to contractors (fence, pool and similar). Email only.
Rules: Plain text, no markdown. Under 120 words in the body. Sound like a real person: direct, warm, no hype words, no exclamation marks, no "I hope this finds you well". One clear ask. Use only the facts given; never invent numbers, results or claims. Sign off with just "${p.senderName}".
Output exactly:
Subject: <short subject, under 8 words>

<body>`;
  const user = `Purpose: ${EMAIL_PURPOSES[p.purpose].label} — ${EMAIL_PURPOSES[p.purpose].brief}
To: ${first || "the owner (name unknown — greet with \"Hi there\")"} at ${p.company}
Deal stage: ${p.stage}${p.proposalSentAt ? ` · proposal sent ${p.proposalSentAt.slice(0, 10)}` : ""}${p.nextStep ? ` · next step: ${p.nextStep}` : ""}
What we know:
${facts}
${p.notes ? `Founder notes: ${p.notes}\n` : ""}
Write the email.`;
  return { system, user };
}

/** Split a model reply into subject and body. Tolerates a missing "Subject:" line. */
export function parseEmailDraft(text: string): { subject: string; body: string } {
  const t = String(text ?? "").replace(/\r/g, "").trim();
  const m = t.match(/^\s*\**subject:?\**\s*(.+)\n+([\s\S]*)$/i);
  if (m) return { subject: m[1].trim().replace(/^["']|["']$/g, "").slice(0, 200), body: m[2].trim() };
  return { subject: "", body: t };
}

/** mailto: link that opens the founder's own email app with the draft filled in. Nothing is sent by Cinder. */
export function mailtoLink(to: string, subject: string, body: string): string {
  const addr = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to.trim()) ? to.trim() : "";
  return `mailto:${encodeURIComponent(addr).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** [Bracketed] placeholders the founder still has to fill in. A draft with blanks can't go out for signature. */
export function countBlanks(content: string): number {
  return (content.match(/\[[^\]\n]{1,80}\]/g) ?? []).length;
}
