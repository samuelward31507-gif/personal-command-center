// Cinder's service agreement — Samuel's reviewed template, filled in from the deal. No AI drafting:
// every agreement is this exact text. Anything the CRM doesn't know becomes a [bracketed blank], and the
// signing link can't be created until every blank is filled. Edit the template here, not per deal.

export const AGREEMENT_TEMPLATE = "# Cinder Revenue Company Service Agreement\n\nThis Service Agreement (the \"Agreement\") is made on **{{agreement_date}}** between:\n\n**Provider:** {{provider_legal_name}}, {{provider_address}}, {{provider_email}} (\"Cinder\")\n\n**Client:** {{client_business_name}}, {{client_entity_type}}, {{client_address}}, {{client_email}}, {{client_phone}}, represented by {{client_owner_name}}, {{client_owner_title}} (\"Client\")\n\n\n## 1. Services\n\nCinder will build, run and maintain the **{{plan_name}}** system for Client, as described in Schedule A (the \"System\"). The System answers Client's incoming leads by text, asks Client's qualifying questions, follows Client's rules, and books appointments on Client's calendar.\n\n## 2. Fees\n\n- Setup fee: **{{setup_fee}}** (less upgrade credit of {{setup_credit}})\n- Monthly fee: **{{monthly_fee}}**{{fee_extras}}\n\nThe Statement of Work, with what is included and when each payment is due, is in Schedule A.\n\n2.1 **Setup fee** is due when this Agreement is signed. Work starts once it is paid.\n\n2.2 **Monthly fee** starts on the day the first Booked Appointment (Section 8.3) lands on Client's calendar, not on signing or go-live. It is billed monthly in advance by card or ACH autopay. The \"Go-Live Date\" is the day the System begins answering Client's real leads.\n\n2.3 **Late payment.** If a payment is more than 10 days late, Cinder may pause the System until the balance is paid.\n\n2.4 **Upgrade credit.** If a Never Miss a Lead client upgrades to Book & Close within 6 months of its Go-Live Date, the setup fee already paid is credited toward the Book & Close setup fee.\n\n2.5 **Price changes.** Cinder may change the monthly fee with 60 days' written notice.\n\n## 3. Go-Live Guarantee\n\n3.1 Cinder will make the System live within **21 business days** after receiving items 1\u20139 on the Kickoff Checklist (Schedule B).\n\n3.2 If Cinder misses that deadline, Client may request a **full refund of the setup fee**. Client may then either end this Agreement with nothing further owed, or keep going under it.\n\n3.3 The 21-day period pauses while Cinder is waiting on Client for information, approvals (including approval of the final message wording), logins, or SMS registration documents, and while the phone carriers are reviewing Client's SMS registration.\n\n## 4. Term and Cancellation\n\n4.1 **No contract term.** This Agreement runs month to month from the date it is signed. There is no minimum term.\n\n4.2 Client may cancel at any time with **30 days' notice** by text or email. Cinder may cancel with 30 days' written notice.\n\n4.3 Either party may end this Agreement right away if the other party materially breaches it and does not fix the breach within 10 days of written notice.\n\n4.4 The setup fee is non-refundable once work begins, except under Section 3.\n\n## 5. Client Responsibilities\n\nClient will:\n\n- (a) provide the items in the Kickoff Checklist (Schedule B) promptly;\n- (b) review and approve all message wording before go-live;\n- (c) provide its legal business name, its IRS EIN letter (CP 575 or 147C) and the business details needed for carrier SMS registration (A2P 10DLC). Texting cannot go live without approved registration;\n- (d) keep its calendar, prices and rules up to date, and tell Cinder about changes;\n- (e) respond to leads and appointments the System books or hands off.\n\n## 6. Texting and Compliance\n\n6.1 The System texts only people who contacted Client first (calls, forms, ads, messages) or who are Client's existing leads or customers.\n\n6.2 Client confirms it has the right to contact the leads and customers it gives Cinder, including any past quotes or customer lists used for follow-up or reactivation.\n\n6.3 Opt-out requests (such as \"STOP\") are honored automatically and immediately.\n\n6.4 The System identifies itself as Client's assistant and does not claim to be a person.\n\n6.5 Replies to people who just contacted Client go out right away. Follow-ups, reminders sent to people who haven't replied, and reactivation messages go out only between 8 am and 8 pm in the lead's local time.\n\n6.6 **Client's lists and content.** Client will cover Cinder for any claims, fines or costs that come from the contact lists Client provides, Client's lack of permission to contact someone, or message content Client approves.\n\n## 7. Usage\n\n7.1 The monthly fee includes a business texting number and up to **{{included_texts}} texts per month**. A \"text\" is one message sent or received, up to 160 characters. Longer messages count as one text per 160 characters, and a picture message counts as 3 texts.\n\n7.2 Cinder will notify Client when usage reaches 80% of the monthly limit.\n\n7.3 Usage above the limit is billed at **$30 per additional 1,000 texts** on the next invoice.\n\n7.4 Carrier registration fees for SMS (A2P 10DLC brand and campaign fees) are billed to Client at cost. Software and AI costs for running the System are included in the monthly fee.\n\n## 8. Guarantees\n\n8.1 **60-second reply guarantee (all plans).** Every lead that reaches the System gets a first reply in under 60 seconds, measured from the moment the lead reaches the System (a missed call, a text, a website form or a lead-site request) to when the first reply is sent. Every reply time is logged and shown in Client's monthly report. If more than 1 in 100 leads in a calendar month gets its first reply later than 60 seconds, that month's monthly fee is waived as a service credit. This does not cover leads that never reach the System because call forwarding or a form was disconnected on Client's side, or delays inside the phone carriers after a reply is sent.\n\n8.2 **Booked-Appointment Guarantee (Book & Close).** The System will book at least **5 Booked Appointments** in Client's first 30 days after the Go-Live Date. If it doesn't, Client's next monthly payment is waived and Cinder keeps working. The waived payment is a service credit, not a refund.\n\n8.3 **What counts as a Booked Appointment:** an estimate, inspection, consult or service visit with a homeowner in Client's service area, for a job type Client said it wants, with a confirmed date and time on Client's calendar, from a lead the System contacted. Each household counts once. A homeowner who cancels without rebooking or doesn't show doesn't count. An appointment Client cancels or moves does count.\n\n8.4 **The Booked-Appointment Guarantee applies when Client:** (a) connects missed-call forwarding and lead forms within 3 business days of signing; (b) receives 30 or more new leads a month; (c) keeps calendar availability current, with open slots each week; and (d) gives Cinder its price sheet for price ranges.\n\n8.5 Cinder reviews conversations weekly to improve the System. Apart from Sections 3 and 8, Cinder does **not** guarantee any specific number of leads, jobs or revenue.\n\n## 9. Data and Confidentiality\n\n9.1 Client owns its leads, customer data and conversation history (\"Client Data\").\n\n9.2 Cinder uses Client Data only to provide the services.\n\n9.3 When this Agreement ends, Cinder will export Client Data to Client within 14 days on request, then delete it.\n\n9.4 Each party will keep the other's non-public business information confidential.\n\n9.5 **Texting number.** When this Agreement ends, Cinder will, on request within 14 days, transfer the business texting number to an account Client controls (Client pays any carrier transfer fee). Otherwise Cinder may release the number.\n\n9.6 **Customer reference.** Cinder may name Client as a customer and share results without personal details of Client's leads or customers. Client can opt out at any time in writing.\n\n## 10. Changes\n\nSmall wording or rule changes are included. New features, integrations or work outside Schedule A will be quoted separately and need Client's written approval.\n\n## 11. Third-Party Services\n\nThe System relies on outside services (phone carriers, SMS providers, Facebook/Meta, calendar and CRM tools). Cinder is not responsible for their outages, policy changes or rejections, but will work to restore service as quickly as possible.\n\n## 12. Limitation of Liability\n\n12.1 Cinder's total liability under this Agreement is limited to the fees Client paid in the **3 months** before the claim.\n\n12.2 Neither party is liable for lost profits or indirect, incidental or consequential damages.\n\n## 13. General\n\n13.1 **Governing law.** This Agreement is governed by the laws of the State of Colorado.\n\n13.2 **Entire agreement.** This Agreement, including its Schedules, is the entire agreement between the parties. Changes must be in writing and agreed by both.\n\n13.3 **Assignment.** Cinder may assign this Agreement to Cinder Revenue Company LLC once formed. Otherwise, neither party may assign it without the other's written consent.\n\n13.4 **Notices.** Notices may be sent by email to the addresses above.\n\n13.5 **Electronic signatures.** Electronic signatures count as originals, and this Agreement may be signed in counterparts.\n\n13.6 **Independent contractor.** Cinder is an independent contractor, not an employee or partner of Client.\n\n13.7 **Severability.** If any part of this Agreement is found unenforceable, the rest stays in effect.\n\n13.8 **Special terms:** {{special_terms}}\n\n\n## Signatures\n\n**Cinder**\n\nSignature: ______________________________\n\nName: {{provider_signer}}\n\nTitle: Owner\n\nDate: ______________\n\n**Client \u2014 {{client_business_name}}**\n\nSignature: ______________________________\n\nName: {{client_owner_name}}\n\nTitle: {{client_owner_title}}\n\nDate: ______________\n\n\n## Schedule A \u2014 Plan and Statement of Work\n\n{{plan_schedule}}\n\n\n## Schedule B \u2014 Kickoff Checklist\n\nClient provides:\n\n1. Business phone number, and access to set up call forwarding or missed-call texting\n2. Website form access, and Facebook page / lead ad access\n3. Calendar access, and estimate availability (days, hours, how long estimates take)\n4. Service area (cities, zip codes or radius)\n5. Qualifying questions Client wants asked\n6. Ballpark price ranges and any minimum job size\n7. Rules for small jobs, repairs and jobs Client does not take\n8. Owner's cell number for alerts and handoffs\n9. Legal business name, business address, website, and Client's IRS EIN letter (CP 575 or 147C) for SMS registration\n10. Approval of the final message wording\n\nBook & Close also:\n\n11. List of quotes and proposals from the last 6 months (name, phone, job, amount, date)\n12. Past customer list (for seasonal reactivation and reviews)\n13. Google review link\n14. Financing details and budget ranges to share with leads\n15. Estimator names, zones and schedules\n16. An access invite to Client's CRM (if syncing). Client never shares passwords";

