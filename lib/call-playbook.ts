// Cold-call playbook by track (trades vs detailing), built on the current offer: open, dig, pitch, guarantee, price, objections. Pure: no I/O.
// Offer source of truth: site/index.html (plans) and site/offer-config.js (founding spots).

export type Track = "trades" | "detailing";
export type Objection = { id: string; label: string; key: string; say: string; then?: string };

/** The one ask on every call: a 15-minute walkthrough, offered as two times. */
export const CLOSE = "I'm not going to sell you on the phone. Give me 15 minutes and I'll show you exactly what it looks like for your shop, with your numbers. Does tomorrow morning or Thursday afternoon work better?";

export const FOUNDING = "We're taking our first 3 clients at half-price setup, so if it's a fit you'd get in at half off.";

export const VOICEMAIL: Record<Track, string> = {
  trades: "Hey {first}, Sam with Cinder. Quick one about the calls and quotes that slip through when you're on a job. I'll shoot you a text. Talk soon.",
  detailing: "Hey {first}, Sam with Cinder. Quick one about getting your past customers back in without you chasing them. I'll shoot you a text. Talk soon.",
};

export const GATEKEEPER = "Hey, Sam with Cinder. Is the owner around? ... No worries, when's the best time to catch them? And is it {first} I'd ask for?";

const SHARED: Objection[] = [
  { id: "busy", label: "Busy, call back", key: "b", say: "No problem, I'll be quick another time. Is tomorrow morning or afternoon better?", then: "Log Busy, call back with the time they gave." },
  { id: "info", label: "Send me info", key: "i", say: "Happy to. So I send the right thing: is it the missed calls or the quotes that go quiet that costs you more?", then: "Text the info now, then: \"It's a 2-minute read. Can I grab 15 minutes Thursday to walk you through it?\"" },
  { id: "not-interested", label: "Not interested", key: "x", say: "Totally fair. Is that because you've got calls and follow-up handled, or just not a good time?", then: "If handled: \"Good, most shops aren't. Mind if I check back in a couple months?\" Then let them go." },
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
    open: "Hey, is this {first}? Sam with Cinder. I'll be quick, I know you're probably on a job. Straight question: could you handle more work right now?",
    dig: [
      "If yes: most owners I talk to aren't short on leads, they lose them. When someone calls after 5 or while you're on a job, what happens to that call?",
      "And the quotes you send out, how many just go quiet? Who chases those?",
      "If no: press W, \"No, we're slammed\".",
    ],
    pitch: "Here's what we do. Every lead that calls, fills out a form or messages you gets a text back in 10 seconds, gets your price range, and gets booked on your calendar. Every quote you send gets followed up until it's a yes or a no. You don't touch any of it, and you keep your number and your software.",
    guarantee: "We guarantee 5 booked appointments in your first 30 days, or your next month is free. And monthly doesn't start until your first appointment lands.",
    price: "Most shops start on Book & Close: $2,500 setup and $1,997 a month. Our first 3 clients get half off setup, so $1,250.",
    objections: [...SHARED, ...TRADES_ONLY],
  },
  detailing: {
    open: "Hey, is this {first}? Sam with Cinder. I'll be quick. Straight question: could you handle more cars right now?",
    dig: [
      "If yes: the fastest cars to fill your calendar are past customers. How many haven't been back in 3 months or more?",
      "And when someone calls while you're mid-detail, what happens?",
      "If no: press W, \"No, we're booked out\".",
    ],
    pitch: "We text your past customers when they're due and book them back in, text back anyone who calls while you're working, and ask every happy customer for a review. It all runs in your words, and you approve every message.",
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
