# Cinder client app: design spec, fifth pass

Status: draft for Sam's OK. Nothing here is built yet. Build order is at the end.

The fourth pass got the materials right (the command center's colors, type, 32px controls, the Attio grid). What it
did not do is compose the screens. Every screen is a stack of equal boxes, the same number appears in three places,
six status colors compete with the one accent, and the main table truncates nearly every cell. This pass fixes the
composition, not the tokens.

## What I saw (1440x900, demo data)

| Screen | Problem |
| --- | --- |
| Today | Seven bordered panels above the fold. "Your move", the reason the owner opens the app, starts halfway down. Reply speed shows three times (kicker, the 8s box, the 9s stat). Setup progress takes a full panel for one remaining step. |
| Jobs | Four stat boxes repeat the four group headers right below them. Nine columns at 1440 means nearly every cell ends in an ellipsis and the last column runs off the edge. Inline buttons of different widths in Next step make a ragged edge. Five chip colors for stages plus rainbow avatars. |
| Record | Floats over half the table. The conversation is styled like iMessage: blue bubbles are the strongest color on screen. "Auto-reply" is printed on every message. The composer stacks three cramped rows. |
| Inbox | Same rainbow chips and avatars. The list row carries four facts in two colors before the message preview. |
| Settings, Connections | Lead sources, outbound tools and a log all in one long scroll. No single place that says "these are connected, this one is not". Ads have no native path (Facebook only via Zapier, Google Ads lead forms missing). |

## Principles

1. **One job per screen, one focal point.** Today: what needs you. Jobs: what's in play and what's next. Record: this
   customer and the next action. Inbox: who said what.
2. **Say each fact once.** If a number is in a header, it is not also in a box above it.
3. **One accent.** Ember marks "your turn", focus and the one primary action per screen. Green and red appear only for
   money (paid, late). Stages are text with a neutral 6px dot, not colored chips. Avatars are one neutral tint.
4. **Fewer containers.** Lists sit on the white window, separated by hairlines. Panels only where content is truly
   separate (the right rail on Today). No card-in-panel-on-wash.
5. **Nothing important truncates.** Columns are chosen for the width. Secondary columns live behind a Columns menu and
   appear on their own at 1600px and up.
6. **Contrast through weight and color, not size.** Page title 20px semibold. Body 13px. Labels 12px in grey-2.
   Figures tabular.
7. **Conversation is a log, not a phone.** Left-aligned rows with author and time, no bubbles.

## Tokens

Keep `app/(client)/tokens.css` as ported from `cinder.css` (ink #1c1d1f, greys #505967 / #6f7988 / #9aa3b0, hairlines
#eeeff1 / #e6e7ea, 32px controls, radius 8, shadows navy). Changes:

- Remove the stage tone map from tables and boards. New `.stg` = 6px dot + text. Dot greys: new #9aa3b0, booked #6f7988,
  quoted #505967, won #1c1d1f, lost #d3d8df. Your-turn rows get an ember dot before the name instead.
- `.vc` chips stay only for money state: Paid (green), Late (red), Draft (grey).
- Avatars: one tint (#eef0f3 background, #505967 initials). Business logo is the only color in the rail.
- Conversation: `.log-row` replaces `.bubble`. Owner and Cinder messages get a #fafafb wash, customer messages none.

## Today

```
+ rail ----+---------------------------------------------------------+----------------------+
| Today    | Sunday, November 16                   [Find  K] [+ Lead] |  This month          |
| Inbox  3 | 3 things need you, $13,250 on them                       |  Won        $37,500  |
| Calendar |                                                          |  Quotes out $24,850  |
|          | Overnight: 4 leads answered, 2 estimates booked,         |  Owed        $6,100  |
| Records  | $3,400 in quotes came back. [Text me this at 6]          |  Book rate      34%  |
| ...      | -------------------------------------------------------- |  First reply     9s  |
|          | o Derek W. emailed, no phone          Thumbtack [Add phone]|  -------------------|
|          | o Henderson family, invoice 2 days late   $8,600   [Open] |  Pipeline            |
|          |   Lena Ortiz keeps looking at the quote   $7,800  [Nudge] |  [====|===|==|=]     |
|          |   ...                                                    |  New 1  Booked 3 ... |
|          | -------------------------------------------------------- |  -------------------|
|          | Today                                                    |  Ask                 |
|          | 8:00  Carla Mendez, install, 905 Cherry St      [Route]  |  [ Ask anything... ] |
+----------+----------------------------------------------------------+----------------------+
```

- Your move is the first thing under the title. Ember dot on rows that are a person waiting.
- Overnight summary becomes one sentence, not four boxes.
- The numbers move to a quiet right rail: label left, figure right, hairline between, no sparklines.
- Setup progress leaves Today. While setup is unfinished it is one line at the bottom of the rail ("1 step left").
- Removed: the 8s speed box, the duplicate first-reply stat, the stat-box row.

## Jobs (built first)

```
+ rail ----+----------------------------------------------------------------------------------+
| Jobs     | Jobs  7 open, $42,950 in play            [Table|Board] [Columns] [Import] [+ Lead] |
|  Open  7 | [Search]  [Stage v] [Source v]                                Sorted by last activity |
|  Won   3 | ---------------------------------------------------------------------------------- |
|  All  12 | Your move  3, $13,250                                                              |
|          | [ ] o Tom Becker        Needs a reply           140 ft cedar       ~$5,800   Booked   Today  [Reply]|
|          | [ ]   Henderson family  Invoice 2 days late     220 ft, 6 ft       $8,600    Won      9 d    [Remind]|
|          | Waiting on the customer  2, $20,200                                                |
|          | [ ]   Lena Ortiz        Opened the quote 3h ago 160 ft, 6 ft       $7,800    Quoted   6 d          |
+----------+----------------------------------------------------------------------------------+
```

- Stat boxes removed. Group headers carry count and sum.
- Default columns at 1440: Customer, Next step, Job, Value, Stage, Age, action. Profit, Came from, Crew, Waiting are
  in Columns and show by default from 1600px.
- The action column is fixed 96px, one ghost button, solid only on your-turn rows. Same width every row.
- Customer cell: name only. Town goes in the record and the Job cell's tooltip.
- Board: same cards, neutral; stage header shows count and sum; the card footer keeps the next step.

## Record (built with Jobs)

From 1280px the record is a split view, not an overlay: the list narrows to Customer and Next step (360px) and the
record takes the rest. Below 1280 it stays the floating panel. On a phone it is a full screen.

```
+ list 360 ------------+---------------------------------------------------------------+
| o Tom Becker   Reply  | Tom Becker                         [Call] [Text] [Quote] [...] |
|   Henderson   Remind  | (720) 555-0177, 2210 Oak Dr, Littleton                         |
|   Lena Ortiz          | Booked > [Quoted] > Won        Needs a reply                   |
|                       | ---------------------------------------+---------------------- |
|                       | Activity   Job   Files                 | Job                   |
|                       | Today                                   | 140 ft, 6 ft cedar    |
|                       | Cinder  3:11  Hi Tom, this is Ridgeline | Value  ~$5,800        |
|                       | Tom     3:21  2210 Oak Dr, Littleton    | Source Web form       |
|                       | Cinder  3:22  For about 140 ft ...      | Crew   Luis           |
|                       | Tom     3:39  Do you offer financing?   | Money                 |
|                       | -------------------------------------- | Quote  not sent       |
|                       | [Text Tom...                 ] [Send]   | Photos (3)            |
+-----------------------+-----------------------------------------+-----------------------+
```

- Conversation as a log: author, time, text. Cinder's messages labeled "Cinder" once per run, not on every line.
- Composer is one row. Saved replies open with "/" or the snippet button, not a strip of truncated chips.
- Stage is a segmented path in the header, clickable.

## Inbox

Three panes as now. List row: ember dot if it's your turn, name, time on the right; second line the last message in
grey. Source and status move to the conversation header. Lead emails without a phone sit at the top in the same row
style, with "No phone" as grey text, not a chip.

## Connections (new home for lead sources)

A rail item under Settings, or the first Settings view, that answers "is everything connected?" in one table.

```
Connections   9 of 11 connected. Every connected source answered in under 10 seconds this week.

Source                      Status                            Last 30 days   Last lead
Speed-to-lead agent         Connected, replying and booking   41 leads       12m ago     [Settings]
Missed-call text-back       Connected, (720) 555-0100          19             40m ago    [Test]
Website form                Connected                          12             5h ago     [Test] [Copy]
Website chat                Connected                          2              6d ago     [Copy snippet]
Facebook and Instagram ads  Connected                          8              2d ago     [Test]
Google Ads lead forms       Needs setup                        -              -          [Connect]
Google Local Services       Needs setup                        -              -          [Connect]
Angi                        Connected                          8              2d ago     [Test]
Thumbtack                   Error: no lead in 14 days          3              15d ago    [Fix]
Lead emails                 Connected                          4              1h ago     [Copy address]
Booking page                Connected                          5              1d ago     [Open]
```

- Status is derived from real events only (a lead arrived, a test passed, a webhook failed). Never assumed.
- Each row opens a drawer with the steps, the address or snippet, a Send a test button and that source's log.
- Outbound tools (texting number, Google Calendar, QuickBooks, Jobber, pay link) move to their own "Tools" view.

## Phone

Same rules. Bottom tabs Today, Inbox, Jobs, Quotes, More. Lists are 56px two-line rows. Record full screen with the
action bar pinned at the bottom (Call, Text, Quote).

## Build order and checkpoints

1. Jobs table + board + record split view. Screenshots at 1440x900 and 390x844, self-critique against this spec and
   the design rules, show Sam. Wait for OK.
2. Today.
3. Inbox.
4. Connections.
5. Quotes, Invoices, Plans, Calendar, Customers, Settings, phone pass.
6. One stylesheet sweep: delete rules nothing uses, `npm test`, type check, commit. No deploy until Sam says deploy.
