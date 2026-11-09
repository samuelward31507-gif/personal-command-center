// Posts for the Cinder Facebook page, Instagram and TikTok, plus the daily rotation. Pure: no I/O.
// Rules: lead with more jobs, not "AI". No made-up results or testimonials. Stats only with their source.

export type Channel = "page" | "video";
export type ContentPost = { key: string; channel: Channel; label: string; body: string; shoot?: string; file?: string };

/** Facebook page + Instagram feed. Same caption works on both; pair it with a demo screenshot or a plain text graphic. */
export const PAGE_POSTS: ContentPost[] = [
  { key: "p-missed", channel: "page", label: "Missed calls", body: `Most homeowners don't leave a voicemail. Only about 2% of callers who don't get through leave one (Invoca).

The rest call the next company on Google.

Cinder texts every missed caller back in seconds, answers their questions, and books the estimate on your calendar. You keep your number and your software.

Fence, roofing, concrete, HVAC: if you're on a job when the phone rings, this is for you. Link in bio.` },
  { key: "p-quotes", channel: "page", label: "Quotes that go quiet", body: `You sent the quote. They said they'd think about it. Then nothing.

That's not a no. Nobody followed up.

Cinder follows up on every quote by text on day 2, 5, 10 and 21 until it's a yes or a no, and answers their questions in seconds. The jobs you already quoted are the easiest ones to close.` },
  { key: "p-guess", channel: "page", label: "Owners guess wrong", body: `Business owners guessed they answered 97% of their calls. Call recordings showed 66% (Service Direct).

Nobody's lazy. You're on a roof, in a trench, under a car. The phone rings anyway.

The fix isn't answering more. It's making sure nobody who calls goes unanswered. That's what we build.` },
  { key: "p-founder", channel: "page", label: "Who I am", body: `I'm Sam, founder of Cinder Revenue Company, based in Colorado.

I build and watch every client's system myself. That means I only take on a few companies at a time, and if something breaks you hear from me before you notice.

What we do: every lead answered in 10 seconds, every quote chased to a yes or a no, past customers brought back. Done for you. No contract.` },
  { key: "p-founding", channel: "page", label: "Founding offer", body: `We're taking our first 3 clients at half-price setup.

Book & Close guarantees 5 booked appointments in your first 30 days, or your next month is free. And your monthly doesn't start until your first booked appointment lands.

No contract. You keep your number. If you're a contractor doing 20+ leads a month, book a 15-minute call. Link in bio.` },
  { key: "p-calc", channel: "page", label: "What it costs you", body: `Quick math for contractors:

40 missed calls a month. About half are new customers. If even a few would have booked an estimate, and you close 1 in 4, that's real money walking to the next company.

We built a 20-second calculator on our site. Put in your own numbers, nothing gets sent anywhere. Link in bio.` },
  { key: "p-detailers", channel: "page", label: "Detailers", body: `Detailers: your best customers already know you. They just need a reminder.

Ceramic maintenance, seasonal details, interior refreshes. Most of that work doesn't get booked because nobody asks at the right time.

We text your past customers when they're due and book them back in. One-time Reactivation Sprint: if it doesn't book at least 3x the fee in jobs, it's free.` },
  { key: "p-reviews", channel: "page", label: "Reviews", body: `The best time to ask for a review is the hour after the job, while they're still looking at the work.

Most owners mean to ask. Then the next job starts.

Cinder sends a review request after every job, automatically, in your words. It's built into Book & Close and up.` },
  { key: "p-speed", channel: "page", label: "First to answer", body: `Homeowners often call more than one company. Whoever answers first has the best shot at the estimate.

79% of people say they'd switch to a business that replies faster (Invoca, 2026).

10 seconds. That's how fast Cinder replies to a new lead, day or night, with your price range and a time to come out.` },
  { key: "p-how", channel: "page", label: "How it works", body: `How Cinder works, in four steps:

1. 30-minute intake call: your service area, prices and calendar.
2. We build it around your trade, in your voice. You approve every message.
3. Go live. Every new lead answered in 10 seconds and booked.
4. Every month: quote follow-ups, review requests, and a Monday text report.

You show up to the appointments. We handle the rest.` },
  { key: "p-weekend", channel: "page", label: "Saturday calls", body: `Saturday, 10am. A homeowner finally has time to deal with the fence. They call three companies.

The first one to answer gets the estimate. On a Saturday, that's usually nobody.

Cinder answers every call, form and message in 10 seconds, nights and weekends included, and books the estimate on your calendar.` },
  { key: "p-forms", channel: "page", label: "Website forms", body: `When was the last time you checked your website form at 9pm?

Homeowners fill out quote forms at night, after work. By morning they've filled out two more.

Every form gets a text back in 10 seconds, with your price range and a time to come out. Link in bio.` },
  { key: "p-angi", channel: "page", label: "Paid leads", body: `Paying for Angi, Thumbtack or Facebook leads?

Those leads get sent to 3 or 4 companies at once. The one that replies first usually wins.

Cinder replies to every paid lead in 10 seconds, so the money you spend on leads turns into booked estimates.` },
  { key: "p-noshow", channel: "page", label: "No-shows", body: `Booked estimates that don't show cost you a drive and an hour.

Cinder texts a reminder the day before and the morning of. If they can't make it, it rebooks them automatically instead of letting the job disappear.` },
  { key: "p-spanish", channel: "page", label: "English and Spanish", body: `Half your calls in Spanish? Cinder answers in whichever language the customer writes in, English or Spanish, and books the estimate the same way.

Every lead answered. Every language.` },
  { key: "p-time", channel: "page", label: "Your evenings", body: `How many hours a week do you spend texting people back, chasing quotes and answering "are you available Thursday?"

That's the work Cinder takes off your plate. You show up to the appointments. We handle the rest.` },
  { key: "p-nocontract", channel: "page", label: "No contract", body: `What it takes to start with Cinder:

1. A 30-minute call about your service area, prices and calendar.
2. You approve the messages.
3. That's it.

No contract. You keep your number and your software. Monthly doesn't start until your first booked appointment.` },
  { key: "p-oldquotes", channel: "page", label: "Old quotes", body: `How many quotes from the last 90 days never got a yes or a no?

Those are the easiest jobs you'll close this month. They already asked you for a price.

When we set you up, we follow up on every open quote from the last 90 days. That's where the first week's jobs come from.` },
  { key: "p-detail-slow", channel: "page", label: "Detailers: slow weeks", body: `Detailers: slow weeks aren't bad luck. They're customers who were due and never got a reminder.

We text your customers when they're due and offer next week's open slots first. Your calendar fills before the week gets slow.` },
  { key: "p-question", channel: "page", label: "Question post", body: `Contractors, honest question: what happens to a call that comes in while you're on a roof?

Voicemail? Call back at 6pm? Your wife answers?

Drop it in the comments. I'm collecting answers.` },
];

