// Call mode talk track and objection handling. Pure: no I/O. The founder places every call himself.
// No invented statistics; prices come from the offer catalog passed in.

export type ScriptInput = {
  firstName: string; company: string; location: string; notes: string;
  setupFee: number; monthlyFee: number; today?: Date;
  me?: string;    // your first name
  brand?: string; // the name you say on calls
  priceLine?: string; // the founding-offer price answer (lib/founding-offer priceScript); falls back to the tier price
  spotsLeft?: number;
};
export type ScriptStep = { key: string; label: string; say: string; tip: string };
export type Objection = { key: string; heard: string; say: string; then: string };

export function nicheOf(text: string): { niche: string; job: string } {
  const t = text.toLowerCase();
  if (/\b(pool|pools|spa|spas)\b/.test(t)) return { niche: "pool builders", job: "pool" };
  if (/\bfenc(e|es|ing)\b/.test(t)) return { niche: "fence companies", job: "fence" };
  if (/\broof/.test(t)) return { niche: "roofers", job: "roof" };
  if (/\b(landscap|hardscap|turf)/.test(t)) return { niche: "landscaping companies", job: "landscaping" };
  return { niche: "contractors", job: "project" };
}

export function cityOf(location: string): string {
  const first = location.split(/[,/·]/)[0]?.trim() ?? "";
  const cleaned = first.replace(/\b[A-Z]{2}\b$/, "").trim();
  return cleaned && !/not found|unknown|n\/a/i.test(cleaned) ? cleaned : "";
}

/** Next two weekdays after today, as names ("Thursday", "Friday"). */
export function nextTwoWeekdays(today = new Date()): [string, string] {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const out: string[] = [];
  const d = new Date(today);
  while (out.length < 2) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(names[d.getDay()]);
  }
  return [out[0], out[1]];
}

const money = (n: number) => "$" + n.toLocaleString("en-US");

export function buildScript(input: ScriptInput): ScriptStep[] {
  const { niche, job } = nicheOf(`${input.company} ${input.notes}`);
  const city = cityOf(input.location);
  const hi = input.firstName ? `Hey ${input.firstName}` : "Hey there";
  const [d1, d2] = nextTwoWeekdays(input.today);
  const company = input.company || "your company";
  return [
    { key: "open", label: "Open", tip: "Smile, slow down. Say it like you're calling a friend's business.",
      say: `${hi}, it's ${input.me || "Sam"} with ${input.brand || "Cinder"}. Quick one, I'll be fast.` },
    { key: "reason", label: "Reason for the call", tip: "Then stop talking. Their answer is the pitch.",
      say: `I help ${niche}${city ? ` around ${city}` : ""} book more jobs from the calls they already get. When you're out on a ${job} job and a homeowner calls, what happens to that call?` },
    { key: "dig", label: "Dig into the pain", tip: "Listen for: voicemail, 'I call back later', 'quotes go quiet'. That's where the jobs leak.",
      say: `And the quotes you send out, how many never hear back?` },
    { key: "bridge", label: "Bridge to the fix", tip: "One sentence. Jobs, not features. Don't say AI unless they ask.",
      say: `That's what we fix. Every missed call gets a text back from your business in seconds, the homeowner's questions get answered, and the estimate lands on your calendar. Quotes get followed up until it's a yes or a no.` },
    { key: "ask", label: "Ask for the meeting", tip: "Offer two times. Silence after the question is fine.",
      say: `I'm not trying to sell you on the phone. Would you be open to 15 minutes where I show you what that would look like for ${company}? Does ${d1} or ${d2} work better?` },
    { key: "close", label: "Lock it in", tip: "Text them the booking link while you're still on the phone, then log 'Meeting booked'.",
      say: `Perfect. I'll text you a calendar link right now so it's locked in. Is this the best number for that? And what's the best email for the invite?` },
  ];
}

export function buildObjections(input: ScriptInput): Objection[] {
  const { job } = nicheOf(`${input.company} ${input.notes}`);
  return [
    { key: "not-interested", heard: "Not interested",
      say: `Totally fair. Are you booked out right now, or is it more that you've been burned by marketing companies before?`,
      then: `If burned: "Makes sense. We don't sell leads or ads. We help you book more of the calls you already get. 15 minutes, and if it's not useful I'll get out of your hair." If booked out: "Good problem. When does it slow down?" Log a callback for then.` },
    { key: "send-info", heard: "Just send me some info",
      say: `Happy to. So I send the right thing: what's the bigger headache right now, missed calls or leads that go cold after you quote?`,
      then: `"Honestly it's easier to show you than to explain in an email. 15 minutes this week?"` },
    { key: "busy", heard: "I'm busy right now",
      say: `No problem at all. When's better, later today or tomorrow morning?`,
      then: `Log "Callback requested" with that date.` },
    { key: "have-someone", heard: "We already have someone / a CRM",
      say: `Good, that means you care about follow-up. Most of the companies we work with had something too. The gap is usually speed in the first five minutes. How fast does your current setup answer a web lead at 9pm?`,
      then: `If it's slow: "That window is where most jobs get lost. Worth 15 minutes to see the difference?"` },
    { key: "price", heard: "How much is it?",
      say: input.priceLine || `Depends on what you need. Setups start at ${money(input.setupFee)} with a monthly plan from ${money(input.monthlyFee)}. Before price means anything, I'd want to see if it actually pays for itself for you.`,
      then: `${input.spotsLeft !== undefined ? `Spots left: ${input.spotsLeft}. ` : ""}"If one extra ${job} job a month covers it, would that be worth 15 minutes to look at?"` },
    { key: "enough-leads", heard: "We get plenty of leads",
      say: `That's a great spot to be in. Then it's about closing more of the ones you already get. How many quotes go out in a month that never hear back?`,
      then: `"Following up on those automatically is usually the fastest win. Want me to show you?"` },
    { key: "ai", heard: "Is this a robot / AI?",
      say: `No, it's me, ${input.me || "Sam"}. A real person. The system we set up uses AI to respond to your leads instantly, but you stay in control of every booking.`,
      then: `Go back to the reason for the call.` },
    { key: "gatekeeper", heard: "Gatekeeper: 'What's this about?'",
      say: `It's ${input.me || "Sam"} with ${input.brand || "Cinder"}. I help ${job} companies book more jobs from the calls they already get. Who handles that side of the business?`,
      then: `Get the owner's name and the best time to reach them. Log "Wrong contact" or "Callback requested".` },
  ];
}
