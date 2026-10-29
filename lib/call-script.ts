// Call mode talk track and objection handling. Pure: no I/O. The founder places every call himself.
// No invented statistics; prices come from the offer catalog passed in.

export type ScriptInput = {
  firstName: string; company: string; location: string; notes: string;
  setupFee: number; monthlyFee: number; today?: Date;
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
    { key: "open", label: "Open", tip: "Smile, slow down. Asking permission lowers their guard.",
      say: `${hi}, it's Samuel with Cinder. Did I catch you at a bad time?` },
    { key: "reason", label: "Reason for the call", tip: "Then stop talking and let them answer.",
      say: `I'll be quick. I work with ${niche}${city ? ` around ${city}` : ""}. When a new lead fills out your form or calls after hours, how fast does someone usually get back to them?` },
    { key: "dig", label: "Dig into the pain", tip: "Listen for: voicemail, 'next day', 'when I get to it'. That's the gap.",
      say: `And when you're out on a ${job} job and miss a call, what happens to that lead?` },
    { key: "bridge", label: "Bridge to the fix", tip: "One sentence. Don't pitch features.",
      say: `That's exactly what we fix. We set up a system that answers and follows up with every new lead within a minute, day or night, and books the good ones straight onto your calendar.` },
    { key: "ask", label: "Ask for the meeting", tip: "Offer two times. Silence after the question is fine.",
      say: `I'm not trying to sell you on the phone. Would you be open to 15 minutes where I show you what that would look like for ${company}? Does ${d1} or ${d2} work better?` },
    { key: "close", label: "Lock it in", tip: "Confirm the best number and email, then log 'Meeting booked'.",
      say: `Perfect. I'll send a calendar invite. What's the best email for it? And is this the best number to reach you?` },
  ];
}

export function buildObjections(input: ScriptInput): Objection[] {
  const { job } = nicheOf(`${input.company} ${input.notes}`);
  return [
    { key: "not-interested", heard: "Not interested",
      say: `Totally fair. One quick question before I go: if a lead called while you were on a job today, would you know about it within five minutes?`,
      then: `If they hesitate: "That's the only thing I'd want to show you. 15 minutes, and if it's not useful I'll get out of your hair."` },
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
      say: `Depends on what you need. Setups start at ${money(input.setupFee)} with a monthly plan from ${money(input.monthlyFee)}. Before price means anything, I'd want to see if it actually pays for itself for you.`,
      then: `"If one extra ${job} job a month covers it, would that be worth 15 minutes to look at?"` },
    { key: "enough-leads", heard: "We get plenty of leads",
      say: `That's a great spot to be in. Then it's about closing more of the ones you already get. How many quotes go out in a month that never hear back?`,
      then: `"Following up on those automatically is usually the fastest win. Want me to show you?"` },
    { key: "ai", heard: "Is this a robot / AI?",
      say: `No, it's me, Samuel. A real person. The system we set up uses AI to respond to your leads instantly, but you stay in control of every booking.`,
      then: `Go back to the reason for the call.` },
    { key: "gatekeeper", heard: "Gatekeeper: 'What's this about?'",
      say: `It's Samuel with Cinder. I help ${job} companies make sure new leads get answered fast. Who handles that side of the business?`,
      then: `Get the owner's name and the best time to reach them. Log "Wrong contact" or "Callback requested".` },
  ];
}
