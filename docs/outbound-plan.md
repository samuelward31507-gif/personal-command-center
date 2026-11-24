# Outbound: one list, one loop (build plan)

Decided with Sam on 2026-11-21. Build in this order; each part ships on its own. Sam's rules still hold: deploy only when he says "deploy", additive SQL migrations only, never touch migration 0064, never delete leads, cold texts are sent by Sam himself (one tap), LinkedIn is hands-on.

## Where things stand
- Outbound tab (`app/(agency)/crm/outbound`, `app/api/outbound`) is live: Text / LinkedIn / Email columns, loop strip, today's log.
- On the branch, NOT deployed yet: phone layout fix for the loop strip, portable regexes, an `outbound-probe` log line (Melanie at Right Now Fencing should be in the Text queue; check the probe log after deploy, then remove the log line), and Grok prospects carrying email + owner LinkedIn + time zone (`lib/agent-api.ts`, `app/api/agent/prospects`).
- Finding leads moves to Grok's Lister (instructions: the file Sam was sent, "grok-lister-instructions.md"). Claude lead runs stay off.
- Today there are three separate lists: Call mode, the old Outreach page (`contact_outreach`, 6 manual steps), Email autopilot (3 emails). None knows what the others did.

## Part 1: one sequence for every grade-A lead
Reuse `contact_outreach` (no new table; add columns only if needed, in a new additive migration). Steps:

| Day | Step | Channel | Who |
|---|---|---|---|
| 1 | Email 1 (intro) | email | autopilot |
| 1 | Connect request | linkedin | Sam, one tap (only if a profile exists) |
| 1-2 | Call 1 | call | Sam, Call mode |
| 2 | Voicemail text (only if call 1 hit voicemail) | text | Sam, one tap |
| 4 | Email 2 (follow-up) | email | autopilot |
| 6 | Call 2 | call | Sam |
| 7 | First message (only if they accepted) | linkedin | Sam, one tap |
| 10 | Email 3 (last) | email | autopilot |
| 14 | Final call, then park | call | Sam |

- Auto-enroll every grade-A lead (new ones from Grok, plus the ~204 uncalled) at Day 1. Skip a channel the lead has no address for.
- Stop on every channel at once when: meeting booked, a reply sorted as interested (hand to Sam, pause the sequence), not interested, STOP or any opt-out on any channel, wrong number, do-not-contact. One function, called from call outcomes, inbound texts, email reply sync and LinkedIn logging.
- Email autopilot sends only the email step a lead is on (it should read the sequence instead of its own `dueFollowUps`).
- Call mode's list = call steps due today from the sequence, then fresh Day-1 leads.
- Outbound columns read their queues from the sequence (the text column already follows call outcomes; keep its rules).
- The old Outreach page becomes a read-only view of the sequence, or is removed from navigation (ask Sam before deleting the page).

## Part 2: the score (0-100) with a plain reason
- Fit gets a lead on the list (fence or standby generators, 40-600 reviews, 4.0+, installs for homeowners, pays for leads). Signals push it up:
  - reviews saying they never called back / slow to reply (strongest; quote the review, it becomes the call opener)
  - hiring someone to answer phones
  - newly paying for leads (Angi/Thumbtack/HomeAdvisor profile, Google or Local Services ads)
  - generators: a storm or outage in their area this week
  - closed Saturday or Sunday
- Store the score and a one-line reason on the contact (additive column or the notes' first line after "Lead grade"). Grok's Lister writes the signals it saw; scoring itself runs in our code so it's consistent.
- Tiers: 80+ get every channel; 60-79 get the email sequence only and move to Call mode when they click or reply; under 60 are skipped.
- Every touch reuses the same hook (the review, the job post, the after-hours gap) so all channels tell one story.

## Part 3: Call mode ordered by who's interested right now
- `lib/site-track` already logs site visits. Tag links in outreach emails/texts per contact; a click or demo watch moves that lead to the top of Call mode that day with "watched your demo 20 min ago".
- Prospect replies (email, text) push an alert to Sam with a drafted answer; target reply under 5 minutes (and say so on the call: that's the product).

## Part 4: the texting queue (compliant cold SMS)
- Texts are written one at a time to one business, tied to a real touch ("tried calling you today"), sent by Sam from his phone. No blasts, no automated sending.
- Every text: identifies Sam and Cinder, an opt-out line, sent only 9am-8pm in the lead's time zone (existing `quietHoursWarning`). STOP ends every channel.
- Before a text is queued, check the number against the National Do Not Call list (Sam downloads area codes; first five are free) and the internal suppression list.
- Queue UX: after calls, "Send next" opens Messages, then marks sent and loads the next one. About 20 in 3 minutes.

## Part 5: learn what works
- Sunday scoreboard adds meetings per 100 leads by signal (slow-callback reviews, hiring, ads, storms, weekend-closed). Raise or lower the signal weights from the results.