/** Ready-made demo videos (in /public/content). Download, post to TikTok, Reels and Shorts with the caption. */
export const DEMO_CLIPS: ContentPost[] = [
  { key: "c-missed", channel: "video", label: "Demo: missed call, booked", file: "/content/demo-missed-call.mp4", body: `A fence company misses a call on a job site. 6 seconds later the customer gets a text back, answers two questions, and the estimate is on the calendar. Nobody touched a phone.

Contractors: this is what every missed call should look like. Link in bio.

#fencecontractor #contractorlife #smallbusiness #homeimprovement` },
  { key: "c-quote", channel: "video", label: "Demo: quote follow-up", file: "/content/demo-quote.mp4", body: `The quote went quiet for two days. This is the follow-up that won it: "a bit more than I was hoping" gets financing or a cheaper option, not a discount. Then a start date.

Most quotes get sent once and never chased. Link in bio.

#contractor #fencecompany #salesfollowup #smallbusinessowner` },
  { key: "c-price", channel: "video", label: "Demo: price range first", file: "/content/demo-price-range.mp4", body: `Booked out and tired of driving to tire-kickers? Every lead gets your price range before anything is booked. Only serious jobs land on your calendar.

Link in bio.

#contractorbusiness #fenceinstallation #roofingcontractor #tradesman` },
  { key: "c-detail", channel: "video", label: "Demo: detailer past customers", file: "/content/demo-detailer.mp4", body: `Detailers: your ceramic customers should be back every few months. Most never get asked. One text when they're due, a slot on the calendar, an add-on at booking.

Link in bio.

#autodetailing #ceramiccoating #detailingbusiness #mobiledetailing` },
  { key: "c-reviews", channel: "video", label: "Demo: review requests", file: "/content/demo-reviews.mp4", body: `The best time to ask for a review is an hour after the job, while they're still looking at the work. Happy customers get your Google link. Unhappy ones come straight to you.

Link in bio.

#googlereviews #contractor #smallbusinesstips #homeservices` },
];

