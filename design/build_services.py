#!/usr/bin/env python3
"""Everything Cinder builds, as data. Generates one page per build, the /everything index, the homepage index
block and the site navigation. Run from the repo root:  python3 design/build_services.py"""
import re, pathlib, html
S = pathlib.Path(__file__).resolve().parent.parent / 'site'
ap = lambda t: t.replace("'", "’")
GROUPS = [('desk', 'Front desk'), ('cal', 'Calendar'), ('sales', 'Quotes'), ('money', 'Money'), ('after', 'After the job'), ('seen', 'Getting found'), ('team', 'Team and office'), ('custom', 'Custom')]
# pages that already exist, by hand: slug, group, name, one line
OLD = [('answering', 'desk', 'Answering', 'Every call and message gets a reply in seconds.'), ('booking', 'cal', 'Booking', 'Serious leads land on your calendar and show up.'),
       ('follow-up', 'sales', 'Follow-up', "Every quote and invoice gets chased until it's settled."), ('reviews', 'after', 'Reviews', 'Every happy customer gets asked for a review.'),
       ('websites', 'seen', 'Websites', 'A site that turns visitors into booked jobs.'), ('integrations', 'custom', 'Tool connections', 'Your calendar, your books and your lead sources, wired together.')]
STD = ('Is this part of a package?', "No. There are no packages. We build what your audit calls for and nothing else.")
def P(slug, group, name, short, h1, lede, does, line, cmp, faq): return dict(slug=slug, group=group, name=name, short=short, h1=h1, lede=lede, does=does, line=line, cmp=cmp, faq=faq + [STD])
NEW = [
P('phone-agent', 'desk', 'Phone agent', "A voice assistant picks up when you can't.", 'Every call gets picked up.',
  "A voice assistant answers when you can't, takes the details and books the estimate. It says who it is, and it hands the call to you when someone asks for a person.",
  [('Answers on the first rings', "Day, night and weekends, including while you're on a job."), ('Takes the details', 'Name, address, the job and how soon they need it.'), ('Books or hands off', 'The estimate goes on your calendar, or the call rings through to you.'), ('Writes it up', 'A summary and the recording land in your app.')],
  "The phone rings while you're on a roof. It still gets answered.",
  [('Voicemail takes the call.', 'The call gets answered.'), ('You call back tonight.', "The estimate is booked before you're off the roof."), ('You guess what they wanted.', 'You read the summary.')],
  [("Will callers know it isn't a person?", "Yes. It introduces itself as your business's assistant. We don't pretend it's a person."), ('Can it send calls to me?', 'Yes. You choose which calls ring through, such as emergencies or existing customers.')]),
P('website-chat', 'desk', 'Website chat', "Visitors get an answer while they're still on the page.", "Visitors get an answer while they're still on the page.",
  'A chat on your site answers questions about your services and your area, then offers a time for an estimate.',
  [('Answers from your own information', 'Services, service area, hours and how you price.'), ('Offers a time', "When someone is ready, it books the estimate instead of asking them to call."), ('Knows when to stop', "Anything it can't answer goes to you with the conversation attached."), ('Works after hours', 'Most people look at night. The chat is there when they do.')],
  'Someone is on your site at 10 PM with one question. They get an answer.',
  [('They leave to find a phone number.', 'They ask on the page.'), ('The form sits until morning.', "The estimate is booked tonight."), ('You answer the same five questions.', 'It answers them for you.')],
  [('What does it know?', 'Only what you give it: your services, area, hours and pricing rules.'), ('What if it gets a question wrong?', 'It hands off instead of guessing, and we tune it from the transcripts.')]),
P('social-messages', 'desk', 'Messages and DMs', 'Facebook, Instagram and Google messages, answered.', 'Every message gets a reply.',
  'Messages from Facebook, Instagram and your Google profile get the same fast reply as a call or a form.',
  [('One inbox', 'Every channel lands in one thread in your app.'), ('A reply in seconds', 'With times to pick from, not just "thanks for reaching out".'), ('Your questions first', 'Job type, address and timing before anything books.'), ('Nothing forgotten', 'A message that goes quiet gets a follow-up.')],
  'A lead messages three companies. The first real reply usually gets the job.',
  [('DMs get seen days later.', 'DMs get answered now.'), ('Five apps to check.', 'One thread.'), ('"Call us" as the reply.', 'A time to pick.')],
  [('Which channels?', 'Facebook, Instagram and Google Business messages. Others on request.'), ('Does it post for me?', 'No. This only answers messages. Posting is a separate build.')]),
P('lead-vetting', 'desk', 'Lead vetting', 'The serious ones reach you first.', 'The serious ones reach you first.',
  'Every new lead is asked your questions before it reaches you, so your time goes to jobs you actually want.',
  [('Your questions, asked for you', 'Job type, size, address, timing and budget range.'), ('Sorted by fit', 'Good fits are booked. Poor fits get a polite no.'), ('Out-of-area caught early', 'Before anyone drives to look at it.'), ('The answers travel with the lead', 'You walk in knowing what they said.')],
  "Not every lead is a job. You shouldn't have to find that out in person.",
  [('You drive out to a job you would never take.', 'You knew before you left.'), ('Every lead gets the same hour.', 'The good ones get the hour.'), ('You ask the same questions on every call.', 'They are already answered.')],
  [('Who decides what counts as a fit?', 'You do. We turn your rules into the questions.'), ('What happens to the ones that are not a fit?', 'They get a clear, polite answer, so nobody is left waiting.')]),
P('after-hours', 'desk', 'After hours', 'Nights and weekends, covered.', 'Nights and weekends, covered.',
  'Calls and messages that come in after you close get handled, and the urgent ones reach whoever is on call.',
  [('Urgent or not', 'It asks what is happening and sorts emergencies from things that can wait.'), ('The right person gets woken', 'Emergencies ring your on-call number. Nothing else does.'), ('Everything else is booked', 'For the next open slot, with a confirmation.'), ('A morning summary', 'What came in overnight and what was done with it.')],
  'The burst pipe at 2 AM and the quote request at 2 AM are not the same call.',
  [('Every night call wakes you.', 'Only the real emergencies do.'), ('Voicemail fills up over the weekend.', 'Monday starts with a booked calendar.'), ('You find out what you missed.', 'You read what was handled.')],
  [('Who is on call?', 'Whoever you set, on a rota you control.'), ('What counts as an emergency?', 'Your rules. We write them with you.')]),
P('reminders', 'cal', 'Reminders', 'Fewer no-shows.', 'They remember, because they were reminded.',
  "Every appointment gets a confirmation and reminders, and a customer who can't make it can move it without calling you.",
  [('Confirmation on booking', 'Time, address and what to expect.'), ('Reminders before the visit', 'The day before and the morning of.'), ('One-tap reschedule', 'They pick a new time. Your calendar updates.'), ('Freed slots get refilled', 'A cancellation is offered to the next lead waiting.')],
  "A no-show costs you the drive and the slot. A reminder costs nothing.",
  [('You show up to an empty house.', 'They confirmed this morning.'), ('Rescheduling takes three calls.', 'They moved it themselves.'), ('A cancelled slot stays empty.', 'It gets offered to someone else.')],
  [('Text or email?', 'Text first. Email as well if you want it.'), ('Can I change the wording?', 'Yes. It should sound like you.')]),
P('dispatch', 'cal', 'Scheduling and dispatch', 'The right crew on the right job.', 'The right crew on the right job.',
  'Jobs are placed on the calendar by who can do them, where they are and how long they take, and the day is rebuilt when something changes.',
  [('Jobs matched to crews', 'By skill, equipment and who is already nearby.'), ('Routes that make sense', 'Fewer miles between stops.'), ('The day adjusts', 'A job runs long and the rest of the day moves with it.'), ('Everyone is told', 'Crews and customers get the change without a round of calls.')],
  'One job running long should not cost you the afternoon.',
  [('The schedule lives in your head.', 'It lives on the calendar.'), ('A delay means six phone calls.', 'A delay means one update.'), ('Crews cross town twice a day.', 'Stops are grouped.')],
  [('Does it replace my scheduling software?', 'No. It works with what you use and does the arranging for you.'), ('Can I override it?', 'Always. It proposes, you decide.')]),
P('job-updates', 'cal', 'Job updates', 'Customers know when you are coming.', 'Customers know when you are coming.',
  'Customers get told when the crew is on the way, when the job starts and when it is done, without anyone in your office sending a text.',
  [('"On our way"', 'With a realistic arrival time.'), ('Running late', 'They hear it from you first.'), ('Job finished', 'With photos if you take them.'), ('Fewer "where are you" calls', 'Because they already know.')],
  'Most complaints start with not knowing what is going on.',
  [('The customer calls to ask where you are.', 'They were told twenty minutes ago.'), ('A delay becomes a bad review.', 'A delay becomes a heads-up.'), ('The job ends and nobody says so.', 'They get a done message with photos.')],
  [('Where does the timing come from?', 'Your calendar and, if you want, the crew marking a job started and finished.'), ('Does the crew need a new app?', 'No. One tap in the app you already have, or a text.')]),
P('estimates', 'sales', 'Estimates', 'The estimate goes out the same day.', 'The estimate goes out the same day.',
  'Measurements, photos and your notes become a draft estimate using your own prices. You check it and send it.',
  [('Built from your price book', 'Your materials, your labour, your margins.'), ('From photos and notes', 'Talk through the job or send pictures, and get a draft back.'), ('You approve every one', 'Nothing goes to a customer until you say so.'), ('Sent while they still care', 'The same day you looked at the job.')],
  'The first estimate in their inbox has an edge. Make it yours.',
  [('Estimates get written on Sunday night.', 'They are drafted before you are back at the truck.'), ('Every estimate starts from a blank page.', 'Every estimate starts from a draft.'), ('The customer waits a week.', 'The customer has it today.')],
  [('How accurate is the draft?', 'It is a starting point built from your prices. You check and adjust every one.'), ('Which trades?', 'Any trade with a price book. We set it up around how you measure and price.')]),
P('proposals', 'sales', 'Proposals', 'A proposal that looks like you spent an hour on it.', 'A proposal that looks like you spent an hour on it.',
  'An approved estimate becomes a clean proposal with scope, photos, options and a way to say yes.',
  [('Scope in plain words', 'What is included, what is not, and when.'), ('Options side by side', 'Good, better and best, so the choice is which, not whether.'), ('Sign from a phone', 'They accept without printing anything.'), ('You see when it is opened', 'So the follow-up is timed, not guessed.')],
  'Two contractors, the same price. The clearer proposal wins.',
  [('A number in a text message.', 'A proposal they can show their spouse.'), ('One price, take it or leave it.', 'Three options to choose from.'), ('You wonder if they saw it.', 'You know when they opened it.')],
  [('Can it use my branding?', 'Yes. Your logo, your colours, your terms.'), ('Does it chase the proposal?', 'That is the Follow-up build. They work together.')]),
P('invoicing', 'money', 'Invoices', 'Invoices go out and get chased.', 'Invoices go out and get chased.',
  'The invoice is sent when the job is marked done, and polite reminders go out until it is settled.',
  [('Sent the day the job ends', 'Not at the end of the month.'), ('Reminders on a schedule', 'Friendly first, firmer later, and they stop when it is paid.'), ('A way to pay in the message', 'Through the payment provider you already use.'), ('You see what is outstanding', 'By customer and by age.')],
  'Work you have finished and not been paid for is a loan you never agreed to.',
  [('Invoices go out when you find the time.', 'They go out when the job is done.'), ('Chasing money is awkward.', 'The reminders are not from you personally.'), ('You are not sure who owes what.', 'It is one list.')],
  [('Do you handle the money?', 'No. Payments go through your own provider. We send and chase the invoice.'), ('Can I stop reminders for one customer?', 'Yes, in one tap.')]),
P('bookkeeping', 'money', 'Bookkeeping prep', 'Receipts sorted before your accountant asks.', 'Receipts sorted before your accountant asks.',
  'Receipts, supplier bills and job costs are read, labelled and filed against the right job, ready for your bookkeeper.',
  [('Snap a receipt', 'It is read and filed against the job.'), ('Supplier bills from email', 'Pulled in without forwarding anything.'), ('Costs by job', 'So you can see which jobs actually made money.'), ('Handed over clean', 'Your bookkeeper gets a tidy file, not a shoebox.')],
  'You should know what a job made before you price the next one like it.',
  [('A shoebox of receipts in March.', 'Filed the day you bought it.'), ('Job profit is a feeling.', 'Job profit is a number.'), ('Your accountant chases you.', 'Your accountant has what they need.')],
  [('Does this replace my bookkeeper?', 'No. It does the sorting so they can do the accounting.'), ('Which accounting software?', 'We work with what you and your bookkeeper already use.')]),
P('review-replies', 'after', 'Review replies', 'Every review gets a reply.', 'Every review gets a reply.',
  'New reviews get a reply drafted in your voice. Good ones are answered quickly, and a bad one comes to you first.',
  [('Replies that sound like you', 'Not the same sentence under every review.'), ('Bad reviews come to you', 'With a suggested reply and the job history.'), ('Every platform', 'Google first, others if they matter in your trade.'), ('Nothing sits unanswered', 'Including the ones from last year.')],
  'People read the replies as closely as the reviews.',
  [('Reviews sit with no reply.', 'Each one is answered.'), ('A bad review catches you off guard.', 'You see it first, with a draft.'), ('"Thanks for the review" forty times.', 'A real reply each time.')],
  [('Does it post without me?', 'You choose. Many owners let good reviews post and approve anything under four stars.'), ('Can it remove a bad review?', 'No. Nobody honest can promise that.')]),
P('win-backs', 'after', 'Win-backs', 'Old customers hear from you again.', 'Old customers hear from you again.',
  'Past customers and quotes that went quiet get a message from you at the right moment, written for them.',
  [('Your old list, cleaned up', 'Customers and quotes from your books, texts and spreadsheets.'), ('A reason to write', 'A season, an anniversary of the job, or a quote that never got an answer.'), ('Replies come back to you', 'As leads, booked the same way as new ones.'), ('It stops when asked', 'One reply and they are off the list.')],
  'The cheapest lead you will ever get is someone who already hired you.',
  [('Old customers forget your name.', 'They hear from you once or twice a year.'), ('Dead quotes stay dead.', 'Some of them come back.'), ('More leads means more ad spend.', 'More leads from a list you already own.')],
  [('Is this spam?', 'No. It goes only to people who have dealt with you, and every message has a way to stop.'), ('How often?', 'Rarely. A couple of well-timed messages beats a monthly blast.')]),
P('maintenance-reminders', 'after', 'Service reminders', "Customers get reminded when it's time again.", "Customers get reminded when it's time again.",
  'Work that comes around again, such as servicing, sealing, staining or inspections, gets a reminder when it is due.',
  [('Due dates from the job', 'Set when the job is finished, by the type of work.'), ('A reminder with a time', 'They can book the visit from the message.'), ('Service plans', 'If you sell them, renewals and visits run themselves.'), ('A steady off-season', 'Repeat work fills the weeks new jobs do not.')],
  'A fence you built needs staining in two years. Somebody will be asked to do it.',
  [('Repeat work depends on their memory.', 'It depends on your reminder.'), ('Slow months are just slow.', 'Slow months have repeat visits in them.'), ('Plans are tracked on paper.', 'Plans run on their own.')],
  [('I do not do repeat work. Is this for me?', 'Maybe not. The audit will say.'), ('Can customers opt out?', 'Yes, with one reply.')]),
P('referrals', 'after', 'Referrals', 'Happy customers get asked to send a neighbor.', 'Happy customers get asked to send a neighbor.',
  'After a good job and a good review, the customer is asked if they know someone who needs the same thing.',
  [('Asked at the right moment', 'Right after they have told you they are happy.'), ('Easy to pass on', 'A link or a card they can forward.'), ('Tracked', 'You know who sent whom.'), ('A thank-you that goes out', 'Whatever you choose to offer, sent without you remembering.')],
  'Most happy customers would refer you. Almost none are asked.',
  [('Referrals happen by luck.', 'Referrals are asked for.'), ('You do not know who sent them.', 'It is on the lead.'), ('The thank-you gets forgotten.', 'It goes out the same day.')],
  [('Do I have to offer a reward?', 'No. Plenty of people refer without one.'), ('When does it ask?', 'Only after a positive review or reply.')]),
P('campaigns', 'after', 'Email and text campaigns', 'Your own list, put to work.', 'Your own list, put to work.',
  'Seasonal offers, openings in the schedule and news go to your own customers by email and text. No ad platform involved.',
  [('Written for you', 'Short, in your voice, with one thing to do.'), ('Sent to the right people', 'By the work they had done and where they live.'), ('Fill a slow week', 'An opening next week goes to the people most likely to take it.'), ('Replies become leads', 'Handled the same way as any other.')],
  'You already paid to win these customers once.',
  [('Your list sits in a spreadsheet.', 'Your list hears from you.'), ('A slow week stays slow.', 'A slow week gets an offer.'), ('Marketing means buying ads.', 'Marketing means talking to people who know you.')],
  [('Is this advertising?', 'No. We do not run ads. This goes only to your own customers.'), ('How do people stop getting them?', 'One reply or one click.')]),
P('local-search', 'seen', 'Local search', 'Your Google profile, kept current.', 'Your Google profile, kept current.',
  'Your Google Business Profile gets regular posts, fresh photos, answered questions and correct details, without you logging in.',
  [('Posts from real jobs', 'Recent work, in the towns you want more of.'), ('Questions answered', 'The ones people ask on your profile.'), ('Details kept right', 'Hours, services and service area.'), ('Pages for what you do', 'A page per service and area on your site, written properly.')],
  'When someone nearby searches for what you do, your profile is your shopfront.',
  [('A profile last updated two years ago.', 'A profile updated this week.'), ('Questions sit unanswered.', 'They are answered.'), ('One generic services page.', 'A page for each thing you do.')],
  [('Will this get me to number one?', 'Nobody honest can promise a ranking. This does the work that tends to help.'), ('Is this ads?', 'No. We do not run ads.')]),
P('job-photos', 'seen', 'Job photos to posts', 'Finished jobs turn into posts.', 'Finished jobs turn into posts.',
  'The crew takes a photo when the job is done. It becomes a post for your profile, your site and your social pages.',
  [('One photo in', 'From the crew, at the job.'), ('A caption written', 'What was done and where, in your voice.'), ('Posted where it counts', 'Google, your site gallery, Facebook and Instagram.'), ('You can approve first', 'Or let it run.')],
  'Your best marketing is work you have already done.',
  [('Photos stay on phones.', 'Photos become posts.'), ('You post when you remember.', 'It posts when you finish a job.'), ('Your gallery is three years old.', 'Your gallery is last week.')],
  [('Do customers have to agree?', 'We set it up so nothing identifying goes out without permission.'), ('What if a photo is bad?', 'It is skipped, or it waits for your approval.')]),
P('hiring', 'team', 'Hiring', 'Applicants screened before you pick up the phone.', 'Applicants screened before you pick up the phone.',
  'Applicants are asked your questions, the ones who fit are booked for a call, and everyone gets an answer.',
  [('Your questions, asked for you', 'Experience, licence, tools, availability, pay expectations.'), ('Fits booked straight in', 'Onto your calendar for a call or a ride-along.'), ('Everyone hears back', 'Including the ones who are not a fit.'), ('One list', 'Every applicant and where they stand.')],
  'Good tradespeople take the first decent offer. Be the first to call.',
  [('Applications pile up in email.', 'They are sorted as they arrive.'), ('You call ten to find two.', 'You call the two.'), ('Applicants never hear back.', 'Everyone gets an answer.')],
  [('Does it decide who I hire?', 'No. It asks your questions and books the call. You choose.'), ('Where do applicants come from?', 'Wherever you post. This handles what happens after they apply.')]),
P('team-assistant', 'team', 'Team assistant', 'Your crew asks, your own playbook answers.', 'Your crew asks, your own playbook answers.',
  'Your price book, procedures and past jobs become something the crew can ask by text, and get your answer back.',
  [('Answers from your documents', 'Prices, specs, procedures, warranty terms.'), ('Asked by text', 'From the job site, in plain words.'), ('New hires get up to speed', 'Without calling you for every question.'), ('It says when it does not know', 'And sends the question to you.')],
  'You are the only person who knows how everything is done. That does not scale.',
  [('Every question comes to you.', 'Most of them get answered first.'), ('New hires guess.', 'New hires ask.'), ('The procedures are in a binder.', 'The procedures answer back.')],
  [('Where does it get the answers?', 'Only from what you give it. It does not make up company policy.'), ('Who can use it?', 'Whoever you add. You can limit what each person sees.')]),
P('field-notes', 'team', 'Field notes', 'Talk for a minute, get the job notes written.', 'Talk for a minute, get the job notes written.',
  'The crew records a voice note at the job. It comes back as clean notes, a materials list and next steps on the job record.',
  [('Speak instead of type', 'A minute of talking at the truck.'), ('Notes on the job', 'Written up and filed where the office can see them.'), ('Materials and follow-ups pulled out', "So nothing is left in someone's head."), ('In English and Spanish', 'Spoken in one, written in whichever you read.')],
  'What the crew saw on site is worth more than what anyone remembers on Friday.',
  [('Notes get written later, or never.', 'Notes are done before the truck leaves.'), ('The office calls the crew to ask.', 'The office reads the job.'), ('Details get lost between people.', 'They are on the record.')],
  [('Does the crew need training?', 'No. If they can leave a voicemail, they can do this.'), ('What about poor signal?', 'It sends when the phone is back in range.')]),
P('reports', 'team', 'Reports', 'Your numbers, every Monday.', 'Your numbers, every Monday.',
  'One short report each week: leads in, jobs booked, quotes open, money owed and what needs you.',
  [('The handful that matter', 'Not forty charts.'), ('Where leads came from', 'So you know which sources pay.'), ('What is stuck', 'Quotes with no answer, invoices past due.'), ('Sent to your phone', 'Read it in two minutes.')],
  'You cannot fix what you only find out about at tax time.',
  [('You run the business on gut feel.', 'You run it on last week.'), ('You find out a source stopped working months later.', 'You see it the week it happens.'), ('Reports mean logging in.', 'The report comes to you.')],
  [('Can I pick what is in it?', 'Yes. We start from the standard set and change it to suit you.'), ('Where does the data come from?', 'The tools you already use, connected during setup.')]),
P('call-review', 'team', 'Call review', 'Every call read, the ones that matter flagged.', 'Every call read, the ones that matter flagged.',
  'Calls are transcribed and summarised. The ones where a job was lost, or a customer was unhappy, are flagged for you.',
  [('Every call written up', 'Who called, what they wanted, what happened.'), ('Lost jobs flagged', 'With the moment it went wrong.'), ('Patterns across a month', 'The question that keeps costing you work.'), ('Coaching without listening to hours of audio', 'Read three calls, not three hundred.')],
  'Somewhere in last month there is a call that explains a job you did not get.',
  [('Nobody knows what was said.', 'Every call has a summary.'), ('You hear about problems from the customer.', 'You see them the same day.'), ('Training is guesswork.', 'Training uses real calls.')],
  [('Is recording calls allowed?', 'Rules vary by state. We set it up to follow yours, including telling callers.'), ('Who sees the calls?', 'Only the people you choose.')]),
P('custom-agents', 'custom', 'Custom agents', 'An agent built for one job in your business.', 'An agent built for one job in your business.',
  'Some work does not fit a standard build. We make an AI agent that does that one job the way you do it, with your rules and your tools.',
  [('Built around one task', 'Ordering materials, checking permits, answering supplier emails, whatever keeps landing on you.'), ('It uses your tools', 'Your inbox, your calendar, your job software.'), ('It asks before it acts', 'On anything you mark as needing a person.'), ('You can see what it did', 'Every step is logged in your app.')],
  'If you can explain the job to a new hire, we can probably build it.',
  [('The task waits for you.', 'The task is done when you look.'), ('You hire for it.', 'You build it once.'), ('Nobody knows how it is done but you.', 'It is written down and running.')],
  [('What can an agent do?', 'Read, write, look things up, fill in forms and use the tools you connect. It works inside limits you set.'), ('What will it not do?', 'Spend money or send anything you have marked for approval without asking.')]),
P('custom-builds', 'custom', 'Custom builds', "If it doesn't need a person, we can build it.", "If it doesn't need a person, we can build it.",
  'The builds on this site are the common ones. If your business has a job that eats your week and is not on the list, tell us.',
  [('Start with the audit', 'We find where your time and jobs are going.'), ('We scope it with you', 'What it does, what it will not do, and what it costs.'), ('We build and watch it', 'It runs in your app with everything else.'), ('The one thing we do not do', 'Run ads. Everything here works on leads and customers you already have.')],
  'The list on this site is where we started, not where we stop.',
  [('"There is no software for that."', 'There is now.'), ('You bend your business to fit a tool.', 'The tool is built around your business.'), ('A dozen logins.', 'One app.')],
  [('How do I know if it can be built?', 'Ask. If it cannot be done well, we will say so.'), ('How long does it take?', 'It depends on the job. You get a timeline with the scope.')]),
]
ALL = [dict(slug=s, group=g, name=n, short=d) for s, g, n, d in OLD] + NEW
ORDER = {'desk': ['answering', 'phone-agent', 'website-chat', 'social-messages', 'lead-vetting', 'after-hours'], 'cal': ['booking', 'reminders', 'dispatch', 'job-updates'], 'sales': ['estimates', 'proposals', 'follow-up'], 'money': ['invoicing', 'bookkeeping'],
         'after': ['reviews', 'review-replies', 'win-backs', 'maintenance-reminders', 'referrals', 'campaigns'], 'seen': ['websites', 'local-search', 'job-photos'], 'team': ['hiring', 'team-assistant', 'field-notes', 'reports', 'call-review'], 'custom': ['custom-agents', 'integrations', 'custom-builds']}
