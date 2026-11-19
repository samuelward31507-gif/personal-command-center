// Cold-call playbook by track (trades vs detailing), built on the current offer: open, dig, pitch, guarantee, price, objections. Pure: no I/O.
// Offer source of truth: site/index.html (plans).

export type Track = "trades" | "generator" | "detailing";
export type Objection = { id: string; label: string; key: string; say: string; then?: string };

/** The soft ask: assume the meeting, ask about logistics. Never "are you interested" or "would you be open to". */
export const CLOSE = "Easiest thing is if I just show you what it'd look like for your shop. Are you more of a morning or afternoon guy? ... Cool, tomorrow at 10 or Wednesday at 2?";

export const RISK = "And the monthly doesn't start until your first appointment actually books. No contract.";

export const VOICEMAIL: Record<Track, string> = {
  generator: "Hey {first}, Sam with Cinder, about the calls that pile up after an outage. 205-837-0211. Again, 205-837-0211.",
  trades: "Hey {first}, Sam with Cinder, about the quotes that go quiet after you send them. 205-837-0211. Again, 205-837-0211.",
  detailing: "Hey {first}, Sam with Cinder. Quick one about getting your past customers back in without you chasing them. I'll shoot you a text. Talk soon.",
};

export const GATEKEEPER = "Calm, like you already know them: \"Hey, it's Sam. Is the owner around? And is it {first} I'd ask for?\" If she asks why: \"It's about the quotes that go quiet after you send them. Is he in the office or out on a job?\" If he's out: \"No problem. When's best to catch him, and is there a better number for him?\" Don't pitch the receptionist. Log the name, best time and cell.";

const SHARED: Objection[] = [
  { id: "busy", label: "Busy, call back", key: "b", say: "No worries. When's a better time to catch you, morning or afternoon?", then: "Log Busy, call back with the time they gave." },
  { id: "info", label: "Send me info", key: "i", say: "Happy to. So I send the right thing: is it more missed calls or quotes going quiet for you? ... Honestly, a 15-minute look shows it better than a PDF. Tomorrow at 10 or Wednesday at 2?", then: "Send the info email from Call mode while you're on the line, then: \"If it looks useful, are you a morning or afternoon guy for a quick look?\"" },
  { id: "not-interested", label: "Not interested", key: "x", say: "Totally fair, you didn't expect my call. Quick question before I go: when a call comes in while you're on a job, what happens to it?", then: "If they answer, go back to the script. If it's a real no: \"No worries at all. Mind if I check back in the spring?\" Next dial." },
  { id: "price", label: "How much?", key: "$", say: "{price} The monthly doesn't start until your first booked appointment lands, and there's no contract.", then: "Ask: \"What's an average job worth to you?\" One extra job a month usually covers it. Then book the 15 minutes." },
  { id: "expensive", label: "Too expensive", key: "e", say: "Fair question. What's a typical job worth to you? ... So if it books one extra job a month, it's paid for. And if it doesn't hit the guarantee, your next month is free.", then: "Then the close." },
  { id: "software", label: "We use Jobber", key: "s", say: "Perfect, I work alongside it. Jobber holds the job once it's booked. I'm the part that gets it booked when you can't pick up, and chases the quote after it goes out.", then: "Let them answer. The gap is usually follow-up." },
  { id: "burned", label: "Got burned by agencies", key: "g", say: "That's fair, a lot of agencies sell leads and ads. We don't. We just make sure the leads you already get don't slip through. No contract, cancel anytime.", then: "Then the close." },
  { id: "robot", label: "Is it a bot?", key: "r", say: "It's software I set up and run for you. It texts like your office would, uses your questions and your prices, and anything tricky comes straight to you.", then: "Then the close." },
];

