# Cinder Revenue website: rebuild brief

Written 27 Nov 2026, after a night of eight homepage directions. Sam's decision: restart the site from scratch, light theme, using Attio's site as the template for every page, with Cinder's own content and pictures. This file is the starting point for that rebuild. Read it before touching anything.

## 1. What the site has to do

The promise, in the hero, unchanged: **More jobs from the leads you already get.**

The visitor does not know they have a problem. The page's first job is to show them the problem and what it costs, and its only goal is a booked call.

What Cinder sells, in one sentence: *we find where you're losing jobs, build what fixes it, and it runs without you.* The free audit is the front door. The system is what they pay for. The app is where it lives.

Sam's rules for the homepage:

- No app, CRM or calendar at the very top.
- Educate on the problem before anything else.
- An overview, not a product page. The deep dives live on inner pages.
- Every route leads to "Book your free audit".

## 2. Rules that still stand

- Never deploy to production unless Sam says "deploy". Preview only.
- No prices, tiers, guarantees or discounts on the site.
- No invented testimonials, results, client counts or logos.
- Never "AI receptionist". No voice AI pitched.
- No "!" in copy.
- Sample data in any picture is labelled as sample.
- Show Sam rendered screenshots before anything goes to the preview.
- Do not copy Attio's artwork, product screenshots, logos or wording. Layout, pacing, where colour is used and how sections change are the template; every picture and every sentence is Cinder's.

## 3. The template: how Attio's pages are built

From Sam's two screen recordings (about 140 frames studied).

**Homepage, top to bottom**

1. Small centered headline, one line of support, two small buttons. Large picture directly under it, on a soft tinted ground, with pieces that slide in beside it on the first scroll.
2. A row of logos.
3. A small tinted label, then a two-tone statement: first sentence dark, the rest grey. Left aligned, modest size.
4. A long area with a short list fixed at the left. Each list item has a block on the right: a two-tone statement, one large picture in a pale panel, then two smaller points side by side, each with its own small picture.
5. A centered statement over one picture, cut off by a hard edge into black.
6. The dark stretch: a very large centered title over a simple line motif, a row of five short points, a statement beside a line drawing, a row of icons, one more statement.
7. Hard edge back to white. One large quote in a serif, which fills in word by word as it scrolls.
8. A statement beside four numbers, with a single line graph that draws as you scroll.
9. Customer logos and one customer story.
10. Four dated columns.
11. A dark closing band with one line and two buttons, then the footer.

**Inner pages** share one template: small centered headline over one picture; alternating statement-and-picture blocks; a quote; a grid of related items; the same dark closing band.

**What makes it look clean**

- Text is restrained. The hero headline is one line, about 3% of the screen width tall (roughly 46 to 48 pixels on a 1440 screen); section statements are much smaller. Nothing is 80 pixels.
- One type size per role, repeated exactly.
- Wide margins and the same vertical gap between every section.
- Colour is rare and lives in three places: small tinted labels, details inside the pictures, and one soft tint behind the hero picture. Everything else is black, grey and white.
- Dark sections are used twice only: the core idea and the closing.

## 4. How audit-led agencies structure their pages

A short look at agencies that lead with a free audit for contractors or for automation work. The patterns that repeat:

- **Name the leak in the headline.** "Your website is leaking calls and estimate requests." (contractorleadcheck.pages.dev)
- **Say what the audit uncovers, with money on it.** One contractor audit page lists five areas, "each with a dollar figure on what it's costing you". (webtoro33.pages.dev/free-audit)
- **A "sound familiar?" problem block before any service.** (footbridgemedia.com/free/contractor-website-audit)
- **Three steps: audit, plan, optional build.** The audit finds the highest-impact leaks first, the deliverable is short, and implementation is offered, not assumed. (contractorleadcheck.pages.dev, ask-geoffrey-ai.pages.dev)
- **A small, concrete deliverable.** A one-page audit instead of a thirty-page report. (contractorleadcheck.pages.dev)
- **Low-pressure terms stated plainly.** "30 minutes. No pitch." and "If your site is already strong, we'll tell you." (webtoro33.pages.dev, contractorleadcheck.pages.dev)
- **A bar of proof numbers** (years, contractors served). Cinder has none yet and must not invent any. Sourced industry statistics are the honest substitute.
- **Clarity beats cleverness.** One review of AI agency sites says most fail because they are unclear, and that dark backgrounds with glowing gradients are the look they all share. (veloxthemes.com/blog/ai-automation-agency-website)

Sources:

- https://contractorleadcheck.pages.dev/
- https://webtoro33.pages.dev/free-audit
- https://www.footbridgemedia.com/free/contractor-website-audit
- https://ask-geoffrey-ai.pages.dev/
- https://veloxthemes.com/blog/ai-automation-agency-website

## 5. Proposed homepage: Attio's structure, Cinder's story

| Attio section | Cinder section |
|---|---|
| Hero with one large picture | "More jobs from the leads you already get." Picture: where jobs are lost (not the app). |
| Logo row | The tools Cinder works alongside. |
| Two-tone statement | The problem, in one statement: most lost jobs are lost after the lead comes in. |
| Fixed list with blocks | **The leaks.** One block per place jobs are lost (after-hours calls, slow replies, quotes that go quiet, late invoices, no reviews). Each block: what it is, how you would know, what it costs, with a sourced statistic where one exists. This is the education. |
| Dark stretch | **The free audit.** What it checks, what you get, fifteen minutes. The clock transition lives here. |
| Large quote | Sam's founder quote. |
| Numbers | The three sourced statistics. |
| Four columns | What happens after the call: the plan, the build, it runs, what is left for you. |
| Dark closing band | "Find out what you're missing." and the button. |

