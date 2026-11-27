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