// Sam's fence and generator scripts (Nov 19 2026). "busy" is shared.
const BUSY = SHARED[0];
const THINK: Objection = { id: "think", label: "Let me think about it", key: "t", say: "Of course. What's the one thing you'd want to be sure of first?", then: "Answer that one thing, then: \"Easiest is to see it. 15 minutes, tomorrow or Friday?\"" };
const FENCE_OBJECTIONS: Objection[] = [
  BUSY,
  { id: "answer-all", label: "We answer every call", key: "a", say: "Respect. Even after 5, on Saturdays, or while you're up on a ladder? Cinder only kicks in on the calls that slip through, so it's a backup, not a replacement." },
  { id: "not-interested", label: "Not interested", key: "x", say: "Fair. Real quick before I let you go: is it that you're not losing leads, or just a bad time?", then: "Bad time: \"When's better, end of day or tomorrow morning?\" Not losing leads: \"Respect. Appreciate your time.\" Next dial." },
  { id: "info", label: "Send me an email", key: "i", say: "Happy to. So I send the right thing, which is the bigger leak for you, missed calls or quotes that go quiet?", then: "Send the info email from Call mode while you're on the line, then offer the 15 minutes." },
  { id: "price", label: "How much?", key: "$", say: "{price} One extra fence job a month usually covers it. Worth 15 minutes to see if it would for you?" },
  { id: "software", label: "We use Jobber", key: "s", say: "Good, keep it. Cinder sits in front of it. It catches the lead and books it in the first ten seconds, then you run the job in Jobber like always." },
  { id: "enough-work", label: "We're booked out", key: "w", say: "Great problem. Booked-out shops lose the most quotes to slow follow-up. This keeps next season's pipeline warm without you lifting a finger." },
  { id: "robot", label: "What if it says something wrong?", key: "r", say: "It only answers from what you approve: your services, your area, your booking times. Anything it isn't sure of, it hands to you." },
  THINK,
];
const GENERATOR_OBJECTIONS: Objection[] = [
  BUSY,
  { id: "answer-all", label: "We answer every call", key: "a", say: "Even on the day after a storm, when 30 people call before lunch? Cinder only catches the ones that slip through." },
  { id: "not-interested", label: "Not interested", key: "x", say: "Fair. Real quick: is it that you're not losing leads during outages, or just a bad time?", then: "Bad time: \"When's better, end of day or tomorrow morning?\" Otherwise: \"Respect. Appreciate your time.\" Next dial." },
  { id: "info", label: "Send me an email", key: "i", say: "Happy to. So I send the right thing, which is the bigger leak for you, the outage rush or quotes that go quiet?", then: "Send the info email from Call mode while you're on the line, then offer the 15 minutes." },
  { id: "price", label: "How much?", key: "$", say: "{price} One standby install usually pays for months of it. Worth 15 minutes to see?" },
  { id: "software", label: "We use Jobber", key: "s", say: "Good, keep it. Cinder sits in front of it. It catches and qualifies the lead in the first ten seconds, then you run the job in Jobber like always." },
  { id: "enough-work", label: "We're booked out", key: "w", say: "Then the follow-up matters most. Booked-out dealers lose big quotes to whoever checks in next. This keeps them warm until you have a slot." },
  { id: "robot", label: "What if it says something wrong?", key: "r", say: "It only answers from what you approve: your brands, your area, your visit times. Anything it isn't sure of, it hands to you." },
  THINK,
];

const DETAILING_ONLY: Objection[] = [
  { id: "regulars", label: "Customers come back anyway", key: "a", say: "The good ones do. How many from last year haven't been back in 6 months? Those are the ones we bring in, and we only text people who gave you their number.", then: "Then the close." },
  { id: "slammed", label: "No, we're booked out", key: "w", say: "Good spot to be in. Then it's not more cars, it's steadier money with less chasing. How many of your customers are on a maintenance plan? ... We offer a plan after every job, fill slow weeks from your own customer list, and get a review from every happy customer, without you texting anyone.", then: "Then the close. Lead with the Reactivation campaign here." },
];