export const SCHEDULE_TIER1 = "**Never Miss a Lead. Setup {{setup_fee}}, then {{monthly_fee}}/month.**\n\n- Text reply in about 10 seconds to missed calls, website forms, Facebook lead ads, and Angi or Thumbtack leads Client forwards\n- Client's qualifying questions and price range before anything is booked\n- Client's job rules (minimums, small jobs, service area)\n- Appointment booking on Client's calendar\n- Appointment reminders and automatic no-show rebooking texts\n- Replies in English and Spanish\n- Owner alert with the full lead summary; owner can take over any conversation\n- Follow-up texts to new leads who go quiet, and a reminder to Client when a handed-off customer is waiting\n- Cinder app for Client: every lead, conversation and booked estimate\n- Weekly text report on Mondays\n- Voice AI answering for missed and after-hours calls is added at no extra cost when Cinder releases it\n- Includes 2,000 texts/month";
export const SCHEDULE_TIER2 = "**Book & Close. Setup {{setup_fee}}, then {{monthly_fee}}/month.**\n\nEverything in Never Miss a Lead, plus:\n\n- Follow-up on every quote on days 2, 5, 10 and 21 until it's a yes or a no, with replies answered in seconds\n- Start a quote's follow-up by sending one text\n- \"Too expensive\" replies get Client's financing or a smaller option; real price negotiation goes to Client\n- One-time follow-up of open quotes from the last 90 days\n- Review request after every completed job\n- Monthly results report: leads, booked estimates, quotes won and reply times\n- Includes 5,000 texts/month";

