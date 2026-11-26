# Cinder design system v2

One set of rules for the website, /software and the CRM. New ideas fit inside these rules; they don't replace them. Change this file first, then the code.

## Look
Dark, quiet and exact. Black, graphite and warm white do the work. Crimson is the one accent, used only for live moments: the glow in the 3D unit, the missed call, leaks, the active part, a soft light behind the closing. Never a button colour, never on body text.

## Colour (11 tokens)
| Token | Value | Use |
|---|---|---|
| `--bg` | #000 | Page |
| `--s1` `--s2` `--s3` | #0b0b0c #111113 #1c1c1f | Raised surfaces, in order of height |
| `--line` `--line2` | warm white 8% / 14% | Dividers / outlines of things you can touch |
| `--t1` `--t2` `--t3` | #f2f1ee #a3a19d #6f6d69 | Headings and key text / body / labels and captions |
| `--acc` | #d4142a | Crimson: leaks, missed call, active state |
| `--acc-hi` | #ff2a3a | Crimson light: the unit's glow, live dots |

Primary button: warm white on black. Secondary: outline. That's all the buttons there are. Links are white with an underline, not coloured.

## Type (7 sizes)
Inter for everything; Geist Mono only for small labels, timestamps and sources.
12 · 14 · 16 · 18 · 24 · 36–56 (section titles) · 48–84 (hero, big numbers, closing).
Headings 600 weight, tight tracking (−0.035em; −0.045em at hero size). Body 16–18 at 1.55–1.6 line height, max ~34em wide.

## Shape
Radius: 6 (tags, small buttons), 10 (buttons, inputs), 16 (cards, panels, screens). Devices (the phone) are objects and keep their own radius.
Spacing on an 8-point grid. Sections are 168px apart on desktop, 104px on phones. Content max width 1200px.

## Sections
One idea per section: a title, at most two sentences, one visual. Sections alternate between two layouts so the page never repeats one trick:
- Overlay: centered, full-width statement over a visual or light.
- Split: words on one side, the visual on the other.

Homepage: 1 hero (overlay), 2 what we fix, the unit comes apart (split), 3 every missed call (overlay) + the phone thread, 4 the free audit (split), 5 then we fix it, over the app (overlay), 6 what you get back (split), 7 book the audit (overlay).

## Motion
One curve: `cubic-bezier(.16,1,.3,1)`. Three durations: 0.2s (hover/press), 0.6s (state changes), 1s (arrivals).
Only transform and opacity animate. Scroll-linked pieces read layout once per frame, then write. No blur, no backdrop-filter, no parallax on text.
Things arrive once and stay; motion answers scroll or a tap, it never loops for attention.
Reduced motion: keep fades, drop movement. Every page holds 60fps at 4x CPU slowdown.

## Words
Plain verbs, sentence case, no exclamation marks. The whole message: we audit your business, then we fix what's costing you jobs. Sell the outcome (more jobs, less time on the phone, evenings back, one place for everything), never the technology. No feature lists, no "AI" in headlines. Every number we show is sourced or labelled as sample data. No invented clients, logos or results.
