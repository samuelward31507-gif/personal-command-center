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
  { id: "info", label: "Send me info", key: "i", say: "Will do. What's the best cell? And honestly, it'll make more sense on a 15-minute call with your numbers. Wednesday at 10 or 2?", then: "Send the info email from Call mode while you're on the line, then: \"If it looks useful, are you a morning or afternoon guy for a quick look?\"" },
  { id: "not-interested", label: "Not interested", key: "x", say: "Fair. Before I go, how many quotes are you sending a week?", then: "If they answer, ask: \"And out of 10, how many sign?\" and go back to the script. If not: \"Respect. Appreciate your time.\" Next dial." },
  { id: "price", label: "How much?", key: "$", say: "{price} The monthly doesn't start until your first booked appointment lands, and there's no contract.", then: "Ask: \"What's an average job worth to you?\" One extra job a month usually covers it. Then book the 15 minutes." },
  { id: "expensive", label: "Too expensive", key: "e", say: "Fair question. What's a typical job worth to you? ... So if it books one extra job a month, it's paid for. And if it doesn't hit the guarantee, your next month is free.", then: "Then the close." },
  { id: "software", label: "We use Jobber", key: "s", say: "Perfect, we plug into it. Jobber sends the quote. We make sure someone chases it. What happens to a quote after it goes out?", then: "Let them answer. The gap is usually follow-up." },
  { id: "burned", label: "Got burned by agencies", key: "g", say: "That's fair, a lot of agencies sell leads and ads. We don't. We just make sure the leads you already get don't slip through. No contract, cancel anytime.", then: "Then the close." },
  { id: "robot", label: "Is it a bot?", key: "r", say: "The replies go out automatically, but in your words. You approve every message before it's live, and anything tricky comes straight to you.", then: "Then the close." },
];

const TRADES_ONLY: Objection[] = [
  { id: "answer-all", label: "We answer every call", key: "a", say: "Respect. When a lead comes in at 7pm on a Saturday, what happens to it?", then: "Let them answer. Then: \"Most homeowners call two or three companies and go with whoever gets back first. We text every missed call and web form back in about 10 seconds and book them on your calendar, even when you're on a job.\" Then the close." },
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
    open: "Hey {first}, it's Sam with Cinder. I'll be honest, this is a cold call. Want to hang up, or give me 30 seconds?",
    dig: [
      "\"What's the best cell for the invite?\" Text it while you're still on the phone.",
      "\"Roughly how many quotes do you send a month, and what's an average job?\" Log both in the notes.",
      "\"Anyone else, like a partner, who should be on that call?\"",
    ],
    pitch: "I work with fence companies on the quotes that go quiet after you send them. Quick question: out of 10 quotes you send, about how many sign? ... (let them talk, then) So about half the people you drove out to and measured went somewhere else. Do you usually find out why, or do they just stop answering? ... (let them talk, then) When someone goes quiet after a quote, how many times do you follow up? ... (let them talk, then) That's normal, you're on jobs all day. But the guy who follows up three or four times usually gets the job, even if he's more expensive. What's an average fence job for you? ... (let them talk, then) So if just one more of those quiet quotes signed each month, that's [job] a month. About [job x 12] a year.",
    close: "That's what we do. When you send a quote, we text that customer on day 2, 5, 10 and 21 until it's a yes or a no. You don't touch it. Let me show you how it'd work for you. 15 minutes. Tomorrow at 10 or Wednesday at 2?",
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

/** Fill {first} and {price} placeholders. Missing first name reads naturally ("Hey, is this the owner?"). */
export function fillLine(line: string, track: Track, first?: string | null): string {
  const f = (first ?? "").trim();
  return line
    .replace("is this {first}?", f ? `is this ${f}?` : "is this the owner?")
    .replace("Hey {first},", f ? `Hey ${f},` : "Hey,")
    .replace("is it {first} I'd ask for?", f ? `is it ${f} I'd ask for?` : "who should I ask for?")
    .replace(/\{first\}/g, f || "there")
    .replace("{price}", SCRIPTS[track].price);
}