export type AgreementTier = "tier1" | "tier2";
export const TIER_TERMS: Record<AgreementTier, { planName: string; includedTexts: string; schedule: string }> = {
  tier1: { planName: "Never Miss a Lead", includedTexts: "2,000", schedule: SCHEDULE_TIER1 },
  tier2: { planName: "Book & Close", includedTexts: "5,000", schedule: SCHEDULE_TIER2 },
};

export type AgreementFill = {
  tier: AgreementTier; date: string;
  providerName?: string; providerAddress?: string; providerEmail?: string; signerName?: string;
  company: string; ownerName?: string; ownerTitle?: string; email?: string; phone?: string; location?: string;
  setupFee: number; monthlyFee: number; setupCredit?: number; specialTerms?: string; addon?: boolean;
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const val = (v: string | undefined, blank: string) => (v && v.trim() ? v.trim() : blank);

/** Tier from the deal's service type; null when the deal isn't on Tier 1 or Tier 2 (the template only covers those). */
export function agreementTier(serviceType: string | null | undefined): AgreementTier | null {
  if (serviceType === "tier1_speed_to_lead") return "tier1";
  if (serviceType === "tier2_revenue_system") return "tier2";
  return null;
}

export function fillAgreement(f: AgreementFill): string {
  const t = TIER_TERMS[f.tier];
  const loc = f.location?.trim();
  const fields: Record<string, string> = {
    agreement_date: f.date,
    provider_legal_name: val(f.providerName, "Samuel Ward, doing business as Cinder Revenue Company"),
    provider_signer: val(f.signerName, "Samuel Ward"),
    provider_address: val(f.providerAddress, "[Your business address]"),
    provider_email: val(f.providerEmail, "[Your email]"),
    client_business_name: val(f.company, "[Client legal business name]"),
    client_entity_type: "[Client entity type, e.g. a Colorado limited liability company]",
    client_address: loc ? `[Street address], ${loc}` : "[Client address]",
    client_email: val(f.email, "[Client email]"),
    client_phone: val(f.phone, "[Client phone]"),
    client_owner_name: val(f.ownerName, "[Owner name]"),
    client_owner_title: val(f.ownerTitle, "Owner"),
    plan_name: t.planName,
    setup_fee: money(f.setupFee),
    monthly_fee: money(f.monthlyFee),
    included_texts: t.includedTexts,
    setup_credit: money(f.setupCredit ?? 0),
    special_terms: val(f.specialTerms, "None"),
    fee_extras: [
      f.addon ? `\n- Reactivation add-on: **${money(ADDON_MONTHLY)}** a month, starting with the monthly fee` : "",
      buildSow({ tier: f.tier, setupFee: f.setupFee, monthlyFee: f.monthlyFee }).founding ? "\n- Founding client: the first month's fee is 50% off" : "",
    ].join(""),
  };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in fields ? fields[k] : m));
  const schedule = fill(t.schedule) + "\n\n" + sowMarkdown({ tier: f.tier, setupFee: f.setupFee, monthlyFee: f.monthlyFee, addon: f.addon });
  return fill(AGREEMENT_TEMPLATE.replace("{{plan_schedule}}", schedule));
}