/** One answer to the either/or question. probe: dig into it. mirror: repeat it back. fix: the one fix. close: a demo ask about that fix. tier: the plan that fix lives in. */
export type Side = { id: "calls" | "quotes"; label: string; key: string; probe: string[]; mirror: string; fix: string; close: string; tier: string };

export type Script = { open: string; dig: string[]; pitch: string; sides?: [Side, Side]; close?: string; guarantee: string; price: string; objections: Objection[] };

const MIRROR = "Repeat it back in his words: \"So if I heard you right, ...\" Then: \"That's exactly what we fix.\"";
const QUOTES_SIDE = (what: string, demo: string): Side => ({
  id: "quotes", label: "Quotes going quiet", key: "q", tier: "Book & Close",
  probe: [
    "What happens right now after a quote goes out? Who follows up, and when?",
    `Roughly how many ${what} a month never hear back?`,
  ],
  mirror: MIRROR,
  fix: "Here's the fix. Every quote gets followed up for you on days 2, 5 and 10, then monthly until it's a yes or a no. If they say it's too expensive, it offers your financing or a smaller option, and real price talk comes straight to you. You don't touch it.",
  close: `Easiest way to see it is a 15-minute demo. I'll show it chasing ${demo} that went quiet, set up as {company}. Does tomorrow or Friday work better?`,
});

