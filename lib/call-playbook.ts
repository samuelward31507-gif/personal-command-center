// Cold-call playbook by track (trades vs detailing), built on the current offer: open, dig, pitch, guarantee, price, objections. Pure: no I/O.
// Offer source of truth: site/index.html (plans) and site/offer-config.js (founding spots).

export type Track = "trades" | "detailing";
export type Objection = { id: string; label: string; key: string; say: string; then?: string };

/** The soft ask: assume the meeting, ask about logistics. Never "are you interested" or "would you be open to". */
export const CLOSE = "Easiest thing is if I just show you what it'd look like for your shop. Are you more of a morning or afternoon guy? ... Cool, tomorrow at 10 or Wednesday at 2?";

export const FOUNDING = "We're taking our first 3 clients at half-price setup, so if it's a fit you'd get in at half off.";

export const VOICEMAIL: Record<Track, string> = {
  trades: "Hey {first}, Sam with Cinder. Quick one about the calls and quotes that slip through when you're on a job. I'll shoot you a text. Talk soon.",
  detailing: "Hey {first}, Sam with Cinder. Quick one about getting your past customers back in without you chasing them. I'll shoot you a text. Talk soon.",
};

export const GATEKEEPER = "Calm, like you already know them: \"Hey, it's Sam. Is the owner around?\" ... \"No worries, when's he usually back? And is it {first} I'd ask for?\" Don't pitch the receptionist. If they push: \"It's about the calls that come in while he's on a job. I'll catch him direct.\"";

const SHARED: Objection[] = [
  { id: "busy", label: "Busy, call back", key: "b", say: "No worries. When's a better time to catch you, morning or afternoon?", then: "Log Busy, call back with the time they gave." },
  { id: "info", label: "Send me info", key: "i", say: "Sure, what's the best email? And so I send the right thing, is it more the missed calls or the quotes that go quiet?", then: "Send the info email from Call mode while you're on the line, then: \"If it looks useful, are you a morning or afternoon guy for a quick look?\"" },
  { id: "not-interested", label: "Not interested", key: "x", say: "All good. Just so I know, is it that you've already got that handled, or it's just not a priority right now?", then: "If handled: \"Makes sense, appreciate you hearing me out.\" Let them go. If not a priority: \"Fair. Mind if I check back in a couple months?\"" },
  { id: "price", label: "How much?", key: "$", say: "{price} The monthly doesn't start until your first booked appointment lands, and there's no contract.", then: "Ask: \"What's an average job worth to you?\" One extra job a month usually covers it. Then book the 15 minutes." },
  { id: "expensive", label: "Too expensive", key: "e", say: "Fair question. What's a typical job worth to you? ... So if it books one extra job a month, it's paid for. And if it doesn't hit the guarantee, your next month is free.", then: "Then the close." },
  { id: "software", label: "Already have software", key: "s", say: "Good, keep it. We work alongside Jobber, Housecall, whatever you use, and you keep your number. What happens to a quote after it goes out?", then: "Let them answer. The gap is usually follow-up." },
  { id: "burned", label: "Got burned by agencies", key: "g", say: "That's fair, a lot of agencies sell leads and ads. We don't. We just make sure the leads you already get don't slip through. No contract, cancel anytime.", then: "Then the close." },
  { id: "robot", label: "Is it a bot?", key: "r", say: "The replies go out automatically, but in your words. You approve every message before it's live, and anything tricky comes straight to you.", then: "Then the close." },
];

const TRADES_ONLY: Objection[] = [
  { id: "answer-all", label: "We answer every call", key: "a", say: "That's rare, nice. What about after 5 and on weekends? And the quotes you send, who chases those?", then: "Most say nobody. That's the pitch: quote follow-up on days 2, 5, 10 and 21." },
  { id: "enough-work", label: "No, we're slammed", key: "w", say: "Good spot to be in. Then it's not about more work, it's better work for less of your time. How many estimates do you drive out to that were never going to buy? ... We answer every lead, ask your questions and give your price range before anything books, so you only drive out to the serious ones. Quotes get chased without you.", then: "Then the close. Skip the 5-appointment guarantee here; say: no contract, and monthly doesn't start until your first booked appointment." },
];

const DETAILING_ONLY: Objection[] = [
  { id: "regulars", label: "Customers come back anyway", key: "a", say: "The good ones do. How many from last year haven't been back in 6 months? Those are the ones we bring in, and we only text people who gave you their number.", then: "Then the close." },
  { id: "slammed", label: "No, we're booked out", key: "w", say: "Good spot to be in. Then it's not more cars, it's steadier money with less chasing. How many of your customers are on a maintenance plan? ... We offer a plan after every job, fill slow weeks from your own customer list, and get a review from every happy customer, without you texting anyone.", then: "Then the close. Lead with Repeat Revenue here, not the sprint." },
];

export type Script = { open: string; dig: string[]; pitch: string; guarantee: string; price: string; objections: Objection[] };

export const SCRIPTS: Record<Track, Script> = {
  trades: {
    open: "Hey {first}, it's Sam with Cinder Revenue. I know I'm catching you out of the blue. Can I take 30 seconds to tell you why I called, and then you can tell me to get lost?",
    dig: [
      "\"Last thing before I let you go. Most fence owners I talk to have one of three things going on: missed calls while they're on a job, quotes that go quiet, or doing office work at night. Which one's biggest for you?\"",
      "\"Where's most of your work coming from right now?\" and \"Roughly how many estimates a month?\"",
      "\"Anyone else, like a partner, who should be on that call?\" Then text the invite while you're still on the phone.",
    ],
    pitch: "Reason I'm calling: I work with fence companies on the calls they miss while they're out on jobs. Quick question: when you're up on a job and the phone rings, what happens to that call? ... (let them talk, then) Yeah, and most of those people don't leave a voicemail, they just call the next fence company. So I set it up so every missed call gets a text back from you in about 10 seconds. It answers their questions, gives your price range and books the estimate on your calendar. Then every quote you send gets followed up until it's a yes or a no. I guarantee 5 booked estimates in your first 30 days, or your next month is free.",
    guarantee: "We guarantee 5 booked appointments in your first 30 days, or your next month is free. And monthly doesn't start until your first appointment lands.",
    price: "Most shops start on Book & Close: $2,500 setup and $1,997 a month. Our first 3 clients get half off setup, so $1,250.",
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
    guarantee: "Our Reactivation Sprint is a one-time $997: we text your past customers with a real offer and book every reply. If it doesn't book at least 3 times the fee in jobs, it's free.",
    price: "The Reactivation Sprint is a one-time $997. To keep it running every month, Repeat Revenue is $750 setup and $497 a month, half off setup for our first 3 clients.",
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
