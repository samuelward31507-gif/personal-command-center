// Cold-call playbook by track (trades vs detailing), built on the current offer: open, dig, pitch, guarantee, price, objections. Pure: no I/O.
// Offer source of truth: site/index.html (plans).

export type Track = "trades" | "detailing";
export type Objection = { id: string; label: string; key: string; say: string; then?: string };

/** The soft ask: assume the meeting, ask about logistics. Never "are you interested" or "would you be open to". */
export const CLOSE = "Easiest thing is if I just show you what it'd look like for your shop. Are you more of a morning or afternoon guy? ... Cool, tomorrow at 10 or Wednesday at 2?";

export const RISK = "And the monthly doesn't start until your first appointment actually books. No contract.";

export const VOICEMAIL: Record<Track, string> = {
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

const TRADES_ONLY: Objection[] = [
  { id: "answer-all", label: "We answer every call", key: "a", say: "That's rare, nice. What about Saturdays, or when you're on another call? Most guys tell me that's where they lose a few.", then: "Let them answer. Then: \"Most homeowners call two or three companies and go with whoever gets back first. We text every missed call and web form back in about 10 seconds and book them on your calendar, even when you're on a job.\" Then the close." },
  { id: "high-close", label: "We close 6+ of 10", key: "h", say: "That's really good, honestly better than most. So you're probably not losing much on quotes. Where do jobs slip for you, leads coming in after hours or on weekends?", then: "Switch to leads: \"When a lead calls at 7pm on a Saturday, what happens to it?\" Pitch Never Miss a Lead ($697/mo), then the close." },
  { id: "perfect", label: "Everything's perfect", key: "f", say: "Then honestly, you probably don't need me. Last thing: when's the last time you found out a quote you sent went to someone else?", then: "Story: go back to the math (average job x one more a month). Never: \"Respect. Appreciate your time.\" Next dial." },
  { id: "enough-work", label: "No, we're slammed", key: "w", say: "Good spot to be in. Then it's not about more work, it's better work for less of your time. How many estimates do you drive out to that were never going to buy? ... We answer every lead, ask your questions and give your price range before anything books, so you only drive out to the serious ones. Quotes get chased without you.", then: "Then the close. Skip the 5-appointment guarantee here; say: no contract, and monthly doesn't start until your first booked appointment." },
];

const DETAILING_ONLY: Objection[] = [
  { id: "regulars", label: "Customers come back anyway", key: "a", say: "The good ones do. How many from last year haven't been back in 6 months? Those are the ones we bring in, and we only text people who gave you their number.", then: "Then the close." },
  { id: "slammed", label: "No, we're booked out", key: "w", say: "Good spot to be in. Then it's not more cars, it's steadier money with less chasing. How many of your customers are on a maintenance plan? ... We offer a plan after every job, fill slow weeks from your own customer list, and get a review from every happy customer, without you texting anyone.", then: "Then the close. Lead with the Reactivation campaign here." },
];

export type Script = { open: string; dig: string[]; pitch: string; close?: string; guarantee: string; price: string; objections: Objection[] };

export const SCRIPTS: Record<Track, Script> = {
  trades: {
    open: "Hey {first}, it's Sam with Cinder. I'll be honest, this is a cold call. Want to hang up, or give me 30 seconds and you can decide?",
    dig: [
      "\"What's the best cell? I'll text you the link and a 2-minute video so you know what we're covering.\" Text it while you're still on the phone.",
      "\"Roughly how many leads do you get a week, and what's an average job?\" Log both in the notes.",
      "\"Anyone else, like a partner, who should be on that call?\"",
    ],
    pitch: "The reason I'm calling: most {owners} lose jobs two ways. One, a homeowner calls while you're on a job, gets voicemail, and calls the next company. Two, you send a quote and never hear back. Which one hits you more? ... (let them talk, then) Missed calls: \"What happens to a call that comes in on a Saturday right now?\" Quotes: \"Out of 10 quotes you send, how many do you hear back from without chasing?\" Neither: \"Love that. Most guys who say that have an office person. What happens after she goes home?\" ... (let them talk, then) That's exactly what I fix. When you can't pick up, the homeowner gets a text from your business in about 10 seconds, it asks your questions, and books the estimate on your calendar. Every quote gets followed up until it's a yes or a no. I set it up and run it.",
    close: "Easiest is I show you in 15 minutes, set up as {company}. Tomorrow at 10 or Wednesday at 2? ... Perfect. I'll text you the link and a 2-minute video so you know what we're covering. What's the best cell for that?",
    guarantee: "We guarantee 5 booked appointments in your first 30 days, or your next month is free (3 if you get under 30 leads a month). And the monthly doesn't start until we book your first appointment.",
    price: "Book & Close is $1,997 to set up and $1,497 a month, and nothing monthly until we book your first appointment. One extra job covers it. If it's just the missed calls, Never Miss a Lead is $997 to set up and $697 a month.",
    objections: [...SHARED, ...TRADES_ONLY],
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