export const SCRIPTS: Record<Track, Script> = {
  trades: {
    open: "Hey {first}, it's Sam with Cinder. I'll be honest, this is a cold call. I help fence installers stop losing leads to the guy who answers first. Got 30 seconds?",
    dig: [
      "\"What's the best cell? I'll text you the link and a 2-minute video so you know what we're covering.\" Text it while you're still on the phone.",
      "\"Roughly how many leads do you get a week, and what's an average job?\" Log both in the notes.",
      "\"Anyone else, like a partner, who should be on that call?\"",
    ],
    pitch: "Most installers I talk to lose jobs two ways. Calls that hit voicemail while you're on a job, and quotes that go out and then get ghosted. Which one hits you harder, missed calls or quotes that go quiet?",
    sides: [
      { id: "calls", label: "Missed calls / slow follow-up", key: "m", tier: "Never Miss a Lead",
        probe: [
          "What happens to a call right now when you're up on a job and can't pick up?",
          "How long before someone calls them back? Same day, next day?",
        ],
        mirror: MIRROR,
        fix: "Here's the fix. When you miss a call or a form comes in, Cinder texts them back in about ten seconds, asks the job questions you'd ask, and books the estimate on your calendar. They never get the chance to call the next guy.",
        close: "Easiest way to see it is a 15-minute demo. I'll show it texting back a missed call, set up as {company}. Does tomorrow or Friday work better?",
      },
      QUOTES_SIDE("fence quotes", "a fence quote"),
    ],
    close: "Easiest way to see it is a 15-minute demo, where I show it texting back a lead like one of yours, set up as {company}. Does tomorrow or Friday work better?",
    guarantee: "Never Miss a Lead: every lead gets a reply in under 60 seconds, or that month is free. Book & Close: 5 booked appointments in your first 30 days (3 if you get under 30 leads a month), or your next month is free. And the monthly doesn't start until your first booked appointment.",
    price: "There are two options. Never Miss a Lead is $997 to set up, then $697 a month. Book & Close is $1,997 to set up, then $1,497 a month, and the monthly doesn't start until your first booked appointment.",
    objections: FENCE_OBJECTIONS,
  },
  generator: {
    open: "Hey {first}, it's Sam with Cinder. I'll be honest, this is a cold call. When the power goes out, everyone calls three dealers at once. I help standby generator dealers make sure they're the one who answers first. Got 30 seconds?",
    dig: [
      "\"What's the best cell? I'll text you the link and a 2-minute video so you know what we're covering.\" Text it while you're still on the phone.",
      "\"Roughly how many leads do you get a week, and what's an average job?\" Log both in the notes.",
      "\"Anyone else, like a partner, who should be on that call?\"",
    ],
    pitch: "Most dealers I talk to lose jobs two ways. The outage rush, when calls pile up and whoever answers first wins, and big install quotes that go out and then get ghosted. Which one hits you harder, the outage rush or big quotes that go quiet?",
    sides: [
      { id: "calls", label: "Outage rush / missed calls", key: "m", tier: "Never Miss a Lead",
        probe: [
          "Last big outage, what happened to the calls you couldn't get to?",
          "How long before those people heard back from you?",
        ],
        mirror: MIRROR,
        fix: "Here's the fix. When you can't pick up, Cinder texts them back in about ten seconds, qualifies them (home size, fuel type, timeline) and books the site visit. You're the first dealer they hear from, even on a 40-call day.",
        close: "Easiest way to see it is a 15-minute demo. I'll show it handling an outage-day lead, set up as {company}. Does tomorrow or Friday work better?",
      },
      QUOTES_SIDE("install quotes", "an install quote"),
    ],
    close: "Easiest way to see it is a 15-minute demo, where I show it handling an outage-day lead, set up as {company}. Does tomorrow or Friday work better?",
    guarantee: "Never Miss a Lead: every lead gets a reply in under 60 seconds, or that month is free. Book & Close: 5 booked appointments in your first 30 days (3 if you get under 30 leads a month), or your next month is free. And the monthly doesn't start until your first booked appointment.",
    price: "There are two options. Never Miss a Lead is $997 to set up, then $697 a month. Book & Close is $1,997 to set up, then $1,497 a month, and the monthly doesn't start until your first booked appointment.",
    objections: GENERATOR_OBJECTIONS,
  },
  detailing: {
    open: "Hey {first}, it's Sam with Cinder Revenue. I know I'm catching you out of the blue. Can I take 30 seconds to tell you why I called, and then you can tell me to get lost?",
    dig: [
      "\"Last thing before I let you go. Most detailers I talk to have one of three things going on: slow weeks, customers who never come back, or answering texts all night. Which one's biggest for you?\"",
      "\"Roughly how many customers did you do last year?\" That sizes the reactivation list.",
      "\"Anyone else who should be on that call?\" Then text the invite while you're still on the phone.",
    ],
    pitch: "Reason I'm calling: I work with detailers on getting past customers back in. Quick question: when's the last time you reached out to customers you haven't seen in a few months? ... (let them talk, then) Yeah, most shops never do, and those are the easiest bookings you'll get, because they already like your work. So I set it up so every past customer gets a text from you when they're due, and they book themselves back in. Anyone who calls while you're mid-detail gets a text back in seconds, and every happy customer gets asked for a review. I guarantee 5 booked appointments in your first 30 days, or your next month is free.",
    guarantee: "Every new lead gets a reply in under 60 seconds, or that month is free. And we keep texting your past customers when they're due, booking every reply.",
    price: "Never Miss a Lead is $997 to set up and $697 a month, and the Reactivation campaign that texts your old leads and past customers is $497 one time, paid with the setup.",
    objections: [...SHARED, ...DETAILING_ONLY],
  },
};

/** Fill {first}, {price}, {owners} and {company} placeholders. Missing first name reads naturally ("Hey, is this the owner?"). */
export function fillLine(line: string, track: Track, first?: string | null, lead?: { niche?: string | null; company?: string | null }): string {
  const f = (first ?? "").trim();
  const owners = /generator/i.test(lead?.niche ?? "") ? "generator dealers" : /fenc/i.test(lead?.niche ?? "") ? "fence owners" : "contractors";
  return line
    .replace("is this {first}?", f ? `is this ${f}?` : "is this the owner?")
    .replace("Hey {first},", f ? `Hey ${f},` : "Hey,")
    .replace("is it {first} I'd ask for?", f ? `is it ${f} I'd ask for?` : "who should I ask for?")
    .replace(/\{first\}/g, f || "there")
    .replace(/\{owners\}/g, owners)
    .replace(/\{company\}/g, lead?.company?.trim() || "your business")
    .replace("{price}", SCRIPTS[track].price);
}
