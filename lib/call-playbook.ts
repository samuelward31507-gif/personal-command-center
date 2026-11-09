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
  { id: "busy", label: "Busy, call back", key: "b", say: "No problem, I'll be quick another time. Is tomorrow morning or afternoon better?", then: "Log Busy, call back with the time they gave." },
  { id: "info", label: "Send me info", key: "i", say: "Happy to. So I send the right thing: is it the missed calls or the quotes that go quiet that costs you more?", then: "Text the info now, then: \"It's a 2-minute read. Can I grab 15 minutes Thursday to walk you through it?\"" },
  { id: "not-interested", label: "Not interested", key: "x", say: "Totally fair, most guys say that before they know what it is. Is it that you've got missed calls covered, or it's just not a priority right now?", then: "If handled: \"Good, most shops aren't. Mind if I check back in a couple months?\" Then let them go." },
  { id: "price", label: "How much?", key: "$", say: "{price} The monthly doesn't start until your first booked appointment lands, and there's no contract.", then: "Ask: \"What's an average job worth to you?\" One extra job a month usually covers it. Then book the 15 minutes." },
  { id: "expensive", label: "Too expensive", key: "e", say: "I hear you. What's one job worth to you? ... So one extra job a month covers it, and if we don't hit the guarantee your next month is free. You're not betting on me, I am.", then: "Then the close." },
  { id: "software", label: "Already have software", key: "s", say: "Good, keep it. We work alongside Jobber, Housecall, whatever you use, and you keep your number. What happens to a quote after it goes out?", then: "Let them answer. The gap is usually follow-up." },
  { id: "burned", label: "Got burned by agencies", key: "g", say: "That's fair, most of them sell you leads or ads. We don't. We work the leads you already pay for, and there's no contract. Cancel by text.", then: "Then the close." },
  { id: "robot", label: "Is it a bot?", key: "r", say: "The replies go out automatically, but in your words. You approve every message before it's live, and anything tricky comes straight to you.", then: "Then the close." },
];

const TRADES_ONLY: Objection[] = [
  { id: "answer-all", label: "We answer every call", key: "a", say: "That's rare, nice. What about after 5 and on weekends? And the quotes you send, who chases those?", then: "Most say nobody. That's the pitch: quote follow-up on days 2, 5, 10 and 21." },
  { id: "enough-work", label: "No, we're slammed", key: "w", say: "Good spot to be in. Then it's not more work, it's better work for less of your time. How many hours a week go to calls, texting people back and chasing quotes? And how many estimates do you drive out to that were never going to buy? ... We answer every lead for you, ask your questions and give your price range before anything gets booked, so you only drive out to the ones worth it. Quotes get chased without you. Same crew, better jobs, your evenings back. And when you're booked out, that's the time to get picky and charge more.", then: "Then the close. Skip the 5-appointment guarantee here; say: no contract, and monthly doesn't start until your first booked appointment." },
];

const DETAILING_ONLY: Objection[] = [
  { id: "regulars", label: "Customers come back anyway", key: "a", say: "The good ones do. How many from last year haven't been back in 6 months? Those are the ones we bring in, and we only text people who gave you their number.", then: "Then the close." },
  { id: "slammed", label: "No, we're booked out", key: "w", say: "Love that. Then it's not more cars, it's steadier money for less chasing. How many of your customers are on a maintenance plan? ... We offer a maintenance plan after every job, fill the slow weeks before they happen from your own customer list, and get a review from every happy customer, without you texting anyone. Booked out is the time to raise prices, and reviews are what let you.", then: "Then the close. Lead with Repeat Revenue here, not the sprint." },
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
    pitch: "Fence guys I talk to all say the same thing: homeowners call three or four companies, and whoever talks to them first gets their foot in the door. When you're out on a job you can't pick up, so someone else gets that first conversation. I set it up so every missed call gets a text back in seconds and the estimate books itself on your calendar. How are you handling calls while you're out on a job right now? ... (let them talk, then) That's exactly what this fixes.",
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
    pitch: "Detailers I talk to all say the same thing: customers love the job, then never come back, not because they left, just because nobody reminded them. I set it up so your past customers get a text when they're due and book themselves back in. How are you getting past customers back right now? ... (let them talk, then) That's exactly what this fixes.",
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
