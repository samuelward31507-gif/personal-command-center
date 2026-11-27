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
