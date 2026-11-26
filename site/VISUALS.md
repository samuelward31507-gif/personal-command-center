# Cinder site: visual build brief (for Codex)

You are the visual engineer for cinderrevenue.com, a site for Cinder Revenue Company. We audit service businesses (contractors), then fix what's costing them jobs.

The site is a static folder: `site/`. It has no build step. three.js 0.160 loads through an import map in each page's `<head>`. Read `site/DESIGN.md` first.

Your job is every 3D and moving visual on the site: build the missing ones, and rebuild the weak ones to one standard. Page layouts and copy are owned by someone else. Don't rewrite copy or restructure sections, except where this brief says so.

## The standard: the six-layer teardown (`assets/cinder-unit.js`)

This is the only visual the owner loves. Open the homepage, scroll the "What's inside" section, and study it before you build anything. Every visual you ship must be at its level, or it doesn't ship. Here's what makes it work, as rules:

1. **Scroll scrubs it continuously.** Every pixel of scroll moves something. It's fully reversible: scroll up and it plays backward, frame-exact. No time-based transitions that fire at a step and then play on their own. (V6 broke this rule: it jumps between four poses on a timer, so it "doesn't move with the scroll".)
2. **A physical object that transforms.** It comes apart, assembles, opens, slides, stacks, docks or rotates. The mechanics tell the story. No flat panels of text pretending to be a UI. (V5 reads as "too basic, fake": a sheet of labels with a scanner line.)
3. **It fills the frame.** The object takes 60–80% of its stage at rest. No big empty areas around a small object. (V12 is "too much white space": a small phone in a big empty stage.)
4. **Machined materials.** Brushed aluminum, graphite, smoked glass, rubber gaskets, steel fasteners. Crimson (`#d4142a` / `#ff2a3a`) appears only as a small "live" accent. Black page, so the canvas is transparent.
5. **Studio light.** RectAreaLights plus a PMREM card environment, soft PCF shadows, GTAO, SMAA, and still-frame accumulation when idle. Copy the stack from `cinder-unit.js` and `cinder-slab.js`.
6. **Very little text.** Short engraved labels at most. Any sample numbers or names on an object are labeled "Example business · sample data".
7. **Steady camera.** Frame from the resting pose. Never jump or re-zoom when something highlights.
8. **Reduced motion.** Scroll-driven motion always plays. Under `prefers-reduced-motion`, remove only idle loops, pointer tilt and smoothing.
9. **Performance.** 60fps on a mid-range phone in a lite mode (no GTAO or accumulation, a smaller shadow map). Render only when something changes. Pause offscreen. Handle WebGL context loss. Full cleanup in `destroy()`.

**Never reuse a visual.** Every slot on the site gets its own object and concept. Different pages share a family look (materials, light, crimson accent), never the same model.

## How a visual plugs in

- One file per visual: `site/assets/cinder-<name>.js`, an ES module.
- It exposes `window.Cinder<Name> = { mount(el), setProgress(p /*0..1*/), destroy() }`.
- When it loads, it dispatches `window.dispatchEvent(new Event('cinder-visual'))`.
- On system pages, `assets/scenes.js` mounts it into `.sx-host` inside `<section data-scene="Cinder<Name>">`. It calls `setProgress` from the section's scroll position.
- Do not expose `setStep`. If you do, scenes.js switches to step mode, and step mode is banned (rule 1).
- Load the module in the page: `<script type="module" src="/assets/cinder-<name>.js"></script>`. Remove the script tag of the visual it replaces if that page no longer uses it.
- On the homepage, sections are driven by the inline script at the bottom of `index.html` (look for `auditReady`, `phoneReady`, `backReady`). Keep those hooks working, or switch them to `setProgress` as needed.
- Self-host three.js: vendor three@0.160.0 (`three.module.min.js` plus the addons you use) into `site/assets/vendor/three/`, and point every page's import map there instead of the CDN.

## Work list, in order (top of the homepage first)

### Phase 1: homepage (`index.html`)

