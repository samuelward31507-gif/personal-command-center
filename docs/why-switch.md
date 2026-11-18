# Why a fence or home-service contractor switches to Cinder

Ten things the app does today, each with the screen where you can see it. Nothing here is planned work, and nothing
here is a claim about another product. If a line stops being true in the code, take it out of this file.

## 1. Every lead gets a text back from your number in seconds, day or night
Missed calls, website forms, Google, Facebook, Angi, Thumbtack and lead emails all land in one inbox, and each one gets a
reply from your business number. The reply engine asks your qualifying questions one at a time, hands off to you for
complaints, price haggling or anything unusual, and stops when someone says stop.
**See it:** Inbox. Settings, Connections shows each source and its last lead. Settings, Agent shows the rules.
**Code:** `lib/client-runtime-run.ts` (`draftReply`, missed-call text-back), `lib/client-runtime.ts` (`replySystem`).

## 2. Leads arrive estimate-ready, with a ballpark from your own prices
For fence work the reply engine collects the feet, material, gates, HOA and address before you call, and can share a
ballpark range from your per-foot prices (always a range, always "final after we measure"; you can turn it off).
**See it:** Jobs, any new lead's record. Setup, Prices.
**Code:** `lib/crm.ts` (`intakeRules`, `ballpark`, `cleanDetails`).

## 3. Estimates get booked by text, inside your hours and your calendar
The reply engine offers two open estimate times and books the one the customer picks. The booking page offers the same
times. Times come from your hours, your booking rules and your Google Calendar when it's connected.
**See it:** Calendar. Settings, Connections, Booking page. The first-day setup ends with a practice lead you watch get
answered and booked.
**Code:** `lib/client-booking.ts` (`freeSlots`, `bookingRules`), `lib/client-runtime-run.ts` (`bookingSlots`, `rehearseReply`).

## 4. Measure the fence on a satellite map, and the quote and material list come out of it
Draw the runs, gates and tear-out on the yard. Feet are measured along the ground; posts, rails, pickets and concrete
follow from your fence types; the quote comes out as good, better and best; the material list becomes an order. The
drawing shows on the customer's quote page and in the crew's job.
**See it:** Jobs, a fence job, Measure on the map. Settings, Fence types.
**Code:** `lib/fence.ts` (`takeoff`, `quoteLines`), `app/(client)/app/measure.tsx`. Tested in `test-fence.mjs`.
Needs the Google Maps key (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`).

## 5. 811, permit and HOA paperwork lives on the job and guards the install date
Each fence job tracks the 811 locate ticket ("Locate clears Thursday"), the permit, HOA approval, property pins and the
customer's sign-off on the line. Setting an install date that isn't clear to dig asks first and says why. The crew sees
the ticket and adds photos of the marks.
**See it:** Jobs, a quoted or won fence job, Paperwork.
**Code:** `lib/paperwork.ts` (`digBlockers`, `locateLine`). Tested in `test-paperwork.mjs`.

## 6. Quotes follow up on their own until it's a yes or a no
Once a quote is sent, follow-ups go out on your schedule (2, 5 and 10 days by default, then monthly), and stop the moment
the customer replies, approves or declines. The customer approves and signs from a link; a deposit can hold the date,
paid through your own pay link.
**See it:** Quotes. Settings, Agent, follow-up days.
**Code:** `lib/client-runtime.ts` (`quoteChaseDue`, `QUOTE_TEXTS`), `app/(client)/q/[token]/page.tsx`.

## 7. Moving in takes one sitting, shows you everything first, and can be undone
Connect Jobber and it reads clients, properties, requests, quotes with their lines, jobs and visits, invoices with what's
paid, notes, attachment photos and products. Housecall Pro, ServiceTitan, QuickBooks, any spreadsheet and phone contacts
come in from their files, with the columns matched before anything is written. Before the move you see counts,
duplicates merged (and can undo each merge), customers missing a phone, and a match report with one row per customer:
new, matched to someone already here, merged, or left out and why. The move can be undone for 7 days.
**See it:** Move your business in (More, or Settings, Account).
**Code:** `lib/switch.ts` (`dedupe`, `previewOf`, `matchReport`), `lib/client-switch-run.ts` (`runStep`, `undoImport`,
`importReport`). Tested in `test-switch.mjs`.

## 8. Nothing texts your customers while you move
Open quotes come in with follow-ups off, unpaid invoices with reminders off, and service plans paused. When you're ready,
one button sends each open quote and invoice again with a new link and starts its follow-ups. After 7 days the go-live
list shows what came in that week, so you know when it's safe to cancel the old app.
**See it:** Move your business in, Go live.
**Code:** `lib/client-golive-run.ts` (`openToResend`, `resendOpen`), `lib/switch.ts` (`GOLIVE`).

## 9. The crew has its own phone app, without your money in it
The crew signs in with their cell and sees the schedule and their jobs. They clock in and out (hours land on the job's
labor cost and export as a timesheet), text "on my way", tick checklists, add photos and get the customer's sign-off.
Prices stay hidden unless you turn them on, and your costs never show.
**See it:** sign in as a crew member, Your day. Settings, Account, Crew sees prices.
**Code:** `app/(client)/app/crew.tsx`, `app/api/app/act/route.ts` (the crew's allowed actions).

## 10. Your data stays yours, and you can see who changed what
Export everything gives every record as a spreadsheet and every photo in one zip, right away. The activity log lists the
changes you, your office and your crew make. Leads are never deleted; undoing a move hides what it added. Customers pay
through your own pay link: payments are recorded here, card details never are.
**See it:** Settings, Account (Export everything, Your data is yours, Activity).
**Code:** `app/api/app/export/route.ts`, `lib/records.ts` (`LOGGED`).

---

Coming from Jobber or Housecall Pro? The app has a page that maps their words to this app's screens: More, Coming from
Jobber or Housecall Pro (`app/(client)/app/coming-from.tsx`).