Not carried over until they are true: customer logos, a customer story.

## 6. Design decisions to make before building

1. **Typeface.** Attio's site is reported to use Inter with a serif for quotes. Cinder already ships Inter and Geist Mono. Decide on a serif for the quote.
2. **Palette.** Sam's call (27 Nov): use the reference's colours. Sampled from his recording: white ground `#ffffff`; ink about `#17181a`; blue accent about `#266df0`; soft blue tints `#eef1fe` to `#d5dcfa` behind the hero picture; amber `#f0a000` and coral red `#e5484d` for tags and chart segments; green tags for positives. Crimson is no longer the accent.
3. **Pictures.** The current line drawings were made for black and look empty on white. Each needs redrawing for light, with more inside it.
4. **Where the app appears.** Not in the hero. Decide whether it appears lower on the homepage or only on the app page.

## 7. How to build it

- Build one section at a time, starting with the hero. Put each next to the matching Attio frame and compare size and spacing before moving on.
- Write a new stylesheet for the light site. Do not pile more overrides onto `site/assets/home2.css`, which has thirty-six layers from the dark design.
- Check every section at 1440, 1200 and phone width, and ask Sam to judge motion on the preview, since motion cannot be watched from the build environment.
- Homepage first. Inner pages after Sam approves it, one at a time, on the inner-page template.

## 8. Where things are

- Repo: `personal-command-center`, static site in `site/`. Homepage is generated by `python3 design/patch_home.py`, which rewrites `site/index.html`.
- Preview branch: `feat/cinder-minimal-premium-home`. Preview deploys are created through the Vercel connector for project `cinder-revenue-company`.
- Current preview state: a quick light recolour of the dark homepage (pass 36). Sam's verdict: nowhere near the target. Treat it as a placeholder.
- Reusable pieces worth keeping: the eased scroll engine and the clock transition in `site/assets/home2.js`; the real app screens in `site/software.html`.
- `?motion=on` on any homepage URL forces the motion on when the computer asks for reduced motion.
- Running notes for every pass so far: `design/HOMEPAGE_PLAN.md`.

## 9. First piece built

- `design/mock/hero-light.html` is the hero, built from scratch for light and checked next to the reference hero frame. It is a mockup: copy it into `site/` to view it (it loads fonts from `/assets/fonts/`). Not on the preview.
- The hero picture is an audit report for an example business: a five-step drop-off chart, the monthly leak total, and a table of the three leaks with what stops each. Two small cards sit over its edges (a missed call, a quote going cold).

## 10. Second piece built (27 Nov, hero approved by Sam)

- `design/mock/home-light.html` is the hero plus the next three pieces: the tools grid, the one-line problem statement, and the first leak block (after-hours calls). Built by `design/mock/mk_home.py`, which also writes an untracked copy to `site/_home-light.html` for viewing.
- Page frame taken from the reference: `#fafafa` ground below the hero, `#e6e6e6` hairlines, guide lines down both container edges, `#f1f2f5` picture panels, white cards.
- Sizes are set to match the reference at a 1900-wide window and scale down with the window (1440 is the floor for desktop). Checked at 1896, 1440, 1200 and 390.
- The leak block is the pattern for the other four: a two-tone statement, one large picture in a pale panel, a one-line sourced statistic, then "How you'd know" and "What it costs" side by side, each with a small picture.
- Sample numbers agree with the hero's audit report: three unanswered new callers, one in three leads becomes a job, $2,400 average job, $2,400 a month.
- Still open: the hero has no phone layout yet; nav items are placeholders; nothing is wired into `site/index.html`.

## 11. The clock, rebuilt for the light site (27 Nov)

Sam asked for the clock transition back as Cinder's own touch, simpler and in the new style. It is in `design/mock/home-light.html`, after the leaks.

- Where: the point where the page turns dark for the free audit. The reference cuts to black with a hard edge; Cinder scrolls through a clock instead.
- What happens: a centred statement ("Fifteen minutes to find yours.") sits over a small black dial drawn in hairlines. As the section scrolls in, the hand sweeps to fifteen minutes. The section then holds for about one and a third screens while the dial grows until it fills the window, the statement scrolls away, and "It starts with / The free audit" comes up inside it. The dial's inner ring of ticks stays as the line motif around the title. Five short points follow (what the audit checks).
- How: one sticky stage, a `clip-path` circle on the dark layer, an SVG of ticks sized to the same radius, and one eased scroll value. No rings rotating, no frame squaring off, no light flood. The nav turns dark with the page.
- Runs on phones. With reduced motion it is a plain hard edge to a dark band with the dial drawn at fifteen minutes. `?motion=on` forces the motion, `?snap=1` turns the easing off for screenshots.

## 12. All five leaks, and the page on the preview (27 Nov)