BY = {p['slug']: p for p in ALL}
e = lambda t: html.escape(ap(t), quote=False)
def index_block(cls='ix', short=False):
    out = []
    for gid, gname in GROUPS:
        links = ''.join(f'<a href="/{s}"><b>{e(BY[s]["name"])}</b>' + (f'<span>{e(BY[s]["short"])}</span>' if short else '') + '</a>' for s in ORDER[gid])
        out.append(f'<div class="{cls}-g rv"><h3>{e(gname)}</h3>{links}</div>')
    return f'<div class="{cls}">' + ''.join(out) + '</div>'
def nav():
    cols = ''.join(f'<div><p class="gm-h">{e(gn)}</p>' + ''.join(f'<a href="/{s}">{e(BY[s]["name"])}</a>' for s in ORDER[gid]) + '</div>' for gid, gn in GROUPS)
    mob = ''.join(f'<p class="gm-h">{e(gn)}</p>' + ''.join(f'<a href="/{s}">{e(BY[s]["name"])}</a>' for s in ORDER[gid]) for gid, gn in GROUPS)
    return f'''<nav class="glinks" aria-label="Main"><ul>
      <li class="has-menu mega"><button type="button" aria-expanded="false" aria-controls="sysmenu">What we build</button>
        <div class="gmenu mega" id="sysmenu"><div class="gm-cols">{cols}</div><a class="gm-all" href="/everything"><b>Everything we build</b><span>{len(ALL)} builds and counting. The one thing we don’t do is run ads.</span></a><a class="gm-all gm-q" href="/questions"><b>Questions</b><span>Straight answers before you book.</span></a></div></li>
      <li class="has-menu"><button type="button" aria-expanded="false" aria-controls="swmenu">Software</button>
        <div class="gmenu" id="swmenu"><ul><li><a href="/software"><b>The app</b><span>Everything we build, in one app on your phone.</span></a></li><li><a href="/integrations"><b>Integrations</b><span>Works with your calendar, your books and your lead sources.</span></a></li><li><a href="/whats-new"><b>What’s new</b><span>What we’ve shipped lately.</span></a></li></ul></div></li><li><a href="/trades">Trades</a></li><li><a href="/free-audit">The free audit</a></li><li><a href="/story">Our story</a></li><li><a href="/about">About</a></li>
    </ul></nav>''', f'''<details class="gmob"><summary aria-label="Menu"><i></i><i></i></summary><div class="gmob-p">
      <a href="/everything">Everything we build</a>{mob}<p class="gm-h">Cinder</p><a href="/software">Software</a><a href="/whats-new">What’s new</a><a href="/trades">Trades</a><a href="/free-audit">The free audit</a><a href="/story">Our story</a><a href="/questions">Questions</a><a href="/about">About</a>
    </div></details>'''