| # | Slot | Now | What to build |
|---|---|---|---|
| B | Backdrops: every `[data-backdrop] .backdrop` on every page (`assets/cinder-field.js`) | Flat red strips that barely move. Owner: "weak", wants "actual visuals in the back that look really cool". | Replace the backdrop engine. Keep the API `CinderField.mount(el,{variant,seed,calm,intensity})`. Give it a distinct, rich, always-moving scene per page (same family, different design per page), driven by both time and scroll: e.g. machined fins under raking light, slow-turning graphite turbines, a field of milled panels catching a moving light. Text must stay readable on top, so keep the center calm. No glow, blur or "AI" haze. Cheap enough to sit behind other WebGL. |
| H0 | Hero, `.hb-stage` (the app screenshot) | A static screenshot | **V2, the hero object.** The first thing people see. It assembles into the product as the page loads, then reacts to the first scroll. |
| H3 | `#problem`, the console (`cinder-slab.js`, V4) | Barely moves. Owner: "overall frame needs more movement". | Keep the concept: lines of a missed call → reply → booked → reminder. Make the whole frame move with scroll: cards slide in and dock, the console tilts as each event lands, mechanisms engage. |
| H4 | `#audit`, the audit panel (`cinder-audit.js`, V5) | "Too basic, fake" | New physical concept for "we inspect your business": e.g. a machined instrument with five gauges or chambers that open one by one as you scroll, each showing pass or leak, and a final readout that docks. No text sheet. |
| H5 | `#app`, the phone (`cinder-phone.js`, V12) | "Don't really like this, too much white space" | Fill the stage. A large, close phone that comes in at an angle and fills the frame, its screen live, with the events stacking. Or a better concept that shows "it runs on its own". |
| H6 | `#back`, outcomes (`cinder-back.js`, V6) | "Doesn't move with the scroll" | Rebuild as continuous `setProgress`, scrubbed by how far you are through the four `.gets` lines (more jobs, less time on the phone, evenings back, one place). The homepage script currently calls `setStep`; change it to send progress. |

**Stop after Phase 1** and open a PR so the owner can review it.

### Phase 2: system pages (each replaces a borrowed visual)

| # | Page | Section | Concept seed (yours to improve) |
|---|---|---|---|
| V7 | `answering.html` | `data-scene` (now the borrowed console) | A call coming in and getting answered: a handset or cradle mechanism, a reply leaving within seconds. Must differ from H3. |
| V8 | `booking.html` | (now the borrowed unit) | A machined calendar block or rotary scheduler: a time slot gets cut, picked and locked in. |
| V9 | `follow-up.html` | (now the borrowed unit) | A quote ledger or cam timer that clicks through day 2, 5 and 10, then monthly, until "yes". |
| V10 | `reviews.html` | (now the borrowed unit) | A star dial or counter that fills, five machined stars seating one by one. |
| V11 | `websites.html` | (now the borrowed unit) | The site in layers: a page exploding into header, quote form, reviews and booking, then reassembling. Must not look like the six-layer unit. |

### Phase 3

| # | Page | What to build |
|---|---|---|
| V14 | `software.html` (`data-scene="CinderApp"`, currently has no visual: `.sx.wait`) | The app as an object, walking through Today, Leads, Calendar and Money. Remove the `wait` class once it's live. Must differ from H0 and H5. |
| V13 | `free-audit.html` (`data-scene="CinderDial"`, `.sx.wait`) | The audit dial: a precision dial that sweeps the five checks and lands on "what to fix first". Must differ from H4. |

## Hard rules

- **Copy:** no new claims, numbers, results, testimonials, prices, guarantees or logos. Never the word "AI". No "!".
- **Sample data:** names and amounts on objects are fictional and labeled "Example business · sample data".
- **Off limits:** `app/`, `lib/`, `supabase/` and anything outside `site/`, except reading.
- **Data:** no credentials, keys or tokens anywhere. No real prospect or client data.
- **Git:** work on a new branch `codex/visuals` off `feat/cinder-minimal-premium-home`, and open PRs into `feat/cinder-minimal-premium-home`. Never touch `main` or `production`. Never deploy.
- **Testing:** for each visual, check that it renders (Playwright plus SwiftShader works: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), that scrolling forward and back is frame-exact, that there are no console errors, and that it works at 390px and 1440px. Attach screenshots at rest, mid-scroll and end to the PR.
- **PR description:** one short paragraph per visual. Include what you couldn't verify, e.g. frame rate on a real phone.