/** TikTok, Reels and Shorts. No face needed: screen recording of the demo plus text on screen and a voiceover. */
export const VIDEO_SCRIPTS: ContentPost[] = [
  { key: "v-10s", channel: "video", label: "10-second reply", shoot: "Screen-record the Try it demo on cinderrevenue.com on your phone: fill the form, show the reply landing. Timer on screen.", body: `Hook (text on screen): "A contractor's lead got a reply in 10 seconds"

VO: Watch this. A homeowner fills out a quote form at 9pm. ... Ten seconds later they get a text with a price range and a time to come out. No one touched a phone.
VO: Most companies reply the next morning. By then the homeowner has often booked someone else.
End card: "Cinder. Every lead answered in 10 seconds."` },
  { key: "v-voicemail", channel: "video", label: "Nobody leaves voicemails", shoot: "Phone ringing on a job site (stock or your own), then cut to the missed-call text-back on screen.", body: `Hook: "Only 2% of people leave a voicemail"

VO: If you run a trade business and you miss a call, that homeowner isn't leaving a message. They're calling the next company on Google.
VO: So we text them back in seconds, answer their questions, and book the estimate. You're still on the job.
End card: "Missed calls are jobs. Answer them all."` },
  { key: "v-quote", channel: "video", label: "The quote follow-up", shoot: "Screen-record the quote follow-up texts from the demo (or mock them up in your notes app).", body: `Hook: "You didn't lose that job. You just never followed up."

VO: Here's what happens to most contractor quotes. Sent once. Never chased.
VO: This is what follow-up looks like on autopilot: day 2, day 5, day 10, day 21, until it's a yes or a no.
VO: The jobs you already quoted are the easiest ones to close.` },
  { key: "v-19", channel: "video", label: "19 and building this", shoot: "Desk, laptop, the CRM on screen. Voiceover or just captions.", body: `Hook: "I'm 19 and I cold call contractors every day"

VO: Most of them say the same thing: they're not short on leads, they lose them. Missed calls on job sites. Quotes nobody chased.
VO: So I built a system that fixes that, and I'm setting it up for my first 3 founding clients at half-price setup.
VO: Follow along if you want to see how it goes.` },
  { key: "v-day", channel: "video", label: "A day of cold calling", shoot: "Time-lapse of your desk during a call block, dial counter on screen. Captions only.", body: `Hook: "150 cold calls to contractors in one day. Here's what happened."

Captions over time-lapse: dials, conversations, meetings booked (use your real numbers from the Dashboard).
Close: "The thing every owner told me: [the most common thing you heard that day]."` },
  { key: "v-detail", channel: "video", label: "Detailers: past customers", shoot: "Screen-record a sample reactivation text and a reply booking a slot (mock it up; label it as an example).", body: `Hook: "Detailers, you're sitting on money"

VO: Every customer who got a ceramic coating last year should be back for maintenance. Most never get asked.
VO: One text when they're due, a slot on your calendar, done. That's a Reactivation Sprint.` },
  { key: "v-math", channel: "video", label: "The missed-call math", shoot: "Screen-record the calculator on cinderrevenue.com with real-looking inputs.", body: `Hook: "What missed calls actually cost a fence company"

VO: Plug in your own numbers. 40 missed calls, a $6,000 average job, close 1 in 4 estimates.
VO: (pause on the result) That's what's walking to the next company. It takes 20 seconds, link in bio.` },
];

export const ALL_POSTS: ContentPost[] = [...PAGE_POSTS, ...DEMO_CLIPS, ...VIDEO_SCRIPTS];

/** Next post on a channel: one never posted, else the one posted longest ago. */
export function nextPost(channel: Channel, posted: { key: string; at: string }[]): ContentPost {
  const pool = ALL_POSTS.filter(p => p.channel === channel);
  const last = new Map<string, number>();
  for (const p of posted) last.set(p.key, Math.max(last.get(p.key) ?? 0, Date.parse(p.at)));
  return pool.find(p => !last.has(p.key)) ?? [...pool].sort((a, b) => (last.get(a.key) ?? 0) - (last.get(b.key) ?? 0))[0];
}