def ribbon(i):  # a wave of its own for every page: amplitude, frequency, width, twist, tilt, roll
    r = lambda k, a, b: round(a + (b - a) * ((i * 0.6180339887 * (k + 1) + k * 0.37) % 1), 3)
    return f'{r(0,.16,.58)},{r(1,2.2,8.6)},{r(2,.2,.58)},{r(3,3,16)},{r(4,.3,.95)},{r(5,-.2,.2)}'
def main():
    shell = (S / 'answering.html').read_text()
    head = shell[:shell.index('<header')]; hdr = re.search(r'<header class="gnav".*?</header>', shell, flags=re.S).group(0)
    tail = shell[shell.index('<section class="p-close"'):]
    tail = re.sub(r'<script src="/assets/cinder-plates.js"></script>\n<script src="/assets/scenes.js"></script>\n<script type="module" src="/assets/cinder-objects.js"></script>\n<script type="module" src="/assets/cinder-field.js"></script>\n', '', tail)
    gname = dict(GROUPS)
    def page(title, desc, slug, body, tl=None):
        h = head.replace('<title>Answering | Cinder Revenue Company</title>', f'<title>{e(title)} | Cinder Revenue Company</title>').replace('https://cinderrevenue.com/answering', f'https://cinderrevenue.com/{slug}').replace('content="Answering | Cinder Revenue Company"', f'content="{e(title)} | Cinder Revenue Company"')
        h = re.sub(r'(name="description" content=")[^"]*', lambda m: m.group(1) + e(desc), h); h = re.sub(r'(property="og:description" content=")[^"]*', lambda m: m.group(1) + e(desc), h)
        (S / f'{slug}.html').write_text(h + hdr + '\n<main id="main">\n' + body + '\n' + (tl or tail))
    PL = {'phone-agent': ('One call, start to finish', 'It takes the details while they are still on the line.'), 'website-chat': ('A question at 10 PM', 'The visitor leaves with a time, not a number to call tomorrow.'),
          'social-messages': ('Three apps, one inbox', 'Every message is answered from one place.'), 'lead-vetting': ('Your questions, asked first', 'Poor fits get a polite no before anyone drives out.'),
          'after-hours': ('One night', 'Emergencies ring the person on call. Everything else is booked for the morning.'), 'reminders': ('From booked to the knock on the door', 'Three messages, sent without you.'),
          'dispatch': ('One day, three crews', 'A job runs long and the afternoon is rebuilt around it.'), 'job-updates': ('What the customer sees', 'Four messages, none of them typed by your office.'),
          'estimates': ('Measurements in, draft out', 'Built from your price book. You check every one.'), 'proposals': ('Three options, one yes', 'Move across the options. The choice becomes which, not whether.'),
          'invoicing': ('What is owed, by age', 'Reminders go out until each one is settled.'), 'bookkeeping': ('Every receipt, filed', 'Read, labelled and put against the right job.'),
          'review-replies': ('Two reviews', 'The good one is answered. The bad one comes to you with a draft.'), 'win-backs': ('A year of past customers', 'Each one hears from you when the moment comes round.'),
          'maintenance-reminders': ('The loop', 'Repeat work comes round because someone is reminded.'), 'referrals': ('One customer becomes a street', 'Asked once, right after the review.'),
          'campaigns': ('One message, the right people', 'Sent to your own customers. No ad platform involved.'), 'local-search': ('A profile kept current', 'Updated every week without you logging in.'),
          'job-photos': ('One photo, three posts', 'Taken by the crew, written up and posted for you.'), 'hiring': ('Seven applicants', 'Everyone gets an answer. You only call the ones who fit.'),
          'team-assistant': ('A question from the job site', 'Answered from your own documents, with the source.'), 'field-notes': ('A minute of talking', 'Written up and filed before the truck leaves.'),
          'reports': ('The Monday report', 'The handful of numbers that matter, and what needs you.'), 'call-review': ('One call, read for you', 'The moment the job was lost, flagged.'),
          'custom-agents': ('An agent at work', 'It runs inside limits you set and asks before it crosses one.'), 'custom-builds': ('Your process, built', 'Describe how you do it. We turn each step into a part.')}
    btail = tail.replace('<script type="module" src="/assets/cinder-flow.js"></script>', '<script src="/assets/cinder-builds.js" defer></script>\n<script src="/assets/cinder-builds2.js" defer></script>\n<script type="module" src="/assets/cinder-flow.js"></script>')
    import pages2
    for i, p in enumerate(NEW):
        rel = [s for s in ORDER[p['group']] if s != p['slug']][:4] or ['custom-builds']
        if len(rel) < 3: rel += [s for s in ('answering', 'booking', 'follow-up') if s not in rel][:3 - len(rel)]
        extra, t2 = '', btail
        if p['slug'] == 'invoicing':
            extra = '<section class="stage3"><div class="wrap"><div><h2 class="rv">Every invoice leaves a trail.</h2><p class="rv d1">Sent, reminded, paid. Each step is on the record, so you never have to wonder where one stands.</p></div><div class="stage3-host" data-plate="CinderTape" role="img" aria-label="A machined printer feeding out a tape of tickets: invoice sent, reminder sent, invoice paid. Sample data."></div></div></section>\n<script>window.CinderTapeTickets=[["Job finished, Friday","Invoice sent","The same day"],["Day 3","Reminder sent","A friendly nudge"],["Day 7","Reminder sent","A little firmer"],["Day 9","Invoice paid","Reminders stopped"],["Job finished, Monday","Invoice sent","The same day"],["Day 2","Invoice paid","No reminder needed"]]</script>'
            t2 = btail.replace('<script src="/assets/cinder-builds.js" defer></script>', '<script src="/assets/cinder-plates.js"></script>\n<script type="module" src="/assets/cinder-objects.js"></script>\n<script src="/assets/cinder-builds.js" defer></script>')
        k = ORDER[p['group']].index(p['slug'])
        body = pages2.compose(p, k, dict(i=i, gname=gname[p['group']], rel=[BY[s] for s in rel], ribbon=ribbon, num=ALL.index(p) + 1, total=len(ALL), plate=PL[p['slug']], extra=extra))
        page(p['name'], p['lede'], p['slug'], body, t2)
    hub = f'''<section class="ov ov-hero svc" aria-labelledby="h1"><div class="backdrop" data-flow="wave" data-p="{ribbon(7)}"></div><div class="wrap">
  <p class="eb">Everything we build</p><h1 id="h1" class="rv">If AI can do it, we build it.</h1><p class="rv d1">{len(ALL)} builds today, in eight parts of your business, and room for whatever yours needs next. The one thing we don’t do is run ads.</p>
  <div class="acts rv d2"><a class="btn" href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta>Book your free audit</a></div>
</div></section>
<section class="ixp"><div class="wrap">{index_block('ix', True)}</div></section>'''
    page('Everything we build', f'{len(ALL)} things we build for service businesses, from answering the phone to custom agents. Everything except ads.', 'everything', hub)
    # navigation and footer on every page
    n_desk, n_mob = nav(); count = 0
    for f in sorted(S.glob('*.html')):
        t = f.read_text()
        if '<header class="gnav"' not in t: continue
        t2 = re.sub(r'<nav class="glinks".*?</nav>', lambda m: n_desk, t, count=1, flags=re.S); t2 = re.sub(r'<details class="gmob">.*?</details>', lambda m: n_mob, t2, count=1, flags=re.S)
        t2 = t2.replace('<div><h4>Systems</h4><ul><li><a href="/answering">Answering</a></li>', '<div><h4>What we build</h4><ul><li><a href="/everything">Everything we build</a></li><li><a href="/answering">Answering</a></li>')
        if f.name == 'index.html':
            blk = f'''<section id="everything" class="ixs" aria-labelledby="h-every"><div class="wrap"><div class="ixs-h"><h2 id="h-every" class="rv">If AI can do it, we build it.</h2><p class="rv d1">{len(ALL)} builds today, in eight parts of your business, and room for whatever yours needs next. The one thing we don’t do is run ads.</p></div>{index_block()}</div></section>'''
            t2 = re.sub(r'<section id="everything".*?</section>\n?', '', t2, flags=re.S); k = t2.index('<section id="back"'); t2 = t2[:k] + blk + '\n' + t2[k:]
        if t2 != t: f.write_text(t2); count += 1
    # every question in one place
    GEN = [('What does the audit cost?', 'Nothing. It is free, and you keep the plan whether or not you work with us.'), ('What happens in the audit?', 'You bring rough numbers: leads a month, your average job, how many quotes you close. We walk your business from the first call to the review, including after hours, and show you where jobs are going.'),
           ('Do I have to buy a package?', 'No. There are no packages. We build what your audit calls for and nothing else.'), ('How is it priced?', "Every fix is scoped after the audit, only if you want it, and priced to your business's size."),
           ('Do you run ads?', 'No. Everything we build works on leads and customers you already have.'), ('Who builds it?', "Sam does. He builds and watches every client's system himself, and takes on a few businesses at a time."),
           ('Where do I see what it is doing?', 'In one app on your phone. Every reply, booking and follow-up is there.'), ('Does it work with the tools I already use?', 'Yes. It connects to your calendar, your books and your lead sources.')]
    qa = lambda items: ''.join(f'<details class="rv"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in items)
    secs = f'<section class="faq"><div class="wrap"><h2 class="rv">The basics.</h2><div>{qa(GEN)}</div></div></section>'
    for gid, gn in GROUPS:
        items = [(f'{BY[sl]["name"]}: {q}', a) for sl in ORDER[gid] if 'faq' in BY[sl] for q, a in BY[sl]['faq'][:-1]]
        if items: secs += f'<section class="faq"><div class="wrap"><h2 class="rv">{e(gn)}.</h2><div>{qa(items)}</div></div></section>'
    nq = len(GEN) + sum(len(p['faq']) - 1 for p in NEW)
    page('Questions', 'Straight answers about the audit, what we build, and how it works.', 'questions', f'''<section class="ov ov-hero svc" aria-labelledby="h1"><div class="backdrop" data-flow="wave" data-p="{ribbon(11)}"></div><div class="wrap">
  <p class="eb">Questions</p><h1 id="h1" class="rv">Straight answers.</h1><p class="rv d1">{nq} questions owners ask before they book, answered plainly. If yours is not here, ask it on the call.</p>
  <div class="acts rv d2"><a class="btn" href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta>Book your free audit</a></div>
</div></section>''' + secs)
    BAR = '''<div class="bookbar" id="bookbar" hidden><p><b>Free audit.</b> It starts with a 15-minute call, and you keep the plan.</p><a class="btn" href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta>Book your free audit</a></div>
<script>(function(){var b=document.getElementById('bookbar');if(!b)return;b.hidden=false;var end=document.querySelector('.p-close,.closing,footer'),near=false;function f(){b.classList.toggle('on',scrollY>innerHeight*.8&&!near)}if(end&&'IntersectionObserver' in window)new IntersectionObserver(function(e){near=e[0].isIntersecting;f()},{rootMargin:'0px 0px -20% 0px'}).observe(end);addEventListener('scroll',f,{passive:true});f()})();</script>
<script src="/assets/cinder-chat.js" defer></script>
'''
    for f in sorted(S.glob('*.html')):
        t = f.read_text()
        if '<header class="gnav"' not in t: continue
        t2 = re.sub(r'<div class="bookbar".*?</script>\n(?:<script src="/assets/cinder-chat.js" defer></script>\n)?', '', t, flags=re.S).replace('</body>', BAR + '</body>', 1)
        t2 = t2.replace('<li><a href="/privacy">Privacy</a></li>', '<li><a href="/questions">Questions</a></li><li><a href="/privacy">Privacy</a></li>') if '/questions">Questions' not in t2 else t2
        if t2 != t: f.write_text(t2)
    print('pages written:', len(NEW) + 1, 'nav updated on', count, 'files; builds:', len(ALL))
if __name__ == '__main__': main()