// ---------- Statement of Work (Schedule A): the price, plainly. What's included is the plan list above it. ----------

export type SowTier = "tier1" | "tier2";
export type SowInput = { tier: SowTier; setupFee: number; monthlyFee: number; addon?: boolean };
export type SowRow = { label: string; amount: number; when: string };

export const LIST = { tier1: { setup: 1500, monthly: 997 }, tier2: { setup: 2500, monthly: 1997 } } as const;
export const ADDON_MONTHLY = 497;

export const usd = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What the client pays and when: setup, the first month, then every month. No 12-month totals: there is no term. */
export function buildSow(i: SowInput): { rows: SowRow[]; setupDue: number; firstMonth: number; monthly: number; founding: boolean } {
  const list = LIST[i.tier];
  const founding = i.setupFee > 0 && i.setupFee < list.setup;
  const monthly = i.monthlyFee + (i.addon ? ADDON_MONTHLY : 0);
  const firstMonth = founding ? Math.round(monthly * 50) / 100 : monthly;
  const rows: SowRow[] = [
    { label: founding ? `Setup (founding price, normally ${usd(list.setup)})` : "Setup", amount: i.setupFee, when: "Once, when you sign" },
    { label: founding ? "First month (50% off)" : "First month", amount: firstMonth, when: "The day your first appointment books" },
    { label: i.addon ? `Every month after (plan ${usd(i.monthlyFee)} + Reactivation ${usd(ADDON_MONTHLY)})` : "Every month after", amount: monthly, when: "Month to month. Cancel with 30 days’ notice" },
  ];
  return { rows, setupDue: i.setupFee, firstMonth, monthly, founding };
}

/** The price table for the agreement (the signing page renders `|` rows as a table). */
export function sowMarkdown(i: SowInput): string {
  const s = buildSow(i);
  const lines = ["| What you pay | Amount |", "| --- | --- |", ...s.rows.map(r => `| ${r.label.replace(/\|/g, "/")}. ${r.when}. | ${usd(r.amount)} |`)];
  return "**What you pay, and when**\n\n" + lines.join("\n") + "\n\nNot included: buying ads or leads, and website redesigns.";
}