- The page so far is on the preview at `/new` (file `site/new.html`, written by `design/mock/mk_home.py`). The old homepage at `/` is untouched.
- All five leak blocks are built on one pattern. The list on the left stays fixed and its highlight follows the block on screen; each item is a link to its block. On a phone the list is a strip under the nav that slides to the active item.
- Pictures: calls by day and hour; time to first reply per lead; quotes on a fourteen-day line with opens and follow-ups; unpaid work by how long it has waited; finished jobs as tiles with the reviews marked.
- Sourced lines: CallRail on the first block, MIT / InsideSales on the second. Quotes, invoices and reviews have none because the site has no sourced figure for them yet.
- Sample numbers agree with the hero report: 71 replies and 58 booked, 19 quotes not signed, $3,100 a month from quotes, 34 finished jobs.

## 13. "Then we build whatever fixes it" (27 Nov)

Sam's point: the page read as a speed-to-lead offer, and Cinder builds across the whole business, websites included.

- New section in the dark stretch, straight after the five audit points. Label "After the audit", statement "Then we build whatever fixes it. Not one product. ..." and a button to `/everything`.
- Beside it, a ring in the clock's tick style with the eight parts of the business around it. An example audit lights three of them (front desk, quotes, after the job, the same three as the hero report). They light when the ring scrolls into view.
- Under it, the eight parts as cells, each one line about the outcome and a link to its page: getting found, front desk, calendar, quotes, money, after the job, team and office, custom. Outcomes, not a feature list.
- Closing line: "The one thing we don't do is run ads." (already on `/everything`).
- No count of builds is stated, and the phone agent is not mentioned, because voice is not being pitched.

## 14. Re-ordered around the audit (27 Nov, Sam: "We're not selling speed to lead. We're selling audits.")

The look stays. The order and the information changed so the page says, from the top, that Cinder audits the whole business and then builds whatever fixes it.

Order on `/new` now:

