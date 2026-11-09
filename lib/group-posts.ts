// Facebook group post scripts and rotation. Pure: no I/O.

export type GroupScript = { key: string; label: string; body: string };

/** Lead with more jobs, not "AI". One question at the end so people comment. Edit them on the Groups page. */
export const DEFAULT_GROUP_SCRIPTS: GroupScript[] = [
  { key: "after-hours", label: "After-hours calls", body: `Question for the owners in here: when a homeowner calls after 5 or on a Saturday and nobody picks up, what happens to that job?

Most of the ones I've talked to say the same thing. They don't leave a voicemail. They call the next company on Google.

I set up a system that texts those callers back in seconds and books the estimate on your calendar. Happy to show anyone how it works, no pitch. Comment "show me" and I'll send it over.` },
  { key: "dead-quotes", label: "Dead quotes", body: `How many quotes did you send last month that never got a yes or a no?

For most crews it's a pile. Nobody had time to chase them.

I help owners follow up on every open quote automatically by text until it's a yes or a no, and it brings back a few jobs a month that were already sold once. If you want to see what that looks like, drop a "quotes" below.` },
  { key: "past-customers", label: "Past customers", body: `Owners: when's the last time you reached out to your past customers?

Stain, repairs, gates, the neighbor who asked who did their fence. Most of that work never gets booked because nobody asks.

I set up a simple text campaign to past customers that books those jobs for you. Want me to show you how it works? Comment "past" and I'll message you.` },
  { key: "speed", label: "Who answers first", body: `Real question: when a homeowner fills out a quote form on your site, how long until they hear back?

I've been asking owners this all month. The honest answer is usually "that night" or "next morning." By then they've got two other companies coming out.

The shop that answers first usually gets the estimate. I set up a system that replies in about 10 seconds with your price range and a time to come out. Comment "fast" and I'll show you how it works, no pitch.` },
  { key: "reviews", label: "Reviews", body: `Owners: how many of your jobs last month turned into a Google review?

Most guys I talk to do great work and have half the reviews of the shop down the street, because nobody asks at the right moment.

I set up an automatic text that goes out right after the job, while the customer is still happy. If you want the exact wording I use, comment "reviews" and I'll send it.` },
  { key: "detailing-rebook", label: "Detailers: rebooking", body: `Detailers: how many of your ceramic and maintenance customers actually come back on schedule without you reaching out?

Most shops I talk to have hundreds of past customers sitting in their phone who'd book if someone just texted them at the right time.

I run a simple text campaign that reminds them when they're due and books them back in. Comment "rebook" and I'll show you how it works.` },
  { key: "office", label: "No office manager", body: `For the owner-operators in here without an office manager: who's answering the phone while you're on a job?

Not a knock, I get it, you can't do both. But every call that goes to voicemail is a job someone else gets.

I set up text-back for missed calls that answers in seconds and books the estimate for you. Free to see how it works, comment "office" and I'll DM you.` },
];

/** The script to use next in a group: one you haven't posted there yet, else the one used longest ago. */
export function nextScript(scripts: GroupScript[], usedInGroup: { script: string; at: string }[]): GroupScript {
  if (!scripts.length) return DEFAULT_GROUP_SCRIPTS[0];
  const last = new Map<string, number>();
  for (const u of usedInGroup) last.set(u.script, Math.max(last.get(u.script) ?? 0, Date.parse(u.at)));
  const unused = scripts.find(s => !last.has(s.key));
  if (unused) return unused;
  return [...scripts].sort((a, b) => (last.get(a.key) ?? 0) - (last.get(b.key) ?? 0))[0];
}

/** Days until a group is due again (0 or less = post today). Never posted = due now. */
export function daysUntilDue(lastPostedAt: string | null, everyDays: number, now = Date.now()): number {
  if (!lastPostedAt) return 0;
  return Math.ceil(everyDays - (now - Date.parse(lastPostedAt)) / 86400000);
}

export const groupSource = (name: string) => `Facebook group: ${name}`.slice(0, 120);
