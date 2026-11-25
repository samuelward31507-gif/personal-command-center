# Cinder design system v1

One set of rules for the website, /software and the CRM. New ideas fit inside these rules; they don't replace them. Change this file first, then the code.

## Look
Dark, quiet and exact. Black, white and greys do the work. Blue is a light source, not a theme: the glow in the 3D unit, the outgoing text bubble, small "leak" and focus markers. Never a button colour, never a gradient wash, never glow behind text.

## Colour (11 tokens)
| Token | Value | Use |
|---|---|---|
| `--bg` | #000 | Page |
| `--s1` `--s2` `--s3` | #0a0a0c #111114 #1a1a1f | Raised surfaces, in order of height |
| `--line` `--line2` | white 8% / 14% | Dividers / outlines of things you can touch |
| `--t1` `--t2` `--t3` | #f4f4f6 #a1a1aa #6e6e78 | Headings and key text / body / labels and captions |
| `--acc` | #4f8cff | The blue light (see Look) |
| `--acc-t` | #93b4ff | Inline text links |

Primary button: white on black. Secondary: outline. That's all the buttons there are.

## Type (7 sizes)
Inter for everything; Geist Mono only for small labels, timestamps and sources.
12 · 14 · 16 · 18 · 24 · 36–56 (section titles) · 48–84 (hero, big numbers, closing).
Headings 600 weight, tight tracking (−0.035em; −0.045em at hero size). Body 16–18 at 1.55–1.6 line height, max ~34em wide.

## Shape
Radius: 6 (tags, small buttons), 10 (buttons, inputs), 16 (cards, panels, screens). Devices (the phone) are objects and keep their own radius.
Spacing on an 8-point grid. Sections are 168px apart on desktop, 104px on phones. Content max width 1200px.

## Sections
One idea per section: a title, at most two sentences, one visual. No section has both a card grid and a visual. The homepage has 7: hero, the problem, the free audit, what we build, the app, who it's for, book the call.

## Motion
One curve: `cubic-bezier(.16,1,.3,1)`. Three durations: 0.2s (hover/press), 0.6s (state changes), 1s (arrivals).
Only transform and opacity animate. Scroll-linked pieces read layout once per frame, then write. No blur, no backdrop-filter, no parallax on text.
Things arrive once and stay; motion answers scroll or a tap, it never loops for attention.
Reduced motion: keep fades, drop movement. Every page holds 60fps at 4x CPU slowdown.

## Words
Plain verbs, sentence case, no exclamation marks. Lead with more jobs, not technology; don't lead with "AI". Every number we show is sourced or labelled as sample data. No invented clients, logos or results.