1. Hero. Headline unchanged (Sam's call, still open). New line under it: "We audit your business for free, find what's costing you jobs and hours, and build the systems that fix it." The audit report now has a fourth finding in hours, not dollars.
2. Tools row.
3. "What we do": "We take your business apart and fix what's costing you. Not one product. ... If a task repeats, AI should be doing it."
4. The clock: "Fifteen minutes, one call." into the dark stretch.
5. Dark: "It starts with / The free audit", then five things the audit covers across the business (calls and messages, quotes and booking, getting paid, work done by hand, getting found).
6. Dark: "How it works". Four steps (the call, the findings, the build, it runs) beside an example findings report with five findings in dollars a month, money waiting and hours a week.
7. Dark: "Then we build whatever fixes it", the ring (five of eight parts lit, matching the findings) and the eight parts.
8. Light: "What an audit finds". The leaks are now examples, and there are six: the five lead leaks plus "Work done by hand".
9. Dark closing band: "Find out what you're missing."

Still to build: founder quote, sourced numbers, footer.

## 15. Custom, a new hero, and the old tools strip (27 Nov)

- **Hero picture.** No longer a report screen. It is the business laid out as the path a job takes (getting found, front desk, calendar, quotes, the work, money, after the job) with the example audit's five findings pinned to the parts they belong to, each with its cost and its fix, and two parts marked "Fine as it is". Totals underneath. On a phone it becomes a list.
- **Headline.** Changed to "Find out what your business is losing." Sam had not answered the question; he said the hero still read as speed to lead. The old line was "More jobs from the leads you already get." Swap it back in `HERO` in `mk_home.py` if he says so.
- **Custom.** Said in four places: under the headline ("systems made for it. Nothing off the shelf."), in "What we do" ("Not one product, and not a template"), in step three of how it works, and in the build statement ("Made for your business, not pulled from a template. No two audits turn up the same list, so no two builds are the same."). The ring now switches between three example audits (fence company, plumber, roofer) that light different parts.
- **Tools.** The grid looked too much like the reference's logo grid. It is the moving strip from the old homepage again, with the logos in their own colours.

## 16. Tools grid back, hero made louder (27 Nov)

- Sam asked for the tools grid back in place of the moving strip. Restored.
- Hero picture, same idea, more in it: the parts of the path are tinted by what the audit found (red for money lost, amber for hours or money waiting, green for fine); each finding card has a large figure and its fix in a green tag; a blue dot travels the path on a loop and each part pulses as it passes; the totals are a dark card that overlaps the bottom-left corner; the ground behind is a deeper blue wash with a faint dot grid.
- Prompts were written for two other chats to carry this look into the personal CRM (`app/(agency)`) and the client app (`app/(client)/app`).

## 17. Split-screen hero, fewer colours (27 Nov)

Sam: the hero had too many colours and he wanted to try a split screen.

- Left half: label, headline on two lines, the line under it, two buttons, and "Free. Fifteen minutes. You keep what we find."
- Right half, on a soft blue wash: one card, the example audit as a list of the seven parts of the business top to bottom, each with what was found, what it costs and the fix. A dashed line joins them and a blue dot travels down it. The totals are a black bar at the bottom of the card.
- Colours in the hero are now ink, grey and one blue. The red, amber and green tints, the floating dark card and the dot grid are gone.
- The previous hero (the horizontal map) is still in `mk_home.py` as `steps` / `TOTAL` but is not placed.

## 18. The homepage, finished pass (27 Nov)

Sam approved the split hero and asked for the fixes from the message check, then to perfect the page before the look goes to the rest of the site.

Order on `/new` now, about a quarter shorter than before:

1. Split hero.
2. Tools grid.
3. "What we do".
4. The clock into the dark stretch: "It starts with / The free audit".
5. "How it works": four steps beside **what ran today** (five things the systems did for the example business, one that needs the owner). The findings report that used to sit here repeated the hero and is gone.
6. "Then we build whatever fixes it": the ring with three example audits, the eight parts, the ads line.
7. "What an audit finds": **three** examples, one about leads (calls nobody answered), one about money (work that isn't paid), one about hours (work done by hand). The other three blocks are still built in `mk_home.py` and are for the inner pages.
8. A booking row straight after the findings: "Yours will be different. That's what the fifteen minutes are for."
9. Founder quote, in a serif, filling in word by word as it scrolls. The words are the ones already on the old homepage.
10. Dark closing band, then the footer.

Cut on purpose: the row of five things the audit covers (a third list of the same parts), and the sourced-numbers section (all three sourced figures are about leads, which is the tilt Sam wanted gone; one of them stays inside the first finding).

Left to do before this replaces the real homepage: prune the unused styles in the generator, move the styles and script into files under `site/assets/`, and write the result to `site/index.html`. Then the inner pages.

## 19. The founder quote moved up (27 Nov)

Sam liked the quote most and asked for it as high as it can go. It now sits straight after the hero and the tools grid, before "What we do". The booking row that stood between the findings and the quote is gone, because the findings now run straight into the closing band and two asks in a row repeated each other.

## 20. The new page is the homepage on the preview (27 Nov)

Sam: build everything on the preview, deploy it all together once the whole site is done. The voice agent page stays on the site; it is only kept off the homepage.

- `design/mock/mk_home.py` now writes `site/index.html` (the homepage), `site/new.html` (the same page, kept so the old link works, marked noindex), `site/assets/light.css` and `site/assets/light.js`. Its `page()` function is the shared shell for every light page: head tags, nav, footer, stylesheet, script, chat.
- Carried over from the old homepage so nothing was lost: description, canonical and social tags, icons and manifest, the skip link, the chat assistant, and `data-cta` on every booking link. Added a phone menu, since the old nav's menus are not in the new nav.
- Not carried over: the bar that slid up from the bottom on phones asking for the booking (the new nav keeps the booking button on screen at all times), and the mega menu listing every build (the nav links to "What we build" instead).
- The old dark homepage is saved at `design/archive/home-dark-pass36.html`. Do not run `design/patch_home.py` again; it would overwrite the new homepage.
- `light.css` still carries styles from earlier heroes that are no longer on the page. Prune before production.

Next: the free audit page, then the rest of the inner pages, all through `page()`.

## 21. First inner page: the free audit (27 Nov)

`site/free-audit.html` is rebuilt on the light look from the same generator. The inner-page pieces now exist as functions in `mk_home.py` and are meant to be reused for every other page: `inner_hero`, `statement`, `cells` (a hairline grid of short points), `split` (statement beside a picture), `faq`, `ask`, plus the dark split and the closing band from the homepage.

Order: centred headline over the audit laid out as a map (the earlier horizontal hero, in ink, grey and one blue) / how it works in three steps / dark "What you leave with" beside the example findings report / "What we look at" in eight cells / "What to bring" beside a card of four rough numbers / questions / "Start with your website" / the booking calendar (the same embedded Cal.com calendar the old page had, now in its light theme) / closing band / footer.

The copy is the old page's, widened from leads to the whole business and with "custom" said once. The old page is in git history.

## 22. Every page gets its own spin (27 Nov)

Sam's rule: the theme is shared, but pages must not be the same few templates repeated. Each page needs its own picture, its own layout and one thing no other page has. The plan to put all the build pages on one template is dropped.

How that is kept honest:

- Shared and never varied: nav, footer, colours, type sizes, hairlines, the closing band.
- Varied on every page: the shape of the top (centred over a picture, split, split reversed), the picture itself (drawn for that page's subject), the order of sections, and one signature block.
- Inner pages are built by `design/mock/mk_pages.py`, which imports the shared pieces from `mk_home.py`, reads the builds' names and copy from `design/build_services.py` without running it, and writes its own stylesheet `site/assets/light-pages.css`.

First three, built to set the level:

| Page | Top | Its own picture | Its one thing |
|---|---|---|---|
| `/everything` | Centred over a board | All 32 builds on one board in eight columns, each a link, ending in a dashed "Yours" | An index that follows you down the page, part by part |
| `/websites` | Split, picture on the left | A phone showing a site with a quote form and open times, three callouts | A table that crosses out what most contractor sites do |
| `/answering` | Centred over a thread | One missed call timed to the second: 9 seconds to reply, 2 minutes to booked | Where calls get missed across one day, then the 78% figure filling a dark band |

Copy on all three is the existing copy from the old pages. Do not run `design/build_services.py`; it would overwrite these with the old dark pages.

### 22b. Second pass after Sam's review (27 Nov)

Sam: go further, every page has to hold the homepage's standard; he likes the founder quote and its setting; the plain list of rows on `/everything` is out, use diagrams.

- Founder quote block (`fq()` in `mk_pages.py`) now appears on inner pages, using only words Sam has actually said. `/everything`: "If it can be automated, it should be automated. If it's a repetitive task, it should be automated." `/websites`: "Everything is custom. It's custom to you. It's custom to your problem. It's not a template." Other pages need a line from Sam before they get one. Never write a quote for him.
- `/everything`: the 32-row index is gone. In its place: one audit picking 4 of 32 (drawn), then the eight parts as a grid of panels, each with its own small picture and its builds as quiet links.
- `/websites`: two phones side by side (most sites, greyed and crossed out, against yours); one visit drawn in four numbered steps on dark; a field that links to the site check. Sign cells, built-in cells and the related row removed.
- `/answering`: the day is now one chart, hour by hour, with a blue "With it" row; Monday report card beside the included list; questions set as a text thread; the related row became a four-step chain. Before/after table removed.
- No two of the three pages now share a section below the top, apart from the closing band and footer.

### 22c. Front desk finished (27 Nov)

Sam approved the level of the second pass. The remaining five front-desk pages are built the same way. Copy is the existing copy in `design/build_services.py` and `design/pages2.py`; nothing new was claimed.

| Page | Top | Its own picture | Its diagram |
|---|---|---|---|
| `/phone-agent` | Split, live call on a dark panel | Call with a transcript and waveform | The call as a fork: books it, or hands off to you; then the call summary |
| `/website-chat` | Centred over a browser window | Site with the chat open at 10 PM | What you give it against what it says, each answer tagged with its source |
| `/social-messages` | Split | Three apps dropping into one inbox | One message, three companies, who replied when |
| `/lead-vetting` | Left-set over a table | This week's leads, sorted | Two lead cards, one booked, one turned away |
| `/after-hours` | Dark, full width | One night on a ruler | Two calls at 2 AM going two ways; the rota; the morning summary |

Questions are shown three ways across the group (cards, fold-out, list, plus the text thread on `/answering`). The nav now turns dark over dark sections on inner pages too. Done so far: home, free audit, everything, websites, and all six front-desk pages. Left: 25 build pages (calendar 4, quotes 3, money 2, after the job 6, getting found 2, team 5, custom 3), then software, trades, story, about, questions, whats-new, audit, privacy, terms, 404.

### 22d. The whole site is on the light look (27 Nov)

Sam, away from his desk: finish every page, same design, each with its own feel; he will review at his computer. All 46 pages in `site/` are now built by `mk_home.py` (home, new, free audit) and `mk_pages.py` (everything else). No old dark page is left. Preview only.

- Build pages, 32 of them: each has its own top, one drawn picture and one diagram no other page uses. Shared across pages: the problem statement, the crossed-out/kept list, three ways of showing questions, the closing band.
- Other pages: the app (drawn app window; what you see beside what the customer sees), trades (tape measure to quote), story (three chapters), about (the founder quote as the picture), questions (all 60, grouped, with the group list following the scroll), what's new (dated list), the site check, privacy, terms, 404.
- Text for privacy, terms, questions and the site check is read from `design/mock/legacy/` (the old pages, saved before replacement) so nothing was retyped. The site-check form and result keep the ids and field names `site/audit.js` uses.
- Founder quote appears only with words Sam has said: `/everything`, `/websites`, `/custom-builds`, `/story`, `/about`.

Open before production:
1. Analytics. Production's homepage loads `/t.js` (anonymous page views and booking clicks). The light pages do not load it. Going live as is would stop the site's analytics. Sam to decide; it is one line in `page()`.
2. Terms page still names the old plans ("Book & Close", "Never Miss a Lead") and a $497 add-on, carried over word for word because it is legal text. It contradicts "no packages" elsewhere. Sam to decide the wording.
3. About page carries "No contract. Month to month, cancel by text with 30 days' notice." from the old page.
4. Not carried over from the old dark pages: the phone booking bar, the mega menu, the 3D/animated scenes.
5. `light.css` still has unused styles from earlier homepage attempts; old dark scripts and styles are still in `site/assets/` but nothing links to them.
6. Nothing was checked in a live browser: stills only. The site check posts to `/api/site-audit` and needs a real run on the preview.

### 22e. Rhythm pass (27 Nov)

Sam on the finished site: "seems like they all follow the same pattern", wants each page custom with different styles for how sections switch; keeping the top relatively the same is fine.

- `RHYTHM` in `mk_pages.py`: one row per build page (30 rows, no two alike, asserted). It sets the running order of the sections below the top, which ones sit on dark, tint or blue, the shape of the statement, line and cells, and how a section hands over to the next: `t-sheet` (rounded sheet sliding over), `t-arc` (curved edge), `t-angle` (slanted edge), `t-rule` (heavy rule), `t-exp` (grows from an inset card to full width as it scrolls in; script in `light.js`, off under reduced motion).
- `restyle()` applies the row after the page is assembled, so page content is untouched. Tops are not changed.
- Not yet done: the same treatment for home-level pages (app, trades, story, about), and any page-to-page transition. If Sam meant the switch between pages rather than between sections, that is still open.

### 22f. Clean pass (27 Nov)

Sam, after the rhythm pass: "Not like different designs, but something like on the first page ... just clean with a small amount of info." Read as the founder quote block on the homepage (he has praised it twice). The rhythm rows are no longer applied.

Every build page except answering, websites, everything and integrations is now five things: its top; the problem set like the homepage quote (serif line, one small sentence under it); its one diagram; its one line set the same way; three questions folded shut; then the closing band. `clean()` in `mk_pages.py` does this after assembly, so the fuller sections (crossed-out lists, numbered points, second pictures, included lists) are still in the file and can be put back per page.

### 22g. Full pass (27 Nov)

Sam, after the clean pass: pages need to be longer, with more information, unique designs, and stronger transitions on some. `full()` in `mk_pages.py` replaces `clean()`:

- Every section a page had before the clean pass is back, and the `RHYTHM` row for the page is applied again (order, surfaces, hand-overs).
- Added from copy that already existed but was never shown on the light pages: the three signs ("How you know you have it", three looks), "What we need from you / What we take care of" (three looks; from `pages2.YW`, shared within a part of the business), the four points or the before/after where a page lacked them, the page's line in the homepage quote setting where it had none, and "Works with the rest" linking to three neighbouring builds.
- Two more scroll-driven hand-overs: `t-wipe` (circle opening from the top, like the homepage clock) and `t-door` (opens from the middle). They sit on the what-we-need section on two pages in three.
- A page no longer repeats its problem headline as its closing line.
- Pages now run roughly 5,000 to 5,800 px tall on desktop, up from about 3,500.

### 22h. Pinned scenes on the most used pages (27 Nov)

Sam: the most useful pages should be much longer and more intricate, with other pages appearing inside them as graphics that build, move and change on scroll; he pointed at the launch page behind the banner at the top of Attio's site (not fetchable from here, so built from his description).

- `stage()` in `mk_pages.py` + a script in `light.js`: a dark stage pins to the screen for five screens of scrolling. Captions sit on the left with a progress line; on the right, one picture at a time, each taken from another page, its rows arriving one by one as you scroll. Clicking a caption jumps to its scene. Under reduced motion or below 981px wide the scenes are stacked, each with its caption.
- `/answering`: "Follow one lead through the business": the missed-call thread, the week calendar (booking), the quote and its check-ins (follow-up), the invoice (invoices), the review ask (reviews). Replaces the old dark "How it works" split.
- `/software`: "What it did while you were on the job": inbox, calendar, open quotes, money owed, Monday report, each linking to its page.
- Candidates for the same treatment next: free audit, everything, websites, home.

### 22i. /day: a page that is only pictures and scroll (27 Nov)

Sam: wants page themes that change colour as you scroll from one "page" to the next, with a visible page change, and fuller pages that are just designs and scroll animations "with clouds in the background or something".

- New page `site/day.html` (noindex, not linked from anywhere yet): "One day, start to finish." A fixed sky behind the page runs dawn, morning, noon, late afternoon, dusk, night as you scroll; a sun crosses and sets, a moon and stars come out, clouds drift at different speeds and change colour with the sky. Six chapters, each pinned: time, one line, one small sentence, a link, and a picture from another page whose rows build as you scroll. Between chapters the screen clears to sky while the colours change. The nav turns dark at dusk and night.
- Lines are existing copy from the build pages; the hero heading and "Scroll through a day at an example business" are new.
- Reduced motion or under 861px: chapters are stacked, the sky still changes colour.
- Code: `chap()`, `SKY`, `DAYP`, `CSS_DAY` in `mk_pages.py`; the `.dayp` script in `light.js`.

### 22j. /day made clean (27 Nov)

Sam on the sky version: he still wants the clean designs from earlier; clouds maybe later, sketched, left out for now; the page should be long and be a design that stays with the screen and animates as you scroll.

`/day` is now white, in the site's clean look. One split screen stays in place for the whole page: on the left, a row of the six times with the current one marked, one line in the homepage quote setting, one small sentence and a link; on the right, a tinted panel that never moves, with the picture inside it changing and building row by row. Six chapters, about 14,000 px of scroll on desktop. The sky, sun, moon, stars and clouds are removed (the sky version is in git at 6e1357e if he wants it back).

### 22k. /day: each chapter made its own (27 Nov)

Sam: looks pretty good; make it as long as needed, with things popping up and changing as you scroll, and make each one custom: a different colourway and a different kind of animation.

- Six chapters, six colourways (peach, blue, amber, mint, lilac, navy), each with its accent on the time marker and the tags.
- Six entrances for the picture: rise, slide in from the right, tilt up from a corner, pop from small, wipe open from the left, drop from above. Rows inside build differently too.
- A large faint time numeral sits behind each picture and drifts as you scroll. Two or three small tags pop in around each picture; each restates something the picture already shows.
- The app page's stage has its own colour (deep indigo), scenes that slide sideways and rows that pop. The app page's second button now goes to `/day`.

### 22l. One side moves, the other stays; more clock-style transitions (27 Nov)

Sam on the coloured version of /day: only one side should move at a time; sometimes the words scroll and the picture stays, sometimes the words stay and the other side is an abstract design (not a product picture) that builds; more transitions like the homepage clock, a few, spread across the site; the coloured panels and the big numerals did not look good. High quality, custom.

- `/day` rebuilt in `mk_pages.py` from three pieces. `words()`: the words scroll past on one side while one picture stays pinned on the other (CSS sticky, no script). `design()`: the words stay while an abstract drawing builds with the scroll: a dial whose rings draw and hand turns, a stack of slabs dropping onto each other, a field of dots filling in (dark). `portal()`: a pinned screen where the next dark section opens out of the light one.
- Colourways, big numerals and pop-in tags removed. Ink, grey and blue on white only.
- Portals placed: `/day` (clock-hand sweep), `/answering` (blinds, into the lead stage), `/software` (rounded square opening, into the app stage), `/everything` (diamond, before the eight parts), `/story` (sweep, chapter two). With the homepage clock that is six across the site.
- All driven by one script in `light.js` that sets `--p` on `[data-sp]` sections; off under reduced motion and below 861px, where everything is stacked and fully drawn.

### 22m. Refinement (27 Nov)

Sam: refine it; the clock-hand sweep transition is too basic, replace it with a real visual; the scroll designs look good, improve them; not every pinned section should be a split screen, some should be the whole screen, for example something coming down the middle.

- Sweep removed. `/day` now uses `pt-line`: a line draws down the centre of the screen with a blue dot at its tip, then opens left and right into the dark screen. `/story` uses `pt-bands`: six bands close in from alternating sides.
- New whole-screen section on `/day`, `spine()`: a line runs down the middle and the six moments of the day branch off it left and right as it passes.
- The dots design is now whole-screen: the field fills the dark screen behind centred words. The stack design is flipped so the drawing is on the left.

### 22n. Line graphs (27 Nov)

Sam sent a screen recording of Attio's architecture page ("i really like this") and asked where line graphs like theirs could go on our site. That page is the reference he could not name earlier ("the pop up link at the top of the page").

What he is responding to there: hairline technical drawings (a curve with dotted drops to the axis, hatching, small square nodes, bracketed mono tags), a serif line beside each, a chapter bar along the bottom, big moments that take the whole screen. Ours are drawn from scratch in that register; nothing is traced or reworded from theirs.

- Kit in `mk_pages.py` (`_lg`, `linefig`, `_g_*`): the plot box is 0..100 both ways, lines are an SVG stretched to the box with non-scaling strokes, and every label, node and hatch is HTML placed by percentage, so text keeps its size on a phone. The solid line is wiped in left to right by `--d`; nodes, drops and tags arrive as it passes. Driven by `[data-in]` on the chart (same enter-progress script as `.t-exp`), so it also draws on phones. Fully drawn without motion.
- Every chart is sample data and is captioned "Sample data, example business". No result is claimed.
- Six charts, each on one page, inserted after `full()` by `figs()`:
  - `/follow-up`: quotes still waiting on an answer, followed up on days 2, 5 and 10 against left alone.
  - `/reviews`: a year of reviews as a stair, every job asked against asked when you remember.
  - `/invoicing` (dark): what one job is owed, reminders, paid, and the wait when nobody asks (hatched).
  - `/reports`: eight weeks of leads in, jobs booked, quotes open.
  - `/answering`: when leads come in across a day, hatched for the hours on a job and the hours closed.
  - `/everything`: one business from lead to paid as a stepped line, the two biggest drops hatched and tagged "Fix this first" / "Then this", with the book button.
- `/day`: the top now sits on graph paper with the day's arc along the bottom and a marker that moves along it as the page starts to scroll. New whole-screen section `dayline()`: the day as one stepped line that climbs each time something is handled, wiped in by the scroll, ending on the 2:07 AM call that rang a person. A chapter bar (`.chb`, The day / Morning / Afternoon / Evening / Night) is fixed along the bottom from the spine onward, shows where you are, and jumps on click; hidden below 1000px.
- Not done: the homepage and `/free-audit` were left alone (approved). The audit chart is the obvious candidate for both; needs Sam's OK.

### 22o. Transitions like the clock, colour-wash bands, monotone (27 Nov)

Sam: the transitions are still weak; he wants the clock's recipe (an image you go through that opens on the next screen) with other images, Attio's colour-wash chapter bands that then go back to normal, and drawings that are black, white and grey.

- `portal(kind, label, line, title)` rebuilt. Each is an object that does its job, then its dark body becomes the next screen: `sheet` (an invoice writes itself and totals, unfolds sideways, opens; /day), `bubble` (a reply is typed, 0:00 to 0:09; /answering), `grid` (32 tiles fill and close up; /everything), `app` (the app icon is pressed and opens; /software). Line, bands, blinds, diamond and iris removed.
- Script: portals are smoothed (lerp, like the clock) and get `--a` (act one), `--g` (grow, exponential), `--f` (fade), `--t` (title) and an optional counter (`.pt-n`). Portals now also run on phones; other pinned sections still do not.
- `wash(kind, tag, title)`: three colour-wash bands (a, b, c) with grain. On /day the first band rises over the pinned spine (`data-cv`). /story chapters are now bands.
- Monotone: dial, stack, dots, spine, day-line and hero marker are ink and grey only; no blue or red in drawings. Charts slimmed (thinner line, smaller nodes and tags, 540px max).

### 22p. Sam's notes on 22o (27 Nov)

- Bands looked exactly like Attio's. Now our own: a straight colour wash under fluted vertical ribs (`--rib`), three palettes.
- Stack of slabs replaced by a thin-line drawing: follow-ups as arcs hopping along a baseline (Sent, Day 2, Day 5, Day 10, Monthly).
- Dial redrawn in hairlines: tick ring, dotted inner rings, one drawn arc, a hand with a square tip.
- Day-line is a smooth line graph, no steps; labels sit under the line to the right of each point.
- (Later, same day) Sam: the ribs still read as Attio's and he does not want lines. Bands are now a clean "ash and ember" wash: warm paper and grey with one ember glow from an edge (a from below, b deeper from below, c from the right). No ribs, no rainbow.
- (Later still) Sam: the ember wash "still feels the same". The feel was the blurred gradient with centred type, not the colours. Bands are now flat colour panels (cream, clay, ash) with a hairline sun on a ruled horizon (rising, setting, overhead) and left-aligned type. No gradients, no grain.
- (Final for now) Sam: keep the bands plain, no drawings; only the colour scheme must differ from Attio's. The sun panels were dropped. Bands are plain soft washes again, centred type, in a cool silver and slate scheme (a silver and ice, b slate and violet-grey, c pale silver). `_sun()` is unused.

### 22q. Homepage top rebuilt; motion no longer gated (27 Nov)

- Sam: the homepage top is weak and does not read as the homepage; he likes Attio's layout but not a CRM screen. New top (`.hm` in `mk_home.py`): centred pill, one very large headline, sub, two buttons, then a full-width "Free audit" window in the hairline style: seven parts of the business down the left, "Where the jobs went" as one line (100, 71, 58, 39, 34) with the two biggest drops hatched and tagged, three "fix first" findings on the right, the three totals along the bottom. Same sample numbers as before. It draws once on load.
- Sam could not see any scroll motion: his system has reduce-motion on, and every scroll effect was switched off for it. Scroll-driven effects now run regardless; `?motion=off` turns them off. The one auto-rotating block still respects the setting.

### 22r. Homepage, top to bottom, first pass (27 Nov)

Sam approved the new top. Changes he asked for: Mac window buttons (red, yellow, green); the dark sections' pictures redone simple and colourless; the eight parts were cluttered, extend the page and let them open; more motion. He asked whether to keep the black totals bar under the window: removed (the same figures are already in the window).
- "What ran today" is now a hairline timeline (`.tml`) that draws as it scrolls in.
- The ring, the example tabs and the eight-cell grid are gone. `.pb` is one pinned screen: words stay left, the eight parts ink in on the right and each opens its one line in turn; each row links to its page.
- (Later) Sam: the dark sections still felt crammed. Opened up, one idea per screen. `.hv`: statement, then the four steps along one drawn line; the "what ran today" timeline is gone from the homepage. `.pv`: statement on its own, then a pinned screen showing one of the eight parts at a time in very large serif with its line and eight ticks; plain list on phones.
- (Later) Sam: no slideshow of words. `.pv` is now a split pinned screen: eight thin rings build outward in layers on the left (one per part, each drawn differently), and the eight names scroll through on the right like a wheel with the current one lit and its line shown. Rows link to their pages again.
- (Later) Sam circled the fine vertical lines behind Attio's dark "Connectivity" section: "I like these lines… want to add things like this in". Added our own pinstripe (1px every 7px, about 7% white, fading out from the middle) behind `.hv`, the top of `.pv`, and the pinned parts screen.
- (Later) Sam: add the overall line work from the same Attio screenshot. Dark homepage sections now have side rules on the container, a ruled strip of cells (`.rsp`) between blocks with small nodes at its corners, and a dashed centre line with a node on the pinned parts screen.
- (Later) Sam: pinstripes only at the top and bottom of a section, like Attio's; the rings-and-wheel version of the eight parts looked tacky. Pinstripes now fade out 230px from each end and stay inside the frame. Eight parts: a quiet list on the left with a marker that steps down it, and on the right eight thin plates set down one on another, the current one bright, with its one line under the drawing. The centre dashed line is gone.
- (Later) Sam: the page needs a reason for each thing being where it is; unsure whether to go back to copying Attio's layout. Homepage reordered into one argument: top (promise and the audit), tools row (fits what you use), the problem (statement and three leaks, moved up from the end), what we do, the clock into the free audit, how it works, what gets built, the founder quote (moved down), the ask. Recommendation given: keep Attio's look and section types, not its order, because Attio sells to people who already know they need a CRM and we have to show the problem first.
- (Later) Sam pointed back at the Attio recording: the dark "This is what we've always been building" run (a statement alone, then big words and short paragraphs scrolling with a lot of space past a drawing that builds in layers) and the light row of tiles above it. Ours: `.hq` "How it works" is light again, four tiles of 25 small squares that go from scattered to in order, one per step, now placed before the clock. `.pv` opens on "Then we build whatever fixes it." alone, then the eight parts scroll past as large serif names with their lines well below, while the plates stack on the right (sticky). Order: top, tools, problem, what we do, how it works, clock, what gets built, quote, ask.
- (Later) Sam wants the layered drawing closer to the one in the Attio recording, "different but similar". Plates are now drawn as flat squares, each with its own pattern (dot grid, rings, ruled lines, joined nodes), and laid over with a CSS matrix: the first starts face-on as a dotted panel and tips into place, the rest set down above it, each tagged with its part's name while current.

### 22s. Hero satellites and page-to-page fade (27 Nov)

Sam sent two Attio homepage screenshots: past the top, their window steps back and three small Mac windows come out at the sides with live content. Ours: `.hm-x[data-sp]` pins the audit window for about a screen; it scales to 0.8 and three small windows (`.hm-q`) come out from behind it and fill in line by line: a missed call and the text back, a dark "what ran today" log, an invoice from finished to paid. Same sample data as elsewhere. Off below 861px. Also added a cross-page fade with the View Transitions rule (`@view-transition{navigation:auto}`), which browsers without it ignore.
- (Later) Sam: it looks good but can't look identical to Attio's. The three small windows are no longer Mac windows: they are square-cornered call-outs with a mono tag and the finding's name ([Fix 01] Quotes, [Fix 02] Front desk, [Fix 03] Calendar), each joined to the audit window by a leader line ending in a square node, and each showing that finding fixed.
